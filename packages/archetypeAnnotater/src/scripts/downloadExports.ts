import { GetObjectCommand, ListObjectsV2Command, S3Client } from '@aws-sdk/client-s3';
import { fromNodeProviderChain } from '@aws-sdk/credential-providers';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import 'dotenv/config';

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const BUCKET = 'cubecobra-public';
const DATA_DIR = path.join(currentDir, '..', '..', 'data', 'exports');

const s3 = new S3Client({
  endpoint: process.env.AWS_ENDPOINT || undefined,
  forcePathStyle: !!process.env.AWS_ENDPOINT,
  credentials: fromNodeProviderChain(),
  region: process.env.AWS_REGION || 'us-east-1',
  maxAttempts: 5,
});

async function downloadFile(key: string, destPath: string): Promise<void> {
  const command = new GetObjectCommand({ Bucket: BUCKET, Key: key });
  const response = await s3.send(command);

  if (!response.Body) {
    throw new Error(`Empty response for ${key}`);
  }

  const dir = path.dirname(destPath);
  fs.mkdirSync(dir, { recursive: true });

  const body = await response.Body.transformToString();
  fs.writeFileSync(destPath, body);
  console.log(`Downloaded: ${key} -> ${destPath}`);
}

async function listExportKeys(prefix: string): Promise<string[]> {
  const keys: string[] = [];
  let continuationToken: string | undefined;

  do {
    const command = new ListObjectsV2Command({
      Bucket: BUCKET,
      Prefix: prefix,
      ContinuationToken: continuationToken,
    });
    const response = await s3.send(command);

    for (const obj of response.Contents || []) {
      if (obj.Key) {
        keys.push(obj.Key);
      }
    }
    continuationToken = response.NextContinuationToken;
  } while (continuationToken);

  return keys;
}

async function main() {
  fs.mkdirSync(DATA_DIR, { recursive: true });

  // Download indexToOracleMap
  console.log('Downloading indexToOracleMap.json...');
  await downloadFile('export/indexToOracleMap.json', path.join(DATA_DIR, 'indexToOracleMap.json'));

  // Download all deck batch files
  console.log('Listing deck export files...');
  const deckKeys = await listExportKeys('export/decks/');
  console.log(`Found ${deckKeys.length} deck export files.`);

  const decksDir = path.join(DATA_DIR, 'decks');
  fs.mkdirSync(decksDir, { recursive: true });

  for (const key of deckKeys) {
    const filename = path.basename(key);
    await downloadFile(key, path.join(decksDir, filename));
  }

  console.log('Download complete.');
}

main().catch((err) => {
  console.error('Download failed:', err);
  process.exit(1);
});
