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

export const adminDoctorRouterV1 = express.Router();
adminDoctorRouterV1.use(auth, authorizeRoles(Roles.ADMIN));
adminDoctorRouterV1.post('/', validateRequest(createDoctorSchema), createDoctorController);
adminDoctorRouterV1.get('/', validateRequest(adminDoctorListSchema), listDoctorsController);
adminDoctorRouterV1.get('/:id', validateRequest(doctorIdSchema), getDoctorController);
adminDoctorRouterV1.patch('/:id', validateRequest(doctorIdSchema.concat(doctorProfileUpdateSchema)), updateDoctorController);
adminDoctorRouterV1.delete('/:id', validateRequest(doctorIdSchema), deleteDoctorController);
