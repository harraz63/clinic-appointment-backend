import { StatusCodes } from 'http-status-codes';
import { HttpResponseError } from '../utils/appError.js';


export const validateRequest = (schema) => {
    return (req, res, next) => {
        const copyReq = { ...req.body, ...req.params, ...req.query };
        const validationResult = schema.validate(copyReq, { abortEarly: false });
        if (validationResult.error) {
            const messages = validationResult.error.details.map((error) => req.__(error.message));
            throw new HttpResponseError(StatusCodes.UNPROCESSABLE_ENTITY, messages.join('\n'));
        }
        return next();
    };
};