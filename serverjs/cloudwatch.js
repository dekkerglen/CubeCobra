// Load Environment Variables
require('dotenv').config();

let apm = null;
if (process.env.APM_SERVER_URL) {
  apm = require('elastic-apm-node').start({
    serverUrl: process.env.APM_SERVER_URL,
    serviceName: 'Cube Cobra',
  });
  // eslint-disable-next-line
  console.log('Initialized APM', apm);
}

const winston = require('winston');
const uuid = require('uuid/v4');
const WinstonCloudWatch = require('winston-cloudwatch');
const AWS = require('aws-sdk');

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
  if (info.message) {
    if (info.message.type === 'request') {
      info.message = `request: ${info.message.path}`;
    } else if (info.level === 'error') {
      info.message = `${info.message} ${info.stack}`;
      delete info.stack;
      delete info.request;
    }
    delete info.type;
  }
  return info;
});

const consoleFormat = winston.format.combine(linearFormat(), winston.format.simple());

const transports = [];
if (process.env.ENV === 'production' && process.env.AWS_LOG_GROUP) {
  transports.push(
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
  );
  transports.push(
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
  );
} else {
  transports.push(new winston.transports.Console({ format: consoleFormat }));
}
if (process.env.ELASTICSEARCH_URL) {
  const { ElasticsearchTransport } = require('winston-elasticsearch');
  const transportOptions = {
    level: 'info',
    indexPrefix: 'cubecobra',
    ensureMappingTemplate: true,
    mappingTemplate: {
      index_patterns: ['cubecobra-*'],
      settings: {
        number_of_shards: 1,
        number_of_replicas: 0,
        index: {
          refresh_interval: '5s',
        },
      },
      mappings: {
        _source: { enabled: true },
        properties: {
          '@timestamp': { type: 'date' },
          '@version': { type: 'keyword' },
          message: { type: 'text', index: true },
          severity: { type: 'keyword', index: true },
          fields: {
            dynamic: true,
            properties: {},
          },
        },
      },
    },
    clientOpts: { node: process.env.ELASTICSEARCH_URL },
  };
  if (apm) {
    transportOptions.apm = apm;
  }
  transports.push(new ElasticsearchTransport(transportOptions));
}

winston.configure({
  level: 'info',
  format: winston.format.json(),
  exitOnError: false,
  transports,
});

module.exports = {
  winston,
};
