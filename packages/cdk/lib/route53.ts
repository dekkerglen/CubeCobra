import { CfnRecordSet, HostedZone } from 'aws-cdk-lib/aws-route53';
import { Construct } from 'constructs';

interface Route53Props {
  domain: string;
  dnsName: string;
  hostedZoneDomain?: string; // Optional: specify the hosted zone domain if different from domain
  recordSetId?: string; // Optional: custom ID for the record set (defaults to 'AliasRecord')
}

export class Route53 extends Construct {
  public readonly recordSet: CfnRecordSet;

  constructor(scope: Construct, id: string, props: Route53Props) {
    super(scope, id);

    // Extract root domain for hosted zone lookup (e.g., ml.cubecobradev.com -> cubecobradev.com)
    const hostedZoneDomain = props.hostedZoneDomain || this.extractRootDomain(props.domain);

    const hostedZone = HostedZone.fromLookup(this, 'HostedZone', {
      domainName: hostedZoneDomain,
    });

    const recordSetId = props.recordSetId || 'AliasRecord';
    this.recordSet = new CfnRecordSet(scope, recordSetId, {
      hostedZoneId: hostedZone.hostedZoneId,
      name: props.domain,
      type: 'A',
      aliasTarget: {
        dnsName: props.dnsName,
        hostedZoneId: 'Z3AADJGX6KTTL2',
      },
    });
  }

  // Helper to extract root domain from subdomain (e.g., ml.cubecobradev.com -> cubecobradev.com)
  private extractRootDomain(domain: string): string {
    const parts = domain.split('.');
    if (parts.length >= 2) {
      // Return last two parts (domain.tld)
      return parts.slice(-2).join('.');
    }
    return domain;
  }
}
