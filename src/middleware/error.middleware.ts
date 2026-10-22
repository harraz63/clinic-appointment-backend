import { StatusCodes } from 'http-status-codes';
import { errorLogger } from '../config/logger.config.js';
import { HttpResponseError } from '../utils/appError.js';
import { Request, Response, NextFunction } from 'express';

export function errorMiddleware(err: Error | HttpResponseError, req: Request, res: Response, next: NextFunction) {

    if (err instanceof HttpResponseError) {
        return res.status(err.statusCode).json({
            message: req.__(err.message),
            statusCode: err.statusCode,
            status: err.status,
        });
    }

    errorLogger.error(err.stack || err.message);

    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
        message: req.__('internal_server_error'),
        statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
        status: 'error'
    });
}