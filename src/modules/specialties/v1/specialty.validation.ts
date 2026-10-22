import Joi from 'joi';
import { localizedTextSchema } from '../../../shared/localized-text.js';

export const specialtyInputSchema = Joi.object({
    name: localizedTextSchema.required(),
    description: localizedTextSchema.optional(),
    isActive: Joi.boolean().optional(),
}).unknown(false);
