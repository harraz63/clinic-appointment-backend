import passport from 'passport';
import { Strategy as JwtStrategy, ExtractJwt, VerifiedCallback } from 'passport-jwt';
import { Strategy as GoogleStrategy, Profile } from 'passport-google-oauth20';
import { UserModel } from '../modules/user/v1/model/user.model.js';
import { UserSessionModel } from '../modules/user-session/v1/model/user-session.entity.js';
import { env } from './env.js';
import { UserService } from '../modules/user/v1/user.service.js';
import { Op } from 'sequelize';


interface JwtPayload {
    _id: string;
    sessionId?: string;
    tokenId?: string;
    role?: string;
}

export async function passportConfig() {
    // Serialization
    passport.serializeUser((user: Express.User, done) => {
        done(null, (user as UserModel).id);
    });

    passport.deserializeUser(async (id: string, done) => {
        try {
            const user = await UserService.getUserById(id);
            done(null, user);
        } catch (error) {
            done(error as Error);
        }
    });

    // JWT Access Strategy
    passport.use('jwt-access', new JwtStrategy({
        jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
        secretOrKey: env.JWT_PRIVATE_KEY,
    }, async (payload: JwtPayload, done: VerifiedCallback) => {
        try {
            const session = await UserSessionModel.findByPk(payload.sessionId);
            const user = await UserService.getUserById(payload._id);
            if (user) {
                return done(null, user, session);
            } else {
                return done(null, false);
            }
        } catch (error) {
            done(error as Error);
        }
    }));

    // JWT Refresh Strategy
    passport.use('jwt-refresh', new JwtStrategy({
        jwtFromRequest: ExtractJwt.fromBodyField('refreshToken'),
        secretOrKey: env.REFRESH_TOKEN_PRIVATE_KEY,
    }, async (payload: JwtPayload, done: VerifiedCallback) => {
        try {
            if (!payload.tokenId) return done(null, false);

            const session = await UserSessionModel.findOne({
                where: {
                    refreshToken: payload.tokenId,
                    expiresAt: { $gt: new Date() }
                }
            });

            if (!session) return done(null, false);

            const user = await UserService.getUserById(payload._id);
            if (user) {
                return done(null, user);
            } else {
                return done(null, false);
            }
        } catch (error) {
            done(error as Error);
        }
    }));

    // Google OAuth Strategy
    passport.use(new GoogleStrategy({
        clientID: env.GOOGLE_CLIENT_ID,
        clientSecret: env.GOOGLE_CLIENT_SECRET,
        callbackURL: env.GOOGLE_CALLBACK_URL,
    }, async (
        accessToken: string,
        refreshToken: string,
        profile: Profile,
        done: (error: Error | null, user?: Express.User) => void
    ) => {
        try {
            const email = profile.emails?.[0]?.value;
            if (!email) return done(new Error('No email found in Google profile'));

            let user = await UserModel.findOne({
                where: {
                    [Op.or]: [
                        { googleId: profile.id },
                        { provider: email }
                    ]
                }
            });

            if (!user) {
                user = await UserService.createUser({
                    provider: email,
                    googleId: profile.id,
                    name: profile.displayName,
                    isVerified: true,
                    password: undefined,
                });
            }

            return done(null, user);
        } catch (error) {
            return done(error as Error);
        }
    }));
}