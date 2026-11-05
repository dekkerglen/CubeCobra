import Joi from 'joi';

import {
  contributeBodySchema,
  contributeMainboardSchema,
  contributeSideboardSchema,
  contributeSubmitHandler,
  routes,
} from '../../../src/router/routes/cube/records/contribute';

jest.mock('../../../src/dynamo/daos', () => ({
  cubeDao: { getById: jest.fn() },
  draftDao: { getById: jest.fn(), update: jest.fn() },
  recordDao: { getById: jest.fn(), update: jest.fn() },
  userDao: { getByUsername: jest.fn() },
}));

/**
 * Contribute is the only write in the records tree reachable without an account: a share
 * link is the whole of the authorisation. It was also the only one with no `bodyValidation`,
 * so every field arrived unchecked — `mainboard` and `sideboard` were `JSON.parse`d straight
 * out of the body with no shape or size cap, and a player name had no length at all.
 */
describe('cube/records/contribute validation', () => {
  const valid = (overrides: Record<string, unknown> = {}) => ({
    token: 'a-token',
    userIndex: '1',
    newPlayer: '',
    renamePlayer: '',
    wins: '2',
    losses: '1',
    draws: '0',
    ...overrides,
  });

  const check = (schema: Joi.Schema, value: unknown) => schema.validate(value).error?.message;

  it('wires validation onto the submit route, ahead of the handler', async () => {
    const route = routes.find((r) => r.method === 'post');
    const handlers = (route?.handler ?? []) as any[];
    // Everything between csrfProtection and the handler, invoked as Express would.
    const validators = handlers.filter((h) => h !== contributeSubmitHandler && h.length === 3);
    expect(validators.length).toBe(3);

    const flash = jest.fn();
    const redirect = jest.fn();
    const next = jest.fn();
    const req: any = {
      params: { id: 'rec-1' },
      body: { ...valid(), mainboard: JSON.stringify(new Array(500).fill('a')), sideboard: '[]' },
      flash,
      logger: { error: jest.fn() },
    };
    const res: any = { redirect, status: () => res, json: jest.fn() };

    for (const validator of validators) {
      await validator(req, res, next);
    }

    // The oversized mainboard is refused before contributeSubmitHandler ever runs.
    expect(next).toHaveBeenCalledTimes(2);
    expect(flash).toHaveBeenCalledWith('danger', expect.stringContaining('must contain less than or equal to 200'));
  });

  describe('boards', () => {
    it('accepts a deck of card ids', () => {
      expect(check(contributeMainboardSchema, ['a', 'b'])).toBeUndefined();
      expect(check(contributeSideboardSchema, [])).toBeUndefined();
    });

    it('refuses a mainboard that is empty, oversized, or not a list of ids', () => {
      expect(check(contributeMainboardSchema, [])).toBeDefined();
      expect(check(contributeMainboardSchema, new Array(201).fill('a'))).toBeDefined();
      expect(check(contributeMainboardSchema, 'not-an-array')).toBeDefined();
      expect(check(contributeMainboardSchema, [{ nested: true }])).toBeDefined();
    });

    it('refuses an oversized sideboard', () => {
      expect(check(contributeSideboardSchema, new Array(201).fill('a'))).toBeDefined();
    });
  });

  describe('body', () => {
    it('accepts what the contribute form submits', () => {
      expect(check(contributeBodySchema, valid())).toBeUndefined();
      expect(check(contributeBodySchema, valid({ newPlayer: '@someone', userIndex: '-1' }))).toBeUndefined();
    });

    /**
     * CSRFForm posts `_csrf` and a `nickname` honeypot alongside every form's own fields, so
     * a whole-body schema that does not name them rejects every real submission while every
     * hand-built test fixture passes. Nothing else in this tree validates a whole form body —
     * the siblings all validate one JSON field at a time — so there was no precedent to copy.
     */
    it('accepts the fields CSRFForm adds to every submission', () => {
      expect(check(contributeBodySchema, valid({ _csrf: 'a-csrf-token', nickname: 'Your Nickname' }))).toBeUndefined();
    });

    it('requires a token', () => {
      expect(check(contributeBodySchema, valid({ token: '' }))).toBeDefined();
    });

    it('caps a player name at the length the record itself allows', () => {
      expect(check(contributeBodySchema, valid({ newPlayer: 'n'.repeat(255) }))).toBeUndefined();
      expect(check(contributeBodySchema, valid({ newPlayer: 'n'.repeat(256) }))).toBeDefined();
      expect(check(contributeBodySchema, valid({ renamePlayer: 'n'.repeat(256) }))).toBeDefined();
    });

    it('refuses a result that is not a non-negative whole number', () => {
      for (const bad of ['-1', '1.5', 'abc']) {
        expect(check(contributeBodySchema, valid({ wins: bad }))).toBeDefined();
      }
      expect(check(contributeBodySchema, valid({ wins: '0' }))).toBeUndefined();
    });

    it('refuses a seat index that is not a whole number', () => {
      expect(check(contributeBodySchema, valid({ userIndex: 'abc' }))).toBeDefined();
      expect(check(contributeBodySchema, valid({ userIndex: '1.5' }))).toBeDefined();
    });

    // The form posts every field on every submit, so anything else is not from this form.
    it('refuses an unknown field', () => {
      expect(check(contributeBodySchema, valid({ somethingElse: 'x' }))).toBeDefined();
    });
  });
});
