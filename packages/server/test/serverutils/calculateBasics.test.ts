import { calculateBasics } from 'serverutils/draftbots';

const makeSpell = (color_identity: string[]) => ({
  type: 'Creature',
  color_identity,
  produced_mana: [],
  parsed_cost: color_identity.map((c: string) => c.toLowerCase()),
});

const makeBasic = (color: string) => ({
  type: 'Basic Land',
  color_identity: [color],
  produced_mana: [color],
  oracle_id: `oracle-${color}`,
});

describe('calculateBasics', () => {
  it('produces an even split for an equal thirds U/B/R deck', () => {
    // 9 spells: 3 blue, 3 black, 3 red
    const spells = [
      ...Array(3).fill(null).map(() => makeSpell(['U'])),
      ...Array(3).fill(null).map(() => makeSpell(['B'])),
      ...Array(3).fill(null).map(() => makeSpell(['R'])),
    ];

    const basics = [makeBasic('U'), makeBasic('B'), makeBasic('R')];
    const deckSize = 20; // 9 spells + 11 basics needed

    const result = calculateBasics(spells, basics, deckSize);

    expect(result).toHaveLength(11);

    const counts: Record<string, number> = { U: 0, B: 0, R: 0 };
    for (const card of result) {
      const key = card.oracle_id.replace('oracle-', '');
      counts[key] = (counts[key] ?? 0) + 1;
    }

    console.log('Basic counts:', counts);

    // Each color should get roughly 1/3 of the basics (within ±2 of 3.67)
    expect(counts.U).toBeGreaterThanOrEqual(2);
    expect(counts.B).toBeGreaterThanOrEqual(2);
    expect(counts.R).toBeGreaterThanOrEqual(2);
    expect(counts.U).toBeLessThanOrEqual(5);
    expect(counts.B).toBeLessThanOrEqual(5);
    expect(counts.R).toBeLessThanOrEqual(5);
  });

  it('produces only Islands for a mono-blue deck', () => {
    const spells = Array(15).fill(null).map(() => makeSpell(['U']));
    const basics = [makeBasic('W'), makeBasic('U'), makeBasic('B'), makeBasic('R'), makeBasic('G')];

    const result = calculateBasics(spells, basics, 20);

    expect(result).toHaveLength(5);
    expect(result.every((c) => c.oracle_id === 'oracle-U')).toBe(true);
  });

  it('returns empty when no basics provided', () => {
    const spells = Array(10).fill(null).map(() => makeSpell(['U']));
    expect(calculateBasics(spells, [], 20)).toHaveLength(0);
  });
});
