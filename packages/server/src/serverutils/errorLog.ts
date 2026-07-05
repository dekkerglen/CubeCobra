// Structured error logging. Emits each error to CloudWatch as a single JSON line so that
// Logs Insights can query individual fields (errorType, handler, location, path, ...) and
// the admin Errors dashboard can group/triage precisely — instead of parsing an opaque
// text blob. See router-level usage in index.ts.
import cloudwatch from './cloudwatch';

// A stack frame that points at our compiled app code, e.g.
//   at getBlogPostHandler (/var/app/current/dist/server/src/router/routes/cube/blog.js:217:168)
// captures the function name (optional) and the source-relative `path:line`.
const NAMED_APP_FRAME = /at\s+(\S+)\s+\([^)]*\/dist\/server\/src\/([^\s:()]+:\d+):\d+\)/;
const ANON_APP_FRAME = /at\s+[^(]*\/dist\/server\/src\/([^\s:()]+:\d+):\d+/;

export interface ErrorRequestContext {
  requestId?: string;
  method?: string;
  path?: string;
  originalUrl?: string;
  query?: unknown;
  authenticated?: boolean;
  userId?: string | null;
  username?: string | null;
}

export interface ErrorRecord extends ErrorRequestContext {
  level: 'error';
  message: string;
  errorType?: string;
  handler?: string;
  location?: string;
  unhandledRejection?: boolean;
  stack?: string;
}

/**
 * Finds the deepest app-code frame in a stack (the handler the error originated in),
 * returning its function name and source-relative `path:line`.
 */
export const topAppFrame = (stack?: string): { handler?: string; location?: string } => {
  if (!stack) {
    return {};
  }
  let handler: string | undefined;
  let location: string | undefined;
  for (const line of stack.split('\n')) {
    const named = line.match(NAMED_APP_FRAME);
    if (named) {
      handler = named[1];
      location = named[2];
      continue;
    }
    const anon = line.match(ANON_APP_FRAME);
    if (anon) {
      handler = undefined;
      location = anon[1];
    }
  }
  return { handler, location };
};

// The first line of a V8 stack is usually `TypeError: message` — pull the type from it.
export const errorTypeFromStack = (stack?: string): string | undefined => {
  const firstLine = stack?.split('\n')[0] ?? '';
  const match = firstLine.match(/^([A-Za-z_]*Error)\b/);
  return match ? match[1] : undefined;
};

// From the loose args callers pass to req.logger.error (a mix of strings, Error objects,
// and stack strings), tease apart the human message, the Error (if any), and the stack.
const dissectArgs = (args: any[]): { message: string; error?: Error; stack?: string } => {
  const error = args.find((a) => a instanceof Error) as Error | undefined;
  const stackString = args.find((a) => typeof a === 'string' && /\n\s+at\s/.test(a)) as string | undefined;
  const message = args
    .filter((a) => a !== error && a !== stackString)
    .map((a) => (typeof a === 'string' ? a : a instanceof Error ? a.message : safeStringify(a)))
    .join(' ')
    .trim();
  return { message: message || error?.message || '', error, stack: error?.stack ?? stackString };
};

const safeStringify = (value: unknown): string => {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
};

/**
 * Builds a structured error record from loose args plus optional request context.
 */
export const buildErrorRecord = (
  args: any[],
  context?: ErrorRequestContext,
  extra?: { unhandledRejection?: boolean },
): ErrorRecord => {
  const { message, error, stack } = dissectArgs(args);
  const { handler, location } = topAppFrame(stack);
  return {
    level: 'error',
    message,
    errorType: error?.name ?? errorTypeFromStack(stack),
    handler,
    location,
    ...(extra?.unhandledRejection ? { unhandledRejection: true } : {}),
    stack,
    ...context,
  };
};

/**
 * Emits a structured error record to CloudWatch as one JSON line.
 */
export const logError = (
  args: any[],
  context?: ErrorRequestContext,
  extra?: { unhandledRejection?: boolean },
): void => {
  cloudwatch.error(JSON.stringify(buildErrorRecord(args, context, extra)));
};
