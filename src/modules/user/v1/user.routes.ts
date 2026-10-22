import express from 'express';
import { auth, authorizeRoles } from '../../../middleware/authorization.middleware.js';
import { validateRequest } from '../../../middleware/validation.middleware.js';
import { Roles } from '../../../constants/roles.js';
import {
    createUserController,
    updateUserController,
    deleteUserController,
    getUserByIdController,
    getUsersFilterController
} from './user.controller.js';
import {
    createUserSchema,
    deleteUserSchema,
    getUserByIdSchema,
    getUsersByFilterSchema,
    updateUserSchema,
} from './user.validation.js';

export const userRouterV1 = express.Router();

userRouterV1.use(auth);
userRouterV1.use(authorizeRoles(Roles.ADMIN));

userRouterV1.post('/', validateRequest(createUserSchema), createUserController);
userRouterV1.get('/filter', validateRequest(getUsersByFilterSchema), getUsersFilterController);
userRouterV1.get('/:id', validateRequest(getUserByIdSchema), getUserByIdController);
userRouterV1.patch('/:id', validateRequest(updateUserSchema), updateUserController);
userRouterV1.delete('/:id', validateRequest(deleteUserSchema), deleteUserController);