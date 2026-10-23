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
        description: 'HTTP API for authentication, user management, clinic catalogs, doctor administration and schedules, media, and service health.',
    },
    servers: [{ url: '/', description: 'Current API origin' }],
    tags: [
        { name: 'Metadata' },
        { name: 'Authentication' },
        { name: 'Users' },
        { name: 'Branches' },
        { name: 'Specialties' },
        { name: 'Doctors' },
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
        '/api/v1/branches': {
            get: {
                tags: ['Branches'],
                summary: 'Browse active branches',
                parameters: [
                    { in: 'query', name: 'search', schema: { type: 'string', maxLength: 100 }, description: 'Case-insensitive match against Arabic or English branch names' },
                    { in: 'query', name: 'page', schema: { type: 'integer', minimum: 1, default: 1 } },
                    { in: 'query', name: 'limit', schema: { type: 'integer', minimum: 1, maximum: 100, default: 10 } },
                ],
                responses: { ...successResponse, ...validationError },
            },
        },
        '/api/v1/specialties': {
            get: {
                tags: ['Specialties'],
                summary: 'Browse active specialties',
                parameters: [
                    { in: 'query', name: 'search', schema: { type: 'string', maxLength: 100 }, description: 'Case-insensitive match against Arabic or English specialty names' },
                    { in: 'query', name: 'page', schema: { type: 'integer', minimum: 1, default: 1 } },
                    { in: 'query', name: 'limit', schema: { type: 'integer', minimum: 1, maximum: 100, default: 10 } },
                ],
                responses: { ...successResponse, ...validationError },
            },
        },
        '/api/v1/admin/branches': {
            get: {
                tags: ['Branches'],
                summary: 'List branches (admin only)',
                security: secured,
                parameters: [
                    { in: 'query', name: 'search', schema: { type: 'string', maxLength: 100 } },
                    { in: 'query', name: 'isActive', schema: { type: 'boolean' } },
                    { in: 'query', name: 'page', schema: { type: 'integer', minimum: 1, default: 1 } },
                    { in: 'query', name: 'limit', schema: { type: 'integer', minimum: 1, maximum: 100, default: 10 } },
                ],
                responses: { ...successResponse, ...validationError },
            },
            post: {
                tags: ['Branches'],
                summary: 'Create a branch (admin only)',
                security: secured,
                requestBody: jsonRequest({
                    type: 'object', required: ['name', 'address'], additionalProperties: false,
                    properties: {
                        name: { $ref: '#/components/schemas/LocalizedText' },
                        description: { $ref: '#/components/schemas/LocalizedText' },
                        address: { $ref: '#/components/schemas/LocalizedText' },
                        phone: { type: 'string' }, email: { type: 'string', format: 'email' },
                        timezone: { type: 'string', default: 'Africa/Cairo' }, isActive: { type: 'boolean', default: true },
                    },
                }),
                responses: { ...createdResponse, ...validationError },
            },
        },
        '/api/v1/admin/branches/{id}': {
            parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string', format: 'uuid' } }],
            get: { tags: ['Branches'], summary: 'Get a branch (admin only)', security: secured, responses: { ...successResponse, '404': { description: 'Branch not found' } } },
            patch: {
                tags: ['Branches'], summary: 'Update a branch (admin only)', security: secured,
                requestBody: jsonRequest({
                    type: 'object', minProperties: 1, additionalProperties: false,
                    properties: {
                        name: { $ref: '#/components/schemas/LocalizedText' },
                        description: { $ref: '#/components/schemas/LocalizedText' },
                        address: { $ref: '#/components/schemas/LocalizedText' },
                        phone: { type: 'string' }, email: { type: 'string', format: 'email' },
                        timezone: { type: 'string' }, isActive: { type: 'boolean' },
                    },
                }),
                responses: { ...successResponse, ...validationError, '404': { description: 'Branch not found' } },
            },
            delete: { tags: ['Branches'], summary: 'Delete or deactivate a branch (admin only)', security: secured, responses: { ...successResponse, ...validationError, '404': { description: 'Branch not found' } } },
        },
        '/api/v1/admin/specialties': {
            get: {
                tags: ['Specialties'],
                summary: 'List specialties (admin only)',
                security: secured,
                parameters: [
                    { in: 'query', name: 'search', schema: { type: 'string', maxLength: 100 } },
                    { in: 'query', name: 'isActive', schema: { type: 'boolean' } },
                    { in: 'query', name: 'page', schema: { type: 'integer', minimum: 1, default: 1 } },
                    { in: 'query', name: 'limit', schema: { type: 'integer', minimum: 1, maximum: 100, default: 10 } },
                ],
                responses: { ...successResponse, ...validationError },
            },
            post: {
                tags: ['Specialties'],
                summary: 'Create a specialty (admin only)',
                security: secured,
                requestBody: jsonRequest({
                    type: 'object', required: ['name'], additionalProperties: false,
                    properties: {
                        name: { $ref: '#/components/schemas/LocalizedText' },
                        description: { $ref: '#/components/schemas/LocalizedText' },
                        isActive: { type: 'boolean', default: true },
                    },
                }),
                responses: { ...createdResponse, ...validationError },
            },
        },
        '/api/v1/admin/specialties/{id}': {
            parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string', format: 'uuid' } }],
            get: { tags: ['Specialties'], summary: 'Get a specialty (admin only)', security: secured, responses: { ...successResponse, '404': { description: 'Specialty not found' } } },
            patch: {
                tags: ['Specialties'], summary: 'Update a specialty (admin only)', security: secured,
                requestBody: jsonRequest({
                    type: 'object', minProperties: 1, additionalProperties: false,
                    properties: {
                        name: { $ref: '#/components/schemas/LocalizedText' },
                        description: { $ref: '#/components/schemas/LocalizedText' },
                        isActive: { type: 'boolean' },
                    },
                }),
                responses: { ...successResponse, ...validationError, '404': { description: 'Specialty not found' } },
            },
            delete: { tags: ['Specialties'], summary: 'Delete or deactivate a specialty (admin only)', security: secured, responses: { ...successResponse, ...validationError, '404': { description: 'Specialty not found' } } },
        },
        '/api/v1/admin/doctors': {
            get: {
                tags: ['Doctors'], summary: 'List doctors (admin only)', security: secured,
                parameters: [
                    { in: 'query', name: 'search', schema: { type: 'string', maxLength: 100 }, description: 'Case-insensitive match against Arabic or English doctor profile names' },
                    { in: 'query', name: 'branchId', schema: { type: 'string', format: 'uuid' } },
                    { in: 'query', name: 'specialtyId', schema: { type: 'string', format: 'uuid' } },
                    { in: 'query', name: 'isActive', schema: { type: 'boolean' } },
                    { in: 'query', name: 'isAvailable', schema: { type: 'boolean' } },
                    { in: 'query', name: 'page', schema: { type: 'integer', minimum: 1, default: 1 } },
                    { in: 'query', name: 'limit', schema: { type: 'integer', minimum: 1, maximum: 100, default: 10 } },
                ],
                responses: { ...successResponse, ...validationError },
            },
            post: {
                tags: ['Doctors'], summary: 'Create a doctor account and profile (admin only)', security: secured,
                requestBody: jsonRequest({
                    type: 'object', required: ['phone', 'accountName', 'password', 'branchId', 'specialtyId', 'name', 'appointmentPrice', 'appointmentDurationMinutes'], additionalProperties: false,
                    properties: {
                        phone: { type: 'string', description: 'Egyptian mobile phone number' }, accountName: { type: 'string', minLength: 5, maxLength: 255 }, password: { type: 'string', format: 'password', description: 'Must include uppercase, lowercase, number and special character' },
                        branchId: { type: 'string', format: 'uuid' }, specialtyId: { type: 'string', format: 'uuid' }, name: { $ref: '#/components/schemas/LocalizedText' }, biography: { $ref: '#/components/schemas/LocalizedText' },
                        appointmentPrice: { type: 'string', pattern: '^\\d{1,10}\\.\\d{2}$' }, currency: { type: 'string', pattern: '^[A-Z]{3}$', description: 'Defaults to the configured CLINIC_CURRENCY' }, appointmentDurationMinutes: { type: 'integer', minimum: 1 }, isAvailable: { type: 'boolean', default: true }, isActive: { type: 'boolean', default: true },
                    },
                }),
                responses: { ...createdResponse, ...validationError, '409': { description: 'Phone number already exists' } },
            },
        },
        '/api/v1/admin/doctors/{id}': {
            parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string', format: 'uuid' } }],
            get: { tags: ['Doctors'], summary: 'Get a doctor and related account, branch, and specialty (admin only)', security: secured, responses: { ...successResponse, '404': { description: 'Doctor not found' } } },
            patch: {
                tags: ['Doctors'], summary: 'Update a doctor profile (admin only)', security: secured,
                requestBody: jsonRequest({
                    type: 'object', minProperties: 1, additionalProperties: false,
                    properties: {
                        branchId: { type: 'string', format: 'uuid' }, specialtyId: { type: 'string', format: 'uuid' }, name: { $ref: '#/components/schemas/LocalizedText' }, biography: { allOf: [{ $ref: '#/components/schemas/LocalizedText' }], nullable: true },
                        appointmentPrice: { type: 'string', pattern: '^\\d{1,10}\\.\\d{2}$' }, currency: { type: 'string', pattern: '^[A-Z]{3}$' }, appointmentDurationMinutes: { type: 'integer', minimum: 1 }, isAvailable: { type: 'boolean' }, isActive: { type: 'boolean' },
                    },
                }),
                responses: { ...successResponse, ...validationError, '404': { description: 'Doctor not found' }, '409': { description: 'Saved hours or exceptions must be cleared before branch reassignment' }, '422': { description: 'Branch and specialty assignments must be active' } },
            },
            delete: { tags: ['Doctors'], summary: 'Deactivate a doctor profile and retain its account and history (admin only)', security: secured, responses: { ...successResponse, '404': { description: 'Doctor not found' } } },
        },
        '/api/v1/admin/doctors/{id}/schedules': {
            parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string', format: 'uuid' } }],
            get: { tags: ['Doctors'], summary: 'Get weekly doctor hours and branch timezone (admin only)', security: secured, responses: { ...successResponse, '404': { description: 'Doctor not found' } } },
            put: {
                tags: ['Doctors'], summary: 'Replace all weekly doctor hours (admin only)', security: secured,
                description: 'Weekday 0 is Sunday. Times are local to the assigned branch. Intervals for one doctor may not overlap; an empty list clears the schedule.',
                requestBody: jsonRequest({ type: 'object', required: ['intervals'], additionalProperties: false, properties: {
                    intervals: { type: 'array', items: { type: 'object', required: ['weekday', 'startTime', 'endTime'], additionalProperties: false, properties: {
                        weekday: { type: 'integer', minimum: 0, maximum: 6 }, startTime: { type: 'string', pattern: '^([01][0-9]|2[0-3]):[0-5][0-9]$' }, endTime: { type: 'string', pattern: '^([01][0-9]|2[0-3]):[0-5][0-9]$' },
                    } } },
                } }),
                responses: { ...successResponse, ...validationError, '404': { description: 'Doctor not found' }, '409': { description: 'Intervals overlap' } },
            },
        },
        '/api/v1/admin/doctors/{id}/schedule-exceptions': {
            parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string', format: 'uuid' } }],
            get: { tags: ['Doctors'], summary: 'List dated schedule exceptions (admin only)', security: secured,
                parameters: [{ in: 'query', name: 'from', required: true, schema: { type: 'string', format: 'date' } }, { in: 'query', name: 'to', required: true, schema: { type: 'string', format: 'date' } }],
                responses: { ...successResponse, ...validationError, '404': { description: 'Doctor not found' } },
            },
        },
        '/api/v1/admin/doctors/{id}/schedule-exceptions/{date}': {
            parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string', format: 'uuid' } }, { in: 'path', name: 'date', required: true, schema: { type: 'string', format: 'date' } }],
            put: { tags: ['Doctors'], summary: 'Set a day off or replacement intervals for one local date (admin only)', security: secured,
                requestBody: jsonRequest({ type: 'object', required: ['isDayOff'], additionalProperties: false, properties: {
                    isDayOff: { type: 'boolean' }, reason: { $ref: '#/components/schemas/LocalizedText' },
                    intervals: { type: 'array', minItems: 1, items: { type: 'object', required: ['startTime', 'endTime'], additionalProperties: false, properties: {
                        startTime: { type: 'string', pattern: '^([01][0-9]|2[0-3]):[0-5][0-9]$' }, endTime: { type: 'string', pattern: '^([01][0-9]|2[0-3]):[0-5][0-9]$' },
                    } } },
                } }),
                responses: { ...successResponse, ...validationError, '404': { description: 'Doctor not found' }, '409': { description: 'Replacement intervals overlap' } },
            },
            delete: { tags: ['Doctors'], summary: 'Remove the date exception and restore weekly hours (admin only)', security: secured,
                responses: { ...successResponse, ...validationError, '404': { description: 'Doctor or exception not found' } },
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
        '/api/v1/auth/register/resend-otp': {
            post: {
                tags: ['Authentication'],
                summary: 'Resend a pending customer registration OTP',
                requestBody: jsonRequest({ type: 'object', required: ['phone'], properties: { phone: { type: 'string' } }, additionalProperties: false }),
                responses: { '202': { description: 'Returns data.otp when a pending registration exists; otherwise data is null' }, ...validationError },
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
            LocalizedText: {
                type: 'object', required: ['ar', 'en'], additionalProperties: false,
                properties: { ar: { type: 'string', minLength: 1 }, en: { type: 'string', minLength: 1 } },
            },
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
