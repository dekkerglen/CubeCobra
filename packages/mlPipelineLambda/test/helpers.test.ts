import { parsePromoteTargets } from '../src/config';
import { summarizeError } from '../src/errors';
import { isServingVersion } from '../src/verify';

describe('summarizeError', () => {
  test('uses the message of a Lambda error', () => {
    const cause = JSON.stringify({ errorType: 'Error', errorMessage: 'No gate report', trace: ['at gate'] });
    expect(summarizeError({ Error: 'Error', Cause: cause })).toBe('Error: No gate report');
  });

  test('describes a stopped ECS task by its stop reason and exit codes', () => {
    const cause = JSON.stringify({
      StoppedReason: 'Essential container in task exited',
      Containers: [{ ExitCode: 137, Reason: 'OutOfMemoryError: Container killed due to memory usage' }],
    });
    expect(summarizeError({ Error: 'States.TaskFailed', Cause: cause })).toBe(
      'States.TaskFailed: Essential container in task exited; exit code 137, OutOfMemoryError: Container killed due to memory usage',
    );
  });

  test('keeps a plain-text cause and falls back to the error name alone', () => {
    expect(summarizeError({ Error: 'GateFailed', Cause: 'The candidate model did not pass the promotion gate' })).toBe(
      'GateFailed: The candidate model did not pass the promotion gate',
    );
    expect(summarizeError({ Error: 'States.Timeout', Cause: '' })).toBe('States.Timeout');
    expect(summarizeError(undefined)).toBe('Error');
  });

  test('truncates long causes', () => {
    const message = summarizeError({ Error: 'States.TaskFailed', Cause: 'x'.repeat(2000) });
    expect(message).toHaveLength(500);
    expect(message.endsWith('...')).toBe(true);
  });
});

describe('isServingVersion', () => {
  test('requires a 200 reporting the version and ok', () => {
    expect(isServingVersion(200, { modelVersion: '20270206-153000', ok: true }, '20270206-153000')).toBe(true);
    expect(isServingVersion(200, { modelVersion: 'v3', ok: true }, '20270206-153000')).toBe(false);
    expect(isServingVersion(200, { modelVersion: '20270206-153000', ok: false }, '20270206-153000')).toBe(false);
    expect(isServingVersion(503, { modelVersion: '20270206-153000', ok: true }, '20270206-153000')).toBe(false);
    expect(isServingVersion(200, null, '20270206-153000')).toBe(false);
    expect(isServingVersion(200, 'OK', '20270206-153000')).toBe(false);
  });
});

describe('parsePromoteTargets', () => {
  const target = (name: string) => ({
    dataBucket: `cubecobra-data-${name}`,
    recommenderEnvironmentName: `cubecobra-recommender-${name}-v2-env`,
    ssmSegment: name,
  });

  test('accepts both targets', () => {
    const targets = { beta: target('beta'), production: target('production') };
    expect(parsePromoteTargets(JSON.stringify(targets))).toEqual(targets);
  });

  test('rejects a missing or incomplete target', () => {
    expect(() => parsePromoteTargets(JSON.stringify({ beta: target('beta') }))).toThrow('production');
    expect(() =>
      parsePromoteTargets(JSON.stringify({ beta: { dataBucket: 'b' }, production: target('production') })),
    ).toThrow('beta');
  });
});
