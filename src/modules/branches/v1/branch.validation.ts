import Joi from 'joi';
import { localizedTextSchema, timezoneSchema } from '../../../shared/localized-text.js';

export const branchInputSchema = Joi.object({
    name: localizedTextSchema.required(),
    description: localizedTextSchema.optional(),
    address: localizedTextSchema.required(),
    phone: Joi.string().optional(),
    email: Joi.string().email().optional(),
    timezone: timezoneSchema.default('Africa/Cairo'),
    isActive: Joi.boolean().optional(),
}).unknown(false);
