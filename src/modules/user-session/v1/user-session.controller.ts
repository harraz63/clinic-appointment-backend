import { StatusCodes } from 'http-status-codes';
import { UserSessionService } from './user-session.service.js';
import { Request, Response } from 'express';


export async function updateFCMTokenController(req: Request, res: Response): Promise<void> {
    const { fcmToken } = req.body;
    const sessionId = req.userSession.id.toString();
    await UserSessionService.updateFCMToken(sessionId, fcmToken);
    res.status(StatusCodes.NO_CONTENT).send();
}