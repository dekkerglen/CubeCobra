import {
  buildOracleRemapping,
  buildSeatMlMaps,
  mlOracle,
  OUT_OF_VOCAB_RATING,
  pickTop,
  rankPack,
  softmax,
} from '@utils/drafting/mlScoring';

// These tests pin the shared post-processing that BOTH the browser sim
// (client draftBot.ts) and the recommender service (recommenderService ml.ts)
// depend on. They are the guardrail against the two runtimes diverging again —
// e.g. the regression where out-of-vocab cards scored 0 instead of never-take
// and were first-picked in the sim while showing ~0% in a normal draft.

describe('mlOracle / remapping', () => {
  it('applies the remap for out-of-vocab cards and passes others through', () => {
    const remapping = { 'black-lotus': 'sol-ring' };
    expect(mlOracle('black-lotus', remapping)).toBe('sol-ring');
    expect(mlOracle('llanowar-elves', remapping)).toBe('llanowar-elves');
    expect(mlOracle('llanowar-elves')).toBe('llanowar-elves');
  });

  it('builds a remapping only for cards with a differing mlOracleId', () => {
    const remapping = buildOracleRemapping({
      'black-lotus': { mlOracleId: 'sol-ring' },
      'llanowar-elves': {},
    });
    expect(remapping).toEqual({ 'black-lotus': 'sol-ring' });
  });

  it('tracks multiple originals that share one ML oracle', () => {
    const maps = buildSeatMlMaps(['lotus-a', 'lotus-b', 'sol-ring'], {
      'lotus-a': 'shared-power',
      'lotus-b': 'shared-power',
    });
    expect(maps.toMl['lotus-a']).toBe('shared-power');
    expect(maps.fromMl['shared-power']).toEqual(['lotus-a', 'lotus-b']);
    expect(maps.fromMl['sol-ring']).toEqual(['sol-ring']);
  });
});

describe('softmax (single source of truth for sim + server + display)', () => {
  it('produces a probability distribution that sums to 1', () => {
    const out = softmax([2, 1, 0]);
    const sum = out.reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1, 10);
    // monotonic: larger logit → larger probability
    expect(out[0]).toBeGreaterThan(out[1]!);
    expect(out[1]).toBeGreaterThan(out[2]!);
  });

  it('is stable for large logits (no overflow)', () => {
    const out = softmax([1000, 999, 998]);
    expect(out.every((p) => Number.isFinite(p))).toBe(true);
    expect(out.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 10);
  });

  it('gives out-of-vocab (-Infinity) entries probability 0', () => {
    const out = softmax([1, OUT_OF_VOCAB_RATING, 0]);
    expect(out[1]).toBe(0);
    expect(out[0]! + out[2]!).toBeCloseTo(1, 10);
  });

  it('returns all zeros when every entry is out-of-vocab', () => {
    expect(softmax([OUT_OF_VOCAB_RATING, OUT_OF_VOCAB_RATING])).toEqual([0, 0]);
  });

  it('returns [] for an empty pack', () => {
    expect(softmax([])).toEqual([]);
  });
});

describe('rankPack', () => {
  const logits: Record<string, number> = { a: -0.5, b: 2.0, c: -3.0 };
  const logitFor = (o: string): number | undefined => logits[o];

  it('sorts pack cards by descending raw logit', () => {
    const ranked = rankPack(['a', 'b', 'c'], logitFor);
    expect(ranked.map((r) => r.oracle)).toEqual(['b', 'a', 'c']);
  });

  it('ranks an out-of-vocab card last, below negative-logit real cards', () => {
    const ranked = rankPack(['a', 'b', 'c', 'newset'], logitFor);
    expect(ranked.map((r) => r.oracle)).toEqual(['b', 'a', 'c', 'newset']);
    const newset = ranked.find((r) => r.oracle === 'newset');
    expect(newset!.rating).toBe(OUT_OF_VOCAB_RATING);
  });
});

describe('pickTop', () => {
  it('picks the highest raw logit', () => {
    const logits: Record<string, number> = { a: -0.5, b: 2.0, c: -3.0 };
    expect(pickTop(['a', 'b', 'c'], (o) => logits[o])).toBe('b');
  });

  it('never picks an out-of-vocab card over a real card with a negative logit', () => {
    // Regression guard: a no-data card must NOT beat a real card whose logit is negative.
    const logits: Record<string, number> = { real: -1.2 };
    expect(pickTop(['newset', 'real'], (o) => logits[o])).toBe('real');
  });

  it('falls back to the first card when every card is out-of-vocab', () => {
    expect(pickTop(['x', 'y'], () => undefined)).toBe('x');
  });

  it('returns empty string for an empty pack', () => {
    expect(pickTop([], () => undefined)).toBe('');
  });
});
