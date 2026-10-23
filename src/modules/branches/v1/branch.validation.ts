import Joi from 'joi';
import { localizedTextSchema, timezoneSchema } from '../../../shared/localized-text.js';
import { JoiCustomValidateObjectId } from '../../../utils/joi-custom-validate-object-id.js';

const paginationSchema = {
    page: Joi.number().integer().min(1).optional(),
    limit: Joi.number().integer().min(1).max(100).optional(),
    search: Joi.string().trim().max(100).optional(),
};

export const branchInputSchema = Joi.object({
    name: localizedTextSchema.required(),
    description: localizedTextSchema.optional(),
    address: localizedTextSchema.required(),
    phone: Joi.string().optional(),
    email: Joi.string().email().optional(),
    timezone: timezoneSchema.optional(),
    isActive: Joi.boolean().optional(),
}).unknown(false);

export const branchUpdateSchema = branchInputSchema.fork(
    ['name', 'address'],
    schema => schema.optional()
).min(1);

export const branchIdSchema = Joi.object({
    id: JoiCustomValidateObjectId('ID', false),
}).unknown(false);

export const publicBranchListSchema = Joi.object(paginationSchema).unknown(false);

export const adminBranchListSchema = Joi.object({
    ...paginationSchema,
    isActive: Joi.boolean().optional(),
}).unknown(false);
