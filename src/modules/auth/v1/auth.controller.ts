import { StatusCodes } from 'http-status-codes';
import { Request, Response } from 'express';
import { AuthService } from './auth.service.js';
import { UserModel } from '../../user/v1/model/user.model.js';
import { UserService } from '../../user/v1/user.service.js';
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
