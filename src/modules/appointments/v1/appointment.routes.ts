import express from 'express';
import { Roles } from '../../../constants/roles.js';
import { auth, authorizeRoles } from '../../../middleware/authorization.middleware.js';
import { validateRequest } from '../../../middleware/validation.middleware.js';
import { appointmentDetail, bookAppointment, listAppointments } from './appointment.controller.js';
import { appointmentIdSchema, appointmentListSchema, bookingSchema, requestSourceGuard } from './appointment.validation.js';

export const appointmentRouterV1 = express.Router();
appointmentRouterV1.use(auth, authorizeRoles(Roles.USER));
appointmentRouterV1.post('/', requestSourceGuard, validateRequest(bookingSchema), bookAppointment);
appointmentRouterV1.get('/', requestSourceGuard, validateRequest(appointmentListSchema), listAppointments);
appointmentRouterV1.get('/:id', requestSourceGuard, validateRequest(appointmentIdSchema), appointmentDetail);
