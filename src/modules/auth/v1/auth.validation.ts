import Joi from 'joi';
import { userValidationSchema } from '../../user/v1/user.validation.js';

export const loginSchema = Joi.object({
    phone: userValidationSchema.extract('phone').messages({
        'any.required': 'Phone is required',
        'string.empty': 'Phone cannot be empty'
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

export const resendRegistrationOtpSchema = Joi.object({
    phone: userValidationSchema.extract('phone'),
}).unknown(false);

export const verifyRegistrationSchema = Joi.object({
    phone: userValidationSchema.extract('phone'),
    otp: Joi.string().pattern(/^\d{6}$/).required(),
}).unknown(false);

export const forgotPasswordSchema = Joi.object({ phone: userValidationSchema.extract('phone') }).unknown(false);
export const resetPasswordSchema = Joi.object({
    phone: userValidationSchema.extract('phone'),
    otp: Joi.string().pattern(/^\d{6}$/).required(),
    newPassword: userValidationSchema.extract('password'),
}).unknown(false);

export const changePhoneSchema = Joi.object({ phone: userValidationSchema.extract('phone') }).unknown(false);
export const verifyPhoneChangeSchema = Joi.object({ otp: Joi.string().pattern(/^\d{6}$/).required() }).unknown(false);

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
    .fork(['phone', 'password', 'role', 'isVerified', 'isBlocked'], schema => schema.forbidden())
    .keys({
        name: userValidationSchema.extract('name').optional(),
    });
