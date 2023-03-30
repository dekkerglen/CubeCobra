// Load Environment Variables
require('dotenv').config();

const {
  CloudWatchLogsClient,
  PutLogEventsCommand,
  CreateLogStreamCommand,
} = require('@aws-sdk/client-cloudwatch-logs');
const uuid = require('uuid/v4');

const client = new CloudWatchLogsClient({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

let infoLogs = [];
let errorLogs = [];

const id = uuid();

const cloudwatchEnabled = process.env.ENV === 'production';

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
      // eslint-disable-next-line no-console
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
      // eslint-disable-next-line no-console
      console.error(err);
    });
}

module.exports = {
  info: (...messages) => {
    if (cloudwatchEnabled) {
      infoLogs.push({
        message: messages.join('\n'),
        timestamp: new Date().valueOf(),
      });
      if (infoLogs.length > 100 || infoLogs[0].timestamp < new Date(Date.now() - 60000).valueOf()) {
        // eslint-disable-next-line no-console
        console.log(`Sending ${infoLogs.length} info logs to CloudWatch...`);
        client
          .send(
            new PutLogEventsCommand({
              logGroupName: `${process.env.AWS_LOG_GROUP}_${process.env.AWS_LOG_STREAM}_INFO`,
              logStreamName: `${id}`,
              logEvents: infoLogs,
            }),
          )
          .catch((err) => {
            // eslint-disable-next-line no-console
            console.error(err);
          });
        infoLogs = [];
      }
    } else {
      // eslint-disable-next-line no-console
      console.log(messages.join('\n'));
    }
  },
  // eslint-disable-next-line no-console
  error: (...messages) => {
    if (cloudwatchEnabled) {
      errorLogs.push({
        message: messages.join('\n'),
        timestamp: new Date().valueOf(),
      });

      if (errorLogs.length > 100 || errorLogs[0].timestamp < new Date(Date.now() - 60000).valueOf()) {
        // eslint-disable-next-line no-console
        console.log(`Sending ${errorLogs.length} error logs to CloudWatch...`);
        client
          .send(
            new PutLogEventsCommand({
              logGroupName: `${process.env.AWS_LOG_GROUP}_${process.env.AWS_LOG_STREAM}_ERROR`,
              logStreamName: `${id}`,
              logEvents: errorLogs,
            }),
          )
          .catch((err) => {
            // eslint-disable-next-line no-console
            console.error(err);
          });
        errorLogs = [];
      }
    } else {
      // eslint-disable-next-line no-console
      console.error(messages);
    }
  },
};
