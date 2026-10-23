import { DoctorModel } from './model/doctor.model.js';

export type DoctorProfileInput = Pick<DoctorModel,
    'branchId' | 'specialtyId' | 'name' | 'appointmentPrice' | 'appointmentDurationMinutes'> &
    Partial<Pick<DoctorModel, 'biography' | 'currency' | 'isActive' | 'isAvailable'>>;

export interface CreateDoctorInput extends DoctorProfileInput {
    phone: string;
    accountName: string;
    password: string;
}
