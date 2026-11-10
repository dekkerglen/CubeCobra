import { DescribeEnvironmentsCommand, ElasticBeanstalkClient } from '@aws-sdk/client-elastic-beanstalk';

const elasticBeanstalk = new ElasticBeanstalkClient({ region: process.env.AWS_REGION });

// Thrown while a recommender environment is deploying; the state machine retries the promotion
// until it is Ready (the error name is what its retrier matches).
export class EnvironmentNotReadyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EnvironmentNotReady';
  }
}

/** The environment's internal load balancer hostname, provided it is Ready (not mid-deploy). */
export const readyEndpoint = async (environmentName: string): Promise<string> => {
  const { Environments } = await elasticBeanstalk.send(
    new DescribeEnvironmentsCommand({ EnvironmentNames: [environmentName], IncludeDeleted: false }),
  );
  const environment = Environments?.[0];
  if (!environment) {
    throw new Error(`Elastic Beanstalk environment ${environmentName} not found`);
  }
  if (environment.Status !== 'Ready') {
    throw new EnvironmentNotReadyError(`${environmentName} is ${environment.Status}`);
  }
  if (!environment.EndpointURL) {
    throw new Error(`${environmentName} has no endpoint`);
  }
  return environment.EndpointURL;
};
