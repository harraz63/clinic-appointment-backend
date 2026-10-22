import express from 'express';
import { retrieveAppMetadataController } from './home.controller.js';

export const homeRouter = express.Router();

homeRouter.get('/', retrieveAppMetadataController);
