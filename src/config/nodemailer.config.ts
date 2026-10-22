import nodemailer from 'nodemailer';
import { env } from './env.js';

export const emailTransporter = nodemailer.createTransport({
    host: env.MAIL_HOST,
    port: env.MAIL_PORT || 587,
    secure: env.MAIL_SECURE === 'true',
    auth: {
        user: env.MAIL_USER,
        pass: env.MAIL_PASS,
    },
});