import { CloudWatchLogsClient, PutLogEventsCommand } from '@aws-sdk/client-cloudwatch-logs';

const client = new CloudWatchLogsClient({ region: process.env.AWS_REGION || 'us-east-2' });

const logGroupName = process.env.LOG_GROUP_NAME || '/aws/elasticbeanstalk/recommender-service/application';
const logStreamName = process.env.LOG_STREAM_NAME || 'default';

let sequenceToken: string | undefined;

const log = async (level: string, message: string, meta?: string) => {
  const timestamp = new Date().getTime();
  const logMessage = meta ? `[${level}] ${message}\n${meta}` : `[${level}] ${message}`;

  // Always log to console for local development
  if (process.env.NODE_ENV === 'development') {
    console.log(logMessage);
  }

  // Send to CloudWatch in production
  if (process.env.NODE_ENV === 'production') {
    try {
      const params: any = {
        logGroupName,
        logStreamName,
        logEvents: [
          {
            message: logMessage,
            timestamp,
          },
        ],
      };

      if (sequenceToken) {
        params.sequenceToken = sequenceToken;
      }

      const command = new PutLogEventsCommand(params);
      const response = await client.send(command);
      sequenceToken = response.nextSequenceToken;
    } catch (err) {
      console.error('Failed to send log to CloudWatch:', err);
    }
  }
};

const cloudwatch = {
  info: (message: string, meta?: string) => log('INFO', message, meta),
  error: (message: string, meta?: string) => log('ERROR', message, meta),
  warn: (message: string, meta?: string) => log('WARN', message, meta),
};

export default cloudwatch;
