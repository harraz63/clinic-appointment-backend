import Joi from 'joi';
import { localizedTextSchema } from '../../../shared/localized-text.js';
import { JoiCustomValidateObjectId } from '../../../utils/joi-custom-validate-object-id.js';

const paginationSchema = {
    page: Joi.number().integer().min(1).optional(),
    limit: Joi.number().integer().min(1).max(100).optional(),
    search: Joi.string().trim().max(100).optional(),
};

export const specialtyInputSchema = Joi.object({
    name: localizedTextSchema.required(),
    description: localizedTextSchema.optional(),
    isActive: Joi.boolean().optional(),
}).unknown(false);

export const specialtyUpdateSchema = specialtyInputSchema.fork(
    ['name'],
    schema => schema.optional()
).min(1);

export const specialtyIdSchema = Joi.object({
    id: JoiCustomValidateObjectId('ID', false),
}).unknown(false);

export const publicSpecialtyListSchema = Joi.object(paginationSchema).unknown(false);

export const adminSpecialtyListSchema = Joi.object({
    ...paginationSchema,
    isActive: Joi.boolean().optional(),
}).unknown(false);
