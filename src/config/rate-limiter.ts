import rateLimit from 'express-rate-limit';
import { Request, Response } from 'express';
import { HttpResponseError } from '../utils/appError.js';
import { StatusCodes } from 'http-status-codes';

export const rateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 1000,
    handler: (req: Request, res: Response) => {
        throw new HttpResponseError(StatusCodes.TOO_MANY_REQUESTS, 'Too many requests from this IP, please try again later.');
    }
});
