import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import sharp from 'sharp';
import { env } from '../../../config/env.js';

const s3Client = new S3Client({
    // region: env.AWS_REGION
});

export const CloudStorage = {
    async upload(file, mediaType) {
        const key = `${Date.now()}-${file.originalname}`;
        const uploadParams = {
            Bucket: env.S3_BUCKET,
            Key: key,
            Body: file.buffer,
            ContentType: file.mimetype
        };

        await s3Client.send(new PutObjectCommand(uploadParams));
        const url = await getSignedUrl(s3Client, new GetObjectCommand(uploadParams), {
            expiresIn: 3600 
        });

        let thumbnails = {};
        if (mediaType === 'video') {
            thumbnails = await this.generateThumbnails(file, key);
        }

        return { key, url, thumbnails };
    },

    async download(key) {
        const command = new GetObjectCommand({
            Bucket: env.S3_BUCKET,
            Key: key
        });

        const { Body } = await s3Client.send(command);
        return Body.transformToByteArray();
    },

    async generateThumbnails(file, baseKey) {
        const sizes = {
            small: 320,
            medium: 640,
            large: 1200
        };

        const thumbnails = {};

        await Promise.all(
            Object.entries(sizes).map(async ([size, width]) => {
                const key = `thumbnails/${size}/${baseKey}`;
                const buffer = await sharp(file.buffer)
                    .resize(width)
                    .toBuffer();

                await s3Client.send(new PutObjectCommand({
                    Bucket: env.S3_BUCKET,
                    Key: key,
                    Body: buffer,
                    ContentType: file.mimetype
                }));

                thumbnails[size] = key;
            })
        );

        return thumbnails;
    }
};