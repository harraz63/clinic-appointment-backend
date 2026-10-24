import Joi from 'joi';
import { Temporal } from '@js-temporal/polyfill';
import { RequestHandler } from 'express';
import { HttpResponseError } from '../../../utils/appError.js';

const validationMessages = Object.fromEntries([
    'any.required', 'any.invalid', 'any.only', 'object.unknown', 'object.base',
    'string.base', 'string.empty', 'string.guid', 'string.pattern.base', 'string.max',
    'number.base', 'number.integer', 'number.min', 'number.max', 'boolean.base',
].map(code => [code, 'Invalid booking request']));

export const requestSourceGuard: RequestHandler = (req, _res, next) => {
    const seen = new Set<string>();
    if ((req.method === 'GET' && Object.keys(req.body ?? {}).length) ||
        (req.method === 'POST' && Object.keys(req.query).length)) {
        throw new HttpResponseError(422, 'Invalid booking request');
    }
    for (const source of [req.params, req.body, req.query]) {
        for (const key of Object.keys(source ?? {})) {
            if (seen.has(key)) throw new HttpResponseError(422, 'Invalid booking request');
            seen.add(key);
        }
    }
    next();
};

const date = Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).custom((value: string, helpers) => {
    try { Temporal.PlainDate.from(value); return value; } catch { return helpers.error('any.invalid'); }
});
export const paginationFields = {
    page: Joi.number().integer().min(1).optional(),
    limit: Joi.number().integer().min(1).max(100).optional(),
};
export const appointmentIdSchema = Joi.object({ id: Joi.string().uuid().required() }).unknown(false).messages(validationMessages);
export const availabilitySchema = appointmentIdSchema.concat(Joi.object({
    from: date.required(), to: date.required(),
}).unknown(false)).messages(Object.fromEntries(Object.keys(validationMessages).map(code => [code, 'Invalid availability date range'])));
export const bookingSchema = Joi.object({
    doctorId: Joi.string().uuid().required(),
    startsAt: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/).custom((value: string, helpers) => {
        try { Temporal.Instant.from(value); return value; } catch { return helpers.error('any.invalid'); }
    }).required(),
}).unknown(false).messages(validationMessages);
export const appointmentListSchema = Joi.object({
    ...paginationFields,
    doctorId: Joi.string().uuid().optional(),
    status: Joi.string().valid('pending', 'confirmed', 'completed', 'cancelled', 'no_show').optional(),
}).unknown(false).messages(validationMessages);
export const publicDoctorListSchema = Joi.object({
    ...paginationFields, search: Joi.string().trim().max(100).optional(),
    branchId: Joi.string().uuid().optional(), specialtyId: Joi.string().uuid().optional(),
    isAvailable: Joi.boolean().optional(),
}).unknown(false).messages(validationMessages);
