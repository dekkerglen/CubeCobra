// A caught error as Step Functions hands it to a Catch.
export interface StepFunctionsError {
  Error?: string;
  Cause?: string;
}

const MAX_MESSAGE_LENGTH = 500;

// Step Functions reports service results in PascalCase; accept camelCase too.
const field = (object: any, name: string): any =>
  object?.[name] ?? object?.[name.charAt(0).toLowerCase() + name.slice(1)];

// Cause is free text, or JSON: a Lambda error ({ errorType, errorMessage, trace }) or, for an ECS
// task, the stopped task's description.
const describeCause = (cause: string): string => {
  let parsed: any;
  try {
    parsed = JSON.parse(cause);
  } catch {
    return cause;
  }
  if (!parsed || typeof parsed !== 'object') return cause;
  if (typeof parsed.errorMessage === 'string') return parsed.errorMessage;

  const stoppedReason = field(parsed, 'StoppedReason');
  const containers: any[] = field(parsed, 'Containers') ?? [];
  if (!stoppedReason && containers.length === 0) return cause;
  const containerDetails = containers.map((container) => {
    const exitCode = field(container, 'ExitCode');
    return [exitCode != null ? `exit code ${exitCode}` : undefined, field(container, 'Reason')]
      .filter(Boolean)
      .join(', ');
  });
  return [stoppedReason, ...containerDetails].filter(Boolean).join('; ');
};

/** A short message for the run's record: the error name and the useful part of its cause. */
export const summarizeError = (error: StepFunctionsError | null | undefined): string => {
  const name = error?.Error || 'Error';
  const detail = error?.Cause ? describeCause(error.Cause) : '';
  const message = detail ? `${name}: ${detail}` : name;
  return message.length > MAX_MESSAGE_LENGTH ? `${message.slice(0, MAX_MESSAGE_LENGTH - 3)}...` : message;
};
