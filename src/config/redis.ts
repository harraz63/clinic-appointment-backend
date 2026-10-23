import { createClient } from 'redis';
import { env } from './env.js';
import { errorLogger, infoLogger } from './logger.config.js';

export const redisClient = createClient({ url: env.REDIS_URL });

redisClient.on('error', () => errorLogger.error('Redis client error'));

export async function initializeRedis(): Promise<void> {
    if (redisClient.isOpen) return;
    await redisClient.connect();
    infoLogger.info('Connected to Redis');
}

export async function closeRedis(): Promise<void> {
    if (redisClient.isOpen) await redisClient.quit();
}
