import { Temporal } from '@js-temporal/polyfill';
import { Op, WhereOptions } from 'sequelize';
import { Roles } from '../../../constants/roles.js';
import { AppointmentStatusValue } from '../../../constants/appointment-status.js';
import { sequelize } from '../../../database/db-config.js';
import { PaginationOptions } from '../../../shared/catalog-query.types.js';
import { HttpResponseError } from '../../../utils/appError.js';
import { DoctorModel } from '../../doctors/v1/model/doctor.model.js';
import { requireEligibleDoctor } from '../../doctors/v1/public-doctor.service.js';
import { UserModel } from '../../user/v1/model/user.model.js';
import { AppointmentModel } from './model/appointment.model.js';
import { AppointmentHistoryModel } from './model/appointment-history.model.js';
import { AppointmentAction, AppointmentActor, assertAppointmentPermission } from './appointment.permissions.js';
import { assertLifecyclePolicy } from './appointment.policy.js';
import { appointmentSnapshot, recordAppointmentHistory } from './appointment-history.js';
import { isExclusionViolation, loadAvailability } from './appointment.service.js';

export interface StaffAppointmentFilter {
    doctorId?: string; customerId?: string; branchId?: string; status?: AppointmentStatusValue; from?: string; to?: string;
}
interface AppointmentPage<T> { items: T[]; page: number; limit: number; total: number; totalPages: number }

async function actorScope(actor: AppointmentActor): Promise<WhereOptions> {
    if (actor.role === Roles.ADMIN) return {};
    if (actor.role === Roles.USER) return { customerId: actor.id };
    if (actor.role === Roles.DOCTOR) {
        const doctor = await DoctorModel.findOne({ where: { userId: actor.id } });
        if (doctor) return { doctorId: doctor.id };
        throw new HttpResponseError(404, 'Appointment not found');
    }
    throw new HttpResponseError(403, 'You do not have permission to perform this action');
}

export class AppointmentLifecycleService {
    static async get(actor: AppointmentActor, id: string): Promise<AppointmentModel> {
        const appointment = await AppointmentModel.findOne({ where: { [Op.and]: [{ id }, await actorScope(actor)] } });
        if (!appointment) throw new HttpResponseError(404, 'Appointment not found');
        return appointment;
    }

    static async list(actor: AppointmentActor, filter: StaffAppointmentFilter, pagination: PaginationOptions): Promise<AppointmentPage<AppointmentModel>> {
        const { from, to, ...fields } = filter;
        const where: WhereOptions = { [Op.and]: [await actorScope(actor), fields, ...(from || to ? [{ startsAt: {
            ...(from ? { [Op.gte]: new Date(from) } : {}), ...(to ? { [Op.lt]: new Date(to) } : {}),
        } }] : [])] };
        const { rows: items, count: total } = await AppointmentModel.findAndCountAll({ where,
            limit: pagination.limit, offset: (pagination.page - 1) * pagination.limit, order: [['startsAt', 'ASC'], ['id', 'ASC']] });
        return { items, ...pagination, total, totalPages: Math.ceil(total / pagination.limit) };
    }

    static async history(actor: AppointmentActor, id: string, pagination: PaginationOptions): Promise<AppointmentPage<AppointmentHistoryModel>> {
        await this.get(actor, id);
        const { rows: items, count: total } = await AppointmentHistoryModel.findAndCountAll({ where: { appointmentId: id },
            attributes: ['id', 'action', 'occurredAt', 'actorRole', 'before', 'after'],
            limit: pagination.limit, offset: (pagination.page - 1) * pagination.limit, order: [['occurredAt', 'ASC'], ['id', 'ASC']] });
        return { items, ...pagination, total, totalPages: Math.ceil(total / pagination.limit) };
    }

    static async change(actor: AppointmentActor, id: string, action: Exclude<AppointmentAction, 'view'>, startsAt?: string): Promise<AppointmentModel> {
        // Unlocked scoped read discovers immutable ownership IDs. Acquire booking locks before the appointment lock.
        const initial = await this.get(actor, id);
        try {
            return await sequelize.transaction(async transaction => {
                await UserModel.findByPk(initial.customerId, { transaction, lock: transaction.LOCK.UPDATE });
                const context = action === 'reschedule' ? await requireEligibleDoctor(initial.doctorId, transaction, 409) : null;
                const doctor = context?.doctor ?? await DoctorModel.findByPk(initial.doctorId, { transaction, lock: transaction.LOCK.UPDATE });
                const appointment = await AppointmentModel.findByPk(id, { transaction, lock: transaction.LOCK.UPDATE });
                if (!doctor || !appointment || appointment.customerId !== initial.customerId || appointment.doctorId !== initial.doctorId ||
                    (actor.role === Roles.USER && appointment.customerId !== actor.id) ||
                    (actor.role === Roles.DOCTOR && doctor.userId !== actor.id)) {
                    throw new HttpResponseError(404, 'Appointment not found');
                }
                assertAppointmentPermission(actor, { customerId: appointment.customerId, doctorUserId: doctor.userId }, action);
                assertLifecyclePolicy(actor, appointment, action, new Date());
                const before = appointmentSnapshot(appointment);
                if (action === 'reschedule') {
                    if (!context.doctor.isAvailable) throw new HttpResponseError(409, 'Doctor is unavailable for booking');
                    const instant = Temporal.Instant.from(startsAt);
                    const target = new Date(instant.epochMilliseconds);
                    if (target.getTime() === appointment.startsAt.getTime()) throw new HttpResponseError(409, 'Appointment already uses this slot');
                    const date = instant.toZonedDateTimeISO(context.branch.timezone).toPlainDate().toString();
                    const availability = await loadAvailability(context, date, date, new Date(), transaction, id);
                    const slot = availability.days[0].slots.find(item => item.startsAt === target.toISOString());
                    if (!slot || target.getTime() <= Date.now()) throw new HttpResponseError(409, 'Appointment slot is no longer available');
                    const endsAt = new Date(slot.endsAt);
                    const conflict = await AppointmentModel.findOne({ where: { id: { [Op.ne]: id }, customerId: appointment.customerId,
                        status: { [Op.ne]: 'cancelled' }, startsAt: { [Op.lt]: endsAt }, endsAt: { [Op.gt]: target } }, transaction });
                    if (conflict) throw new HttpResponseError(409, 'Customer has an overlapping appointment');
                    assertLifecyclePolicy(actor, appointment, action, new Date());
                    await appointment.update({ startsAt: target, endsAt, branchId: context.branch.id, timezone: context.branch.timezone,
                        durationMinutes: context.doctor.appointmentDurationMinutes }, { transaction });
                } else {
                    const status = { confirm: 'confirmed', complete: 'completed', no_show: 'no_show', cancel: 'cancelled' }[action];
                    await appointment.update({ status }, { transaction });
                }
                await recordAppointmentHistory(appointment, actor, action, before, transaction);
                return appointment;
            });
        } catch (error) {
            if (isExclusionViolation(error)) throw new HttpResponseError(409, 'Appointment overlaps an existing booking');
            throw error;
        }
    }
}
