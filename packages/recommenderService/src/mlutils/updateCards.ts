import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import fs from 'fs';
import path from 'path';

import 'dotenv/config';

const publicS3 = new S3Client({
  region: process.env.AWS_REGION || 'us-east-2',
});

const authenticatedS3 = new S3Client({
  region: process.env.AWS_REGION || 'us-east-2',
});

/**
 * Download only the card files needed by the recommender service
 * (oracleToId.json and carddict.json)
 */
export async function updateCardbase(basePath: string = 'private', bucket: string): Promise<void> {
  console.log('Downloading card data files needed for recommender service...');

  if (!fs.existsSync(basePath)) {
    fs.mkdirSync(basePath, { recursive: true });
  }

  const s3 = bucket === 'cubecobra-public' ? publicS3 : authenticatedS3;

  // Only download the files needed for ML recommendations
  const requiredFiles = ['oracleToId.json', 'carddict.json'];

  for (const file of requiredFiles) {
    try {
      const getCommand = new GetObjectCommand({
        Bucket: bucket,
        Key: `cards/${file}`,
      });

      const res = await s3.send(getCommand);
      const content = await res.Body!.transformToString();

      const filePath = path.join(basePath, file);
      fs.writeFileSync(filePath, content);

      console.log(`Downloaded ${file} to ${filePath}`);
    } catch (error: any) {
      if (error.Code === 'NoSuchKey') {
        console.log(`Skipping ${file} (not found in S3)`);
      } else {
        throw error;
      }
    }
  }

  console.log('Card data download complete for recommender service');
}
