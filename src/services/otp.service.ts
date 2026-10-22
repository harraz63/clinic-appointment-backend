import { createHmac, randomInt, randomUUID } from 'node:crypto';
import { StatusCodes } from 'http-status-codes';
import { env } from '../config/env.js';
import { redisClient } from '../config/redis.js';
import { HttpResponseError } from '../utils/appError.js';
import { normalizeEgyptianPhone } from '../utils/phone.utils.js';

export type OtpPurpose = 'signup' | 'password_reset' | 'phone_change';

interface StoredOtp {
    hash: string;
    attempts: number;
}

export class OtpService {
    private static otpKey(purpose: OtpPurpose, identity: string): string {
        return `otp:${purpose}:${identity}`;
    }

    private static cooldownKey(purpose: OtpPurpose, identity: string): string {
        return `otp-cooldown:${purpose}:${identity}`;
    }

    private static hash(purpose: OtpPurpose, identity: string, code: string): string {
        return createHmac('sha256', env.OTP_HMAC_SECRET ?? env.REFRESH_TOKEN_PRIVATE_KEY).update(`${purpose}:${identity}:${code}`).digest('hex');
    }

    static async send(identityInput: string, purpose: OtpPurpose, cooldownIdentityInput?: string): Promise<string> {
        const identity = normalizeEgyptianPhone(identityInput);
        const cooldownIdentity = cooldownIdentityInput ?? identity;
        const cooldownKey = this.cooldownKey(purpose, cooldownIdentity);
        const owner = randomUUID();
        const acquired = await redisClient.set(cooldownKey, owner, { EX: env.OTP_RESEND_COOLDOWN_SECONDS, NX: true });
        if (!acquired) throw new HttpResponseError(StatusCodes.TOO_MANY_REQUESTS, 'AUTH_OTP_COOLDOWN_ACTIVE');

        const code = randomInt(0, 1_000_000).toString().padStart(6, '0');
        const record: StoredOtp = { hash: this.hash(purpose, identity, code), attempts: 0 };
        const otpKey = this.otpKey(purpose, identity);
        try {
            await redisClient.set(otpKey, JSON.stringify(record), { EX: env.OTP_TTL_MINUTES * 60 });
            return code;
        } catch (error: unknown) {
            const cleanup = `
                local value = redis.call('GET', KEYS[1])
                if value and cjson.decode(value).hash == ARGV[1] then redis.call('DEL', KEYS[1]) end
                if redis.call('GET', KEYS[2]) == ARGV[2] then redis.call('DEL', KEYS[2]) end
                return 1
            `;
            await Promise.allSettled([redisClient.eval(cleanup, { keys: [otpKey, cooldownKey], arguments: [record.hash, owner] })]);
            throw error;
        }
    }

    static async consume(identityInput: string, purpose: OtpPurpose, code: string): Promise<void> {
        const identity = normalizeEgyptianPhone(identityInput);
        const key = this.otpKey(purpose, identity);
        const script = `
            local value = redis.call('GET', KEYS[1])
            if not value then return 0 end
            local record = cjson.decode(value)
            if record.hash == ARGV[1] then redis.call('DEL', KEYS[1]); return 1 end
            record.attempts = record.attempts + 1
            if record.attempts >= tonumber(ARGV[2]) then redis.call('DEL', KEYS[1])
            else redis.call('SET', KEYS[1], cjson.encode(record), 'KEEPTTL') end
            return -1
        `;
        const result = await redisClient.eval(script, {
            keys: [key],
            arguments: [this.hash(purpose, identity, code), String(env.OTP_MAX_ATTEMPTS)],
        });
        if (Number(result) !== 1) throw new HttpResponseError(StatusCodes.UNPROCESSABLE_ENTITY, 'AUTH_OTP_INVALID_OR_EXPIRED');
    }
}
