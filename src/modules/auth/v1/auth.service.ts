import jwt from 'jsonwebtoken';
import { Transaction } from 'sequelize';
import { StatusCodes } from 'http-status-codes';
import { HttpResponseError } from '../../../utils/appError.js';
import { UserModel } from '../../user/v1/model/user.model.js';
import { UserSessionModel } from '../../user-session/v1/model/user-session.entity.js';
import { IAuthToken } from '../../../utils/token.utils.js';
import { sequelize } from '../../../database/db-config.js';
import { env } from '../../../config/env.js';
import { Roles } from '../../../constants/roles.js';
import { assertActiveSession } from '../../user-session/v1/user-session.policy.js';
import { normalizeEgyptianPhone } from '../../../utils/phone.utils.js';
import { hashPassword, isStrongPassword } from '../../../utils/password.utils.js';
import { OtpService } from '../../../services/otp.service.js';
import { PendingRegistrationService } from '../../../services/pending-registration.service.js';
import { redisClient } from '../../../config/redis.js';

interface AuthResult { user: UserModel; accessToken: IAuthToken; refreshToken: string }


export class AuthService {
    private static async createSession(user: UserModel, transaction?: Transaction): Promise<AuthResult> {
        const session = await UserSessionModel.create({ userId: user.id }, { transaction });
        return {
            user,
            accessToken: user.generateAuthToken(session.id),
            refreshToken: await user.generateRefreshToken(session.id, transaction),
        };
    }

    static async login(phoneInput: string, password: string): Promise<{ user: UserModel; accessToken: IAuthToken; refreshToken: string }> {
        const phone = normalizeEgyptianPhone(phoneInput);
        // Use the custom scope to include password
        const user = await UserModel.scope('withPassword').findOne({ where: { phone } });
        if (!user) {
            throw new HttpResponseError(StatusCodes.UNAUTHORIZED, 'Invalid credentials');
        }

        if (user.isBlocked) {
            throw new HttpResponseError(StatusCodes.FORBIDDEN, 'Account is blocked');
        }
        if (!user.isVerified) throw new HttpResponseError(StatusCodes.FORBIDDEN, 'Phone is not verified');
        const isValidPassword = await user.validatePassword(password);
        if (!isValidPassword) {
            throw new HttpResponseError(StatusCodes.UNAUTHORIZED, 'Invalid credentials');
        }

        const userSession = await UserSessionModel.create({ userId: user.id });

        const accessToken = user.generateAuthToken(userSession.id.toString());
        const refreshToken = await user.generateRefreshToken(userSession.id.toString());

        return { user, accessToken, refreshToken };
    }

    static async register(userData: { phone: string; name: string; password: string }): Promise<string> {
        if (!isStrongPassword(userData.password)) {
            throw new HttpResponseError(StatusCodes.UNPROCESSABLE_ENTITY, 'Password must be at least 8 characters long and include uppercase, lowercase, number, and special character');
        }
        const phone = normalizeEgyptianPhone(userData.phone);
        if (await UserModel.findOne({ where: { phone } })) throw new HttpResponseError(StatusCodes.CONFLICT, 'User with this phone already exists');
        const pending = { phone, name: userData.name.trim(), passwordHash: await hashPassword(userData.password) };
        if (!await PendingRegistrationService.create(pending)) throw new HttpResponseError(StatusCodes.CONFLICT, 'Registration is already pending for this phone');
        try {
            return await OtpService.send(phone, 'signup');
        } catch (error: unknown) {
            await PendingRegistrationService.remove(phone);
            throw error;
        }
    }

    static async resendRegistrationOtp(phoneInput: string): Promise<string | null> {
        const phone = normalizeEgyptianPhone(phoneInput);
        const pending = await PendingRegistrationService.get(phone);
        if (!pending || await UserModel.findOne({ where: { phone } })) return null;
        const otp = await OtpService.send(phone, 'signup');
        await PendingRegistrationService.renew(phone);
        return otp;
    }

    static async verifyRegistration(phoneInput: string, otp: string): Promise<AuthResult> {
        const phone = normalizeEgyptianPhone(phoneInput);
        const pending = await PendingRegistrationService.get(phone);
        if (!pending) throw new HttpResponseError(StatusCodes.UNPROCESSABLE_ENTITY, 'AUTH_OTP_INVALID_OR_EXPIRED');
        await OtpService.consume(phone, 'signup', otp);
        const result = await sequelize.transaction(async transaction => {
            const user = await UserModel.create({
                phone,
                name: pending.name,
                password: pending.passwordHash,
                role: Roles.USER,
                isVerified: true,
                isBlocked: false,
            }, { transaction, hooks: false });
            return this.createSession(user, transaction);
        });
        await PendingRegistrationService.remove(phone);
        return result;
    }

    static async forgotPassword(phoneInput: string): Promise<string | null> {
        try {
            const phone = normalizeEgyptianPhone(phoneInput);
            const user = await UserModel.findOne({ where: { phone, role: Roles.USER } });
            if (user) return await OtpService.send(phone, 'password_reset');
            return null;
        } catch (error: unknown) {
            if (error instanceof HttpResponseError && error.statusCode === StatusCodes.TOO_MANY_REQUESTS) return null;
            throw error;
        }
    }

    static async resetPassword(phoneInput: string, otp: string, newPassword: string): Promise<void> {
        if (!isStrongPassword(newPassword)) {
            throw new HttpResponseError(StatusCodes.UNPROCESSABLE_ENTITY, 'Password must be at least 8 characters long and include uppercase, lowercase, number, and special character');
        }
        const phone = normalizeEgyptianPhone(phoneInput);
        const user = await UserModel.findOne({ where: { phone, role: Roles.USER } });
        if (!user) throw new HttpResponseError(StatusCodes.UNPROCESSABLE_ENTITY, 'AUTH_OTP_INVALID_OR_EXPIRED');
        await OtpService.consume(phone, 'password_reset', otp);
        await sequelize.transaction(async transaction => {
            const locked = await UserModel.findByPk(user.id, { transaction, lock: transaction.LOCK.UPDATE });
            if (!locked) throw new HttpResponseError(StatusCodes.UNPROCESSABLE_ENTITY, 'AUTH_OTP_INVALID_OR_EXPIRED');
            locked.password = newPassword;
            await locked.save({ transaction });
            await UserSessionModel.destroy({ where: { userId: user.id }, transaction });
        });
    }

    static async requestPhoneChange(userId: string, phoneInput: string): Promise<string> {
        const phone = normalizeEgyptianPhone(phoneInput);
        const user = await UserModel.findByPk(userId);
        if (!user) throw new HttpResponseError(StatusCodes.NOT_FOUND, 'User not found');
        if (user.role !== Roles.USER) throw new HttpResponseError(StatusCodes.FORBIDDEN, 'You do not have permission to perform this action');
        if (user.phone === phone) throw new HttpResponseError(StatusCodes.UNPROCESSABLE_ENTITY, 'Phone is already active');
        if (await UserModel.findOne({ where: { phone } })) throw new HttpResponseError(StatusCodes.CONFLICT, 'User with this phone already exists');
        const key = `pending-phone-change:${userId}`;
        const previous = await redisClient.get(key);
        await redisClient.set(key, phone, { EX: env.OTP_TTL_MINUTES * 60 });
        try {
            return await OtpService.send(phone, 'phone_change', `user:${userId}`);
        } catch (error: unknown) {
            if (previous) await redisClient.set(key, previous, { EX: env.OTP_TTL_MINUTES * 60 });
            else await redisClient.del(key);
            throw error;
        }
    }

    static async verifyPhoneChange(userId: string, otp: string): Promise<UserModel> {
        const key = `pending-phone-change:${userId}`;
        const pendingPhoneValue = await redisClient.get(key);
        const phone = pendingPhoneValue === null ? null : Buffer.isBuffer(pendingPhoneValue) ? pendingPhoneValue.toString() : pendingPhoneValue;
        if (!phone) throw new HttpResponseError(StatusCodes.UNPROCESSABLE_ENTITY, 'AUTH_OTP_INVALID_OR_EXPIRED');
        await OtpService.consume(phone, 'phone_change', otp);
        const user = await sequelize.transaction(async transaction => {
            const locked = await UserModel.findByPk(userId, { transaction, lock: transaction.LOCK.UPDATE });
            if (!locked || locked.role !== Roles.USER) throw new HttpResponseError(StatusCodes.NOT_FOUND, 'User not found');
            const duplicate = await UserModel.findOne({ where: { phone }, transaction, lock: transaction.LOCK.UPDATE });
            if (duplicate && duplicate.id !== locked.id) throw new HttpResponseError(StatusCodes.CONFLICT, 'User with this phone already exists');
            locked.phone = phone;
            locked.isVerified = true;
            await locked.save({ transaction });
            return locked;
        });
        await redisClient.del(key);
        return user;
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
        return sequelize.transaction(async transaction => {
            const session = await UserSessionModel.findByPk(decoded.sessionId, {
                transaction,
                lock: transaction.LOCK.UPDATE
            });
            if (!session || session.refreshToken !== refreshToken) {
                throw new HttpResponseError(StatusCodes.UNAUTHORIZED, 'Invalid or expired token');
            }

            const user = await UserModel.findByPk(decoded._id, { transaction });
            assertActiveSession(user, session);

            const accessToken = user.generateAuthToken(session.id.toString());
            const newRefreshToken = await user.generateRefreshToken(session.id.toString(), transaction);
            return { accessToken, newRefreshToken };
        });
    }

    static async logout(refreshToken: string): Promise<void> {
        const session = await UserSessionModel.findOne({ where: { refreshToken } });
        if (!session) {
            throw new HttpResponseError(StatusCodes.NOT_FOUND, 'Session not found');
        }
        await session.destroy();
    }

    static async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
        await sequelize.transaction(async transaction => {
            const user = await UserModel.scope('withPassword').findByPk(userId, {
                transaction,
                lock: transaction.LOCK.UPDATE
            });
            if (!user) throw new HttpResponseError(StatusCodes.NOT_FOUND, 'User not found');
            const isValid = await user.validatePassword(currentPassword);

            if (!isValid) {
                throw new HttpResponseError(StatusCodes.UNAUTHORIZED, 'Current password is incorrect');
            }

            if (!isStrongPassword(newPassword)) {
                throw new HttpResponseError(StatusCodes.BAD_REQUEST, 'Password must be at least 8 characters long and include uppercase, lowercase, number, and special character');
            }

            user.password = newPassword;
            await user.save({ transaction });
            await UserSessionModel.destroy({ where: { userId }, transaction });
        });
    }
}
