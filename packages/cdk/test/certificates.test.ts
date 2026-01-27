import * as cdk from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import * as route53 from 'aws-cdk-lib/aws-route53';
import { Construct } from 'constructs';

import { Certificates } from '../lib/certificates';
import { BaseTestStack } from './base-test-stack';

// Mock HostedZone.fromLookup() to return a fake hosted zone
jest.spyOn(route53.HostedZone, 'fromLookup').mockImplementation(
  (_scope: Construct, _id: string, _props: route53.HostedZoneProviderProps) =>
    ({
      hostedZoneId: 'Z123456ABCDEF', // Mocked hosted zone ID
    }) as route53.IHostedZone,
);

class TestStack extends BaseTestStack {
  constructor(scope: Construct, id: string) {
    super(scope, id);

    new Certificates(this, 'TestCertificates', {
      domain: 'example.com',
    });
  }
}

test('Creates an ACM Certificate with DNS Validation', () => {
  const app = new cdk.App();
  const stack = new TestStack(app, 'TestStack');
  const template = Template.fromStack(stack);

  template.hasResourceProperties('AWS::CertificateManager::Certificate', {
    DomainName: 'example.com',
    SubjectAlternativeNames: ['www.example.com'],
    ValidationMethod: 'DNS',
  });
});

test('Does not create a Hosted Zone (uses existing one)', () => {
  const app = new cdk.App();
  const stack = new TestStack(app, 'TestStack');
  const template = Template.fromStack(stack);

  // Ensure HostedZone is NOT created (since we're looking it up)
  template.resourceCountIs('AWS::Route53::HostedZone', 0);
});
