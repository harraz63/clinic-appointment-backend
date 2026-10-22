import Joi from 'joi';
import { localizedTextSchema } from '../../../shared/localized-text.js';

const localTime = Joi.string().pattern(/^(?:[01]\d|2[0-3]):[0-5]\d$/);
export const workingIntervalSchema = Joi.object({
    weekday: Joi.number().integer().min(0).max(6).required(),
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
