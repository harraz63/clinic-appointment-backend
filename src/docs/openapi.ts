const jsonRequest = (schema: object) => ({
    required: true,
    content: { 'application/json': { schema } },
});

const successResponse = {
    '200': {
        description: 'Successful response wrapped in the standard JSON envelope',
        content: { 'application/json': { schema: { $ref: '#/components/schemas/Success' } } },
    },
};

const createdResponse = {
    '201': {
        description: 'Resource created and returned in the standard JSON envelope',
        content: { 'application/json': { schema: { $ref: '#/components/schemas/Success' } } },
    },
};

const validationError = {
    '422': {
        description: 'Request validation failed',
        content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
    },
};

const secured = [{ bearerAuth: [] }];

export const openapiDocument = {
    openapi: '3.0.3',
    info: {
        title: 'Clinic Appointment Backend API',
        version: '1.0.0',
        description: 'HTTP API for authentication, user management, media, and service health.',
    },
    servers: [{ url: '/', description: 'Current API origin' }],
    tags: [
        { name: 'Metadata' },
        { name: 'Authentication' },
        { name: 'Users' },
        { name: 'Media' },
    ],
    paths: {
        '/': {
            get: {
                tags: ['Metadata'],
                summary: 'Get application metadata',
                responses: { ...successResponse, '500': { description: 'Internal server error', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } } },
            },
        },
        '/health': {
            get: {
                tags: ['Metadata'],
                summary: 'Check database health',
                responses: {
                    '200': { ...successResponse['200'], description: 'Database is available; diagnostics are in data' },
                    '503': {
                        description: 'Database is unavailable; error details and health diagnostics are returned',
                        content: { 'application/json': { schema: { $ref: '#/components/schemas/HealthError' } } },
                    },
                },
            },
        },
        '/api/constant/roles': {
            get: {
                tags: ['Metadata'],
                summary: 'Get supported roles',
                responses: successResponse,
            },
        },
        '/api/v1/auth/register': {
            post: {
                tags: ['Authentication'],
                summary: 'Start customer registration and return a verification OTP',
                requestBody: jsonRequest({
                    type: 'object',
                    required: ['phone', 'name', 'password'],
                    properties: {
                        phone: { type: 'string', description: 'Egyptian mobile phone number' },
                        name: { type: 'string', minLength: 5, maxLength: 30 },
                        password: { type: 'string', format: 'password' },
                    },
                    additionalProperties: false,
                }),
                responses: { '202': { description: 'OTP is returned in data.otp for verification' }, ...validationError },
            },
        },
        '/api/v1/auth/send-otp': {
            post: {
                tags: ['Authentication'],
                summary: 'Resend a registration or password reset OTP',
                requestBody: jsonRequest({ type: 'object', required: ['phone', 'type'], properties: { phone: { type: 'string' }, type: { type: 'string', enum: ['register', 'resetPassword'] } }, additionalProperties: false }),
                responses: { '202': { description: 'Returns data.otp when an eligible OTP is issued; otherwise data is null' }, ...validationError },
            },
        },
        '/api/v1/auth/register/verify': {
            post: {
                tags: ['Authentication'],
                summary: 'Verify signup OTP and create a customer account',
                requestBody: jsonRequest({ type: 'object', required: ['phone', 'otp'], properties: { phone: { type: 'string' }, otp: { type: 'string', pattern: '^\\d{6}$' } }, additionalProperties: false }),
                responses: successResponse,
            },
        },
        '/api/v1/auth/forgot-password': {
            post: {
                tags: ['Authentication'],
                summary: 'Request a customer password reset OTP by phone',
                requestBody: jsonRequest({ type: 'object', required: ['phone'], properties: { phone: { type: 'string' } }, additionalProperties: false }),
                responses: { '202': { description: 'Returns data.otp for an eligible customer; otherwise data is null' }, ...validationError },
            },
        },
        '/api/v1/auth/reset-password': {
            post: {
                tags: ['Authentication'],
                summary: 'Reset a customer password using an OTP',
                requestBody: jsonRequest({ type: 'object', required: ['phone', 'otp', 'newPassword'], properties: { phone: { type: 'string' }, otp: { type: 'string', pattern: '^\\d{6}$' }, newPassword: { type: 'string', format: 'password' } }, additionalProperties: false }),
                responses: successResponse,
            },
        },
        '/api/v1/auth/login': {
            post: {
                tags: ['Authentication'],
                summary: 'Log in with phone and password',
                requestBody: jsonRequest({
                    type: 'object',
                    required: ['phone', 'password'],
                    properties: {
                        phone: { type: 'string' },
                        password: { type: 'string', format: 'password' },
                    },
                }),
                responses: { ...successResponse, ...validationError },
            },
        },
        '/api/v1/auth/refresh-token': {
            post: {
                tags: ['Authentication'],
                summary: 'Rotate a refresh token',
                requestBody: jsonRequest({
                    type: 'object',
                    required: ['refreshToken'],
                    properties: { refreshToken: { type: 'string' } },
                }),
                responses: { ...successResponse, ...validationError },
            },
        },
        '/api/v1/auth/logout': {
            post: {
                tags: ['Authentication'],
                summary: 'Log out and remove the refresh-token session',
                requestBody: jsonRequest({
                    type: 'object',
                    required: ['refreshToken'],
                    properties: { refreshToken: { type: 'string' } },
                }),
                responses: successResponse,
            },
        },
        '/api/v1/auth/me': {
            get: {
                tags: ['Authentication'],
                summary: 'Get the authenticated user profile',
                security: secured,
                responses: successResponse,
            },
            patch: {
                tags: ['Authentication'],
                summary: 'Update the authenticated user profile',
                security: secured,
                requestBody: jsonRequest({
                    type: 'object',
                    properties: { name: { type: 'string', minLength: 5, maxLength: 30 } },
                    additionalProperties: false,
                }),
                responses: { ...successResponse, ...validationError },
            },
            delete: {
                tags: ['Authentication'],
                summary: 'Delete the authenticated user account',
                security: secured,
                responses: successResponse,
            },
        },
        '/api/v1/auth/me/phone': {
            patch: {
                tags: ['Authentication'],
                summary: 'Request a verified customer phone change',
                security: secured,
                requestBody: jsonRequest({ type: 'object', required: ['phone'], properties: { phone: { type: 'string' } }, additionalProperties: false }),
                responses: { '202': { description: 'OTP is returned in data.otp; current phone remains active until verification' }, ...validationError },
            },
        },
        '/api/v1/auth/me/phone/verify': {
            post: {
                tags: ['Authentication'],
                summary: 'Verify and activate the pending customer phone number',
                security: secured,
                requestBody: jsonRequest({ type: 'object', required: ['otp'], properties: { otp: { type: 'string', pattern: '^\\d{6}$' } }, additionalProperties: false }),
                responses: successResponse,
            },
        },
        '/api/v1/auth/password': {
            patch: {
                tags: ['Authentication'],
                summary: 'Change the authenticated user password',
                security: secured,
                requestBody: jsonRequest({
                    type: 'object',
                    required: ['currentPassword', 'newPassword'],
                    properties: {
                        currentPassword: { type: 'string', format: 'password' },
                        newPassword: { type: 'string', format: 'password' },
                    },
                }),
                responses: { ...successResponse, ...validationError },
            },
        },
        '/api/v1/users': {
            post: {
                tags: ['Users'],
                summary: 'Create a user (admin only)',
                security: secured,
                responses: { ...createdResponse, ...validationError },
            },
        },
        '/api/v1/users/filter': {
            get: {
                tags: ['Users'],
                summary: 'Filter users (admin only)',
                security: secured,
                parameters: [
                    { in: 'query', name: 'page', schema: { type: 'integer', minimum: 1 } },
                    { in: 'query', name: 'limit', schema: { type: 'integer', minimum: 1 } },
                    { in: 'query', name: 'phone', schema: { type: 'string' } },
                    { in: 'query', name: 'name', schema: { type: 'string' } },
                    { in: 'query', name: 'role', schema: { type: 'string', enum: ['admin', 'doctor', 'customer'] } },
                    { in: 'query', name: 'isVerified', schema: { type: 'boolean' } },
                    { in: 'query', name: 'isBlocked', schema: { type: 'boolean' } },
                ],
                responses: successResponse,
            },
        },
        '/api/v1/users/{id}': {
            parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string', format: 'uuid' } }],
            get: { tags: ['Users'], summary: 'Get a user (admin only)', security: secured, responses: successResponse },
            patch: { tags: ['Users'], summary: 'Update a user (admin only)', security: secured, responses: successResponse },
            delete: { tags: ['Users'], summary: 'Delete a user (admin only)', security: secured, responses: successResponse },
        },
        '/api/v1/media/upload': {
            post: {
                tags: ['Media'],
                summary: 'Upload a public media file',
                requestBody: {
                    required: true,
                    content: { 'multipart/form-data': { schema: {
                        type: 'object',
                        required: ['media'],
                        properties: { media: { type: 'string', format: 'binary' } },
                    } } },
                },
                responses: {
                    ...createdResponse,
                    '400': { description: 'Upload rejected', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
                },
            },
        },
        '/api/v1/media/{id}': {
            parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string', format: 'uuid' } }],
            get: {
                tags: ['Media'],
                summary: 'Retrieve media bytes',
                responses: { '200': { description: 'Media file' }, '404': { description: 'Media not found' } },
            },
        },
        '/api/v1/media/{id}/info': {
            parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string', format: 'uuid' } }],
            get: { tags: ['Media'], summary: 'Get media metadata', responses: successResponse },
        },
    },
    components: {
        securitySchemes: {
            bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
        },
        schemas: {
            Success: {
                type: 'object',
                required: ['status', 'data'],
                properties: {
                    status: { type: 'string', enum: ['success'] },
                    data: { nullable: true, description: 'Endpoint result, or null when the action has no result' },
                },
            },
            Error: {
                type: 'object',
                required: ['message', 'statusCode', 'status'],
                properties: {
                    message: { type: 'string' },
                    statusCode: { type: 'integer' },
                    status: { type: 'string', enum: ['fail', 'error'] },
                },
            },
            HealthError: {
                type: 'object',
                required: ['message', 'statusCode', 'status', 'data'],
                properties: {
                    message: { type: 'string' },
                    statusCode: { type: 'integer', enum: [503] },
                    status: { type: 'string', enum: ['error'] },
                    data: {
                        type: 'object',
                        required: ['status', 'service', 'version', 'uptime', 'timestamp', 'dependencies'],
                        properties: {
                            status: { type: 'string', enum: ['degraded'] },
                            service: { type: 'string' },
                            version: { type: 'string' },
                            uptime: { type: 'number' },
                            timestamp: { type: 'string', format: 'date-time' },
                            dependencies: { type: 'object', properties: { database: { type: 'string', enum: ['down'] } } },
                        },
                    },
                },
            },
        },
    },
};
