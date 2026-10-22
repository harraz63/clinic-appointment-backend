// database.ts
import { Sequelize } from 'sequelize';
import { env } from '../config/env.js';
import { errorLogger, infoLogger } from '../config/logger.config.js';
import { exit } from 'process';

function resolveDatabaseUrl() {
    try {
        const dbUrl = new URL(env.DB_URI);
        const runningInDocker = process.env.DOCKER === 'true' || process.env.IN_DOCKER === 'true';

        if (dbUrl.hostname === 'db' && !runningInDocker) {
            dbUrl.hostname = 'localhost';
            infoLogger.warn('DB host "db" detected outside Docker. Falling back to "localhost".');
        }

        return dbUrl.toString();
    } catch {
        return env.DB_URI;
    }
}

const DB_URL = resolveDatabaseUrl();

export const sequelize = new Sequelize(DB_URL, {
    logging: false,
});

export async function initializeDatabase() {
    try {
        await sequelize.authenticate();
        infoLogger.info('Database connected');
    } catch (error) {
        errorLogger.error('Database connection failed');
        exit(1);
    }
}
