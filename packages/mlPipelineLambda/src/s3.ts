import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';

const s3 = new S3Client({ region: process.env.AWS_REGION });

const isNotFound = (error: any): boolean =>
  error?.name === 'NoSuchKey' || error?.name === 'NotFound' || error?.$metadata?.httpStatusCode === 404;

/** The object's contents, or null when the key is missing. */
export const readText = async (bucket: string, key: string): Promise<string | null> => {
  try {
    const response = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
    return (await response.Body?.transformToString()) ?? null;
  } catch (error) {
    if (isNotFound(error)) return null;
    throw error;
  }
};

export const readJson = async <T>(bucket: string, key: string): Promise<T | null> => {
  const raw = await readText(bucket, key);
  return raw === null ? null : (JSON.parse(raw) as T);
};

export const objectExists = async (bucket: string, key: string): Promise<boolean> => {
  try {
    await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    return true;
  } catch (error) {
    if (isNotFound(error)) return false;
    throw error;
  }
};

export const deleteObject = async (bucket: string, key: string): Promise<void> => {
  await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
};

export const writeJson = async (bucket: string, key: string, data: unknown): Promise<void> => {
  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: JSON.stringify(data),
      ContentType: 'application/json',
    }),
  );
};
