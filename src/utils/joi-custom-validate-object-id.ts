import Joi from 'joi';


export const JoiCustomValidateObjectId = (field: string, optional = false) => {
    const schema = Joi.string().uuid().messages({
        'any.required': `${field} is a required field`,
        'string.empty': `${field} cannot be empty`,
        'string.base': `${field} must be a string`,
        'string.guid': `${field} must be a valid UUID`
    });

    return optional ? schema.optional() : schema.required();
};