import { env } from '../config/env.js';
import { redisClient } from '../config/redis.js';

export interface PendingRegistration {
    phone: string;
    name: string;
    passwordHash: string;
}

export class PendingRegistrationService {
    private static key(phone: string): string {
        return `pending-registration:${phone}`;
    }

    static async create(record: PendingRegistration): Promise<boolean> {
        const result = await redisClient.set(this.key(record.phone), JSON.stringify(record), {
            EX: env.OTP_TTL_MINUTES * 60,
            NX: true,
        });
        return result === 'OK';
    }

    static async get(phone: string): Promise<PendingRegistration | null> {
        const raw = await redisClient.get(this.key(phone));
        if (!raw) return null;
        const text = Buffer.isBuffer(raw) ? raw.toString() : raw;
        let parsed: unknown;
        try {
            parsed = JSON.parse(text);
        } catch {
            return null;
        }
        if (typeof parsed !== 'object' || parsed === null) return null;
        const record = parsed as Record<string, unknown>;
        if (record.phone !== phone || typeof record.name !== 'string' || typeof record.passwordHash !== 'string') return null;
        return { phone, name: record.name, passwordHash: record.passwordHash };
    }

    static async renew(phone: string): Promise<void> {
        await redisClient.expire(this.key(phone), env.OTP_TTL_MINUTES * 60);
    }

    static async remove(phone: string): Promise<void> {
        await redisClient.del(this.key(phone));
    }
}
