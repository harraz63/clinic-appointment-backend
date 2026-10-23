import express from 'express';
import { Roles } from '../../../constants/roles.js';
import { auth, authorizeRoles } from '../../../middleware/authorization.middleware.js';
import { validateRequest } from '../../../middleware/validation.middleware.js';
import {
    createDoctorController,
    deleteDoctorController,
    getDoctorController,
    listDoctorsController,
    updateDoctorController,
} from './doctor.controller.js';
import { adminDoctorListSchema, createDoctorSchema, doctorIdSchema, doctorProfileUpdateSchema } from './doctor.validation.js';
import {
    deleteScheduleException, getWeeklySchedule, listScheduleExceptions, putScheduleException, putWeeklySchedule,
} from '../../doctor-schedules/v1/doctor-schedule.controller.js';
import {
    exceptionDateSchema, exceptionRangeSchema, rejectScheduleSourceCollisions, replaceScheduleSchema, scheduleDoctorIdSchema, setExceptionSchema,
} from '../../doctor-schedules/v1/doctor-schedule.validation.js';

export const adminDoctorRouterV1 = express.Router();
adminDoctorRouterV1.use(auth, authorizeRoles(Roles.ADMIN));
adminDoctorRouterV1.post('/', validateRequest(createDoctorSchema), createDoctorController);
adminDoctorRouterV1.get('/', validateRequest(adminDoctorListSchema), listDoctorsController);
adminDoctorRouterV1.get('/:id/schedules', rejectScheduleSourceCollisions, validateRequest(scheduleDoctorIdSchema), getWeeklySchedule);
adminDoctorRouterV1.put('/:id/schedules', rejectScheduleSourceCollisions, validateRequest(replaceScheduleSchema), putWeeklySchedule);
adminDoctorRouterV1.get('/:id/schedule-exceptions', rejectScheduleSourceCollisions, validateRequest(exceptionRangeSchema), listScheduleExceptions);
adminDoctorRouterV1.put('/:id/schedule-exceptions/:date', rejectScheduleSourceCollisions, validateRequest(setExceptionSchema), putScheduleException);
adminDoctorRouterV1.delete('/:id/schedule-exceptions/:date', rejectScheduleSourceCollisions, validateRequest(exceptionDateSchema), deleteScheduleException);
adminDoctorRouterV1.get('/:id', validateRequest(doctorIdSchema), getDoctorController);
adminDoctorRouterV1.patch('/:id', validateRequest(doctorIdSchema.concat(doctorProfileUpdateSchema)), updateDoctorController);
adminDoctorRouterV1.delete('/:id', validateRequest(doctorIdSchema), deleteDoctorController);
