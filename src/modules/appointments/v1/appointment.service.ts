import { Temporal } from '@js-temporal/polyfill';
import { Op, Transaction, WhereOptions } from 'sequelize';
import { Roles } from '../../../constants/roles.js';
import { sequelize } from '../../../database/db-config.js';
import { HttpResponseError } from '../../../utils/appError.js';
import { PaginationOptions } from '../../../shared/catalog-query.types.js';
import { DoctorScheduleModel } from '../../doctor-schedules/v1/model/doctor-schedule.model.js';
import { ScheduleExceptionModel } from '../../doctor-schedules/v1/model/schedule-exception.model.js';
import { EligibleDoctor, requireEligibleDoctor } from '../../doctors/v1/public-doctor.service.js';
import { UserModel } from '../../user/v1/model/user.model.js';
import { AppointmentModel } from './model/appointment.model.js';
import { assertAvailabilityRange, AvailabilityDay, generateSlots } from './availability.js';
import { BookingInput } from './appointment.types.js';
import { recordAppointmentHistory } from './appointment-history.js';

export interface AvailabilityResult { timezone: string; durationMinutes: number; days: AvailabilityDay[] }

export async function loadAvailability(context: EligibleDoctor, from: string, to: string, now: Date, transaction?: Transaction, excludeId?: string): Promise<AvailabilityResult> {
    const { doctor, branch } = context;
    assertAvailabilityRange(from, to, branch.timezone, now);
    const fromDate = Temporal.PlainDate.from(from);
    const toDate = Temporal.PlainDate.from(to).add({ days: 1 });
    const start = new Date(fromDate.toZonedDateTime(branch.timezone).epochMilliseconds);
    const end = new Date(toDate.toZonedDateTime(branch.timezone).epochMilliseconds);
    const [weekly, exceptions, busy] = await Promise.all([
        DoctorScheduleModel.findAll({ where: { doctorId: doctor.id }, transaction }),
        ScheduleExceptionModel.findAll({ where: { doctorId: doctor.id, date: { [Op.between]: [from, to] } }, transaction }),
        AppointmentModel.findAll({ where: {
            ...(excludeId ? { id: { [Op.ne]: excludeId } } : {}),
            doctorId: doctor.id, status: { [Op.ne]: 'cancelled' }, startsAt: { [Op.lt]: end }, endsAt: { [Op.gt]: start },
        }, transaction }),
    ]);
    const days = generateSlots({ from, to, timezone: branch.timezone, durationMinutes: doctor.appointmentDurationMinutes,
        now, weekly: doctor.isAvailable ? weekly : [], exceptions: doctor.isAvailable ? exceptions : [], busy });
    return { timezone: branch.timezone, durationMinutes: doctor.appointmentDurationMinutes, days };
}

export function isExclusionViolation(error: unknown): boolean {
    if (!error || typeof error !== 'object') return false;
    if ('code' in error && error.code === '23P01') return true;
    return 'original' in error && !!error.original && typeof error.original === 'object' &&
        'code' in error.original && error.original.code === '23P01';
}

export class AppointmentService {
    static async availability(doctorId: string, from: string, to: string): Promise<AvailabilityResult> {
        return loadAvailability(await requireEligibleDoctor(doctorId), from, to, new Date());
    }

    static async book(customerId: string, input: BookingInput): Promise<AppointmentModel> {
        try {
            return await sequelize.transaction(async transaction => {
                const customer = await UserModel.findByPk(customerId, { transaction, lock: transaction.LOCK.UPDATE });
                if (!customer || customer.role !== Roles.USER || customer.isBlocked) {
                    throw new HttpResponseError(403, 'You do not have permission to perform this action');
                }
                const context = await requireEligibleDoctor(input.doctorId, transaction, 409);
                if (!context.doctor.isAvailable) throw new HttpResponseError(409, 'Doctor is unavailable for booking');
                const now = new Date();
                const instant = Temporal.Instant.from(input.startsAt);
                const date = instant.toZonedDateTimeISO(context.branch.timezone).toPlainDate().toString();
                const availability = await loadAvailability(context, date, date, now, transaction);
                const startsAt = new Date(instant.epochMilliseconds);
                const slot = availability.days[0].slots.find(item => item.startsAt === startsAt.toISOString());
                if (!slot || startsAt.getTime() <= Date.now()) throw new HttpResponseError(409, 'Appointment slot is no longer available');
                const endsAt = new Date(slot.endsAt);
                const conflict = await AppointmentModel.findOne({ where: {
                    customerId, status: { [Op.ne]: 'cancelled' }, startsAt: { [Op.lt]: endsAt }, endsAt: { [Op.gt]: startsAt },
                }, transaction });
                if (conflict) throw new HttpResponseError(409, 'Customer has an overlapping appointment');
                const appointment = await AppointmentModel.create({
                    customerId, doctorId: context.doctor.id, branchId: context.branch.id,
                    startsAt, endsAt, timezone: context.branch.timezone,
                    durationMinutes: context.doctor.appointmentDurationMinutes, bookedPrice: context.doctor.appointmentPrice,
                    currency: context.doctor.currency, status: 'confirmed',
                }, { transaction });
                await recordAppointmentHistory(appointment, { id: customerId, role: Roles.USER }, 'booked', null, transaction);
                return appointment;
            });
        } catch (error) {
            if (isExclusionViolation(error)) throw new HttpResponseError(409, 'Appointment overlaps an existing booking');
            throw error;
        }
    }

    static async list(customerId: string, filter: { doctorId?: string; status?: string }, pagination: PaginationOptions): Promise<{
        items: AppointmentModel[]; page: number; limit: number; total: number; totalPages: number;
    }> {
        const where: WhereOptions = { customerId, ...(filter.doctorId ? { doctorId: filter.doctorId } : {}), ...(filter.status ? { status: filter.status } : {}) };
        const { rows: items, count: total } = await AppointmentModel.findAndCountAll({
            where, limit: pagination.limit, offset: (pagination.page - 1) * pagination.limit,
            order: [['startsAt', 'DESC'], ['id', 'ASC']],
        });
        return { items, ...pagination, total, totalPages: Math.ceil(total / pagination.limit) };
    }

    static async get(customerId: string, id: string): Promise<AppointmentModel> {
        const appointment = await AppointmentModel.findOne({ where: { id, customerId } });
        if (!appointment) throw new HttpResponseError(404, 'Appointment not found');
        return appointment;
    }
}
