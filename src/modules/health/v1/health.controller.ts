import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { sequelize } from '../../../database/db-config.js';
import { env } from '../../../config/env.js';
import { sendSuccess } from '../../../shared/api-response.js';
import { ErrorResponse } from '../../../shared/api.types.js';

export async function healthCheckController(req: Request, res: Response): Promise<void> {
    try {
        await sequelize.authenticate();

        sendSuccess(res, {
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
        const data = {
            status: 'degraded',
            service: env.APP_NAME,
            version: env.APP_VERSION,
            uptime: process.uptime(),
            timestamp: new Date().toISOString(),
            dependencies: {
                database: 'down',
            },
        };
        const body: ErrorResponse<typeof data> = {
            status: 'error',
            statusCode: StatusCodes.SERVICE_UNAVAILABLE,
            message: req.__('service_unavailable'),
            data,
        };
        res.status(StatusCodes.SERVICE_UNAVAILABLE).json(body);
    }
}
