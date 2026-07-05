// Per-node in-memory collector for browser-reported errors. Reports arrive at the
// /api/clienterror endpoint, are buffered here, and flushed to a dedicated CloudWatch
// log group either when the buffer reaches FLUSH_AT_SIZE or every FLUSH_INTERVAL_MS,
// whichever comes first. This keeps PutLogEvents call volume low under error storms
// while still surfacing errors promptly.
import { CloudWatchLogsClient, CreateLogStreamCommand, InputLogEvent } from '@aws-sdk/client-cloudwatch-logs';
import { fromNodeProviderChain } from '@aws-sdk/credential-providers';
import { v4 as uuidv4 } from 'uuid';

import 'dotenv/config';

import { flushLogs, truncateMessage } from './cwBatch';

// The shape a client sends, plus the fields the server enriches it with. Everything
// is optional except message/kind so a partial report from the browser still lands.
export interface ClientErrorReport {
  // From the browser
  message: string;
  kind: string; // 'onerror' | 'unhandledrejection' | 'react-boundary'
  stack?: string;
  componentStack?: string;
  source?: string;
  lineno?: number;
  colno?: number;
  url?: string;
  userAgent?: string;
  clientTimestamp?: number;
  // Enriched server-side (never trusted from the client)
  requestId?: string;
  userId?: string | null;
  username?: string | null;
  remoteAddr?: string;
  version?: string;
  receivedAt?: string;
}

const client = new CloudWatchLogsClient({
  endpoint: process.env.AWS_ENDPOINT || undefined,
  region: process.env.AWS_REGION || 'us-east-2',
  credentials: fromNodeProviderChain(),
});

const id = uuidv4();
const logGroupName = process.env.AWS_CLIENT_ERROR_LOG_GROUP;
const enabled = process.env.CLOUDWATCH_ENABLED === 'true' && !!logGroupName;

// Flush whenever we've buffered this many events...
const FLUSH_AT_SIZE = 25;
// ...or at least this often, so low-volume errors don't sit indefinitely.
const FLUSH_INTERVAL_MS = 60_000;
// Hard cap so a CloudWatch outage can't grow the buffer unbounded; oldest events are
// dropped past this point.
const MAX_BUFFER = 10_000;

let buffer: InputLogEvent[] = [];
let flushing = false;

const flush = async (): Promise<void> => {
  if (flushing || buffer.length === 0) {
    return;
  }
  flushing = true;
  const events = buffer;
  buffer = [];
  try {
    console.log(`Sending ${events.length} client error logs to CloudWatch...`);
    await flushLogs(client, logGroupName as string, `${id}`, events);
  } catch (err) {
    console.error(err);
  } finally {
    flushing = false;
  }
};

if (enabled) {
  client
    .send(new CreateLogStreamCommand({ logGroupName: logGroupName as string, logStreamName: `${id}` }))
    .catch((err) => console.error(err));

  setInterval(() => {
    flush().catch((err) => console.error(err));
  }, FLUSH_INTERVAL_MS);
}

console.log(`Client error logging is ${enabled ? 'enabled' : 'disabled'}.`);

// Buffer a single enriched report. Serializes to a compact JSON line so CloudWatch
// Logs Insights can query individual fields.
export const report = (entry: ClientErrorReport): void => {
  if (!enabled) {
    console.error('client error report', JSON.stringify(entry));
    return;
  }

  buffer.push({
    message: truncateMessage(JSON.stringify(entry)),
    timestamp: entry.clientTimestamp ?? Date.now(),
  });

  // Drop the oldest events if we're backed up (e.g. CloudWatch is unreachable).
  if (buffer.length > MAX_BUFFER) {
    buffer = buffer.slice(buffer.length - MAX_BUFFER);
  }

  if (buffer.length >= FLUSH_AT_SIZE) {
    flush().catch((err) => console.error(err));
  }
};

export default { report };
