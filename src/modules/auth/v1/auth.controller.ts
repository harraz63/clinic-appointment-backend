import { StatusCodes } from 'http-status-codes';
import { Request, Response } from 'express';
import { AuthService } from './auth.service.js';
import { UserModel } from '../../user/v1/model/user.model.js';
import { UserService } from '../../user/v1/user.service.js';
import { sendSuccess } from '../../../shared/api-response.js';


export async function loginController(req: Request, res: Response): Promise<void> {
    const { phone, password } = req.body;

    const { user, accessToken, refreshToken } = await AuthService.login(phone, password);

    sendSuccess(res, {
        user: user.toJSON(),
        accessToken,
        refreshToken,
    });
}

export async function registerController(req: Request, res: Response): Promise<void> {
    const otp = await AuthService.register(req.body);
    sendSuccess(res, { otp }, StatusCodes.ACCEPTED);
}

export async function resendRegistrationOtpController(req: Request, res: Response): Promise<void> {
    const otp = await AuthService.resendRegistrationOtp(req.body.phone);
    sendSuccess(res, otp ? { otp } : null, StatusCodes.ACCEPTED);
}

export async function verifyRegistrationController(req: Request, res: Response): Promise<void> {
    const data = await AuthService.verifyRegistration(req.body.phone, req.body.otp);
    sendSuccess(res, { user: data.user.toJSON(), accessToken: data.accessToken, refreshToken: data.refreshToken });
}

export async function forgotPasswordController(req: Request, res: Response): Promise<void> {
    const otp = await AuthService.forgotPassword(req.body.phone);
    sendSuccess(res, otp ? { otp } : null, StatusCodes.ACCEPTED);
}

export async function resetPasswordController(req: Request, res: Response): Promise<void> {
    await AuthService.resetPassword(req.body.phone, req.body.otp, req.body.newPassword);
    sendSuccess(res, null);
}

export async function requestPhoneChangeController(req: Request, res: Response): Promise<void> {
    const otp = await AuthService.requestPhoneChange((req.user as UserModel).id, req.body.phone);
    sendSuccess(res, { otp }, StatusCodes.ACCEPTED);
}

export async function verifyPhoneChangeController(req: Request, res: Response): Promise<void> {
    const user = await AuthService.verifyPhoneChange((req.user as UserModel).id, req.body.otp);
    sendSuccess(res, { user: user.toJSON() });
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
