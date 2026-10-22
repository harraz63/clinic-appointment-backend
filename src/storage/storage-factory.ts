import { S3StorageService } from './s3-storage.service.js';
import { LocalStorageService } from './local-storage.service.js';
import { R2StorageService } from '../modules/media/v1/r2-storage.service.js';
import { env } from '../config/env.js';

export class StorageFactory {
    static getStorage() {
        switch (env.STORAGE_TYPE) {
        case 's3':
            console.log('Using S3StorageService');
            return new S3StorageService();
        case 'r2':
            console.log('Using R2StorageService');
            return new R2StorageService();
        case 'local':
            console.log('Using LocalStorageService');
            return new LocalStorageService();
        default:
            throw new Error('Invalid storage type');
        }
    }
}