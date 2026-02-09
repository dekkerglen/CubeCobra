import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { fromNodeProviderChain } from '@aws-sdk/credential-providers';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();

const publicS3 = new S3Client({
  region: process.env.AWS_REGION || 'us-east-2',
  // No credentials
  credentials: { accessKeyId: '', secretAccessKey: '' },
  // No signing of requests
  signer: { sign: async (req) => req },
});

const authenticatedS3 = new S3Client({
  endpoint: process.env.AWS_ENDPOINT || undefined,
  forcePathStyle: !!process.env.AWS_ENDPOINT,
  credentials: fromNodeProviderChain(),
  region: process.env.AWS_REGION || 'us-east-2',
});

/**
 * Download only the card files needed by the recommender service
 * (only oracleToId.json - carddict is no longer needed)
 */
export async function updateCardbase(basePath: string = 'private', bucket: string): Promise<void> {
  console.log('Downloading card data files needed for recommender service...');

  if (!fs.existsSync(basePath)) {
    fs.mkdirSync(basePath, { recursive: true });
  }

  const s3 = bucket === 'cubecobra-public' ? publicS3 : authenticatedS3;

  // Only download oracleToId - filtering is now done on server side
  const requiredFiles = ['oracleToId.json'];

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
