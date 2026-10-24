import { modelHandler, sanitizeModelPath } from '../../src/router/routes/model';
import { call } from '../test-utils/transport';

describe('model proxy path validation', () => {
  it.each([
    ['encoder/model.json', 'encoder/model.json'],
    ['/v12/draft/group1-shard1of3.bin', 'v12/draft/group1-shard1of3.bin'],
    ['some_file.v2.json', 'some_file.v2.json'],
  ])('accepts %s', (input, expected) => {
    expect(sanitizeModelPath(input)).toBe(expected);
  });

  it.each([
    '../secret.json',
    'encoder/../../secret.json',
    './model.json',
    '..',
    '%2e%2e/secret.json',
    '%252e%252e/secret.json',
    'encoder/%2E%2E/secret',
    'encoder\\..\\secret',
    'model.json?x=1',
    'model.json#frag',
    'a b.json',
    '%E0%A4%A',
    '',
    undefined,
  ])('rejects %s', (input) => {
    expect(sanitizeModelPath(input as any)).toBeNull();
  });

  // Express 5 hands `*splat` over as already-decoded segments, so a double-encoded "%252e%252e"
  // arrives as the literal segment "%2e%2e", and a raw "/model/../x" request as "..".
  it.each([[['%2e%2e', '%2e%2e', 'private', 'thing']], [['..', '..', 'private', 'thing']]])(
    'answers 400 without fetching for traversal segments %p',
    async (splat) => {
      const fetchSpy = jest.spyOn(global, 'fetch');

      const res = await call(modelHandler as any)
        .withParams({ splat })
        .send();

      expect(res.status).toBe(400);
      expect(fetchSpy).not.toHaveBeenCalled();
      fetchSpy.mockRestore();
    },
  );
});
