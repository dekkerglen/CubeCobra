import * as cdk from 'aws-cdk-lib';
import { BlockPublicAccess, Bucket, BucketEncryption, IBucket } from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';

export interface S3BucketsProps {
  dataBucketName: string;
  appBucketName: string;
  createDataBucket?: boolean;
}

/**
 * Construct for managing S3 buckets used by CubeCobra.
 *
 * The app bucket is always imported by name (it's managed separately).
 *
 * The data bucket can either be:
 * - Created by this construct (when createDataBucket is true)
 * - Imported by name (when createDataBucket is false or undefined)
 *
 * For production environments, set createDataBucket to false to import existing buckets.
 * For new environments like beta, set createDataBucket to true.
 */
export class S3Buckets extends Construct {
  public readonly dataBucket: IBucket;
  public readonly appBucket: IBucket;

  constructor(scope: Construct, id: string, props: S3BucketsProps) {
    super(scope, id);

    // Import existing app bucket (always managed separately)
    this.appBucket = Bucket.fromBucketName(this, 'AppBucket', props.appBucketName);

    // Create or import data bucket based on configuration
    if (props.createDataBucket) {
      // Create new data bucket for environments like beta/dev
      this.dataBucket = new Bucket(this, 'DataBucket', {
        bucketName: props.dataBucketName,
        removalPolicy: cdk.RemovalPolicy.RETAIN,
        encryption: BucketEncryption.S3_MANAGED,
        blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
        versioned: false,
      });
    } else {
      // Import existing data bucket for production
      this.dataBucket = Bucket.fromBucketName(this, 'DataBucket', props.dataBucketName);
    }
  }
}
