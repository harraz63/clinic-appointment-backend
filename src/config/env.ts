import { z } from 'zod';
import dotenv from 'dotenv';


dotenv.config();

const envSchema = z.object({
    NODE_ENV: z.enum(['development', 'production', 'test']),
    PORT: z.coerce.number().int().positive().default(3000),
    DB_URI: z.url(),
    APP_NAME: z.string().min(1, 'APP_NAME must not be empty'),
    APP_VERSION: z.string().min(1, 'APP_VERSION must not be empty'),
    SUPER_ADMIN_PROVIDER: z.string().min(1, 'SUPER_ADMIN_PROVIDER must not be empty'),
    SUPER_ADMIN_PASSWORD: z.string().min(1, 'SUPER_ADMIN_PASSWORD must not be empty'),
    JWT_PRIVATE_KEY: z.string().min(1, 'JWT_PRIVATE_KEY must not be empty'),
    REFRESH_TOKEN_PRIVATE_KEY: z.string().min(1, 'REFRESH_TOKEN_PRIVATE_KEY must not be empty'),
    GOOGLE_CLIENT_ID: z.string().min(1, 'GOOGLE_CLIENT_ID must not be empty'),
    MOBILE_GOOGLE_CLIENT_ID: z.string().min(1, 'MOBILE_GOOGLE_CLIENT_ID must not be empty').optional(),
    GOOGLE_CLIENT_SECRET: z.string().min(1, 'GOOGLE_CLIENT_SECRET must not be empty'),
    GOOGLE_CALLBACK_URL: z.string().min(1, 'GOOGLE_CALLBACK_URL must not be empty'),
    MAIL_HOST: z.string().min(1, 'MAIL_HOST must not be empty'),
    MAIL_PORT: z.coerce.number().min(1).default(587),
    MAIL_USER: z.string().min(1, 'MAIL_USER must not be empty'),
    MAIL_PASS: z.string().min(1, 'MAIL_PASS must not be empty'),
    MAIL_SECURE: z.string().min(1, 'MAIL_SECURE must not be empty'),
    STORAGE_TYPE: z.enum(['local', 's3', 'r2']).default('local'),
    AWS_REGION: z.string().min(1, 'AWS_REGION must not be empty').optional(),
    S3_BUCKET: z.string().min(1, 'S3_BUCKET must not be empty').optional(),
    S3_PUBLIC_URL: z.string().min(1, 'S3_PUBLIC_URL must not be empty').optional(),
    APP_URL: z.string().min(1, 'APP_URL must not be empty').optional(),
    CLOUDFLARE_BUCKET_NAME: z.string().min(1, 'CLOUDFLARE_BUCKET_NAME must not be empty').optional(),
    CLOUDFLARE_PUBLIC_DOMAIN: z.string().min(1, 'CLOUDFLARE_PUBLIC_DOMAIN must not be empty').optional(),
    CLOUDFLARE_SECRET_ACCESS_KEY: z.string().min(1, 'CLOUDFLARE_SECRET_ACCESS_KEY must not be empty').optional(),
    CLOUDFLARE_ACCOUNT_ID: z.string().min(1, 'CLOUDFLARE_ACCOUNT_ID must not be empty').optional(),
    CLOUDFLARE_ACCESS_KEY_ID: z.string().min(1, 'CLOUDFLARE_ACCESS_KEY_ID must not be empty').optional()
}).superRefine((data, ctx) => {
    const requireField = (field: keyof typeof data) => {
        if (!data[field]) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: [field],
                message: `${String(field)} must not be empty`,
            });
        }
    };

    if (data.STORAGE_TYPE === 'local') {
        requireField('APP_URL');
    }

    if (data.STORAGE_TYPE === 's3') {
        requireField('AWS_REGION');
        requireField('S3_BUCKET');
        requireField('S3_PUBLIC_URL');
    }

    if (data.STORAGE_TYPE === 'r2') {
        requireField('CLOUDFLARE_BUCKET_NAME');
        requireField('CLOUDFLARE_PUBLIC_DOMAIN');
        requireField('CLOUDFLARE_SECRET_ACCESS_KEY');
        requireField('CLOUDFLARE_ACCOUNT_ID');
        requireField('CLOUDFLARE_ACCESS_KEY_ID');
    }
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
    console.error('Invalid environment variables:', z.treeifyError(parsedEnv.error));
    process.exit(1);
}

export const env = parsedEnv.data;
