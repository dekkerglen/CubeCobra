// daos.ts constructs real Dynamo clients at import and requires DYNAMO_TABLE; the route
// module pulls it in transitively via middleware, so stub it out for this pure-logic test.
jest.mock('../../src/dynamo/daos', () => ({
  userDao: {},
  patronDao: {},
}));

import { normalizeErrorMessage } from '../../src/router/routes/admin/errors';

describe('normalizeErrorMessage', () => {
  it('collapses quoted subjects so per-email errors group into one signature', () => {
    const a = normalizeErrorMessage('Received a patreon hook without a found email: "alice@example.com"');
    const b = normalizeErrorMessage('Received a patreon hook without a found email: "bob@example.com"');
    expect(a).toBe(b);
    expect(a).toBe('Received a patreon hook without a found email: "<str>"');
  });

  it('normalizes mongo-style ids and numbers', () => {
    expect(normalizeErrorMessage('Cannot load cube: 6127f992ecaf89103d252168 - too many cards: 16509')).toBe(
      'Cannot load cube: <id> - too many cards: <n>',
    );
  });

  it('normalizes uuids', () => {
    expect(normalizeErrorMessage('S3 data not found for pack 1a2b3c4d-5e6f-7a8b-9c0d-1e2f3a4b5c6d')).toBe(
      'S3 data not found for pack <uuid>',
    );
  });

  it('uses only the first line, dropping the stack trace', () => {
    expect(normalizeErrorMessage('Error: boom\n    at foo (/app/x.js:1:2)\n    at bar')).toBe('Error: boom');
  });

  it('returns a placeholder for an empty message', () => {
    expect(normalizeErrorMessage('')).toBe('(empty)');
  });

  it('distinguishes unhandled rejections by their real error and originating app frame', () => {
    const headersInPitList = normalizeErrorMessage(
      'Unhandled Rejection at: Promise \n' +
        'Error [ERR_HTTP_HEADERS_SENT]: Cannot set headers after they are sent to the client\n' +
        '    at ServerResponse.setHeader (node:_http_outgoing:655:11)\n' +
        '    at pitListHandler (/var/app/current/dist/server/src/router/routes/cube/changelog.js:163:36)',
    );
    const typeErrorInCube = normalizeErrorMessage(
      'Unhandled Rejection at: Promise \n' +
        "TypeError: Cannot read properties of undefined (reading 'id')\n" +
        '    at listHandler (/var/app/current/dist/server/src/router/routes/cube.js:123:88)',
    );

    // The generic "Unhandled Rejection" prefix is skipped; the real cause + frame remain.
    expect(headersInPitList).toBe(
      'Error [ERR_HTTP_HEADERS_SENT]: Cannot set headers after they are sent to the client @ changelog.js:163',
    );
    expect(typeErrorInCube).toContain('@ cube.js:123');
    // Two different unhandled rejections must NOT collapse into one signature.
    expect(headersInPitList).not.toBe(typeErrorInCube);
  });

  it('groups the same error thrown from different handlers separately', () => {
    const fromCube = normalizeErrorMessage(
      "TypeError: Cannot read properties of undefined (reading 'id')\n" +
        '    at listHandler (/var/app/current/dist/server/src/router/routes/cube.js:123:88)',
    );
    const fromPlaytest = normalizeErrorMessage(
      "TypeError: Cannot read properties of undefined (reading 'id')\n" +
        '    at playtestHandler (/var/app/current/dist/server/src/router/routes/cube/playtest.js:48:87)',
    );
    expect(fromCube).not.toBe(fromPlaytest);
  });
});
