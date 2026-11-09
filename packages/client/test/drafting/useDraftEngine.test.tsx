import { act, renderHook, waitFor } from '@testing-library/react';

import Card from '@utils/datatypes/Card';
import Draft from '@utils/datatypes/Draft';
import { DRAFT_EFFECTS } from '@utils/drafting/draftEffects';
import { applyTick, createEngineState, engineContext } from '@utils/drafting/draftEngine';

import useDraftEngine, { HUMAN } from 'drafting/useDraftEngine';

import { createCard, createCompletedSoloDraft } from '../../../server/test/test-utils/data';

const LIBRARIAN_ORACLE = Object.entries(DRAFT_EFFECTS).find(([, effect]) => effect.id === 'librarian')![0];

// Two seats, one round of three-card packs; the player's pack opens with a Cogwork Librarian.
const buildDraft = (): Draft => {
  const cards: Card[] = Array.from({ length: 6 }, () => createCard());
  cards[0]!.details = { ...cards[0]!.details!, oracle_id: LIBRARIAN_ORACLE, name: 'Cogwork Librarian' };
  const steps = [
    { action: 'pick' as const, amount: 1 },
    { action: 'pass' as const, amount: null },
    { action: 'pick' as const, amount: 1 },
    { action: 'pass' as const, amount: null },
    { action: 'pick' as const, amount: 1 },
  ];
  const base = createCompletedSoloDraft();
  return {
    ...base,
    cards,
    InitialState: [[{ cards: [0, 1, 2], steps }], [{ cards: [3, 4, 5], steps }]],
    seats: [base.seats[0]!, base.seats[1]!],
  };
};

const renderEngine = (draft: Draft) =>
  renderHook(() => useDraftEngine({ draft, onGain: jest.fn(), onLose: jest.fn(), onFinished: jest.fn(async () => {}) }))
    .result;

describe('useDraftEngine', () => {
  beforeEach(() => {
    window.localStorage.clear();
    global.fetch = jest.fn(async () => ({ ok: true, json: async () => ({ prediction: [[], []] }) })) as any;
  });

  it('keeps a Cogwork Librarian armed once the cards picked need it', async () => {
    const draft = buildDraft();
    // The player has drafted the Librarian and is looking at a two-card pack.
    const ctx = engineContext(draft);
    const start = applyTick(
      createEngineState(2, ctx),
      { 0: { kind: 'pick', cards: [0] }, 1: { kind: 'pick', cards: [3] } },
      ctx,
    ).state;
    window.localStorage.setItem(`draftengine-${draft.id}`, JSON.stringify(start));

    const hook = renderEngine(draft);
    await waitFor(() => expect(hook.current.ready).toContain(0));
    expect(hook.current.pack).toEqual([4, 5]);

    act(() => hook.current.toggleArm(0));
    expect(hook.current.picksLeft).toBe(2);
    act(() => hook.current.pick(4));
    // Switching it off now would leave two cards picked with one allowed.
    act(() => hook.current.toggleArm(0));
    expect(hook.current.arming.librarians).toEqual([0]);
    act(() => hook.current.pick(5));

    await waitFor(() => expect(hook.current.engine.tick).toBe(start.tick + 1));
    const seat = hook.current.engine.seats[HUMAN]!;
    expect(seat.pool).toEqual(expect.arrayContaining([4, 5]));
    expect(seat.pool).not.toContain(0);
  });

  it('lets a Cogwork Librarian be switched off before any card is picked', async () => {
    const draft = buildDraft();
    const ctx = engineContext(draft);
    const start = applyTick(
      createEngineState(2, ctx),
      { 0: { kind: 'pick', cards: [0] }, 1: { kind: 'pick', cards: [3] } },
      ctx,
    ).state;
    window.localStorage.setItem(`draftengine-${draft.id}`, JSON.stringify(start));

    const hook = renderEngine(draft);
    await waitFor(() => expect(hook.current.ready).toContain(0));

    act(() => hook.current.toggleArm(0));
    act(() => hook.current.toggleArm(0));
    expect(hook.current.arming.librarians).toEqual([]);
    expect(hook.current.picksLeft).toBe(1);
  });
});
