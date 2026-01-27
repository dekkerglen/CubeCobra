import * as cdk from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import * as route53 from 'aws-cdk-lib/aws-route53';
import { Construct } from 'constructs';

import { Route53 } from '../lib/route53';
import { BaseTestStack } from './base-test-stack';

// Mock HostedZone.fromLookup() to return a fake hosted zone
jest.spyOn(route53.HostedZone, 'fromLookup').mockImplementation(
  (_scope: Construct, _id: string, _props: route53.HostedZoneProviderProps) =>
    ({
      hostedZoneId: 'Z123456ABCDEF',
    }) as route53.IHostedZone,
);

class TestStack extends BaseTestStack {
  constructor(scope: Construct, id: string) {
    super(scope, id);

    new Route53(this, 'TestRoute53', {
      domain: 'example.com',
      dnsName: 'some-lb.amazonaws.com',
    });
  }
}

test('Creates an Alias A Record in Route 53', () => {
  const app = new cdk.App();
  const stack = new TestStack(app, 'TestStack');
  const template = Template.fromStack(stack);

  template.hasResourceProperties('AWS::Route53::RecordSet', {
    Name: 'example.com',
    Type: 'A',
    HostedZoneId: 'Z123456ABCDEF', // Mocked value
    AliasTarget: {
      DNSName: 'some-lb.amazonaws.com',
      HostedZoneId: 'Z3AADJGX6KTTL2', // AWS ALB Hosted Zone ID
    },
  });
});
