import jwt from 'jsonwebtoken';
import { StatusCodes } from 'http-status-codes';
import { HttpResponseError } from '../../../utils/appError.js';
import { UserModel } from '../../user/v1/model/user.model.js';
import { isStrongPassword } from '../../../utils/password.utils.js';
import { UserSessionModel } from '../../user-session/v1/model/user-session.entity.js';
import { IAuthToken } from '../../../utils/token.utils.js';
import { UserService } from '../../user/v1/user.service.js';
import { env } from '../../../config/env.js';
import { Roles } from '../../../constants/roles.js';
import { assertActiveSession } from '../../user-session/v1/user-session.policy.js';


export class AuthService {
    static async login(provider: string, password: string): Promise<{ user: UserModel; accessToken: IAuthToken; refreshToken: string }> {
        // Use the custom scope to include password
        const user = await UserModel.scope('withPassword').findOne({ where: { provider } });
        if (!user) {
            throw new HttpResponseError(StatusCodes.UNAUTHORIZED, 'Invalid credentials');
        }

        if (user.isBlocked) {
            throw new HttpResponseError(StatusCodes.FORBIDDEN, 'Account is blocked');
        }
        const isValidPassword = await user.validatePassword(password);
        if (!isValidPassword) {
            throw new HttpResponseError(StatusCodes.UNAUTHORIZED, 'Invalid credentials');
        }

        const userSession = await UserSessionModel.create({ userId: user.id });

        const accessToken = user.generateAuthToken(userSession.id.toString());
        const refreshToken = await user.generateRefreshToken(userSession.id.toString());

        return { user, accessToken, refreshToken };
    }

    static async register(userData: Partial<UserModel>): Promise<UserModel> {
        const existingUser = await UserService.getUserByProvider(userData.provider);
        if (existingUser) {
            throw new HttpResponseError(StatusCodes.CONFLICT, 'User with this provider already exists');
        }

        return UserService.createUser({ provider: userData.provider, name: userData.name, password: userData.password, role: Roles.USER });
    }

    static async refreshToken(refreshToken: string): Promise<{ accessToken: IAuthToken; newRefreshToken: string }> {
        let decoded: jwt.JwtPayload;
        try {
            const payload = jwt.verify(refreshToken, env.REFRESH_TOKEN_PRIVATE_KEY);
            if (typeof payload === 'string' || typeof payload._id !== 'string' || typeof payload.sessionId !== 'string') {
                throw new Error('Invalid payload');
            }
            decoded = payload;
        } catch {
            throw new HttpResponseError(StatusCodes.UNAUTHORIZED, 'Invalid refresh token');
        }
        const session = await UserSessionModel.findOne({ where: { id: decoded.sessionId, refreshToken } });
        const user = await UserModel.findByPk(decoded._id);
        assertActiveSession(user, session);
        const newAccessToken = user.generateAuthToken(session.id.toString());
        const newRefreshToken = await user.generateRefreshToken(session.id.toString());

        session.refreshToken = newRefreshToken;

        await session.save();

        return { accessToken: newAccessToken, newRefreshToken };
    }

    static async logout(refreshToken: string): Promise<void> {
        const session = await UserSessionModel.findOne({ where: { refreshToken } });
        if (!session) {
            throw new HttpResponseError(StatusCodes.NOT_FOUND, 'Session not found');
        }
        await session.destroy();
    }

    static async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
        const user = await UserModel.scope('withPassword').findByPk(userId);
        if (!user) throw new HttpResponseError(StatusCodes.NOT_FOUND, 'User not found');
        const isValid = await user.validatePassword(currentPassword);

        if (!isValid) {
            throw new HttpResponseError(StatusCodes.UNAUTHORIZED, 'Current password is incorrect');
        }

        if (!isStrongPassword(newPassword)) {
            throw new HttpResponseError(StatusCodes.BAD_REQUEST, 'Password must be at least 8 characters long and include uppercase, lowercase, number, and special character');
        }

        user.password = newPassword;
        await user.save();
    }
}