import express from 'express';
import { auth } from '../../../middleware/authorization.middleware.js';
import { validateRequest } from '../../../middleware/validation.middleware.js';
import { updateFCMTokenController } from './user-session.controller.js';
import { updateFCMTokenSchema } from './user-session.validation.js';


export const userSessionRouterV1 = express.Router();

userSessionRouterV1.patch(
    '/fcm-token',
    auth,
    validateRequest(updateFCMTokenSchema),
    updateFCMTokenController
);
