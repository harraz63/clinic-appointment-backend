import { StatusCodes } from 'http-status-codes';
import { HttpResponseError } from '../utils/appError.js';
import { Request, Response, NextFunction } from 'express';


export function notFoundMiddleware(req: Request, res: Response, next: NextFunction) {
    throw new HttpResponseError(StatusCodes.NOT_FOUND, 'not_found');
}