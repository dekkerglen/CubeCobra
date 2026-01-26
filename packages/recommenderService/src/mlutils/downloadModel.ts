import { GetObjectCommand, ListObjectsV2Command, S3Client } from '@aws-sdk/client-s3';
import fs from 'fs';
import path from 'path';
import { Readable } from 'stream';

import 'dotenv/config';

const publicS3 = new S3Client({
  region: process.env.AWS_REGION || 'us-east-2',
});

const authenticatedS3 = new S3Client({
  region: process.env.AWS_REGION || 'us-east-2',
});

export const downloadModelsFromS3 = async (basePath: string = '', bucket: string): Promise<void> => {
  const s3 = bucket === 'cubecobra-public' ? publicS3 : authenticatedS3;

  console.log('Downloading model files from S3...');

  const listCommand = new ListObjectsV2Command({ Bucket: bucket, Prefix: 'model/' });
  const listResult = await s3.send(listCommand);

  if (!listResult.Contents || listResult.Contents.length === 0) {
    console.log('No model files found in S3');
    return;
  }

  for (const file of listResult.Contents) {
    if (!file.Key) {
      console.warn('Skipping file with undefined key');
      continue;
    }

    // Skip directory markers (keys ending with '/')
    if (file.Key.endsWith('/')) {
      continue;
    }

    const getCommand = new GetObjectCommand({ Bucket: bucket, Key: file.Key });
    const res = await s3.send(getCommand);

    const localFilePath = path.join(basePath, file.Key);
    const localDir = path.dirname(localFilePath);

    if (!fs.existsSync(localDir)) {
      fs.mkdirSync(localDir, { recursive: true });
    }

    if (res.Body) {
      const fileStream = fs.createWriteStream(localFilePath);

      await new Promise<void>((resolve, reject) => {
        const bodyStream = res.Body as Readable;
        bodyStream
          .pipe(fileStream)
          .on('error', (err: Error) => reject(err))
          .on('close', () => resolve());
      });

      console.log(`Downloaded ${file.Key}`);
    } else {
      console.error('S3 object body is empty.');
    }
  }
};
