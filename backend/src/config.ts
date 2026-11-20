import dotenv from 'dotenv';
import os from 'node:os';
import path from 'node:path';

dotenv.config();

export const config = {
  port: Number(process.env.PORT ?? 4000),
  host: process.env.HOST ?? '0.0.0.0',
  jwtSecret: process.env.JWT_SECRET ?? 'dev-secret-change-in-production',
  instanceId: process.env.INSTANCE_ID ?? os.hostname(),
  corsOrigin: process.env.CORS_ORIGIN ?? '*',
  databaseUrl: process.env.DATABASE_URL?.trim() || '',
  sqlitePath: path.resolve(process.env.SQLITE_PATH ?? './data/portal.sqlite'),
  storageDriver: (process.env.STORAGE_DRIVER ?? 'local') as 'local' | 's3',
  localUploadDir: path.resolve(process.env.LOCAL_UPLOAD_DIR ?? './uploads'),
  s3: {
    endpoint: process.env.S3_ENDPOINT || undefined,
    region: process.env.S3_REGION ?? 'us-east-1',
    bucket: process.env.S3_BUCKET ?? 'books',
    accessKeyId: process.env.S3_ACCESS_KEY_ID ?? '',
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? '',
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE === 'true',
  },
  maxFileSizeBytes: Number(process.env.MAX_FILE_SIZE_BYTES ?? 50 * 1024 * 1024), // 50 MB
};
