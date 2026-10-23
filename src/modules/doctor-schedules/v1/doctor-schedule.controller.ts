import { Request, Response } from 'express';
import { sendSuccess } from '../../../shared/api-response.js';
import { DoctorScheduleService, ExceptionInput, WorkingInterval } from './doctor-schedule.service.js';

export async function getWeeklySchedule(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await DoctorScheduleService.getWeekly(req.params.id));
}

export async function putWeeklySchedule(req: Request, res: Response): Promise<void> {
    const body = req.body as { intervals: WorkingInterval[] };
    sendSuccess(res, await DoctorScheduleService.replaceWeekly(req.params.id, body.intervals));
}

export async function listScheduleExceptions(req: Request, res: Response): Promise<void> {
    const { from, to } = req.query as unknown as { from: string; to: string };
    sendSuccess(res, await DoctorScheduleService.listExceptions(req.params.id, from, to));
}

export async function putScheduleException(req: Request, res: Response): Promise<void> {
    sendSuccess(res, await DoctorScheduleService.setException(req.params.id, req.params.date, req.body as ExceptionInput));
}

export async function deleteScheduleException(req: Request, res: Response): Promise<void> {
    await DoctorScheduleService.deleteException(req.params.id, req.params.date);
    sendSuccess(res, null);
}
