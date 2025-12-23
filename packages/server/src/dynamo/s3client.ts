// Load Environment Variables
import dotenv from 'dotenv';
dotenv.config();

import { S3 } from '@aws-sdk/client-s3';
import { fromNodeProviderChain } from '@aws-sdk/credential-providers';

export const s3 = new S3({
  endpoint: process.env.AWS_ENDPOINT || undefined,
  forcePathStyle: !!process.env.AWS_ENDPOINT,
  credentials: fromNodeProviderChain(),
  region: process.env.AWS_REGION,
});

export const getObject = async (bucket: string, key: string): Promise<any> => {
  try {
    const res = await s3.getObject({
      Bucket: bucket,
      Key: key,
    });

    return JSON.parse(await res!.Body!.transformToString());
  } catch {
    return null;
  }
};

export const putObject = async (bucket: string, key: string, value: any): Promise<void> => {
  await s3.putObject({
    Bucket: bucket,
    Key: key,
    Body: JSON.stringify(value),
  });
};

export const deleteObject = async (bucket: string, key: string): Promise<void> => {
  await s3.deleteObject({
    Bucket: bucket,
    Key: key,
  });
};

export const getBucketName = (): string => {
  //So S3 actions don't complain that an environment variable could be undefined
  if (!process.env.DATA_BUCKET) {
    throw new Error('Bucket is not set');
  }
  return process.env.DATA_BUCKET;
};

/**
 * Lists all versions of an S3 object, including version IDs and timestamps.
 */
export const listObjectVersions = async (
  bucket: string,
  key: string,
): Promise<Array<{ versionId: string; lastModified: Date; isLatest: boolean }>> => {
  const response = await s3.listObjectVersions({
    Bucket: bucket,
    Prefix: key,
  });

  const versions: Array<{ versionId: string; lastModified: Date; isLatest: boolean }> = [];

  // Filter to exact key match and map to our format
  if (response.Versions) {
    for (const version of response.Versions) {
      if (version.Key === key && version.VersionId && version.LastModified) {
        versions.push({
          versionId: version.VersionId,
          lastModified: version.LastModified,
          isLatest: version.IsLatest ?? false,
        });
      }
    }
  }

  // Sort by last modified date, newest first
  versions.sort((a, b) => b.lastModified.getTime() - a.lastModified.getTime());

  return versions;
};

/**
 * Gets a specific version of an S3 object by version ID.
 */
export const getObjectVersion = async (bucket: string, key: string, versionId: string): Promise<any> => {
  try {
    const res = await s3.getObject({
      Bucket: bucket,
      Key: key,
      VersionId: versionId,
    });

    return JSON.parse(await res!.Body!.transformToString());
  } catch {
    return null;
  }
};

module.exports = {
  s3,
  getObject,
  putObject,
  deleteObject,
  getBucketName,
  listObjectVersions,
  getObjectVersion,
};
