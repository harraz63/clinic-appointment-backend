import express from 'express';
import { Roles } from '../../../constants/roles.js';
import { auth, authorizeRoles } from '../../../middleware/authorization.middleware.js';
import { validateRequest } from '../../../middleware/validation.middleware.js';
import { appointmentDetail, bookAppointment, listAppointments } from './appointment.controller.js';
import { appointmentIdSchema, appointmentListSchema, bookingSchema, requestSourceGuard } from './appointment.validation.js';
import { appointmentHistory, cancelAppointment, changeAppointmentStatus, rescheduleAppointment, staffAppointmentDetail, staffAppointmentList } from './appointment.controller.js';
import { adminAppointmentListSchema, adminStatusSchema, appointmentHistorySchema, doctorAppointmentListSchema, doctorStatusSchema, rescheduleSchema } from './appointment.validation.js';

export const appointmentRouterV1 = express.Router();
appointmentRouterV1.use(auth, authorizeRoles(Roles.USER));
appointmentRouterV1.post('/', requestSourceGuard, validateRequest(bookingSchema), bookAppointment);
appointmentRouterV1.get('/', requestSourceGuard, validateRequest(appointmentListSchema), listAppointments);
appointmentRouterV1.get('/:id', requestSourceGuard, validateRequest(appointmentIdSchema), appointmentDetail);
appointmentRouterV1.get('/:id/history', requestSourceGuard, validateRequest(appointmentHistorySchema), appointmentHistory);
appointmentRouterV1.patch('/:id/cancel', requestSourceGuard, validateRequest(appointmentIdSchema), cancelAppointment);
appointmentRouterV1.patch('/:id/reschedule', requestSourceGuard, validateRequest(rescheduleSchema), rescheduleAppointment);

export const doctorAppointmentRouterV1 = express.Router();
doctorAppointmentRouterV1.use(auth, authorizeRoles(Roles.DOCTOR));
doctorAppointmentRouterV1.get('/', requestSourceGuard, validateRequest(doctorAppointmentListSchema), staffAppointmentList);
doctorAppointmentRouterV1.get('/:id', requestSourceGuard, validateRequest(appointmentIdSchema), staffAppointmentDetail);
doctorAppointmentRouterV1.get('/:id/history', requestSourceGuard, validateRequest(appointmentHistorySchema), appointmentHistory);
doctorAppointmentRouterV1.patch('/:id/status', requestSourceGuard, validateRequest(doctorStatusSchema), changeAppointmentStatus);

export const adminAppointmentRouterV1 = express.Router();
adminAppointmentRouterV1.use(auth, authorizeRoles(Roles.ADMIN));
adminAppointmentRouterV1.get('/', requestSourceGuard, validateRequest(adminAppointmentListSchema), staffAppointmentList);
adminAppointmentRouterV1.get('/:id', requestSourceGuard, validateRequest(appointmentIdSchema), staffAppointmentDetail);
adminAppointmentRouterV1.get('/:id/history', requestSourceGuard, validateRequest(appointmentHistorySchema), appointmentHistory);
adminAppointmentRouterV1.patch('/:id/status', requestSourceGuard, validateRequest(adminStatusSchema), changeAppointmentStatus);
adminAppointmentRouterV1.patch('/:id/reschedule', requestSourceGuard, validateRequest(rescheduleSchema), rescheduleAppointment);
