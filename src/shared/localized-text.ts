import Joi from 'joi';

export interface LocalizedText {
    ar: string;
    en: string;
}

// Values are validated without relying on middleware conversions or trimming.
export const localizedTextSchema = Joi.object({
    ar: Joi.string().pattern(/\S/).required(),
    en: Joi.string().pattern(/\S/).required(),
}).unknown(false);

export const timezoneSchema = Joi.string().custom((value: string, helpers) => {
    try {
        new Intl.DateTimeFormat('en', { timeZone: value });
        return value;
    } catch {
        return helpers.error('any.invalid');
    }
});

export const moneySchema = Joi.string().pattern(/^\d{1,10}\.\d{2}$/);
export const currencySchema = Joi.string().pattern(/^[A-Z]{3}$/);
