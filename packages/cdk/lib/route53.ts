import { CfnRecordSet, HostedZone } from 'aws-cdk-lib/aws-route53';
import { Construct } from 'constructs';

interface Route53Props {
  domain: string;
  dnsName: string;
}

export class Route53 extends Construct {
  public readonly recordSet: CfnRecordSet;

  constructor(scope: Construct, id: string, props: Route53Props) {
    super(scope, id);

    const hostedZone = HostedZone.fromLookup(scope, 'HostedZone', {
      domainName: props.domain,
    });

    this.recordSet = new CfnRecordSet(scope, 'ConsoleAliasRecord', {
      hostedZoneId: hostedZone.hostedZoneId,
      name: props.domain,
      type: 'A',
      aliasTarget: {
        dnsName: props.dnsName,
        hostedZoneId: 'Z3AADJGX6KTTL2',
      },
    });
  }
}
