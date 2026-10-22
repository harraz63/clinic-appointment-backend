import { StatusCodes } from 'http-status-codes';
import { errorLogger } from '../config/logger.config.js';
import { HttpResponseError } from '../utils/appError.js';
import { Request, Response, NextFunction } from 'express';
import { ErrorResponse } from '../shared/api.types.js';

export function errorMiddleware(err: Error | HttpResponseError, req: Request, res: Response, next: NextFunction) {

    if (err instanceof HttpResponseError) {
        const body: ErrorResponse = {
            message: req.__(err.message),
            statusCode: err.statusCode,
            status: err.status,
        };
        return res.status(err.statusCode).json(body);
    }

    errorLogger.error(err.stack || err.message);

    const body: ErrorResponse = {
        message: req.__('internal_server_error'),
        statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
        status: 'error'
    };
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json(body);
}
