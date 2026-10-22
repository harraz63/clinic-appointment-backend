import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { sequelize } from '../../../database/db-config.js';
import { env } from '../../../config/env.js';

export async function healthCheckController(req: Request, res: Response): Promise<void> {
    try {
        await sequelize.authenticate();

        res.status(StatusCodes.OK).json({
            status: 'ok',
            service: env.APP_NAME,
            version: env.APP_VERSION,
            uptime: process.uptime(),
            timestamp: new Date().toISOString(),
            dependencies: {
                database: 'up',
            },
        });
    } catch {
        res.status(StatusCodes.SERVICE_UNAVAILABLE).json({
            status: 'degraded',
            service: env.APP_NAME,
            version: env.APP_VERSION,
            uptime: process.uptime(),
            timestamp: new Date().toISOString(),
            dependencies: {
                database: 'down',
            },
        });
    }
}
