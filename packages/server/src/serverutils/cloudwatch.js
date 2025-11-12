// Load Environment Variables
require('dotenv').config();

const {
  CloudWatchLogsClient,
  PutLogEventsCommand,
  CreateLogStreamCommand,
} = require('@aws-sdk/client-cloudwatch-logs');
const uuid = require('uuid');

const client = new CloudWatchLogsClient({
  endpoint: process.env.AWS_ENDPOINT || undefined,
  region: process.env.AWS_REGION || 'us-east-2',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

let infoLogs = [];
let errorLogs = [];

const id = uuid.v4();

const cloudwatchEnabled = process.env.NODE_ENV === 'production';

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

module.exports = {
  info: (...messages) => {
    if (cloudwatchEnabled) {
      infoLogs.push({
        message: messages.join('\n'),
        timestamp: new Date().valueOf(),
      });
    } else {
      console.log(messages.join('\n'));
    }
  },

  error: (...messages) => {
    if (cloudwatchEnabled) {
      errorLogs.push({
        message: messages.join('\n'),
        timestamp: new Date().valueOf(),
      });
    } else {
      console.error(messages);
    }
  },
};
