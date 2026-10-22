import express from 'express';
import { getRolesController } from './constant.controller.js';

export const constantRouter = express.Router();

constantRouter.get('/roles', getRolesController);