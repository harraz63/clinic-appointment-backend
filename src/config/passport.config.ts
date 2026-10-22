import passport from 'passport';
import { Strategy as JwtStrategy, ExtractJwt } from 'passport-jwt';
import { UserModel } from '../modules/user/v1/model/user.model.js';
import { UserSessionModel } from '../modules/user-session/v1/model/user-session.entity.js';
import { env } from './env.js';

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

}
