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

// CloudWatch PutLogEvents hard limits:
//   - Max batch size:    1,048,576 bytes (sum of UTF-8 message bytes + 26 bytes overhead per event)
//   - Max events/batch:  10,000
//   - Max event size:    262,144 bytes (256 KB) of UTF-8 message bytes (plus 26 bytes overhead)
// We use slightly conservative thresholds to leave headroom.
const CW_EVENT_OVERHEAD_BYTES = 26;
const CW_MAX_BATCH_BYTES = 1_000_000; // leave ~48 KB of headroom under the 1,048,576 limit
const CW_MAX_BATCH_EVENTS = 10_000;
const CW_MAX_EVENT_BYTES = 256_000; // leave a little headroom under the 262,144 limit

const utf8ByteLength = (s: string): number => Buffer.byteLength(s, 'utf8');

// Truncate a single message so its UTF-8 byte length fits within CW_MAX_EVENT_BYTES.
// Avoids Buffer slicing in the middle of a multi-byte character by re-encoding.
const truncateMessage = (message: string): string => {
  if (utf8ByteLength(message) <= CW_MAX_EVENT_BYTES) {
    return message;
  }
  const suffix = '...[truncated]';
  const suffixBytes = utf8ByteLength(suffix);
  const budget = CW_MAX_EVENT_BYTES - suffixBytes;
  const buf = Buffer.from(message, 'utf8').subarray(0, budget);
  // Decoding with 'utf8' will replace any partial trailing code point with U+FFFD,
  // so the resulting string is always valid UTF-8.
  return buf.toString('utf8') + suffix;
};

// Split a list of events into batches that respect CloudWatch's size and count limits.
const chunkLogEvents = (events: InputLogEvent[]): InputLogEvent[][] => {
  const batches: InputLogEvent[][] = [];
  let current: InputLogEvent[] = [];
  let currentBytes = 0;

  for (const event of events) {
    const messageBytes = utf8ByteLength(event.message ?? '');
    const eventBytes = messageBytes + CW_EVENT_OVERHEAD_BYTES;

    if (
      current.length > 0 &&
      (currentBytes + eventBytes > CW_MAX_BATCH_BYTES || current.length >= CW_MAX_BATCH_EVENTS)
    ) {
      batches.push(current);
      current = [];
      currentBytes = 0;
    }

    current.push(event);
    currentBytes += eventBytes;
  }

  if (current.length > 0) {
    batches.push(current);
  }

  return batches;
};

const flushLogs = async (logGroupName: string, logStreamName: string, events: InputLogEvent[]): Promise<void> => {
  // CloudWatch requires events within a single batch to be sorted by timestamp ascending.
  const sorted = [...events].sort((a, b) => (a.timestamp ?? 0) - (b.timestamp ?? 0));
  const batches = chunkLogEvents(sorted);

  for (const batch of batches) {
    try {
      await client.send(
        new PutLogEventsCommand({
          logGroupName,
          logStreamName,
          logEvents: batch,
        }),
      );
    } catch (err) {
      console.error(err);
    }
  }
};

console.log(`CloudWatch logging is ${cloudwatchEnabled ? 'enabled' : 'disabled'}.`);

if (cloudwatchEnabled) {
  // create log streams
  client
    .send(
      new CreateLogStreamCommand({
        logGroupName: `${process.env.AWS_LOG_GROUP}/info`,
        logStreamName: `${id}`,
      }),
    )
    .catch((err) => {
      console.error(err);
    });

  client
    .send(
      new CreateLogStreamCommand({
        logGroupName: `${process.env.AWS_LOG_GROUP}/error`,
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
      infoLogs = [];

      console.log(`Sending ${logEvents.length} info logs to CloudWatch...`);
      flushLogs(`${process.env.AWS_LOG_GROUP}/info`, `${id}`, logEvents).catch((err) => {
        console.error(err);
      });
    }

    if (errorLogs.length > 0) {
      const logEvents = errorLogs.slice(0);
      errorLogs = [];

      console.log(`Sending ${logEvents.length} error logs to CloudWatch...`);
      flushLogs(`${process.env.AWS_LOG_GROUP}/error`, `${id}`, logEvents).catch((err) => {
        console.error(err);
      });
    }
  }, 60000);
}

export const info = (...messages: any[]): void => {
  if (cloudwatchEnabled) {
    infoLogs.push({
      message: truncateMessage(messages.join('\n')),
      timestamp: new Date().valueOf(),
    });
  } else {
    console.log(messages.join('\n'));
  }
};

export const error = (...messages: any[]): void => {
  if (cloudwatchEnabled) {
    errorLogs.push({
      message: truncateMessage(messages.join('\n')),
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
