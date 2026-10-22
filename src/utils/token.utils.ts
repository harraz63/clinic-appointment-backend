import jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';
import { Transaction } from 'sequelize';
import { UserModel } from '../modules/user/v1/model/user.model.js';
import { UserSessionModel } from '../modules/user-session/v1/model/user-session.entity.js';
import { env } from '../config/env.js';



export interface IAuthToken {
    token: string;
    expiresAt: Date;
}

export const generateAuthToken = function (this: UserModel, sessionId: string): IAuthToken {
    const expiresIn = 15 * 60 * 60; // Existing 15-hour access-token lifetime.
    const token = jwt.sign(
        { _id: this.id, role: this.role, sessionId },
        env.JWT_PRIVATE_KEY,
        { expiresIn }
    );

    return {
        token,
        expiresAt: new Date(Date.now() + expiresIn * 1000)
    };
};

export const generateRefreshToken = async function (
    this: UserModel,
    sessionId: string,
    transaction?: Transaction
): Promise<string> {
    const expiresInDays = 7;
    const refreshToken = jwt.sign(
        { _id: this.id, tokenId: randomUUID(), sessionId },
        env.REFRESH_TOKEN_PRIVATE_KEY,
        { expiresIn: `${expiresInDays}d` }
    );

    await UserSessionModel.update(
        { refreshToken, expiresAt: new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000) },
        { where: { id: sessionId }, transaction }
    );

    return refreshToken;
};
