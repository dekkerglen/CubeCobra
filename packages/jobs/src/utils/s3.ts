import { GetObjectCommand, ListObjectsV2Command, PutObjectCommand, S3 } from '@aws-sdk/client-s3';
import { fromNodeProviderChain } from '@aws-sdk/credential-providers';
import { Readable } from 'stream';

// Initialize S3 client
export const s3 = new S3({
  endpoint: process.env.AWS_ENDPOINT || undefined,
  forcePathStyle: !!process.env.AWS_ENDPOINT,
  credentials: fromNodeProviderChain(),
  region: process.env.AWS_REGION,
});

/**
 * Get the DATA_BUCKET name from environment variables
 */
export const getJobsBucket = (): string => {
  if (!process.env.DATA_BUCKET) {
    throw new Error('DATA_BUCKET environment variable is not set');
  }
  return process.env.DATA_BUCKET;
};

/**
 * Upload a JSON object to S3
 */
export const uploadJson = async (key: string, data: any): Promise<void> => {
  const bucket = getJobsBucket();
  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: JSON.stringify(data),
      ContentType: 'application/json',
    }),
  );
};

/**
 * Upload a file from the filesystem to S3
 * Uses streaming to avoid loading large files into memory
 */
export const uploadFile = async (key: string, filePath: string, contentType?: string): Promise<void> => {
  const fs = await import('fs');
  const bucket = getJobsBucket();
  const stream = fs.createReadStream(filePath);

  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: stream,
      ContentType: contentType || 'application/json',
    }),
  );
};

/**
 * Download a JSON object from S3
 * Returns null if the object doesn't exist
 */
export const downloadJson = async (key: string): Promise<any | null> => {
  const bucket = getJobsBucket();
  try {
    const response = await s3.send(
      new GetObjectCommand({
        Bucket: bucket,
        Key: key,
      }),
    );

    if (!response.Body) {
      return null;
    }

    const bodyContents = await streamToString(response.Body as Readable);
    return JSON.parse(bodyContents);
  } catch (error: any) {
    if (error.name === 'NoSuchKey' || error.$metadata?.httpStatusCode === 404) {
      return null;
    }
    throw error;
  }
};

/**
 * Check if a file exists in S3
 */
export const fileExists = async (key: string): Promise<boolean> => {
  const bucket = getJobsBucket();
  try {
    await s3.send(
      new GetObjectCommand({
        Bucket: bucket,
        Key: key,
      }),
    );
    return true;
  } catch (error: any) {
    if (error.name === 'NoSuchKey' || error.$metadata?.httpStatusCode === 404) {
      return false;
    }
    throw error;
  }
};

/**
 * List all files with a given prefix in S3
 * Returns an array of keys (file paths)
 */
export const listFiles = async (prefix: string): Promise<string[]> => {
  const bucket = getJobsBucket();
  const files: string[] = [];
  let continuationToken: string | undefined;

  do {
    const response = await s3.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: prefix,
        ContinuationToken: continuationToken,
      }),
    );

    if (response.Contents) {
      for (const object of response.Contents) {
        if (object.Key) {
          files.push(object.Key);
        }
      }
    }

    continuationToken = response.NextContinuationToken;
  } while (continuationToken);

  return files;
};

/**
 * Get the most recent file from a list of S3 keys
 * Useful for getting the latest history state
 */
export const getMostRecentFile = async (prefix: string): Promise<string | null> => {
  const files = await listFiles(prefix);
  if (files.length === 0) {
    return null;
  }

  // Sort files by name (assuming date-based naming like YYYY-M-D.json)
  files.sort((a, b) => {
    const aName = a.split('/').pop()?.replace('.json', '') || '';
    const bName = b.split('/').pop()?.replace('.json', '') || '';

    // Parse date components
    const aParts = aName.split('-').map((x) => parseInt(x, 10));
    const bParts = bName.split('-').map((x) => parseInt(x, 10));

    // Compare year, month, day
    for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
      const aVal = aParts[i] || 0;
      const bVal = bParts[i] || 0;
      if (aVal !== bVal) {
        return bVal - aVal; // Descending order
      }
    }

    return 0;
  });

  return files[0] || null;
};

/**
 * Helper function to convert a stream to a string
 */
async function streamToString(stream: Readable): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    stream.on('data', (chunk) => chunks.push(chunk));
    stream.on('error', reject);
    stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
  });
}
