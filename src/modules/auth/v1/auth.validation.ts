import Joi from 'joi';
import { userValidationSchema } from '../../user/v1/user.validation.js';

export const loginSchema = Joi.object({
    provider: userValidationSchema.extract('provider').messages({
        'any.required': 'Provider is required',
        'string.empty': 'Provider cannot be empty'
    }),
    password: Joi.string().required().messages({
        'any.required': 'Password is required',
        'string.empty': 'Password cannot be empty'
    })
});

export const registerSchema = userValidationSchema
    .fork(['role', 'isVerified', 'isBlocked'], schema => schema.forbidden())
    .keys({
        password: userValidationSchema.extract('password')
    });

export const refreshTokenSchema = Joi.object({
    refreshToken: Joi.string().required().messages({
        'any.required': 'Refresh token is required',
        'string.empty': 'Refresh token cannot be empty'
    })
});

export const logoutSchema = refreshTokenSchema;

export const changePasswordSchema = Joi.object({
    currentPassword: Joi.string().required().messages({
        'any.required': 'Current password is required',
        'string.empty': 'Current password cannot be empty'
    }),
    newPassword: Joi.string().required().messages({
        'any.required': 'New password is required',
        'string.empty': 'New password cannot be empty'
    })
});

export const updateMeSchema = userValidationSchema
    .fork(['provider', 'password', 'role', 'isVerified', 'isBlocked'], schema => schema.forbidden())
    .keys({
        name: userValidationSchema.extract('name').optional(),
    });
