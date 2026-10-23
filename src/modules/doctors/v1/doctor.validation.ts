import Joi from 'joi';
import { localizedTextSchema, moneySchema, currencySchema } from '../../../shared/localized-text.js';
import { isStrongPassword } from '../../../utils/password.utils.js';
import { JoiCustomValidateObjectId } from '../../../utils/joi-custom-validate-object-id.js';

const doctorProfileFields = {
    branchId: Joi.string().uuid().required(),
    specialtyId: Joi.string().uuid().required(),
    name: localizedTextSchema.required(),
    biography: localizedTextSchema.optional(),
    appointmentPrice: moneySchema.required(),
    currency: currencySchema.optional(),
    appointmentDurationMinutes: Joi.number().integer().positive().required(),
    isAvailable: Joi.boolean().optional(),
    isActive: Joi.boolean().optional(),
};

export const doctorProfileInputSchema = Joi.object(doctorProfileFields).unknown(false);

const phoneSchema = Joi.string().min(11).max(13)
    .pattern(/^(?:01[0125]\d{8}|\+?20(?:1[0125]\d{8}))$/)
    .messages({ 'string.pattern.base': 'Phone must be a valid Egyptian mobile number' });

const passwordSchema = Joi.string().max(1024).custom((value: string, helpers) =>
    isStrongPassword(value) ? value : helpers.error('password.strong')
).messages({ 'password.strong': 'Password must be at least 8 characters long and include uppercase, lowercase, number, and special character' });

export const createDoctorSchema = Joi.object({
    phone: phoneSchema.required(),
    accountName: Joi.string().min(5).max(255).required(),
    password: passwordSchema.required(),
    ...doctorProfileFields,
}).unknown(false);

export const doctorProfileUpdateSchema = Joi.object({
    branchId: Joi.string().uuid().optional(),
    specialtyId: Joi.string().uuid().optional(),
    name: localizedTextSchema.optional(),
    biography: localizedTextSchema.allow(null).optional(),
    appointmentPrice: moneySchema.optional(),
    currency: currencySchema.optional(),
    appointmentDurationMinutes: Joi.number().integer().positive().optional(),
    isAvailable: Joi.boolean().optional(),
    isActive: Joi.boolean().optional(),
}).min(1).unknown(false);

export const doctorIdSchema = Joi.object({ id: JoiCustomValidateObjectId('ID', false) }).unknown(false);

const paginationSchema = {
    page: Joi.number().integer().min(1).optional(),
    limit: Joi.number().integer().min(1).max(100).optional(),
    search: Joi.string().trim().max(100).optional(),
};

export const adminDoctorListSchema = Joi.object({
    ...paginationSchema,
    branchId: Joi.string().uuid().optional(),
    specialtyId: Joi.string().uuid().optional(),
    isActive: Joi.boolean().optional(),
    isAvailable: Joi.boolean().optional(),
}).unknown(false);
