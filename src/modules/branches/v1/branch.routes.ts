import express from 'express';
import { Roles } from '../../../constants/roles.js';
import { auth, authorizeRoles } from '../../../middleware/authorization.middleware.js';
import { validateRequest } from '../../../middleware/validation.middleware.js';
import {
    createBranchController,
    deleteBranchController,
    getBranchController,
    listBranchesController,
    listPublicBranchesController,
    updateBranchController,
} from './branch.controller.js';
import { adminBranchListSchema, branchIdSchema, branchInputSchema, branchUpdateSchema, publicBranchListSchema } from './branch.validation.js';

export const publicBranchRouterV1 = express.Router();
publicBranchRouterV1.get('/', validateRequest(publicBranchListSchema), listPublicBranchesController);

export const adminBranchRouterV1 = express.Router();
adminBranchRouterV1.use(auth, authorizeRoles(Roles.ADMIN));
adminBranchRouterV1.post('/', validateRequest(branchInputSchema), createBranchController);
adminBranchRouterV1.get('/', validateRequest(adminBranchListSchema), listBranchesController);
adminBranchRouterV1.get('/:id', validateRequest(branchIdSchema), getBranchController);
adminBranchRouterV1.patch('/:id', validateRequest(branchIdSchema.concat(branchUpdateSchema).min(2)), updateBranchController);
adminBranchRouterV1.delete('/:id', validateRequest(branchIdSchema), deleteBranchController);
