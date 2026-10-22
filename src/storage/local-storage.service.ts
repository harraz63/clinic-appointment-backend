import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { StorageService } from './storage.service.js';
import { env } from '../config/env.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class LocalStorageService extends StorageService {
    private storagePath: string;

    constructor() {
        super();
        this.storagePath = path.join(__dirname, '../../public/uploads');
    }

    private async ensureDirExists(filePath: string) {
        const dir = path.dirname(filePath);
        await fs.mkdir(dir, { recursive: true });
    }

    async uploadFile(buffer: Buffer, key: string) {
        const filePath = path.join(this.storagePath, key);
        await this.ensureDirExists(filePath);
        await fs.writeFile(filePath, buffer);
    }

    async downloadFile(key: string): Promise<Buffer> {
        const filePath = path.join(this.storagePath, key);
        return fs.readFile(filePath);
    }

    getPublicUrl(key: string): string {
        return `${env.APP_URL}/uploads/${key}`;
    }
}