const jsonRequest = (schema: object) => ({
    required: true,
    content: { 'application/json': { schema } },
});

const successResponse = {
    '200': { description: 'Successful response' },
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
                responses: { ...successResponse, '500': { description: 'Internal server error' } },
            },
        },
        '/health': {
            get: {
                tags: ['Metadata'],
                summary: 'Check database health',
                responses: {
                    '200': { description: 'Database is available' },
                    '503': { description: 'Database is unavailable' },
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
                summary: 'Register a customer account',
                requestBody: jsonRequest({
                    type: 'object',
                    required: ['provider', 'name', 'password'],
                    properties: {
                        provider: { type: 'string', description: 'Email address or phone number' },
                        name: { type: 'string', minLength: 5, maxLength: 30 },
                        password: { type: 'string', format: 'password' },
                    },
                    additionalProperties: false,
                }),
                responses: { '201': { description: 'Customer account created' }, ...validationError },
            },
        },
        '/api/v1/auth/login': {
            post: {
                tags: ['Authentication'],
                summary: 'Log in with provider and password',
                requestBody: jsonRequest({
                    type: 'object',
                    required: ['provider', 'password'],
                    properties: {
                        provider: { type: 'string' },
                        password: { type: 'string', format: 'password' },
                    },
                }),
                responses: { '200': { description: 'User and access/refresh tokens' }, ...validationError },
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
                responses: { '200': { description: 'New access and refresh tokens' }, ...validationError },
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
                responses: { '201': { description: 'User created' }, ...validationError },
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
                    { in: 'query', name: 'provider', schema: { type: 'string' } },
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
                responses: { '200': { description: 'Media uploaded' }, '400': { description: 'Upload rejected' } },
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
            Error: {
                type: 'object',
                properties: {
                    message: { type: 'string' },
                    statusCode: { type: 'integer' },
                    status: { type: 'string', enum: ['fail', 'error'] },
                },
            },
        },
    },
};
