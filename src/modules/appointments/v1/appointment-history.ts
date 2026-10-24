import { Transaction } from 'sequelize';
import { AppointmentActor } from './appointment.permissions.js';
import { AppointmentModel } from './model/appointment.model.js';
import { AppointmentHistoryModel, AppointmentSnapshot, HistoryAction } from './model/appointment-history.model.js';

export function appointmentSnapshot(appointment: AppointmentModel): AppointmentSnapshot {
    return {
        status: appointment.status, startsAt: appointment.startsAt.toISOString(), endsAt: appointment.endsAt.toISOString(),
        branchId: appointment.branchId, timezone: appointment.timezone, durationMinutes: appointment.durationMinutes,
        bookedPrice: appointment.bookedPrice, currency: appointment.currency,
    };
}

export async function recordAppointmentHistory(appointment: AppointmentModel, actor: AppointmentActor, action: HistoryAction,
    before: AppointmentSnapshot | null, transaction: Transaction): Promise<void> {
    await AppointmentHistoryModel.create({ appointmentId: appointment.id, actorId: actor.id, actorRole: actor.role,
        action, occurredAt: new Date(), before, after: appointmentSnapshot(appointment) }, { transaction });
}
