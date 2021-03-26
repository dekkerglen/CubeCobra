// run with: node --max-old-space-size=8192 populate_analytics.js
// will oom without the added tag

// Load Environment Variables
require('dotenv').config();

const mongoose = require('mongoose');

const winston = require('winston');
const WinstonCloudWatch = require('winston-cloudwatch');
const uuid = require('uuid/v4');
const AWS = require('aws-sdk');

const { WebpackOptionsValidationError } = require('webpack');
const { updatePodcast } = require('../serverjs/podcast');
const Podcast = require('../models/podcast');

const formatInfo = ({ message }) => {
  try {
    return JSON.stringify(message);
  } catch (err) {
    return 'Error formatting info';
  }
};
const formatError = ({ message, stack, request }) =>
  JSON.stringify({
    level: 'error',
    message,
    target: request ? request.originalUrl : null,
    uuid: request ? request.uuid : null,
    stack: (stack || '').split('\n'),
  });

const linearFormat = winston.format((info) => {
  if (info.message.type === 'request') {
    info.message = `request: ${info.message.path}`;
  } else if (info.level === 'error') {
    info.message = `${info.message} ${info.stack}`;
    delete info.stack;
    delete info.request;
  }
  delete info.type;
  return info;
});

const consoleFormat = winston.format.combine(linearFormat(), winston.format.simple());

if (process.env.ENV === 'production') {
  winston.configure({
    level: 'info',
    format: winston.format.json(),
    exitOnError: false,
    transports: [
      new WinstonCloudWatch({
        level: 'info',
        cloudWatchLogs: new AWS.CloudWatchLogs(),
        logGroupName: `${process.env.AWS_LOG_GROUP}_${process.env.AWS_LOG_STREAM}_info`,
        logStreamName: uuid(),
        awsAccessKeyId: process.env.AWS_ACCESS_KEY_ID,
        awsSecretKey: process.env.AWS_SECRET_ACCESS_KEY,
        awsRegion: process.env.AWS_REGION,
        retentionInDays: parseInt(process.env.LOG_RETENTION_DAYS, 10),
        messageFormatter: formatInfo,
      }),
      new WinstonCloudWatch({
        level: 'error',
        cloudWatchLogs: new AWS.CloudWatchLogs(),
        logGroupName: `${process.env.AWS_LOG_GROUP}_${process.env.AWS_LOG_STREAM}_error`,
        logStreamName: uuid(),
        awsAccessKeyId: process.env.AWS_ACCESS_KEY_ID,
        awsSecretKey: process.env.AWS_SECRET_ACCESS_KEY,
        awsRegion: process.env.AWS_REGION,
        retentionInDays: parseInt(process.env.LOG_RETENTION_DAYS, 10),
        messageFormatter: formatError,
      }),
    ],
  });
} else {
  winston.configure({
    level: 'info',
    format: winston.format.json(),
    exitOnError: false,
    transports: [new winston.transports.Console({ format: consoleFormat })],
  });
}

const run = async () => {
  const podcasts = await Podcast.find();

  winston.info('Updating podcasts...');

  await Promise.all(podcasts.map(updatePodcast));

  winston.info('Finished updating podcasts.');
  process.exit();
};

// Connect db
mongoose
  .connect(process.env.MONGODB_URL, {
    useCreateIndex: true,
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => {
    run();
  });
