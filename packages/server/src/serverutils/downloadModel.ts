import fs from 'fs';
import path from 'path';
import { Readable } from 'stream';

import 'dotenv/config';

import { s3 as authenticatedS3 } from '../dynamo/s3client';
import { getPublicS3Client } from './s3';

export const downloadModelsFromS3 = async (basePath: string = '', bucket: string, region: string): Promise<void> => {
  // Create S3 client with provided region
  const s3 = bucket === 'cubecobra-public' ? getPublicS3Client(region) : authenticatedS3;

  // list all from s3 under s3://{bucket}/model
  const listResult = await s3.listObjectsV2({ Bucket: bucket, Prefix: 'model/' });

  console.log('Downloading model files from S3...');

  // Check if Contents exists and has items
  if (!listResult.Contents || listResult.Contents.length === 0) {
    console.log('No model files found in S3');
    return;
  }

  // for each file, download it to the local model directory
  for (const file of listResult.Contents) {
    if (!file.Key) {
      console.warn('Skipping file with undefined key');
      continue;
    }

    // Skip directory markers (keys ending with '/')
    if (file.Key.endsWith('/')) {
      continue;
    }

    const res = await s3.getObject({ Bucket: bucket, Key: file.Key });

    // make sure folders exist
    const localFilePath = path.join(basePath, file.Key);
    const localDir = path.dirname(localFilePath);

    // Create directory recursively if it doesn't exist
    if (!fs.existsSync(localDir)) {
      fs.mkdirSync(localDir, { recursive: true });
    }

    //Models are a mix of JSON and binary, can't simply call res.Body.transformToString
    if (res.Body) {
      // Create a writable stream to the local file
      const fileStream = fs.createWriteStream(localFilePath);

      // Convert Body to Readable stream and pipe to file
      await new Promise<void>((resolve, reject) => {
        const bodyStream = res.Body as Readable;
        bodyStream
          .pipe(fileStream)
          .on('error', (err: Error) => reject(err))
          .on('close', () => resolve()); // 'close' event indicates the stream has finished writing
      });

      console.log(`Downloaded ${file.Key}`);
    } else {
      console.error('S3 object body is empty.');
    }
  }
};
