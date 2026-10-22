import { Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { Success } from './api.types.js';

export function sendSuccess<T>(
    res: Response,
    data: T,
    statusCode: number = StatusCodes.OK
): Response<Success<T>> {
    return res.status(statusCode).json({ status: 'success', data });
}
