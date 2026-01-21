import { SubnetType } from 'aws-cdk-lib/aws-ec2';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import { Construct } from 'constructs';

export interface ScheduledJobProps {
  command: string[];
  memoryLimitMib: number;
  cpu: number;
  schedule: events.Schedule;
  tag?: string;
}

export class ScheduledJob extends Construct {
  constructor(
    scope: Construct,
    id: string,
    cluster: ecs.ICluster,
    repository: ecr.IRepository,
    props: ScheduledJobProps,
  ) {
    super(scope, id);

    const taskDefinition = new ecs.FargateTaskDefinition(this, `${id}TaskDefinition`, {
      memoryLimitMiB: props.memoryLimitMib,
      cpu: props.cpu,
    });

    taskDefinition.addContainer(`${id}Container`, {
      image: ecs.ContainerImage.fromEcrRepository(repository, props.tag),
      command: props.command,
      logging: new ecs.AwsLogDriver({
        streamPrefix: id,
      }),
    });

    const rule = new events.Rule(this, `${id}ScheduleRule`, {
      schedule: props.schedule,
    });

    rule.addTarget(
      new targets.EcsTask({
        cluster: cluster,
        taskDefinition: taskDefinition,
        subnetSelection: { subnetType: SubnetType.PUBLIC },
        assignPublicIp: true,
      }),
    );
  }
}
