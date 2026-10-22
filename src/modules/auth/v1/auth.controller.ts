import { StatusCodes } from 'http-status-codes';
import { Request, Response } from 'express';
import { AuthService } from './auth.service.js';
import { UserModel } from '../../user/v1/model/user.model.js';
import { UserService } from '../../user/v1/user.service.js';
import passport from 'passport';
import { HttpResponseError } from '../../../utils/appError.js';
import { googleClient } from '../../../config/google-client.js';
import { UserSessionModel } from '../../user-session/v1/model/user-session.entity.js';
import { errorLogger } from '../../../config/logger.config.js';
import { env } from '../../../config/env.js';
import { sendSuccess } from '../../../shared/api-response.js';


export async function loginController(req: Request, res: Response): Promise<void> {
    const { provider, password } = req.body;

    const { user, accessToken, refreshToken } = await AuthService.login(provider, password);

    sendSuccess(res, {
        user: user.toJSON(),
        accessToken,
        refreshToken,
    });
}

export async function registerController(req: Request, res: Response): Promise<void> {
    const user = await AuthService.register(req.body);
    sendSuccess(res, { user }, StatusCodes.CREATED);
}

export async function refreshTokenController(req: Request, res: Response): Promise<void> {
    const { refreshToken } = req.body;
    const { accessToken, newRefreshToken } = await AuthService.refreshToken(refreshToken);

    sendSuccess(res, {
        accessToken,
        refreshToken: newRefreshToken,
        expiresAt: accessToken.expiresAt
    });
}

export const googleWebAuth = passport.authenticate('google', { scope: ['profile', 'email'] });

export const googleAuthCallback = [
    passport.authenticate('google', { failureRedirect: '/', session: false }),
    async (req: Request, res: Response) => {
        if (!req.user) {
            throw new HttpResponseError(StatusCodes.UNAUTHORIZED, 'Google authentication failed');
        }

        const session = await UserSessionModel.create({
            userId: req.user.id
        });

        const [accessToken, refreshToken] = await Promise.all([
            req.user.generateAuthToken(session.id.toString()),
            req.user.generateRefreshToken(session.id.toString())
        ]);

        sendSuccess(res, {
            accessToken,
            refreshToken,
            user: req.user.toJSON()
        });
    }
];


export async function googleMobileAuthController(req: Request, res: Response): Promise<void> {
    try {
        const { idToken } = req.body;

        // Verify Google ID token
        const ticket = await googleClient.verifyIdToken({
            idToken,
            audience: env.MOBILE_GOOGLE_CLIENT_ID ?? env.GOOGLE_CLIENT_ID,
        });

        const payload = ticket.getPayload();
        if (!payload?.email || !payload?.sub || !payload?.name) {
            throw new HttpResponseError(StatusCodes.UNAUTHORIZED, 'Invalid Google token payload');
        }

        const provider = payload.email;
        const name = payload.name;

        // Find or create user (similar to your existing Google strategy)
        let user = await UserService.getUserByProvider(provider);

        if (!user) {
            user = await UserService.createUser({
                provider,
                googleId: payload.sub,
                name,
                isVerified: true,
                password: undefined,
            });

        }

        if (user.isBlocked) throw new HttpResponseError(StatusCodes.FORBIDDEN, 'Account is blocked');

        const session = await UserSessionModel.create({
            userId: user.id
        });

        // Generate tokens
        const [accessToken, refreshToken] = await Promise.all([
            user.generateAuthToken(session.id.toString()),
            user.generateRefreshToken(session.id.toString()),
        ]);

        sendSuccess(res, {
            user,
            accessToken,
            refreshToken,
        });
    } catch (error) {
        errorLogger.error('Google authentication failed');
        throw new HttpResponseError(
            StatusCodes.UNAUTHORIZED,
            'Google authentication failed'
        );

    }
}

export async function logoutController(req: Request, res: Response): Promise<void> {
    const { refreshToken } = req.body;
    await AuthService.logout(refreshToken);
    sendSuccess(res, null);
}

export async function changePasswordController(req: Request, res: Response): Promise<void> {
    const userId = (req.user as UserModel).id.toString();
    const { currentPassword, newPassword } = req.body;
    await AuthService.changePassword(userId, currentPassword, newPassword);
    sendSuccess(res, null);
}

export async function getMeController(req: Request, res: Response): Promise<void> {
    const user = req.user as UserModel;
    sendSuccess(res, { user: user.toJSON() });
}

export async function updateMeController(req: Request, res: Response): Promise<void> {
    const userId = (req.user as UserModel).id.toString();
    // Prevent updating password via this route
    if (req.body.password) {
        delete req.body.password;
    }
    const user = await UserService.updateUser(userId, req.body);
    sendSuccess(res, { user });
}

export async function deleteMeController(req: Request, res: Response): Promise<void> {
    const userId = (req.user as UserModel).id.toString();
    await UserService.deleteUser(userId);
    sendSuccess(res, null);
}
