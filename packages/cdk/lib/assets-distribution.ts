import * as path from 'path';

import { CfnOutput, Duration, RemovalPolicy } from 'aws-cdk-lib';
import { Certificate, CertificateValidation } from 'aws-cdk-lib/aws-certificatemanager';
import {
  AllowedMethods,
  CacheCookieBehavior,
  CacheHeaderBehavior,
  CachePolicy,
  CacheQueryStringBehavior,
  Distribution,
  Function as CloudFrontFunction,
  FunctionCode,
  FunctionEventType,
  FunctionRuntime,
  HttpVersion,
  OriginRequestPolicy,
  PriceClass,
  ResponseHeadersPolicy,
  ViewerProtocolPolicy,
} from 'aws-cdk-lib/aws-cloudfront';
import { S3BucketOrigin } from 'aws-cdk-lib/aws-cloudfront-origins';
import { CfnRecordSet, HostedZone } from 'aws-cdk-lib/aws-route53';
import { BlockPublicAccess, Bucket, BucketEncryption, IBucket, ObjectOwnership } from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';

export interface AssetsDistributionProps {
  /** Stage identifier used in resource names: 'beta' | 'production' | 'development'. */
  environmentName: string;
  /** Apex domain for the environment (e.g. cubecobra.com). The asset hostname is `assets.<domain>`. */
  domain: string;
}

/**
 * Static-asset distribution: a private S3 bucket fronted by CloudFront with
 * Origin Access Control, served at `assets.<domain>`.
 *
 * Layout in the bucket mirrors `packages/server/public/`:
 *   js/<name>.<hash>.bundle.js   (immutable; long cache)
 *   css/stylesheet.css           (short cache; busted by ?v=<sha>)
 *   content/...                  (short cache)
 *   manifest.json                (no-cache)
 *
 * Old hashed objects are never overwritten and are pruned by the lifecycle
 * rule below, which lets rolling EB deploys reference both old and new
 * bundles during cutover.
 */
export class AssetsDistribution extends Construct {
  public readonly bucket: IBucket;
  public readonly distribution: Distribution;
  public readonly assetDomain: string;

  constructor(scope: Construct, id: string, props: AssetsDistributionProps) {
    super(scope, id);

    this.assetDomain = `assets.${props.domain}`;

    this.bucket = new Bucket(this, 'AssetsBucket', {
      bucketName: `cubecobra-assets-${props.environmentName}`,
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
      encryption: BucketEncryption.S3_MANAGED,
      objectOwnership: ObjectOwnership.BUCKET_OWNER_ENFORCED,
      enforceSSL: true,
      versioned: false,
      // Keep assets after stack deletion — losing the bundles a still-running
      // server references would 500 every page render.
      removalPolicy: RemovalPolicy.RETAIN,
      lifecycleRules: [
        {
          id: 'expire-old-hashed-bundles',
          enabled: true,
          // Hashed bundles are never re-uploaded with the same key, so any
          // object older than 90d is unreferenced by current deploys.
          expiration: Duration.days(90),
          // But keep unhashed paths (manifest.json, /content/*, /css/*.css)
          // — they're updated in place. Those don't match the prefix.
          prefix: 'js/',
        },
      ],
    });

    // Cert is provisioned in this same construct because the AssetsStack runs
    // in us-east-1 (CloudFront's required region for ACM certs on custom
    // domains). DNS validation against the public hosted zone for the apex.
    const hostedZoneDomain = props.domain.split('.').slice(-2).join('.');
    const hostedZone = HostedZone.fromLookup(this, 'AssetsHostedZone', { domainName: hostedZoneDomain });

    const certificate = new Certificate(this, 'AssetsCertificate', {
      domainName: this.assetDomain,
      validation: CertificateValidation.fromDns(hostedZone),
    });

    const origin = S3BucketOrigin.withOriginAccessControl(this.bucket);

    // Security headers + CORS so fonts/JS modules load cleanly from the
    // app origin. Adjust the allowed origins to match your envs.
    const responseHeaders = new ResponseHeadersPolicy(this, 'AssetsResponseHeaders', {
      responseHeadersPolicyName: `cubecobra-assets-${props.environmentName}-headers`,
      corsBehavior: {
        accessControlAllowCredentials: false,
        accessControlAllowHeaders: ['*'],
        accessControlAllowMethods: ['GET', 'HEAD', 'OPTIONS'],
        accessControlAllowOrigins: [`https://${props.domain}`, `https://www.${props.domain}`],
        accessControlExposeHeaders: ['*'],
        accessControlMaxAge: Duration.seconds(600),
        originOverride: true,
      },
      securityHeadersBehavior: {
        strictTransportSecurity: {
          accessControlMaxAge: Duration.days(365),
          includeSubdomains: true,
          override: true,
        },
        contentTypeOptions: { override: true },
      },
    });

    // stylesheet.css is served from a fixed, unhashed path with a 1-year
    // immutable Cache-Control and is cache-busted purely by a ?v=<git-sha>
    // query string. The AWS managed cache policies (including
    // CACHING_OPTIMIZED_FOR_UNCOMPRESSED_OBJECTS, used here before) do NOT keep
    // the query string in the cache key, so every ?v= collapsed onto one key
    // and the busting silently never worked — new CSS could not propagate for
    // up to a year without a manual /css/stylesheet.css invalidation. This
    // policy keeps the query string in the key; TTLs mirror the managed policy
    // (origin sends max-age=1y immutable, so the effective TTL is a year and
    // freshness comes from the changing ?v= producing a fresh key each deploy).
    // Compression intentionally left off to exactly match prior behavior.
    const cssCachePolicy = new CachePolicy(this, 'AssetsCssCachePolicy', {
      cachePolicyName: `cubecobra-assets-${props.environmentName}-css`,
      comment: 'CSS at a fixed path, busted by ?v=<sha>; query string must be in the cache key',
      minTtl: Duration.seconds(1),
      defaultTtl: Duration.days(1),
      maxTtl: Duration.days(365),
      queryStringBehavior: CacheQueryStringBehavior.all(),
      headerBehavior: CacheHeaderBehavior.none(),
      cookieBehavior: CacheCookieBehavior.none(),
      enableAcceptEncodingGzip: false,
      enableAcceptEncodingBrotli: false,
    });

    // CloudFront standard (legacy) access logs → a dedicated bucket. Used to
    // attribute egress per URI prefix (/model/* vs /js/* vs /content/*) when
    // diagnosing CloudFront spend. Standard log delivery writes objects via S3
    // ACLs, so this bucket MUST keep ACLs enabled (BUCKET_OWNER_PREFERRED) —
    // unlike the assets bucket above, which enforces ownership and disables
    // ACLs (CloudFront would fail to deliver logs there). Logs are voluminous
    // and only needed for a forensic window, so a 30-day lifecycle keeps the
    // storage cost negligible. SSE-S3 only: standard logging rejects SSE-KMS.
    const logBucket = new Bucket(this, 'AssetsLogBucket', {
      bucketName: `cubecobra-assets-logs-${props.environmentName}`,
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
      encryption: BucketEncryption.S3_MANAGED,
      objectOwnership: ObjectOwnership.BUCKET_OWNER_PREFERRED,
      enforceSSL: true,
      versioned: false,
      removalPolicy: RemovalPolicy.RETAIN,
      lifecycleRules: [
        {
          id: 'expire-access-logs',
          enabled: true,
          expiration: Duration.days(30),
        },
      ],
    });

    // Viewer-request filter that returns 403 for heavy-egress crawler
    // user-agents (Amazonbot, AhrefsBot, the AI training bots, etc.) before
    // CloudFront serves a byte. Search engines are intentionally allowed
    // through — see assetsBotFilter.js for the blocklist and rationale.
    // Attached to every behavior below so /js/*, /css/* and the default
    // (/content/*, /model/*) are all covered.
    const botFilter = new CloudFrontFunction(this, 'AssetsBotFilter', {
      functionName: `cubecobra-assets-${props.environmentName}-bot-filter`,
      runtime: FunctionRuntime.JS_2_0,
      code: FunctionCode.fromFile({ filePath: path.join(__dirname, 'assetsBotFilter.js') }),
      comment: 'Returns 403 for high-egress crawler user-agents.',
    });
    const botFilterAssociation = [{ function: botFilter, eventType: FunctionEventType.VIEWER_REQUEST }];

    this.distribution = new Distribution(this, 'AssetsDistribution', {
      domainNames: [this.assetDomain],
      certificate,
      defaultBehavior: {
        origin,
        viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        allowedMethods: AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
        cachePolicy: CachePolicy.CACHING_OPTIMIZED,
        originRequestPolicy: OriginRequestPolicy.CORS_S3_ORIGIN,
        responseHeadersPolicy: responseHeaders,
        functionAssociations: botFilterAssociation,
        compress: true,
      },
      additionalBehaviors: {
        // Hashed JS bundles — already content-addressed, override with the
        // longest cache policy CloudFront ships.
        'js/*': {
          origin,
          viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          allowedMethods: AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
          cachePolicy: CachePolicy.CACHING_OPTIMIZED,
          originRequestPolicy: OriginRequestPolicy.CORS_S3_ORIGIN,
          responseHeadersPolicy: responseHeaders,
          functionAssociations: botFilterAssociation,
          compress: true,
        },
        // stylesheet.css is at a fixed unhashed path, busted by ?v=<sha> — use
        // the custom policy above that actually keeps the query string in the
        // cache key (the managed policies strip it; see cssCachePolicy).
        'css/*': {
          origin,
          viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          allowedMethods: AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
          cachePolicy: cssCachePolicy,
          originRequestPolicy: OriginRequestPolicy.CORS_S3_ORIGIN,
          responseHeadersPolicy: responseHeaders,
          functionAssociations: botFilterAssociation,
          compress: true,
        },
      },
      priceClass: PriceClass.PRICE_CLASS_100,
      httpVersion: HttpVersion.HTTP2_AND_3,
      enableIpv6: true,
      comment: `cubecobra-assets-${props.environmentName}`,
      enableLogging: true,
      logBucket,
      logFilePrefix: 'cf-access-logs/',
      // Cookies are irrelevant to byte/URI attribution and only bloat logs.
      logIncludesCookies: false,
    });

    // Route53 alias for assets.<domain> → CloudFront. Z2FDTNDATAQYW2 is the
    // canonical zone ID for all CloudFront distributions.
    new CfnRecordSet(this, 'AssetsAliasRecord', {
      hostedZoneId: hostedZone.hostedZoneId,
      name: this.assetDomain,
      type: 'A',
      aliasTarget: {
        dnsName: this.distribution.distributionDomainName,
        hostedZoneId: 'Z2FDTNDATAQYW2',
      },
    });
    new CfnRecordSet(this, 'AssetsAliasRecordIPv6', {
      hostedZoneId: hostedZone.hostedZoneId,
      name: this.assetDomain,
      type: 'AAAA',
      aliasTarget: {
        dnsName: this.distribution.distributionDomainName,
        hostedZoneId: 'Z2FDTNDATAQYW2',
      },
    });

    // Surface the values the deploy job needs (uploadAssets reads
    // CUBECOBRA_ASSETS_BUCKET; invalidateCdn reads CDN_DISTRIBUTION_ID).
    new CfnOutput(this, 'AssetsBucketName', {
      value: this.bucket.bucketName,
      exportName: `CubeCobra-${props.environmentName}-AssetsBucketName`,
    });
    new CfnOutput(this, 'AssetsDistributionId', {
      value: this.distribution.distributionId,
      exportName: `CubeCobra-${props.environmentName}-AssetsDistributionId`,
    });
    new CfnOutput(this, 'AssetsLogBucketName', {
      value: logBucket.bucketName,
      exportName: `CubeCobra-${props.environmentName}-AssetsLogBucketName`,
    });
    new CfnOutput(this, 'AssetsBaseUrl', {
      value: `https://${this.assetDomain}`,
      exportName: `CubeCobra-${props.environmentName}-AssetsBaseUrl`,
    });
  }
}
