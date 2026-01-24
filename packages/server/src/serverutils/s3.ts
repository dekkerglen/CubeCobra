import { S3 } from '@aws-sdk/client-s3';

export const getPublicS3Client = (region: string): S3 => {
  //Must set no credentials and disable signing to make anonymous requests to the public bucket
  //Reference https://github.com/aws/aws-sdk-js-v3/issues/4093#issuecomment-2364084415
  return new S3({
    region,
    // No credentials
    credentials: { accessKeyId: '', secretAccessKey: '' },
    // No signing of requests
    signer: { sign: async (req) => req },
  });
};
