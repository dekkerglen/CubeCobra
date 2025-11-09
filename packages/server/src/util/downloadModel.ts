import 'dotenv/config';
import fs from 'fs';
import { Readable } from 'stream';

import { S3 } from '@aws-sdk/client-s3';
import { fromNodeProviderChain } from '@aws-sdk/credential-providers';
import path from 'path';

const s3: S3 = new S3({
  endpoint: process.env.AWS_ENDPOINT || undefined,
  forcePathStyle: !!process.env.AWS_ENDPOINT,
  credentials: fromNodeProviderChain(),
  region: process.env.AWS_REGION,
});

export const downloadModelsFromS3 = async (basePath: string = ''): Promise<void> => {
  // list all from s3 under s3://cubecobra/model
  const listResult = await s3.listObjectsV2({ Bucket: process.env.DATA_BUCKET!, Prefix: 'model/' });

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

    const res = await s3.getObject({ Bucket: process.env.DATA_BUCKET!, Key: file.Key });

    // make sure folders exist
    const folders = basePath.split('/').concat(file.Key.split('/'));
    folders.pop();

    let folderPath = '';
    for (const folder of folders) {
      folderPath += `${folder}/`;
      if (!fs.existsSync(folderPath)) {
        fs.mkdirSync(folderPath);
      }
    }

    //Models are a mix of JSON and binary, can't simply call res.Body.transformToString
    if (res.Body) {
      // Create a writable stream to the local file
      const fileStream = fs.createWriteStream(path.join(basePath, file.Key));

      // Convert Body to Readable stream and pipe to file
      await new Promise<void>((resolve, reject) => {
        const bodyStream = res.Body as Readable;
        bodyStream
          .pipe(fileStream)
          .on('error', (err: Error) => reject(err))
          .on('close', () => resolve()); // 'close' event indicates the stream has finished writing
      });

      // eslint-disable-next-line no-console -- Debugging
      console.log(`Downloaded ${file.Key}`);
    } else {
      // eslint-disable-next-line no-console -- Debugging
      console.error('S3 object body is empty.');
    }
  }
};
