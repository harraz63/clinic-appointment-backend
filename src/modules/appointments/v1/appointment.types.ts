import { AppointmentModel } from './model/appointment.model.js';

// Internal persistence input: services derive ownership and booked snapshots.
export type AppointmentInput = Pick<AppointmentModel, 'customerId' | 'doctorId' | 'branchId' | 'startsAt' | 'endsAt' | 'timezone' | 'durationMinutes' | 'bookedPrice' | 'currency'>;
