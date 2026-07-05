// Shared helpers for batching events into CloudWatch Logs PutLogEvents calls.
// Used by both the server request/error logger (cloudwatch.ts) and the
// client-side error collector (clientErrors.ts).
import { CloudWatchLogsClient, InputLogEvent, PutLogEventsCommand } from '@aws-sdk/client-cloudwatch-logs';

// CloudWatch PutLogEvents hard limits:
//   - Max batch size:    1,048,576 bytes (sum of UTF-8 message bytes + 26 bytes overhead per event)
//   - Max events/batch:  10,000
//   - Max event size:    262,144 bytes (256 KB) of UTF-8 message bytes (plus 26 bytes overhead)
// We use slightly conservative thresholds to leave headroom.
export const CW_EVENT_OVERHEAD_BYTES = 26;
export const CW_MAX_BATCH_BYTES = 1_000_000; // leave ~48 KB of headroom under the 1,048,576 limit
export const CW_MAX_BATCH_EVENTS = 10_000;
export const CW_MAX_EVENT_BYTES = 256_000; // leave a little headroom under the 262,144 limit

const utf8ByteLength = (s: string): number => Buffer.byteLength(s, 'utf8');

// Truncate a single message so its UTF-8 byte length fits within CW_MAX_EVENT_BYTES.
// Avoids Buffer slicing in the middle of a multi-byte character by re-encoding.
export const truncateMessage = (message: string): string => {
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
export const chunkLogEvents = (events: InputLogEvent[]): InputLogEvent[][] => {
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

// Sort events by timestamp (CloudWatch requires ascending order within a batch),
// split into limit-respecting batches, and PutLogEvents each one.
export const flushLogs = async (
  client: CloudWatchLogsClient,
  logGroupName: string,
  logStreamName: string,
  events: InputLogEvent[],
): Promise<void> => {
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
