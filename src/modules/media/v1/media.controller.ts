import { StatusCodes } from 'http-status-codes';
import { MediaService } from './media-processing.service.js';
import { HttpResponseError } from '../../../utils/appError.js';
import { sendSuccess } from '../../../shared/api-response.js';

export const uploadMedia = async (req, res) => {
    if (!req.file) {
        throw new HttpResponseError(StatusCodes.BAD_REQUEST, 'No file uploaded');
    }

    const media = await MediaService.processAndUpload(req.file);
    sendSuccess(res, media, StatusCodes.CREATED);
};

export const getMedia = async (req, res) => {
    const { id } = req.params;
    const media = await MediaService.getMedia(id);

    res.set('Content-Type', media.contentType);
    res.send(media.buffer);
};

export const getMediaInfo = async (req, res) => {
    const { id } = req.params;
    const mediaInfo = await MediaService.getMediaInfo(id);
    sendSuccess(res, mediaInfo);
};
