// Isolated test configuration overrides local .env without printing its values.
Object.assign(process.env, {
    NODE_ENV: 'test', DB_URI: 'postgres://postgres@127.0.0.1:1/clinic_tests',
    APP_NAME: 'Clinic Test', APP_VERSION: '1.0.0', PORT: '3000',
    SUPER_ADMIN_PHONE: '01012345678', SUPER_ADMIN_PASSWORD: 'TestOnly#123',
    JWT_PRIVATE_KEY: 'test-only-access-key', REFRESH_TOKEN_PRIVATE_KEY: 'test-only-refresh-key',
    STORAGE_TYPE: 'local', APP_URL: 'http://localhost:3000', REDIS_URL: 'redis://127.0.0.1:6379',
    OTP_HMAC_SECRET: 'test-only-secret-at-least-32-characters', OTP_TTL_MINUTES: '10',
    OTP_RESEND_COOLDOWN_SECONDS: '60', OTP_MAX_ATTEMPTS: '5',
});
