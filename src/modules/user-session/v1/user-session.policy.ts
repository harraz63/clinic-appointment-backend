import { StatusCodes } from 'http-status-codes';
import { HttpResponseError } from '../../../utils/appError.js';
import { UserModel } from '../../user/v1/model/user.model.js';
import { UserSessionModel } from './model/user-session.entity.js';

export function assertActiveSession(user: UserModel | null, session: UserSessionModel | null): void {
    if (!user || !session || session.userId !== user.id || !session.expiresAt || session.expiresAt.getTime() <= Date.now()) {
        throw new HttpResponseError(StatusCodes.UNAUTHORIZED, 'Invalid or expired token');
    }
    if (user.isBlocked) throw new HttpResponseError(StatusCodes.FORBIDDEN, 'Account is blocked');
}

