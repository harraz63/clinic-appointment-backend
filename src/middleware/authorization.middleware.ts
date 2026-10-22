import passport from 'passport';
import { NextFunction, Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { HttpResponseError } from '../utils/appError.js';
import { UserModel } from '../modules/user/v1/model/user.model.js';
import { UserSessionModel } from '../modules/user-session/v1/model/user-session.entity.js';
import { Role } from '../constants/roles.js';
import { assertActiveSession } from '../modules/user-session/v1/user-session.policy.js';

declare module 'express' {
    interface Request {
        user?: UserModel;
        userSession?: UserSessionModel;
    }
}

export const auth = (req: Request, res: Response, next: NextFunction): void => {
    passport.authenticate('jwt-access', { session: false }, (
        err: unknown, user: UserModel | false, session: UserSessionModel | null
    ) => {
        try {
            if (err || !user) throw new HttpResponseError(StatusCodes.UNAUTHORIZED, 'Invalid or expired token');
            assertActiveSession(user, session);
            req.user = user;
            req.userSession = session;
            next();
        } catch (error) {
            next(error);
        }
    })(req, res, next);
};

export const authorizeRoles = (...allowedRoles: Role[]) => {
    return (req: Request, res: Response, next: NextFunction): void => {
        if (!req.user || !allowedRoles.includes(req.user.role)) {
            throw new HttpResponseError(StatusCodes.FORBIDDEN, 'You do not have permission to perform this action');
        }
        next();
    };
};
