import { DoctorScheduleModel } from './model/doctor-schedule.model.js';

export type DoctorScheduleInput = Pick<DoctorScheduleModel, 'doctorId' | 'weekday' | 'startTime' | 'endTime'>;
