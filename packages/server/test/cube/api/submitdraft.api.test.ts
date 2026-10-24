import { DRAFT_TYPES } from '@utils/datatypes/Draft';

import { submitgriddraftHandler } from '../../../src/router/routes/cube/api/submitgriddraft';
import { submithousmandraftHandler } from '../../../src/router/routes/cube/api/submithousmandraft';
import { createUser } from '../../test-utils/data';
import { call } from '../../test-utils/transport';

jest.mock('../../../src/dynamo/daos', () => ({
  draftDao: {
    getById: jest.fn(),
    update: jest.fn(),
  },
}));

import { draftDao } from '../../../src/dynamo/daos';

const owner = createUser();
const emptyBoard = () => [Array.from({ length: 8 }, () => [] as number[])];

const makeDraft = (type: string, overrides: Record<string, unknown> = {}) => ({
  id: 'draft-1',
  cube: 'cube-1',
  type,
  owner: owner.id,
  complete: false,
  cards: Array.from({ length: 18 }, (_, index) => ({ cardID: `card-${index}` })),
  InitialState: [[], []],
  seats: [
    {
      owner: owner.id,
      name: owner.username,
      bot: false,
      mainboard: emptyBoard(),
      sideboard: emptyBoard(),
      pickorder: [],
    },
    { owner: null, name: 'Bot', bot: true, mainboard: emptyBoard(), sideboard: emptyBoard(), pickorder: [] },
  ],
  ...overrides,
});

const submittedSeat = (cards: number[], extra: Record<string, unknown> = {}) => ({
  mainboard: [[cards, [], [], [], [], [], [], []]],
  sideboard: emptyBoard(),
  pickorder: cards,
  ...extra,
});

describe.each([
  ['grid', submitgriddraftHandler, DRAFT_TYPES.GRID],
  ['housman', submithousmandraftHandler, DRAFT_TYPES.HOUSMAN],
])('%s draft submission', (_name, handler, type) => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const submit = (body: Record<string, unknown>, user = owner) =>
    call(handler)
      .as(user)
      .withBody({ id: 'draft-1', ...body })
      .send();

  it("refuses to update someone else's draft", async () => {
    (draftDao.getById as jest.Mock).mockResolvedValue(makeDraft(type));

    const res = await submit({ seats: [submittedSeat([0]), submittedSeat([1])] }, createUser());

    expect(res.status).toBe(403);
    expect(draftDao.update).not.toHaveBeenCalled();
  });

  it('accepts a hydrated owner object', async () => {
    (draftDao.getById as jest.Mock).mockResolvedValue(makeDraft(type, { owner }));

    const res = await submit({ seats: [submittedSeat([0]), submittedSeat([1])] });

    expect(res.status).toBe(200);
  });

  it('refuses an already-complete draft', async () => {
    (draftDao.getById as jest.Mock).mockResolvedValue(makeDraft(type, { complete: true }));

    const res = await submit({ seats: [submittedSeat([0]), submittedSeat([1])] });

    expect(res.status).toBe(409);
    expect(draftDao.update).not.toHaveBeenCalled();
  });

  it.each([
    ['a different seat count', [submittedSeat([0])]],
    ['a non-array', { 0: submittedSeat([0]) }],
    ['an out-of-range card', [submittedSeat([18]), submittedSeat([1])]],
    ['a negative card', [submittedSeat([-1]), submittedSeat([1])]],
    ['a malformed board', [{ ...submittedSeat([0]), mainboard: [[0]] }, submittedSeat([1])]],
    ['a malformed pick order', [{ ...submittedSeat([0]), pickorder: 'all' }, submittedSeat([1])]],
    ['a non-object seat', [null, submittedSeat([1])]],
  ])('rejects %s', async (_label, seats) => {
    (draftDao.getById as jest.Mock).mockResolvedValue(makeDraft(type));

    const res = await submit({ seats });

    expect(res.status).toBe(400);
    expect(draftDao.update).not.toHaveBeenCalled();
  });

  it('copies only deck fields and keeps owner, name and bot from the server', async () => {
    (draftDao.getById as jest.Mock).mockResolvedValue(makeDraft(type));

    const res = await submit({
      seats: [
        submittedSeat([0, 1], { owner: 'attacker', name: 'Attacker', bot: true, title: 'Mine now' }),
        submittedSeat([2], { owner: 'attacker' }),
      ],
    });

    expect(res.status).toBe(200);
    const saved = (draftDao.update as jest.Mock).mock.calls[0][0];
    expect(saved.complete).toBe(true);
    expect(saved.seats[0]).toMatchObject({ owner: owner.id, name: owner.username, bot: false, pickorder: [0, 1] });
    expect(saved.seats[0]).not.toHaveProperty('title');
    expect(saved.seats[1]).toMatchObject({ owner: null, name: 'Bot', bot: true, pickorder: [2] });
    expect(saved.seats[0].mainboard[0][0]).toEqual([0, 1]);
  });
});

describe('housman log', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (draftDao.getById as jest.Mock).mockResolvedValue(makeDraft(DRAFT_TYPES.HOUSMAN));
  });

  const submit = (log: unknown) =>
    call(submithousmandraftHandler)
      .as(owner)
      .withBody({ id: 'draft-1', seats: [submittedSeat([0]), submittedSeat([1])], log })
      .send();

  it('stores a well-formed log with known fields only', async () => {
    const res = await submit([{ seat: 1, round: 1, given: 3, taken: 4, extra: '<script>' }]);

    expect(res.status).toBe(200);
    expect((draftDao.update as jest.Mock).mock.calls[0][0].HousmanLog).toEqual([
      { seat: 1, round: 1, given: 3, taken: 4 },
    ]);
  });

  it.each([
    ['an unknown seat', { seat: 2, round: 0, given: 0, taken: 1 }],
    ['an unknown round', { seat: 0, round: 2, given: 0, taken: 1 }],
    ['an unknown card', { seat: 0, round: 0, given: 0, taken: 99 }],
    ['a non-object entry', 'x'],
  ])('rejects %s', async (_label, entry) => {
    const res = await submit([entry]);

    expect(res.status).toBe(400);
    expect(draftDao.update).not.toHaveBeenCalled();
  });
});
