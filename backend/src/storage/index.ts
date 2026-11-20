import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { Readable } from 'node:stream';
import {
  CreateBucketCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { config } from '../config.js';

export interface StorageService {
  init(): Promise<void>;
  upload(key: string, buffer: Buffer, contentType: string): Promise<void>;
  getStream(key: string): Promise<Readable>;
  delete(key: string): Promise<void>;
}

class LocalStorageService implements StorageService {
  constructor(private readonly baseDir: string) {}

  async init(): Promise<void> {
    await fsp.mkdir(this.baseDir, { recursive: true });
  }

  private resolveSafePath(key: string): string {
    const resolved = path.resolve(this.baseDir, key);
    if (!resolved.startsWith(this.baseDir + path.sep) && resolved !== this.baseDir) {
      throw new Error('Invalid storage key');
    }
    return resolved;
  }

  async upload(key: string, buffer: Buffer): Promise<void> {
    const targetPath = this.resolveSafePath(key);
    await fsp.mkdir(path.dirname(targetPath), { recursive: true });
    await fsp.writeFile(targetPath, buffer);
  }

  async getStream(key: string): Promise<Readable> {
    const targetPath = this.resolveSafePath(key);
    await fsp.access(targetPath, fs.constants.R_OK);
    return fs.createReadStream(targetPath);
  }

  async delete(key: string): Promise<void> {
    const targetPath = this.resolveSafePath(key);
    await fsp.rm(targetPath, { force: true });
  }
}

class S3StorageService implements StorageService {
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor() {
    this.bucket = config.s3.bucket;
    this.client = new S3Client({
      region: config.s3.region,
      endpoint: config.s3.endpoint,
      forcePathStyle: config.s3.forcePathStyle,
      credentials: {
        accessKeyId: config.s3.accessKeyId,
        secretAccessKey: config.s3.secretAccessKey,
      },
    });
  }

  async init(): Promise<void> {
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
    } catch {
      await this.client.send(new CreateBucketCommand({ Bucket: this.bucket }));
    }
  }

  async upload(key: string, buffer: Buffer, contentType: string): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: buffer,
        ContentType: contentType,
      })
    );
  }

  async getStream(key: string): Promise<Readable> {
    const response = await this.client.send(
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
      })
    );
    if (!response.Body) {
      throw new Error('Object not found');
    }
    return response.Body as Readable;
  }

  async delete(key: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: key,
      })
    );
  }
}

export const storage: StorageService =
  config.storageDriver === 's3'
    ? new S3StorageService()
    : new LocalStorageService(config.localUploadDir);
