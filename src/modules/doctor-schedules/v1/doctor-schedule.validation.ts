import Joi from 'joi';
import { RequestHandler } from 'express';
import { StatusCodes } from 'http-status-codes';
import { localizedTextSchema } from '../../../shared/localized-text.js';
import { JoiCustomValidateObjectId } from '../../../utils/joi-custom-validate-object-id.js';
import { HttpResponseError } from '../../../utils/appError.js';

export const rejectScheduleSourceCollisions: RequestHandler = (req, _res, next) => {
    const seen = new Set<string>();
    for (const source of [req.params, req.body, req.query]) {
        for (const key of Object.keys(source ?? {})) {
            if (seen.has(key)) throw new HttpResponseError(StatusCodes.UNPROCESSABLE_ENTITY, 'Duplicate schedule request field');
            seen.add(key);
        }
    }
    next();
};

const localTime = Joi.string().pattern(/^(?:[01]\d|2[0-3]):[0-5]\d$/);
export const workingIntervalSchema = Joi.object({
    weekday: Joi.number().strict().integer().min(0).max(6).required(),
    startTime: localTime.required(),
    endTime: localTime.required(),
}).custom((value: { startTime: string; endTime: string }, helpers) =>
    value.startTime < value.endTime ? value : helpers.error('any.invalid'));

export const scheduleExceptionSchema = Joi.object({
    date: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).custom((value: string, helpers) => {
        const parsed = new Date(value);
        return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value ? value : helpers.error('any.invalid');
    }).required(),
    isDayOff: Joi.boolean().required(),
    reason: localizedTextSchema.optional(),
    startTime: localTime.when('isDayOff', { is: true, then: Joi.forbidden(), otherwise: Joi.required() }),
    endTime: localTime.when('isDayOff', { is: true, then: Joi.forbidden(), otherwise: Joi.required() }),
}).custom((value: { isDayOff: boolean; startTime?: string; endTime?: string }, helpers) =>
    value.isDayOff || value.startTime < value.endTime ? value : helpers.error('any.invalid'));

const dateSchema = scheduleExceptionSchema.extract('date');
export const scheduleDoctorIdSchema = Joi.object({ id: JoiCustomValidateObjectId('ID', false) }).unknown(false);
export const replaceScheduleSchema = scheduleDoctorIdSchema.concat(Joi.object({
    intervals: Joi.array().items(workingIntervalSchema).required(),
}).unknown(false));
export const exceptionRangeSchema = scheduleDoctorIdSchema.concat(Joi.object({
    from: dateSchema.required(),
    to: dateSchema.required(),
}).custom((value: { from: string; to: string }, helpers) => value.from <= value.to ? value : helpers.error('any.invalid')).unknown(false));
export const exceptionDateSchema = scheduleDoctorIdSchema.concat(Joi.object({ date: dateSchema.required() }).unknown(false));
export const setExceptionSchema = exceptionDateSchema.concat(Joi.object({
    isDayOff: Joi.boolean().strict().required(),
    intervals: Joi.array().items(Joi.object({
        startTime: localTime.required(),
        endTime: localTime.required(),
    }).custom((value: { startTime: string; endTime: string }, helpers) =>
        value.startTime < value.endTime ? value : helpers.error('any.invalid'))).optional(),
    reason: localizedTextSchema.optional(),
}).custom((value: { isDayOff: boolean; intervals?: unknown[] }, helpers) =>
    (value.isDayOff && value.intervals === undefined) || (!value.isDayOff && Array.isArray(value.intervals) && value.intervals.length > 0)
        ? value : helpers.error('any.invalid')).unknown(false));
