import Joi from 'joi';
import { localizedTextSchema, moneySchema, currencySchema } from '../../../shared/localized-text.js';

export const doctorProfileInputSchema = Joi.object({
    userId: Joi.string().uuid().required(),
    branchId: Joi.string().uuid().required(),
    specialtyId: Joi.string().uuid().required(),
    name: localizedTextSchema.required(),
    biography: localizedTextSchema.optional(),
    appointmentPrice: moneySchema.required(),
    currency: currencySchema.required(),
    appointmentDurationMinutes: Joi.number().integer().positive().required(),
    isAvailable: Joi.boolean().optional(),
    isActive: Joi.boolean().optional(),
}).unknown(false);
