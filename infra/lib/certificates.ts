import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as route53 from 'aws-cdk-lib/aws-route53';
import { Construct } from 'constructs';

interface CertificateProps {
  domain: string;
}

export class Certificates extends Construct {
  public readonly consoleCertificate: acm.Certificate;

  constructor(scope: Construct, id: string, props: CertificateProps) {
    super(scope, id);

    const hostedZone = route53.HostedZone.fromLookup(scope, 'Zone', {
      domainName: props.domain,
    });

    this.consoleCertificate = new acm.Certificate(scope, 'ConsoleCertificate', {
      domainName: props.domain,
      subjectAlternativeNames: [`www.${props.domain}`],
      validation: acm.CertificateValidation.fromDns(hostedZone),
    });
  }
}
