import Joi from 'joi';
import { JoiCustomValidateObjectId } from '../../../utils/joi-custom-validate-object-id.js';
import { Roles } from '../../../constants/roles.js';

const adminManagedRoles = [Roles.ADMIN, Roles.USER] as const;

export const userValidationSchema = Joi.object({
    phone: Joi.string().min(11).max(13).required()
        .pattern(/^(?:01[0125]\d{8}|\+?20(?:1[0125]\d{8}))$/)
        .messages({
            'string.base': 'Phone must be a string',
            'string.empty': 'Phone cannot be empty',
            'string.min': 'Phone must be a valid Egyptian mobile number',
            'string.max': 'Phone must be a valid Egyptian mobile number',
            'string.pattern.base': 'Phone must be a valid Egyptian mobile number',
            'any.required': 'Phone is required',
        }),
    password: Joi.string().min(5).max(1024).required().messages({
        'string.base': 'Password must be a string',
        'string.empty': 'Password cannot be empty',
        'string.min': 'Password must be at least 5 characters long',
        'string.max': 'Password must be at most 1024 characters long',
        'any.required': 'Password is required',
    }),
    name: Joi.string().min(5).max(30).required().messages({
        'string.base': 'User name must be a string',
        'string.empty': 'User name cannot be empty',
        'string.min': 'User name must be at least 3 characters long',
        'string.max': 'User name must be at most 30 characters long',
        'any.required': 'User name is required',
    }),
    role: Joi.string().valid(...adminManagedRoles).default(Roles.USER).messages({
        'string.base': 'Role must be a string',
        'any.only': `Role must be one of ${adminManagedRoles.join(', ')}`,
        'any.default': `Role defaults to '${Roles.USER}' if not specified`
    }),
    isVerified: Joi.boolean().optional().messages({
        'boolean.base': 'isVerified must be a boolean',
    }),
    isBlocked: Joi.boolean().optional().messages({
        'boolean.base': 'isBlocked must be a boolean',
    })
});

export const createUserSchema = userValidationSchema;
export const updateUserSchema = userValidationSchema
    .fork(['password', 'phone', 'name', 'role'], schema => schema.optional())
    .append({ role: Joi.string().valid(...adminManagedRoles).optional() })
    .append({
        id: JoiCustomValidateObjectId('ID', false)
    });

export const deleteUserSchema = Joi.object({
    id: JoiCustomValidateObjectId('ID', false)
});

export const getUserByIdSchema = Joi.object({
    id: JoiCustomValidateObjectId('ID', false)
});

export const getUsersByFilterSchema = Joi.object({
    page: Joi.number().integer().min(1).default(1).optional().messages({
        'number.base': 'Page must be a number',
        'number.integer': 'Page must be an integer',
        'number.min': 'Page must be at least 1'
    }),
    limit: Joi.number().integer().min(1).max(100).default(10).optional().messages({
        'number.base': 'Limit must be a number',
        'number.integer': 'Limit must be an integer',
        'number.min': 'Limit must be at least 1',
        'number.max': 'Limit cannot exceed 100'
    }),
    phone: userValidationSchema.extract('phone').optional().messages({
        'string.base': 'Phone must be a string'
    }),
    name: Joi.string().trim().optional().messages({
        'string.base': 'Name must be a string'
    }),
    role: Joi.string().valid(...Object.values(Roles)).optional().messages({
        'any.only': `Role must be one of: ${Object.values(Roles).join(', ')}`
    }),
    isVerified: Joi.boolean().optional().messages({
        'boolean.base': 'isVerified must be a boolean'
    }),
    isBlocked: Joi.boolean().optional().messages({
        'boolean.base': 'isBlocked must be a boolean'
    })
}).unknown(false);
