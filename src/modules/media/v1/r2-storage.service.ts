import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { StorageService } from '../../../storage/storage.service.js';
import { env } from '../../../config/env.js';

export class R2StorageService extends StorageService {
    private client: S3Client;
    private bucket: string;

    constructor() {
        super();
        this.client = new S3Client({
            region: 'auto',
            endpoint: `https://${env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
            credentials: {
                accessKeyId: env.CLOUDFLARE_ACCESS_KEY_ID,
                secretAccessKey: env.CLOUDFLARE_SECRET_ACCESS_KEY,
            },
        });
        this.bucket = env.CLOUDFLARE_BUCKET_NAME;
    }

    async uploadFile(buffer: Buffer, key: string, contentType: string): Promise<void> {
        const command = new PutObjectCommand({
            Bucket: this.bucket,
            Key: key,
            Body: buffer,
            ContentType: contentType,
        });
        await this.client.send(command);
    }

    async downloadFile(key: string): Promise<Buffer> {
        const command = new GetObjectCommand({
            Bucket: this.bucket,
            Key: key
        });
        const { Body } = await this.client.send(command);
        const byteArray = await Body.transformToByteArray();
        return Buffer.from(byteArray);
    }

    getPublicUrl(key: string): string {
        if (env.CLOUDFLARE_PUBLIC_DOMAIN) {
            return `${env.CLOUDFLARE_PUBLIC_DOMAIN}/${key}`;
        }
        return `https://pub-${env.CLOUDFLARE_ACCOUNT_ID}.r2.dev/${key}`;
    }
}