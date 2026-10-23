import express from 'express';
import { Roles } from '../../../constants/roles.js';
import { auth, authorizeRoles } from '../../../middleware/authorization.middleware.js';
import { validateRequest } from '../../../middleware/validation.middleware.js';
import {
    createSpecialtyController,
    deleteSpecialtyController,
    getSpecialtyController,
    listPublicSpecialtiesController,
    listSpecialtiesController,
    updateSpecialtyController,
} from './specialty.controller.js';
import { adminSpecialtyListSchema, publicSpecialtyListSchema, specialtyIdSchema, specialtyInputSchema, specialtyUpdateSchema } from './specialty.validation.js';

export const publicSpecialtyRouterV1 = express.Router();
publicSpecialtyRouterV1.get('/', validateRequest(publicSpecialtyListSchema), listPublicSpecialtiesController);

export const adminSpecialtyRouterV1 = express.Router();
adminSpecialtyRouterV1.use(auth, authorizeRoles(Roles.ADMIN));
adminSpecialtyRouterV1.post('/', validateRequest(specialtyInputSchema), createSpecialtyController);
adminSpecialtyRouterV1.get('/', validateRequest(adminSpecialtyListSchema), listSpecialtiesController);
adminSpecialtyRouterV1.get('/:id', validateRequest(specialtyIdSchema), getSpecialtyController);
adminSpecialtyRouterV1.patch('/:id', validateRequest(specialtyIdSchema.concat(specialtyUpdateSchema).min(2)), updateSpecialtyController);
adminSpecialtyRouterV1.delete('/:id', validateRequest(specialtyIdSchema), deleteSpecialtyController);
