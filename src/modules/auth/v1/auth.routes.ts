import express from 'express';
import { validateRequest } from '../../../middleware/validation.middleware.js';
import { auth } from '../../../middleware/authorization.middleware.js';
import {
    loginController,
    registerController,
    refreshTokenController,
    logoutController,
    changePasswordController,
    getMeController,
    updateMeController,
    deleteMeController
} from './auth.controller.js';
import {
    loginSchema,
    registerSchema,
    refreshTokenSchema,
    logoutSchema,
    changePasswordSchema,
    updateMeSchema
} from './auth.validation.js';


export const authRouterV1 = express.Router();

// Public routes
authRouterV1.post('/login', validateRequest(loginSchema), loginController);
authRouterV1.post('/register', validateRequest(registerSchema), registerController);
authRouterV1.post('/refresh-token', validateRequest(refreshTokenSchema), refreshTokenController);
authRouterV1.post('/logout', validateRequest(logoutSchema), logoutController);


// Authenticated routes
authRouterV1.use(auth);
authRouterV1.patch('/password', validateRequest(changePasswordSchema), changePasswordController);
authRouterV1.get('/me', getMeController);
authRouterV1.patch('/me', validateRequest(updateMeSchema), updateMeController);
authRouterV1.delete('/me', deleteMeController);
