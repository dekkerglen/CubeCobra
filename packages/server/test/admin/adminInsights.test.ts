import { parseErrorEntry } from '../../src/serverutils/adminInsights';

describe('parseErrorEntry', () => {
  it('parses a structured JSON error record into fields', () => {
    const raw = JSON.stringify({
      level: 'error',
      message: "Cannot read properties of undefined (reading 'id')",
      errorType: 'TypeError',
      handler: 'listHandler',
      location: 'router/routes/cube.js:123',
      method: 'GET',
      path: '/cube/list/foo',
      authenticated: false,
      stack: 'TypeError: ...\n    at listHandler (...)',
    });

    const p = parseErrorEntry(raw);
    expect(p.errorType).toBe('TypeError');
    expect(p.handler).toBe('listHandler');
    expect(p.location).toBe('router/routes/cube.js:123');
    expect(p.method).toBe('GET');
    expect(p.authenticated).toBe(false);
    expect(p.stack).toContain('listHandler');
    expect(p.signature).toContain('router/routes/cube.js:123');
  });

  it('groups structured records that differ only by a variable token', () => {
    const mk = (id: number) =>
      JSON.stringify({ level: 'error', message: `bad thing ${id}`, errorType: 'TypeError', location: 'x.js:1' });
    expect(parseErrorEntry(mk(1)).signature).toBe(parseErrorEntry(mk(2)).signature);
  });

  it('keeps different locations distinct even with the same message', () => {
    const a = parseErrorEntry(JSON.stringify({ level: 'error', message: 'boom', location: 'a.js:1' }));
    const b = parseErrorEntry(JSON.stringify({ level: 'error', message: 'boom', location: 'b.js:2' }));
    expect(a.signature).not.toBe(b.signature);
  });

  it('falls back to text parsing for legacy (non-JSON) log entries', () => {
    const p = parseErrorEntry(
      "TypeError: Cannot read properties of undefined (reading 'id')\n" +
        '    at listHandler (/var/app/current/dist/server/src/router/routes/cube.js:123:88)',
    );
    expect(p.signature).toContain('@ cube.js:123');
    expect(p.stack).toBeUndefined();
  });
});
