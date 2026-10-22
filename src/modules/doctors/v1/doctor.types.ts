import { DoctorModel } from './model/doctor.model.js';

export type DoctorInput = Pick<DoctorModel,
    'userId' | 'branchId' | 'specialtyId' | 'name' | 'appointmentPrice' | 'currency' | 'appointmentDurationMinutes'> &
    Partial<Pick<DoctorModel, 'biography' | 'isActive' | 'isAvailable'>>;
