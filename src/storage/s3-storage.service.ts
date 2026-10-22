import { PutObjectCommand, GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { StorageService } from './storage.service.js';
import { env } from '../config/env.js';

export class S3StorageService extends StorageService {
    private client: S3Client;
    private bucket: string;

    constructor() {
        super();
        this.client = new S3Client({ region: env.AWS_REGION });
        this.bucket = env.S3_BUCKET;
    }

    async uploadFile(buffer: Buffer, key: string, contentType: string) {
        const command = new PutObjectCommand({
            Bucket: this.bucket,
            Key: key,
            Body: buffer,
            ContentType: contentType,
            ACL: 'public-read'
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
        if (env.S3_PUBLIC_URL) {
            return `${env.S3_PUBLIC_URL}/${key}`;
        }
        return `https://${this.bucket}.s3.${env.AWS_REGION}.amazonaws.com/${key}`;
    }
}