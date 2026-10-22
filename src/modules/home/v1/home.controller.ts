import { env } from '../../../config/env.js';
import { Request, Response } from 'express';


interface AppMetadata {
    appName: string;
    appVersion: string;
}

export async function retrieveAppMetadataController(
    req: Request,
    res: Response
): Promise<void> {
    const metadata: AppMetadata = {
        appName: env.APP_NAME,
        appVersion: env.APP_VERSION,
    };
    res.json(metadata);
}