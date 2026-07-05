import { buildErrorRecord, errorTypeFromStack, topAppFrame } from '../../src/serverutils/errorLog';

const STACK = [
  "TypeError: Cannot read properties of undefined (reading 'id')",
  '    at ServerResponse.setHeader (node:_http_outgoing:655:11)',
  '    at getBlogPostHandler (/var/app/current/dist/server/src/router/routes/cube/blog.js:217:168)',
  '    at process.processTicksAndRejections (node:internal/process/task_queues:95:5)',
].join('\n');

describe('topAppFrame', () => {
  it('extracts the deepest app frame function and source-relative location', () => {
    expect(topAppFrame(STACK)).toEqual({
      handler: 'getBlogPostHandler',
      location: 'router/routes/cube/blog.js:217',
    });
  });

  it('handles anonymous app frames (no function name)', () => {
    const stack = 'Error: x\n    at /var/app/current/dist/server/src/serverutils/render.js:212:29';
    expect(topAppFrame(stack)).toEqual({ handler: undefined, location: 'serverutils/render.js:212' });
  });

  it('returns empty when there is no stack', () => {
    expect(topAppFrame(undefined)).toEqual({});
  });
});

describe('errorTypeFromStack', () => {
  it('reads the error type from the first stack line', () => {
    expect(errorTypeFromStack('TypeError: boom\n    at x')).toBe('TypeError');
    expect(errorTypeFromStack('ReferenceError: y is not defined')).toBe('ReferenceError');
  });
});

describe('buildErrorRecord', () => {
  it('structures an Error object together with request context', () => {
    const err = new TypeError("Cannot read properties of undefined (reading 'id')");
    err.stack =
      "TypeError: Cannot read properties of undefined (reading 'id')\n" +
      '    at listHandler (/var/app/current/dist/server/src/router/routes/cube.js:123:88)';

    const rec = buildErrorRecord([err], { method: 'GET', path: '/cube/list/foo', authenticated: false });

    expect(rec.level).toBe('error');
    expect(rec.errorType).toBe('TypeError');
    expect(rec.handler).toBe('listHandler');
    expect(rec.location).toBe('router/routes/cube.js:123');
    expect(rec.method).toBe('GET');
    expect(rec.authenticated).toBe(false);
    expect(rec.message).toContain('Cannot read properties');
  });

  it('handles the legacy (message, stack) string call shape', () => {
    const rec = buildErrorRecord([
      'boom',
      'TypeError: boom\n    at h (/var/app/current/dist/server/src/router/routes/x.js:1:2)',
    ]);
    expect(rec.errorType).toBe('TypeError');
    expect(rec.location).toBe('router/routes/x.js:1');
    expect(rec.message).toBe('boom');
  });

  it('flags unhandled rejections', () => {
    const rec = buildErrorRecord([new Error('nope')], undefined, { unhandledRejection: true });
    expect(rec.unhandledRejection).toBe(true);
  });
});
