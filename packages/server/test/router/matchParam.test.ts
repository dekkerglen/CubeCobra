import { ISO_DATE, matchParam, UUID } from 'router/middleware';

import { NextFunction, Request, Response } from '../../src/types/express';

const run = (name: string, pattern: RegExp, params: Record<string, any>) => {
  const next = jest.fn() as unknown as NextFunction;
  const req = { params } as unknown as Request;
  matchParam(name, pattern)(req, {} as Response, next);
  return next as unknown as jest.Mock;
};

describe('matchParam', () => {
  describe('with ISO_DATE', () => {
    it('continues into the route for a well-formed date', () => {
      expect(run('date', ISO_DATE, { date: '2026-01-01' })).toHaveBeenCalledWith();
    });

    it.each([
      ['a non-date', 'garbage'],
      ['an unpadded date', '2026-1-1'],
      ['a bare number', '99999999'],
      ['a date with a suffix', '2026-01-01x'],
      ['an empty string', ''],
    ])('skips the route for %s', (_label, value) => {
      expect(run('date', ISO_DATE, { date: value })).toHaveBeenCalledWith('route');
    });

    it('skips the route when the param is absent', () => {
      expect(run('date', ISO_DATE, {})).toHaveBeenCalledWith('route');
    });

    it('skips the route when the param is an array, as a wildcard capture would be', () => {
      expect(run('date', ISO_DATE, { date: ['2026-01-01'] })).toHaveBeenCalledWith('route');
    });
  });

  describe('with UUID', () => {
    it('continues into the route for a well-formed uuid', () => {
      expect(run('packId', UUID, { packId: '3f1e2d4c-5b6a-7980-a1b2-c3d4e5f60718' })).toHaveBeenCalledWith();
    });

    it.each([
      ['a non-uuid', 'not-a-uuid'],
      ['an uppercase uuid', '3F1E2D4C-5B6A-7980-A1B2-C3D4E5F60718'],
      ['a truncated uuid', '3f1e2d4c-5b6a-7980-a1b2'],
    ])('skips the route for %s', (_label, value) => {
      expect(run('packId', UUID, { packId: value })).toHaveBeenCalledWith('route');
    });
  });
});
