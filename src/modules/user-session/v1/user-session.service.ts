import { StatusCodes } from 'http-status-codes';
import { HttpResponseError } from '../../../utils/appError.js';
import { UserSessionModel } from './model/user-session.entity.js';
import './model/associate-models.js'


export class UserSessionService {
    static async updateFCMToken(sessionId: string, fcmToken: string): Promise<void> {
        const session = await UserSessionModel.findByPk(sessionId);
        if (!session) {
            throw new HttpResponseError(StatusCodes.NOT_FOUND, 'User session not found');
        }
        session.fcmToken = fcmToken;
        await session.save();
    }
}
