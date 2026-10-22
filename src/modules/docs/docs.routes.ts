import express from 'express';
import swaggerUi from 'swagger-ui-express';
import { openapiDocument } from '../../docs/openapi.js';

export const docsRouter = express.Router();

docsRouter.get('/openapi.json', (_req, res) => {
    res.json(openapiDocument);
});

docsRouter.use('/', swaggerUi.serve);
docsRouter.get('/', swaggerUi.setup(openapiDocument, {
    customSiteTitle: 'Clinic Appointment Backend API Documentation',
    swaggerOptions: {
        docExpansion: 'none',
        persistAuthorization: true,
    },
}));
