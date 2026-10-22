import multer from 'multer';
import { MediaService } from '../modules/media/v1/media-processing.service.js';

const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
    if (MediaService.getMediaType(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('Invalid file type'), false);
    }
};

export default multer({
    storage,
    fileFilter,
    limits: {
        fileSize: 50 * 1024 * 1024, // 50MB
        files: 1
    }
});