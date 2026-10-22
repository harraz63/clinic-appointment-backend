import passport from 'passport';
import { Strategy as JwtStrategy, ExtractJwt } from 'passport-jwt';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { UserModel } from '../modules/user/v1/model/user.model.js';
import { UserSessionModel } from '../modules/user-session/v1/model/user-session.entity.js';
import { env } from './env.js';
import { UserService } from '../modules/user/v1/user.service.js';
import { Op } from 'sequelize';

interface JwtPayload {
    _id: string;
    sessionId?: string;
}

export async function passportConfig(): Promise<void> {
    passport.use('jwt-access', new JwtStrategy({
        jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
        secretOrKey: env.JWT_PRIVATE_KEY,
    }, async (payload: JwtPayload, done) => {
        try {
            if (!payload.sessionId || !payload._id) return done(null, false);
            const session = await UserSessionModel.findByPk(payload.sessionId);
            const user = await UserModel.findByPk(payload._id);
            return done(null, user || false, session);
        } catch (error) {
            done(error);
        }
    }));

    if (!env.GOOGLE_AUTH_ENABLED) return;
    passport.use(new GoogleStrategy({
        clientID: env.GOOGLE_CLIENT_ID,
        clientSecret: env.GOOGLE_CLIENT_SECRET,
        callbackURL: env.GOOGLE_CALLBACK_URL,
    }, async (_accessToken, _refreshToken, profile, done) => {
        try {
            const email = profile.emails?.[0]?.value;
            if (!email) return done(new Error('Google authentication failed'));
            let user = await UserModel.findOne({ where: { [Op.or]: [{ googleId: profile.id }, { provider: email }] } });
            if (!user) {
                user = await UserService.createUser({
                    provider: email, googleId: profile.id, name: profile.displayName, isVerified: true,
                });
            }
            if (user.isBlocked) return done(null, false);
            return done(null, user);
        } catch (error) {
            return done(error as Error);
        }
    }));
}
