import express from 'express';
import {
    uploadMedia,
    getMedia,
    getMediaInfo
} from './media.controller.js';
import uploadMiddleware from '../../../middleware/upload.middleware.js';

export const mediaRouterV1 = express.Router();

mediaRouterV1.post('/upload',
    uploadMiddleware.single('media'),
    uploadMedia
);

mediaRouterV1.get('/:id/info', getMediaInfo);
mediaRouterV1.get('/:id', getMedia);
