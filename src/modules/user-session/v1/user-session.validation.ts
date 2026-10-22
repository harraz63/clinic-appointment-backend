import Joi from 'joi';


export const updateFCMTokenSchema = Joi.object({
    fcmToken: Joi.string().required().messages({
        'string.base': 'FCM token must be a string',
        'string.empty': 'FCM token is required',
        'any.required': 'FCM token is required'
    })
});