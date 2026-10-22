 
export abstract class StorageService {
    abstract uploadFile(buffer: Buffer, key: string, contentType: string): Promise<void>;
    abstract downloadFile(key: string): Promise<Buffer>;
    abstract getPublicUrl(key: string): string;
}
 