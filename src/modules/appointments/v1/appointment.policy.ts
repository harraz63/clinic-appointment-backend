import { AppointmentStatusValue } from '../../../constants/appointment-status.js';
import { Roles } from '../../../constants/roles.js';
import { HttpResponseError } from '../../../utils/appError.js';
import { AppointmentAction, AppointmentActor } from './appointment.permissions.js';

export function assertLifecyclePolicy(actor: AppointmentActor, appointment: { status: AppointmentStatusValue; startsAt: Date },
    action: Exclude<AppointmentAction, 'view'>, now: Date): void {
    const future = appointment.startsAt.getTime() > now.getTime();
    const open = appointment.status === 'pending' || appointment.status === 'confirmed';
    const allowed = action === 'confirm' ? appointment.status === 'pending' && future :
        action === 'complete' || action === 'no_show' ? appointment.status === 'confirmed' && !future :
            action === 'cancel' ? open && (future || actor.role === Roles.ADMIN) : open && future;
    if (!allowed) throw new HttpResponseError(409, 'Appointment action is not allowed in its current state or time');
}
