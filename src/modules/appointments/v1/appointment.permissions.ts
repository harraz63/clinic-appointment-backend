import { Roles, Role } from '../../../constants/roles.js';
import { HttpResponseError } from '../../../utils/appError.js';

export interface AppointmentActor {
    id: string;
    role: Role;
}

export interface AppointmentOwnership {
    customerId: string;
    doctorUserId: string;
}

export type AppointmentAction = 'view' | 'confirm' | 'complete' | 'no_show' | 'cancel' | 'reschedule';

// Supply ownership loaded by the service, never ownership IDs taken from request bodies.
export function assertAppointmentPermission(actor: AppointmentActor, appointment: AppointmentOwnership, action: AppointmentAction): void {
    if (actor.role === Roles.ADMIN) return;
    if (actor.role === Roles.DOCTOR && appointment.doctorUserId === actor.id &&
        ['view', 'confirm', 'complete', 'no_show'].includes(action)) return;
    if (actor.role === Roles.USER && appointment.customerId === actor.id &&
        ['view', 'cancel', 'reschedule'].includes(action)) return;
    throw new HttpResponseError(403, 'You do not have permission to perform this action');
}
