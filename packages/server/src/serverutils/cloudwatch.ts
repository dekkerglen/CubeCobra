// Load Environment Variables
import {
  CloudWatchLogsClient,
  CreateLogStreamCommand,
  InputLogEvent,
  PutLogEventsCommand,
} from '@aws-sdk/client-cloudwatch-logs';
import { fromNodeProviderChain } from '@aws-sdk/credential-providers';
import { v4 as uuidv4 } from 'uuid';

import 'dotenv/config';

const client = new CloudWatchLogsClient({
  endpoint: process.env.AWS_ENDPOINT || undefined,
  region: process.env.AWS_REGION || 'us-east-2',
  credentials: fromNodeProviderChain(),
});

let infoLogs: InputLogEvent[] = [];
let errorLogs: InputLogEvent[] = [];

const id = uuidv4();

const cloudwatchEnabled = process.env.CLOUDWATCH_ENABLED === 'true';

console.log(`CloudWatch logging is ${cloudwatchEnabled ? 'enabled' : 'disabled'}.`);

if (cloudwatchEnabled) {
  // create log streams
  client
    .send(
      new CreateLogStreamCommand({
        logGroupName: `${process.env.AWS_LOG_GROUP}_${process.env.AWS_LOG_STREAM}_INFO`,
        logStreamName: `${id}`,
      }),
    )
    .catch((err) => {
      console.error(err);
    });

  client
    .send(
      new CreateLogStreamCommand({
        logGroupName: `${process.env.AWS_LOG_GROUP}_${process.env.AWS_LOG_STREAM}_ERROR`,
        logStreamName: `${id}`,
      }),
    )
    .catch((err) => {
      console.error(err);
    });

  // push logs every 60 seconds
  setInterval(() => {
    if (infoLogs.length > 0) {
      const logEvents = infoLogs.slice(0);

      console.log(`Sending ${logEvents.length} info logs to CloudWatch...`);
      infoLogs = [];
      client
        .send(
          new PutLogEventsCommand({
            logGroupName: `${process.env.AWS_LOG_GROUP}_${process.env.AWS_LOG_STREAM}_INFO`,
            logStreamName: `${id}`,
            logEvents,
          }),
        )
        .catch((err) => {
          console.error(err);
        });
    }

    if (errorLogs.length > 0) {
      const logEvents = errorLogs.slice(0);
      errorLogs = [];

      console.log(`Sending ${logEvents.length} error logs to CloudWatch...`);
      client
        .send(
          new PutLogEventsCommand({
            logGroupName: `${process.env.AWS_LOG_GROUP}_${process.env.AWS_LOG_STREAM}_ERROR`,
            logStreamName: `${id}`,
            logEvents,
          }),
        )
        .catch((err) => {
          console.error(err);
        });
    }
  }, 60000);
}

export const info = (...messages: any[]): void => {
  if (cloudwatchEnabled) {
    infoLogs.push({
      message: messages.join('\n'),
      timestamp: new Date().valueOf(),
    });
  } else {
    console.log(messages.join('\n'));
  }
};

export const error = (...messages: any[]): void => {
  if (cloudwatchEnabled) {
    errorLogs.push({
      message: messages.join('\n'),
      timestamp: new Date().valueOf(),
    });
  } else {
    console.error(messages);
  }
};

export default {
  info,
  error,
};
