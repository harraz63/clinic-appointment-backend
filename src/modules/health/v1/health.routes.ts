import express from 'express';
import { healthCheckController } from './health.controller.js';

export const healthRouter = express.Router();

healthRouter.get('/', healthCheckController);
