import { Request, Response } from 'express';
import { sendSuccess } from '../../../shared/api-response.js';
import { AppointmentService } from './appointment.service.js';
import { BookingInput } from './appointment.types.js';
import { PublicDoctorService } from '../../doctors/v1/public-doctor.service.js';

export async function browseDoctors(req: Request, res: Response): Promise<void> {
    const query = req.query as Record<string, string>;
    sendSuccess(res, await PublicDoctorService.list({
        search: query.search, branchId: query.branchId, specialtyId: query.specialtyId,
        ...(query.isAvailable === undefined ? {} : { isAvailable: query.isAvailable.toLowerCase() === 'true' }),
    }, { page: Number(query.page ?? 1), limit: Number(query.limit ?? 10) }));
}

export async function publicDoctorDetail(req: Request, res: Response): Promise<void> {
    sendSuccess(res, { doctor: await PublicDoctorService.get(req.params.id) });
}

export async function doctorAvailability(req: Request, res: Response): Promise<void> {
    const query = req.query as { from: string; to: string };
    sendSuccess(res, await AppointmentService.availability(req.params.id, query.from, query.to));
}

export async function bookAppointment(req: Request, res: Response): Promise<void> {
    sendSuccess(res, { appointment: await AppointmentService.book(req.user.id, req.body as BookingInput) }, 201);
}

export async function listAppointments(req: Request, res: Response): Promise<void> {
    const query = req.query as Record<string, string>;
    sendSuccess(res, await AppointmentService.list(req.user.id, { doctorId: query.doctorId, status: query.status },
        { page: Number(query.page ?? 1), limit: Number(query.limit ?? 10) }));
}

export async function appointmentDetail(req: Request, res: Response): Promise<void> {
    sendSuccess(res, { appointment: await AppointmentService.get(req.user.id, req.params.id) });
}
