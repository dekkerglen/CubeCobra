import { RemovalPolicy } from 'aws-cdk-lib';
import { Bucket, IBucket } from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';

export interface S3BucketsProps {
  dataBucketName: string;
  appBucketName: string;
  jobsBucketName: string;
}

/**
 * Construct for managing S3 buckets used by CubeCobra.
 *
 * Both buckets are imported by name, referencing existing S3 buckets.
 * This allows the CDK to reference the buckets without managing their lifecycle.
 */
export class S3Buckets extends Construct {
  public readonly dataBucket: IBucket;
  public readonly appBucket: IBucket;
  public readonly jobsBucket: IBucket;

  constructor(scope: Construct, id: string, props: S3BucketsProps) {
    super(scope, id);

    // Import existing app bucket
    this.appBucket = Bucket.fromBucketName(this, 'AppBucket', props.appBucketName);

    // Import existing data bucket
    this.dataBucket = Bucket.fromBucketName(this, 'DataBucket', props.dataBucketName);

    // Create jobs bucket for storing job artifacts and temporary data
    this.jobsBucket = new Bucket(this, 'JobsBucket', {
      bucketName: props.jobsBucketName,
      removalPolicy: RemovalPolicy.RETAIN,
      versioned: false,
      publicReadAccess: false,
      blockPublicAccess: {
        blockPublicAcls: true,
        blockPublicPolicy: true,
        ignorePublicAcls: true,
        restrictPublicBuckets: true,
      },
    });
  }
}
