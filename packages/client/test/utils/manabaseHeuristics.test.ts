import type { BasicCardLike, LandMetaLookup } from '@utils/drafting/manabaseHeuristics';
import {
  evaluateFetch,
  FETCHLANDS,
  GENERIC_BASIC_FETCHLANDS,
  getLandTypesForOracle,
  getLandTypesFromTypeline,
  hasShuffleSynergy,
  oracleIsAllOffColorLand,
  oracleIsForceCutDual,
  oracleIsForceCutLand,
  oracleIsMustKeepNonbasicLand,
  oracleIsOffColorAbilityLand,
  oracleIsSuspectNonbasicLand,
  oracleIsUnderusedMultiColorLand,
  oracleIsUnderusedSingleColorLand,
  pickForceCutBasic,
  SHUFFLE_SYNERGY_NAMES,
} from '@utils/drafting/manabaseHeuristics';

// ---------------------------------------------------------------------------
// Helpers — keeps each test self-contained instead of mutating a shared object
// ---------------------------------------------------------------------------

const meta = (
  overrides: Partial<{
    name: string;
    type: string;
    colorIdentity: string[];
    producedMana: string[];
    isManaFixingLand: boolean;
  }> = {},
) => ({
  type: 'Land',
  colorIdentity: [] as string[],
  ...overrides,
});

const basic = (color: 'W' | 'U' | 'B' | 'R' | 'G') => {
  const map = { W: 'Plains', U: 'Island', B: 'Swamp', R: 'Mountain', G: 'Forest' } as const;
  const oracleId = `basic-${color}`;
  return {
    oracle: oracleId,
    landMeta: { name: map[color], type: `Basic Land — ${map[color]}`, colorIdentity: [color], producedMana: [color] },
    basicCard: {
      oracleId,
      type: `Basic Land — ${map[color]}`,
      colorIdentity: [color],
      producedMana: [color],
    } satisfies BasicCardLike,
  };
};

const allBasics = ['W', 'U', 'B', 'R', 'G'].map((color) => basic(color as 'W' | 'U' | 'B' | 'R' | 'G').basicCard);

// ---------------------------------------------------------------------------
// Typeline parser
// ---------------------------------------------------------------------------

describe('getLandTypesFromTypeline', () => {
  test('parses em-dash separated subtypes', () => {
    expect(getLandTypesFromTypeline('Land — Forest Island Mountain')).toEqual(['Forest', 'Island', 'Mountain']);
  });

  test('parses hyphen-minus fallback separator', () => {
    expect(getLandTypesFromTypeline('Land - Plains Swamp')).toEqual(['Plains', 'Swamp']);
  });

  test('returns empty for typeline with no separator (untyped fixers)', () => {
    expect(getLandTypesFromTypeline('Land')).toEqual([]);
    expect(getLandTypesFromTypeline('Legendary Land')).toEqual([]);
  });

  test('filters out non-basic-land subtypes like Locus or Urza', () => {
    expect(getLandTypesFromTypeline('Land — Urza Locus')).toEqual([]);
    expect(getLandTypesFromTypeline('Land — Plains Urza')).toEqual(['Plains']);
  });

  test('handles basic land typelines', () => {
    expect(getLandTypesFromTypeline('Basic Land — Plains')).toEqual(['Plains']);
  });
});

// ---------------------------------------------------------------------------
// Canonical land-types lookup (typeline first, hardcoded fallback)
// ---------------------------------------------------------------------------

describe('getLandTypesForOracle', () => {
  test('uses typeline subtypes when present', () => {
    const cardMeta: LandMetaLookup = {
      'oracle-1': meta({ name: 'Stomping Ground', type: 'Land — Mountain Forest' }),
    };
    expect(getLandTypesForOracle('oracle-1', cardMeta)).toEqual(['Mountain', 'Forest']);
  });

  test('returns empty for typed lands with a bare "Land" typeline', () => {
    // We trust the typeline; we no longer fall back to a hardcoded name table.
    const cardMeta: LandMetaLookup = {
      'oracle-ketria': meta({ name: 'Ketria Triome', type: 'Land' }),
    };
    expect(getLandTypesForOracle('oracle-ketria', cardMeta)).toEqual([]);
  });

  test('returns empty array for unknown untyped land', () => {
    const cardMeta: LandMetaLookup = {
      'oracle-unknown': meta({ name: 'Sulfur Falls', type: 'Land' }),
    };
    expect(getLandTypesForOracle('oracle-unknown', cardMeta)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Hardcoded table spot-checks — catch typos in card names that would otherwise
// silently break the heuristic
// ---------------------------------------------------------------------------

describe('FETCHLANDS table', () => {
  test('covers all 10 typed Onslaught + Zendikar fetches', () => {
    for (const name of [
      'Flooded Strand',
      'Polluted Delta',
      'Bloodstained Mire',
      'Wooded Foothills',
      'Windswept Heath',
      'Scalding Tarn',
      'Verdant Catacombs',
      'Arid Mesa',
      'Misty Rainforest',
      'Marsh Flats',
    ]) {
      expect(FETCHLANDS[name]).toBeDefined();
      expect(FETCHLANDS[name]!.basicsOnly).toBe(false);
      expect(FETCHLANDS[name]!.types.length).toBe(2);
    }
  });

  test('covers all 5 Mirage slowfetches', () => {
    for (const name of ['Flood Plain', 'Bad River', 'Rocky Tar Pit', 'Mountain Valley', 'Grasslands']) {
      expect(FETCHLANDS[name]).toBeDefined();
    }
  });

  test('Polluted Delta searches for Island or Swamp specifically', () => {
    expect(FETCHLANDS['Polluted Delta']!.types).toEqual(['Island', 'Swamp']);
  });

  test('generic basic fetches are tracked separately', () => {
    expect(GENERIC_BASIC_FETCHLANDS.has('Evolving Wilds')).toBe(true);
    expect(GENERIC_BASIC_FETCHLANDS.has('Fabled Passage')).toBe(true);
    expect(GENERIC_BASIC_FETCHLANDS.has('Terramorphic Expanse')).toBe(true);
  });
});

describe('SHUFFLE_SYNERGY_NAMES', () => {
  test('includes the canonical "put-cards-on-top" cards', () => {
    expect(SHUFFLE_SYNERGY_NAMES.has('Brainstorm')).toBe(true);
    expect(SHUFFLE_SYNERGY_NAMES.has("Sensei's Divining Top")).toBe(true);
    expect(SHUFFLE_SYNERGY_NAMES.has('Scroll Rack')).toBe(true);
    expect(SHUFFLE_SYNERGY_NAMES.has('Jace, the Mind Sculptor')).toBe(true);
    expect(SHUFFLE_SYNERGY_NAMES.has('Sylvan Library')).toBe(true);
    expect(SHUFFLE_SYNERGY_NAMES.has('Ponder')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// evaluateFetch — the heart of the fetchland reachability logic
// ---------------------------------------------------------------------------

describe('evaluateFetch', () => {
  test("'real' when a typed nonbasic on-color target is reachable in 1 grab", () => {
    // Polluted Delta (Island/Swamp) in UB with Underground Sea (Island Swamp) → 1 grab = U+B
    const cardMeta: LandMetaLookup = {
      'oracle-delta': meta({ name: 'Polluted Delta', type: 'Land' }),
      'oracle-sea': meta({ name: 'Underground Sea', type: 'Land — Island Swamp', colorIdentity: ['U', 'B'] }),
    };
    const result = evaluateFetch('oracle-delta', ['oracle-delta', 'oracle-sea'], cardMeta, new Set(['U', 'B']));
    expect(result.quality).toBe('real');
    expect(result.bestSingle).toBe(2);
  });

  test("'thinning' when only basic on-color targets exist", () => {
    // Bloodstained Mire (Swamp/Mountain) in mono-R: only basic Mountain reachable
    const cardMeta: LandMetaLookup = {
      'oracle-mire': meta({ name: 'Bloodstained Mire', type: 'Land' }),
      'oracle-bolt': meta({ name: 'Lightning Bolt', type: 'Instant', colorIdentity: ['R'] }),
    };
    const result = evaluateFetch('oracle-mire', ['oracle-mire', 'oracle-bolt'], cardMeta, new Set(['R']), allBasics, 3);
    expect(result.quality).toBe('thinning');
    expect(result.bestSingle).toBe(1);
  });

  test("'real' when a typed fetch can cover two on-color basics even without duals", () => {
    const cardMeta: LandMetaLookup = {
      'oracle-strand': meta({ name: 'Flooded Strand', type: 'Land' }),
      'oracle-swords': meta({ name: 'Swords to Plowshares', type: 'Instant', colorIdentity: ['W'] }),
      'oracle-preordain': meta({ name: 'Preordain', type: 'Sorcery', colorIdentity: ['U'] }),
    };
    const result = evaluateFetch(
      'oracle-strand',
      ['oracle-strand', 'oracle-swords', 'oracle-preordain'],
      cardMeta,
      new Set(['W', 'U']),
      allBasics,
      5,
    );
    expect(result.quality).toBe('real');
    expect(result.bestSingle).toBe(1);
  });

  test("'real' for Evolving Wilds-style lands when they cover two on-color basics", () => {
    const cardMeta: LandMetaLookup = {
      'oracle-wilds': meta({ name: 'Evolving Wilds', type: 'Land', isManaFixingLand: true }),
      'oracle-swords': meta({ name: 'Swords to Plowshares', type: 'Instant', colorIdentity: ['W'] }),
      'oracle-preordain': meta({ name: 'Preordain', type: 'Sorcery', colorIdentity: ['U'] }),
    };
    const result = evaluateFetch(
      'oracle-wilds',
      ['oracle-wilds', 'oracle-swords', 'oracle-preordain'],
      cardMeta,
      new Set(['W', 'U']),
      allBasics,
      5,
    );
    expect(result.quality).toBe('real');
    expect(result.bestSingle).toBe(1);
  });

  test("'thinning' for Evolving Wilds-style lands in a single-color deck", () => {
    const cardMeta: LandMetaLookup = {
      'oracle-wilds': meta({ name: 'Evolving Wilds', type: 'Land', isManaFixingLand: true }),
      'oracle-bolt': meta({ name: 'Lightning Bolt', type: 'Instant', colorIdentity: ['R'] }),
    };
    const result = evaluateFetch(
      'oracle-wilds',
      ['oracle-wilds', 'oracle-bolt'],
      cardMeta,
      new Set(['R']),
      allBasics,
      3,
    );
    expect(result.quality).toBe('thinning');
    expect(result.bestSingle).toBe(1);
  });

  test("'thinning' for Prismatic Vista when predicted basics collapse to one type", () => {
    const cardMeta: LandMetaLookup = {
      'oracle-vista': meta({ name: 'Prismatic Vista', type: 'Land', isManaFixingLand: true }),
      'oracle-tundra-visions': meta({ name: 'Sea Gate Oracle', type: 'Creature', colorIdentity: ['U'] }),
      'oracle-adanto': meta({ name: 'Adanto Vanguard', type: 'Creature', colorIdentity: ['W'] }),
      'oracle-wrath': meta({ name: 'Wrath of God', type: 'Sorcery', colorIdentity: ['W'] }),
      'oracle-mentor': meta({ name: 'Monastery Mentor', type: 'Creature', colorIdentity: ['W'] }),
      'oracle-coast': meta({
        name: 'Adarkar Wastes',
        type: 'Land',
        producedMana: ['W', 'U'],
        colorIdentity: ['W', 'U'],
      }),
      'oracle-islet': meta({ name: 'Lonely Sandbar', type: 'Land', producedMana: ['U'], colorIdentity: ['U'] }),
    };
    const result = evaluateFetch(
      'oracle-vista',
      [
        'oracle-vista',
        'oracle-tundra-visions',
        'oracle-adanto',
        'oracle-wrath',
        'oracle-mentor',
        'oracle-coast',
        'oracle-islet',
      ],
      cardMeta,
      new Set(['W', 'U']),
      allBasics,
      8,
    );
    expect(result.quality).toBe('thinning');
    expect(result.bestSingle).toBe(1);
  });

  test("'thinning' for Flooded Strand when only Island basics are predicted", () => {
    const cardMeta: LandMetaLookup = {
      'oracle-strand': meta({ name: 'Flooded Strand', type: 'Land' }),
      'oracle-counterspell': meta({ name: 'Counterspell', type: 'Instant', colorIdentity: ['U'] }),
      'oracle-fatal-push': meta({ name: 'Fatal Push', type: 'Instant', colorIdentity: ['B'] }),
      'oracle-drown': meta({ name: 'Drown in the Loch', type: 'Instant', colorIdentity: ['U', 'B'] }),
      'oracle-island-source': meta({
        name: 'Faerie Conclave',
        type: 'Land',
        producedMana: ['U'],
        colorIdentity: ['U'],
      }),
      'oracle-swamp-source': meta({
        name: 'Underground River',
        type: 'Land',
        producedMana: ['U', 'B'],
        colorIdentity: ['U', 'B'],
      }),
    };
    const result = evaluateFetch(
      'oracle-strand',
      [
        'oracle-strand',
        'oracle-counterspell',
        'oracle-fatal-push',
        'oracle-drown',
        'oracle-island-source',
        'oracle-swamp-source',
      ],
      cardMeta,
      new Set(['U', 'B']),
      allBasics,
      7,
    );
    expect(result.quality).toBe('dead');
    expect(result.bestSingle).toBe(0);
  });

  test("'dead' when no on-color target is reachable", () => {
    // Windswept Heath (Plains/Forest) in mono-red: no Plains or Forest basic types running,
    // no typed W/G nonbasic in mainboard
    const cardMeta: LandMetaLookup = {
      'oracle-heath': meta({ name: 'Windswept Heath', type: 'Land' }),
    };
    const result = evaluateFetch('oracle-heath', ['oracle-heath'], cardMeta, new Set(['R']));
    expect(result.quality).toBe('dead');
  });

  test('correctly ignores untyped fixers like check lands as fetch targets', () => {
    // Wooded Foothills (Mountain/Forest) in mono-R with Sulfur Falls (untyped check land) in
    // mainboard. Sulfur Falls produces U+R but has no basic land subtypes — must not count.
    const cardMeta: LandMetaLookup = {
      'oracle-foothills': meta({ name: 'Wooded Foothills', type: 'Land' }),
      'oracle-falls': meta({ name: 'Sulfur Falls', type: 'Land', colorIdentity: ['U', 'R'], producedMana: ['U', 'R'] }),
      'oracle-bolt': meta({ name: 'Lightning Bolt', type: 'Instant', colorIdentity: ['R'] }),
    };
    const result = evaluateFetch(
      'oracle-foothills',
      ['oracle-foothills', 'oracle-falls', 'oracle-bolt'],
      cardMeta,
      new Set(['R']),
      allBasics,
      4,
    );
    expect(result.quality).toBe('thinning'); // basic Mountain reachable, Sulfur Falls is NOT
    expect(result.bestSingle).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Force-cut logic
// ---------------------------------------------------------------------------

describe('oracleIsForceCutDual', () => {
  test('Scrubland in mono-W: on-color count = 1, force-cut', () => {
    const cardMeta: LandMetaLookup = {
      'oracle-scrubland': meta({ name: 'Scrubland', type: 'Land — Plains Swamp' }),
    };
    expect(oracleIsForceCutDual('oracle-scrubland', new Set(['W']), cardMeta)).toBe(true);
  });

  test('Scrubland in WB: on-color count = 2, NOT force-cut', () => {
    const cardMeta: LandMetaLookup = {
      'oracle-scrubland': meta({ name: 'Scrubland', type: 'Land — Plains Swamp' }),
    };
    expect(oracleIsForceCutDual('oracle-scrubland', new Set(['W', 'B']), cardMeta)).toBe(false);
  });

  test('Ketria Triome in mono-B: on-color count = 0, force-cut', () => {
    const cardMeta: LandMetaLookup = {
      'oracle-ketria': meta({ name: 'Ketria Triome', type: 'Land — Forest Island Mountain' }),
    };
    expect(oracleIsForceCutDual('oracle-ketria', new Set(['B']), cardMeta)).toBe(true);
  });

  test('Ketria Triome in UG: on-color count = 2 (Forest+Island), NOT force-cut', () => {
    const cardMeta: LandMetaLookup = {
      'oracle-ketria': meta({ name: 'Ketria Triome', type: 'Land — Forest Island Mountain' }),
    };
    expect(oracleIsForceCutDual('oracle-ketria', new Set(['U', 'G']), cardMeta)).toBe(false);
  });

  test('Stomping Ground in UB: on-color count = 0, force-cut', () => {
    const cardMeta: LandMetaLookup = {
      'oracle-sg': meta({ name: 'Stomping Ground', type: 'Land — Mountain Forest' }),
    };
    expect(oracleIsForceCutDual('oracle-sg', new Set(['U', 'B']), cardMeta)).toBe(true);
  });

  test('Hallowed Fountain in WU: on-color count = 2, NOT force-cut', () => {
    const cardMeta: LandMetaLookup = {
      'oracle-fountain': meta({ name: 'Hallowed Fountain', type: 'Land — Plains Island' }),
    };
    expect(oracleIsForceCutDual('oracle-fountain', new Set(['W', 'U']), cardMeta)).toBe(false);
  });

  test('basic land never force-cut', () => {
    const cardMeta: LandMetaLookup = {
      'oracle-plains': meta({ name: 'Plains', type: 'Basic Land — Plains' }),
    };
    expect(oracleIsForceCutDual('oracle-plains', new Set(['U']), cardMeta)).toBe(false);
  });

  test('untyped land (Lumbering Falls / manland) never force-cut by typed-dual rule', () => {
    const cardMeta: LandMetaLookup = {
      'oracle-falls': meta({ name: 'Lumbering Falls', type: 'Land', colorIdentity: ['U', 'G'] }),
    };
    expect(oracleIsForceCutDual('oracle-falls', new Set(['B']), cardMeta)).toBe(false);
  });
});

describe('oracleIsForceCutLand', () => {
  test('routes typed duals through oracleIsForceCutDual', () => {
    const cardMeta: LandMetaLookup = {
      'oracle-scrubland': meta({ name: 'Scrubland', type: 'Land — Plains Swamp' }),
    };
    expect(oracleIsForceCutLand('oracle-scrubland', new Set(['W']), cardMeta, ['oracle-scrubland'])).toBe(true);
  });

  test('force-cuts dead fetches', () => {
    // Windswept Heath in mono-R with no W/G targets
    const cardMeta: LandMetaLookup = {
      'oracle-heath': meta({ name: 'Windswept Heath', type: 'Land' }),
      'oracle-bolt': meta({ name: 'Lightning Bolt', type: 'Instant', colorIdentity: ['R'] }),
    };
    expect(
      oracleIsForceCutLand('oracle-heath', new Set(['R']), cardMeta, ['oracle-heath', 'oracle-bolt'], allBasics, 3),
    ).toBe(true);
  });

  test('does NOT force-cut a thinning-only fetch', () => {
    // Bloodstained Mire in mono-R reaches basic Mountain → 'thinning', not 'dead'
    const cardMeta: LandMetaLookup = {
      'oracle-mire': meta({ name: 'Bloodstained Mire', type: 'Land' }),
      'oracle-bolt': meta({ name: 'Lightning Bolt', type: 'Instant', colorIdentity: ['R'] }),
    };
    expect(
      oracleIsForceCutLand('oracle-mire', new Set(['R']), cardMeta, ['oracle-mire', 'oracle-bolt'], allBasics, 3),
    ).toBe(false);
  });

  test('does NOT force-cut a real fetch', () => {
    const cardMeta: LandMetaLookup = {
      'oracle-delta': meta({ name: 'Polluted Delta', type: 'Land' }),
      'oracle-sea': meta({ name: 'Underground Sea', type: 'Land — Island Swamp' }),
    };
    expect(oracleIsForceCutLand('oracle-delta', new Set(['U', 'B']), cardMeta, ['oracle-delta', 'oracle-sea'])).toBe(
      false,
    );
  });

  test('does NOT force-cut Flooded Strand in UW with only basics available', () => {
    const cardMeta: LandMetaLookup = {
      'oracle-strand': meta({ name: 'Flooded Strand', type: 'Land' }),
      'oracle-swords': meta({ name: 'Swords to Plowshares', type: 'Instant', colorIdentity: ['W'] }),
      'oracle-preordain': meta({ name: 'Preordain', type: 'Sorcery', colorIdentity: ['U'] }),
    };
    expect(
      oracleIsForceCutLand(
        'oracle-strand',
        new Set(['W', 'U']),
        cardMeta,
        ['oracle-strand', 'oracle-swords', 'oracle-preordain'],
        allBasics,
        5,
      ),
    ).toBe(false);
  });

  test('force-cuts lands whose activated ability is dead in this deck (Unholy Grotto in mono-W)', () => {
    // Grotto taps for {C} but its useful ability costs {B}. In a deck with no B, the
    // ability is dead and the land is just an Add-{C} with no upside.
    const cardMeta: LandMetaLookup = {
      'oracle-grotto': meta({ name: 'Unholy Grotto', type: 'Land', producedMana: ['C'], colorIdentity: ['B'] }),
    };
    expect(oracleIsForceCutLand('oracle-grotto', new Set(['W']), cardMeta, ['oracle-grotto'])).toBe(true);
  });

  test('force-cuts untyped multi-color all-off-color lands (Karplusan Forest in mono-W)', () => {
    const cardMeta: LandMetaLookup = {
      'oracle-karplusan': meta({
        name: 'Karplusan Forest',
        type: 'Land',
        producedMana: ['R', 'G'],
        colorIdentity: ['R', 'G'],
      }),
    };
    expect(oracleIsForceCutLand('oracle-karplusan', new Set(['W']), cardMeta, ['oracle-karplusan'])).toBe(true);
  });

  test('force-cuts untyped multi-color underused producers (Adarkar Wastes in mono-W)', () => {
    // 2-color pain land where only W is on-color in this deck. colorIdentity has W so
    // all-off doesn't fire; the underused-multi rule does.
    const cardMeta: LandMetaLookup = {
      'oracle-adarkar': meta({
        name: 'Adarkar Wastes',
        type: 'Land',
        producedMana: ['W', 'U'],
        colorIdentity: ['W', 'U'],
      }),
    };
    expect(oracleIsForceCutLand('oracle-adarkar', new Set(['W']), cardMeta, ['oracle-adarkar'])).toBe(true);
  });

  test('force-cuts 5-color producers in 1-color decks (Mana Confluence in mono-W)', () => {
    const cardMeta: LandMetaLookup = {
      'oracle-confluence': meta({
        name: 'Mana Confluence',
        type: 'Land',
        producedMana: ['W', 'U', 'B', 'R', 'G'],
        colorIdentity: ['W', 'U', 'B', 'R', 'G'],
      }),
    };
    expect(oracleIsForceCutLand('oracle-confluence', new Set(['W']), cardMeta, ['oracle-confluence'])).toBe(true);
  });

  test('force-cuts single-color utility lands in light splashes (Valakut in 2-R-spell deck)', () => {
    const cardMeta: LandMetaLookup = {
      'oracle-valakut': meta({
        name: 'Valakut, the Molten Pinnacle',
        type: 'Legendary Land',
        producedMana: ['R'],
        colorIdentity: ['R'],
      }),
      'oracle-bolt': meta({ name: 'Lightning Bolt', type: 'Instant', colorIdentity: ['R'] }),
      'oracle-flame-slash': meta({ name: 'Flame Slash', type: 'Sorcery', colorIdentity: ['R'] }),
      'oracle-swords': meta({ name: 'Swords to Plowshares', type: 'Instant', colorIdentity: ['W'] }),
    };
    expect(
      oracleIsForceCutLand('oracle-valakut', new Set(['W', 'R']), cardMeta, [
        'oracle-valakut',
        'oracle-bolt',
        'oracle-flame-slash',
        'oracle-swords',
      ]),
    ).toBe(true);
  });

  test('does NOT force-cut Unholy Grotto in mono-B (ability is on-color)', () => {
    const cardMeta: LandMetaLookup = {
      'oracle-grotto': meta({ name: 'Unholy Grotto', type: 'Land', producedMana: ['C'], colorIdentity: ['B'] }),
    };
    expect(oracleIsForceCutLand('oracle-grotto', new Set(['B']), cardMeta, ['oracle-grotto'])).toBe(false);
  });

  test('does NOT force-cut colorless-only producers (Library of Alexandria) in any deck', () => {
    const cardMeta: LandMetaLookup = {
      'oracle-loa': meta({
        name: 'Library of Alexandria',
        type: 'Legendary Land',
        producedMana: ['C'],
        colorIdentity: [],
      }),
    };
    expect(oracleIsForceCutLand('oracle-loa', new Set(['W']), cardMeta, ['oracle-loa'])).toBe(false);
  });

  test('does NOT force-cut Mana Confluence in 2-color decks (≥ 2 on-color)', () => {
    const cardMeta: LandMetaLookup = {
      'oracle-confluence': meta({
        name: 'Mana Confluence',
        type: 'Land',
        producedMana: ['W', 'U', 'B', 'R', 'G'],
        colorIdentity: ['W', 'U', 'B', 'R', 'G'],
      }),
    };
    expect(oracleIsForceCutLand('oracle-confluence', new Set(['W', 'U']), cardMeta, ['oracle-confluence'])).toBe(false);
  });

  test('does NOT force-cut Flooded Strand in UB when it can only fetch Island basics', () => {
    const cardMeta: LandMetaLookup = {
      'oracle-strand': meta({ name: 'Flooded Strand', type: 'Land' }),
      'oracle-counterspell': meta({ name: 'Counterspell', type: 'Instant', colorIdentity: ['U'] }),
      'oracle-fatal-push': meta({ name: 'Fatal Push', type: 'Instant', colorIdentity: ['B'] }),
      'oracle-drown': meta({ name: 'Drown in the Loch', type: 'Instant', colorIdentity: ['U', 'B'] }),
      'oracle-island-source': meta({
        name: 'Faerie Conclave',
        type: 'Land',
        producedMana: ['U'],
        colorIdentity: ['U'],
      }),
      'oracle-swamp-source': meta({
        name: 'Underground River',
        type: 'Land',
        producedMana: ['U', 'B'],
        colorIdentity: ['U', 'B'],
      }),
    };
    expect(
      oracleIsForceCutLand(
        'oracle-strand',
        new Set(['U', 'B']),
        cardMeta,
        [
          'oracle-strand',
          'oracle-counterspell',
          'oracle-fatal-push',
          'oracle-drown',
          'oracle-island-source',
          'oracle-swamp-source',
        ],
        allBasics,
        7,
      ),
    ).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// oracleIsAllOffColorLand
// ---------------------------------------------------------------------------

describe('oracleIsAllOffColorLand', () => {
  test('flags lands whose only colored cost is off-color (Unholy Grotto in mono-W)', () => {
    // Grotto's produced mana is colorless ({T}: Add {C}); the {B} sits in its ability
    // cost ({B},{T}: return zombie). colorIdentity captures both production and cost.
    const cardMeta: LandMetaLookup = {
      'oracle-grotto': meta({ name: 'Unholy Grotto', type: 'Land', producedMana: ['C'], colorIdentity: ['B'] }),
    };
    expect(oracleIsAllOffColorLand('oracle-grotto', new Set(['W']), cardMeta)).toBe(true);
  });

  test("flags lands whose produced mana is off-color (Volrath's Stronghold in mono-W)", () => {
    const cardMeta: LandMetaLookup = {
      'oracle-vs': meta({ name: "Volrath's Stronghold", type: 'Land', producedMana: ['B'], colorIdentity: ['B'] }),
    };
    expect(oracleIsAllOffColorLand('oracle-vs', new Set(['W']), cardMeta)).toBe(true);
  });

  test('flags multi-color all-off lands (Underground River in mono-W)', () => {
    const cardMeta: LandMetaLookup = {
      'oracle-river': meta({
        name: 'Underground River',
        type: 'Land',
        producedMana: ['U', 'B'],
        colorIdentity: ['U', 'B'],
      }),
    };
    expect(oracleIsAllOffColorLand('oracle-river', new Set(['W']), cardMeta)).toBe(true);
  });

  test('does not flag if any produced color is on-color', () => {
    const cardMeta: LandMetaLookup = {
      'oracle-river': meta({
        name: 'Underground River',
        type: 'Land',
        producedMana: ['U', 'B'],
        colorIdentity: ['U', 'B'],
      }),
    };
    expect(oracleIsAllOffColorLand('oracle-river', new Set(['U']), cardMeta)).toBe(false);
  });

  test('does not flag colorless-only producers (Library of Alexandria)', () => {
    const cardMeta: LandMetaLookup = {
      'oracle-loa': meta({
        name: 'Library of Alexandria',
        type: 'Legendary Land',
        producedMana: ['C'],
        colorIdentity: [],
      }),
    };
    expect(oracleIsAllOffColorLand('oracle-loa', new Set(['W']), cardMeta)).toBe(false);
  });

  test('does not flag lands with no produced mana (Wasteland-style)', () => {
    const cardMeta: LandMetaLookup = {
      'oracle-wasteland': meta({ name: 'Wasteland', type: 'Land', producedMana: [], colorIdentity: [] }),
    };
    expect(oracleIsAllOffColorLand('oracle-wasteland', new Set(['W']), cardMeta)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Colored-ability lands (Goblin Burrows, Daru Encampment, Starlit Sanctum…)
// ---------------------------------------------------------------------------

describe('oracleIsOffColorAbilityLand', () => {
  test('flags Goblin Burrows in a non-R deck', () => {
    // Produces {C}, has an {R} activated ability → colorIdentity carries R.
    const cardMeta: LandMetaLookup = {
      'oracle-burrows': meta({ name: 'Goblin Burrows', type: 'Land', producedMana: ['C'], colorIdentity: ['R'] }),
    };
    expect(oracleIsOffColorAbilityLand('oracle-burrows', new Set(['W', 'U']), cardMeta)).toBe(true);
  });

  test('does not flag Goblin Burrows in a R deck', () => {
    const cardMeta: LandMetaLookup = {
      'oracle-burrows': meta({ name: 'Goblin Burrows', type: 'Land', producedMana: ['C'], colorIdentity: ['R'] }),
    };
    expect(oracleIsOffColorAbilityLand('oracle-burrows', new Set(['R']), cardMeta)).toBe(false);
  });

  test('flags Daru Encampment in a non-W deck', () => {
    const cardMeta: LandMetaLookup = {
      'oracle-daru': meta({ name: 'Daru Encampment', type: 'Land', producedMana: ['C'], colorIdentity: ['W'] }),
    };
    expect(oracleIsOffColorAbilityLand('oracle-daru', new Set(['B', 'R']), cardMeta)).toBe(true);
  });

  test('flags Starlit Sanctum in a W-only deck (B ability is dead)', () => {
    // Produces {C}, has both {W} and {B} activated abilities → colorIdentity = [W, B].
    const cardMeta: LandMetaLookup = {
      'oracle-starlit': meta({ name: 'Starlit Sanctum', type: 'Land', producedMana: ['C'], colorIdentity: ['W', 'B'] }),
    };
    expect(oracleIsOffColorAbilityLand('oracle-starlit', new Set(['W']), cardMeta)).toBe(true);
  });

  test('does not flag Starlit Sanctum in a WB deck (both abilities live)', () => {
    const cardMeta: LandMetaLookup = {
      'oracle-starlit': meta({ name: 'Starlit Sanctum', type: 'Land', producedMana: ['C'], colorIdentity: ['W', 'B'] }),
    };
    expect(oracleIsOffColorAbilityLand('oracle-starlit', new Set(['W', 'B']), cardMeta)).toBe(false);
  });

  test('skips lands whose entire colorIdentity is produced (shockland in non-WU deck)', () => {
    // Hallowed Fountain produces both W and U directly. The standard produced-mana rules
    // handle these; this rule should not double-fire.
    const cardMeta: LandMetaLookup = {
      'oracle-fountain': meta({
        name: 'Hallowed Fountain',
        type: 'Land',
        producedMana: ['W', 'U'],
        colorIdentity: ['W', 'U'],
      }),
    };
    expect(oracleIsOffColorAbilityLand('oracle-fountain', new Set(['B', 'R']), cardMeta)).toBe(false);
  });

  test('does not flag pure colorless utility lands (Wasteland)', () => {
    const cardMeta: LandMetaLookup = {
      'oracle-wasteland': meta({ name: 'Wasteland', type: 'Land', producedMana: [], colorIdentity: [] }),
    };
    expect(oracleIsOffColorAbilityLand('oracle-wasteland', new Set(['W']), cardMeta)).toBe(false);
  });

  test('does not flag basics', () => {
    const cardMeta: LandMetaLookup = {
      'basic-r': meta({ name: 'Mountain', type: 'Basic Land — Mountain', producedMana: ['R'], colorIdentity: ['R'] }),
    };
    expect(oracleIsOffColorAbilityLand('basic-r', new Set(['W']), cardMeta)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Suspect-check — covers the typed-dual protection path
// ---------------------------------------------------------------------------

describe('oracleIsSuspectNonbasicLand', () => {
  test('basic lands are never suspect', () => {
    const cardMeta: LandMetaLookup = {
      'oracle-plains': meta({ name: 'Plains', type: 'Basic Land — Plains' }),
    };
    expect(oracleIsSuspectNonbasicLand('oracle-plains', new Set(['W']), cardMeta)).toBe(false);
  });

  test('non-lands are never suspect', () => {
    const cardMeta: LandMetaLookup = {
      'oracle-bolt': meta({ name: 'Lightning Bolt', type: 'Instant' }),
    };
    expect(oracleIsSuspectNonbasicLand('oracle-bolt', new Set(['R']), cardMeta)).toBe(false);
  });

  test('does not flag pure colorless utility lands (Library of Alexandria) as off-color', () => {
    const cardMeta: LandMetaLookup = {
      'oracle-loa': meta({
        name: 'Library of Alexandria',
        type: 'Legendary Land',
        producedMana: ['C'],
        colorIdentity: [],
      }),
    };
    expect(oracleIsSuspectNonbasicLand('oracle-loa', new Set(['U']), cardMeta, ['oracle-loa'])).toBe(false);
  });

  test('flags single-color producers in light splashes (Valakut in 1-R-spell deck)', () => {
    const cardMeta: LandMetaLookup = {
      'oracle-valakut': meta({
        name: 'Valakut, the Molten Pinnacle',
        type: 'Legendary Land',
        producedMana: ['R'],
        colorIdentity: ['R'],
      }),
      'oracle-bolt': meta({ name: 'Lightning Bolt', type: 'Instant', colorIdentity: ['R'] }),
      'oracle-swords': meta({ name: 'Swords to Plowshares', type: 'Instant', colorIdentity: ['W'] }),
    };
    expect(
      oracleIsSuspectNonbasicLand('oracle-valakut', new Set(['W', 'R']), cardMeta, [
        'oracle-valakut',
        'oracle-bolt',
        'oracle-swords',
      ]),
    ).toBe(true);
  });

  test('still treats no-mana lands (Wasteland) as non-suspect', () => {
    const cardMeta: LandMetaLookup = {
      'oracle-wasteland': meta({ name: 'Wasteland', type: 'Land', producedMana: [], colorIdentity: [] }),
    };
    expect(oracleIsSuspectNonbasicLand('oracle-wasteland', new Set(['W']), cardMeta, ['oracle-wasteland'])).toBe(false);
  });

  test('protects typed duals with >= 2 on-color subtypes (Ketria Triome in UG)', () => {
    const cardMeta: LandMetaLookup = {
      'oracle-ketria': meta({
        name: 'Ketria Triome',
        type: 'Land — Forest Island Mountain',
        colorIdentity: ['G', 'U', 'R'],
      }),
    };
    expect(oracleIsSuspectNonbasicLand('oracle-ketria', new Set(['U', 'G']), cardMeta, ['oracle-ketria'])).toBe(false);
  });

  test('flags typed duals with < 2 on-color subtypes (Stomping Ground in UB)', () => {
    const cardMeta: LandMetaLookup = {
      'oracle-sg': meta({
        name: 'Stomping Ground',
        type: 'Land — Mountain Forest',
        colorIdentity: ['R', 'G'],
        producedMana: ['R', 'G'],
      }),
    };
    expect(oracleIsSuspectNonbasicLand('oracle-sg', new Set(['U', 'B']), cardMeta, ['oracle-sg'])).toBe(true);
  });

  test('protects real fetches via the fetch evaluation path', () => {
    const cardMeta: LandMetaLookup = {
      'oracle-delta': meta({ name: 'Polluted Delta', type: 'Land' }),
      'oracle-sea': meta({ name: 'Underground Sea', type: 'Land — Island Swamp' }),
    };
    expect(
      oracleIsSuspectNonbasicLand('oracle-delta', new Set(['U', 'B']), cardMeta, ['oracle-delta', 'oracle-sea']),
    ).toBe(false);
  });

  test('protects Flooded Strand in UW even without typed duals', () => {
    const cardMeta: LandMetaLookup = {
      'oracle-strand': meta({ name: 'Flooded Strand', type: 'Land' }),
      'oracle-swords': meta({ name: 'Swords to Plowshares', type: 'Instant', colorIdentity: ['W'] }),
      'oracle-preordain': meta({ name: 'Preordain', type: 'Sorcery', colorIdentity: ['U'] }),
    };
    expect(
      oracleIsSuspectNonbasicLand(
        'oracle-strand',
        new Set(['W', 'U']),
        cardMeta,
        ['oracle-strand', 'oracle-swords', 'oracle-preordain'],
        allBasics,
        5,
      ),
    ).toBe(false);
  });

  test('protects Evolving Wilds-style lands when they cover two on-color basics', () => {
    const cardMeta: LandMetaLookup = {
      'oracle-wilds': meta({ name: 'Evolving Wilds', type: 'Land', isManaFixingLand: true }),
      'oracle-swords': meta({ name: 'Swords to Plowshares', type: 'Instant', colorIdentity: ['W'] }),
      'oracle-preordain': meta({ name: 'Preordain', type: 'Sorcery', colorIdentity: ['U'] }),
    };
    expect(
      oracleIsSuspectNonbasicLand(
        'oracle-wilds',
        new Set(['W', 'U']),
        cardMeta,
        ['oracle-wilds', 'oracle-swords', 'oracle-preordain'],
        allBasics,
        5,
      ),
    ).toBe(false);
  });

  test('flags dead fetches', () => {
    const cardMeta: LandMetaLookup = {
      'oracle-heath': meta({ name: 'Windswept Heath', type: 'Land' }),
      'oracle-bolt': meta({ name: 'Lightning Bolt', type: 'Instant', colorIdentity: ['R'] }),
    };
    expect(
      oracleIsSuspectNonbasicLand(
        'oracle-heath',
        new Set(['R']),
        cardMeta,
        ['oracle-heath', 'oracle-bolt'],
        allBasics,
        3,
      ),
    ).toBe(true);
  });

  test('flags thinning fetches when no shuffle synergy is in the deck', () => {
    const cardMeta: LandMetaLookup = {
      'oracle-mire': meta({ name: 'Bloodstained Mire', type: 'Land' }),
      'oracle-bolt': meta({ name: 'Lightning Bolt', type: 'Instant', colorIdentity: ['R'] }),
    };
    expect(
      oracleIsSuspectNonbasicLand(
        'oracle-mire',
        new Set(['R']),
        cardMeta,
        ['oracle-mire', 'oracle-bolt'],
        allBasics,
        3,
      ),
    ).toBe(true);
  });

  test('protects thinning fetches when Jace, the Mind Sculptor is in the deck', () => {
    const cardMeta: LandMetaLookup = {
      'oracle-mire': meta({ name: 'Bloodstained Mire', type: 'Land' }),
      'oracle-bolt': meta({ name: 'Lightning Bolt', type: 'Instant', colorIdentity: ['R'] }),
      'oracle-jace': meta({ name: 'Jace, the Mind Sculptor', type: 'Legendary Planeswalker — Jace' }),
    };
    expect(
      oracleIsSuspectNonbasicLand(
        'oracle-mire',
        new Set(['R']),
        cardMeta,
        ['oracle-mire', 'oracle-bolt', 'oracle-jace'],
        allBasics,
        4,
      ),
    ).toBe(false);
  });

  test('flags Prismatic Vista when only one basic type is predicted and there is no shuffle synergy', () => {
    const cardMeta: LandMetaLookup = {
      'oracle-vista': meta({ name: 'Prismatic Vista', type: 'Land', isManaFixingLand: true }),
      'oracle-tundra-visions': meta({ name: 'Sea Gate Oracle', type: 'Creature', colorIdentity: ['U'] }),
      'oracle-adanto': meta({ name: 'Adanto Vanguard', type: 'Creature', colorIdentity: ['W'] }),
      'oracle-wrath': meta({ name: 'Wrath of God', type: 'Sorcery', colorIdentity: ['W'] }),
      'oracle-mentor': meta({ name: 'Monastery Mentor', type: 'Creature', colorIdentity: ['W'] }),
      'oracle-coast': meta({
        name: 'Adarkar Wastes',
        type: 'Land',
        producedMana: ['W', 'U'],
        colorIdentity: ['W', 'U'],
      }),
      'oracle-islet': meta({ name: 'Lonely Sandbar', type: 'Land', producedMana: ['U'], colorIdentity: ['U'] }),
    };
    expect(
      oracleIsSuspectNonbasicLand(
        'oracle-vista',
        new Set(['W', 'U']),
        cardMeta,
        [
          'oracle-vista',
          'oracle-tundra-visions',
          'oracle-adanto',
          'oracle-wrath',
          'oracle-mentor',
          'oracle-coast',
          'oracle-islet',
        ],
        allBasics,
        8,
      ),
    ).toBe(true);
  });

  test('flags Flooded Strand in UB when only Island basics are predicted and there is no shuffle synergy', () => {
    const cardMeta: LandMetaLookup = {
      'oracle-strand': meta({ name: 'Flooded Strand', type: 'Land' }),
      'oracle-counterspell': meta({ name: 'Counterspell', type: 'Instant', colorIdentity: ['U'] }),
      'oracle-fatal-push': meta({ name: 'Fatal Push', type: 'Instant', colorIdentity: ['B'] }),
      'oracle-drown': meta({ name: 'Drown in the Loch', type: 'Instant', colorIdentity: ['U', 'B'] }),
      'oracle-island-source': meta({
        name: 'Faerie Conclave',
        type: 'Land',
        producedMana: ['U'],
        colorIdentity: ['U'],
      }),
      'oracle-swamp-source': meta({
        name: 'Underground River',
        type: 'Land',
        producedMana: ['U', 'B'],
        colorIdentity: ['U', 'B'],
      }),
    };
    expect(
      oracleIsSuspectNonbasicLand(
        'oracle-strand',
        new Set(['U', 'B']),
        cardMeta,
        [
          'oracle-strand',
          'oracle-counterspell',
          'oracle-fatal-push',
          'oracle-drown',
          'oracle-island-source',
          'oracle-swamp-source',
        ],
        allBasics,
        7,
      ),
    ).toBe(true);
  });

  test('flags non-fetch 2-color land with no shared colors (Stomping Ground produces RG in mono-W)', () => {
    const cardMeta: LandMetaLookup = {
      'oracle-sg': meta({
        name: 'Stomping Ground',
        type: 'Land — Mountain Forest',
        colorIdentity: ['R', 'G'],
        producedMana: ['R', 'G'],
      }),
    };
    expect(oracleIsSuspectNonbasicLand('oracle-sg', new Set(['W']), cardMeta, ['oracle-sg'])).toBe(true);
  });
});

describe('oracleIsMustKeepNonbasicLand', () => {
  test('must-keeps typed duals with >= 2 on-color subtypes', () => {
    const cardMeta: LandMetaLookup = {
      'oracle-ketria': meta({ name: 'Ketria Triome', type: 'Land — Forest Island Mountain' }),
    };
    expect(oracleIsMustKeepNonbasicLand('oracle-ketria', new Set(['U', 'G']), cardMeta, ['oracle-ketria'])).toBe(true);
  });

  test('must-keeps real fetches', () => {
    const cardMeta: LandMetaLookup = {
      'oracle-delta': meta({ name: 'Polluted Delta', type: 'Land' }),
      'oracle-sea': meta({ name: 'Underground Sea', type: 'Land — Island Swamp', colorIdentity: ['U', 'B'] }),
    };
    expect(
      oracleIsMustKeepNonbasicLand(
        'oracle-delta',
        new Set(['U', 'B']),
        cardMeta,
        ['oracle-delta', 'oracle-sea'],
        allBasics,
        3,
      ),
    ).toBe(true);
  });

  test('does not must-keep thinning fetches', () => {
    const cardMeta: LandMetaLookup = {
      'oracle-mire': meta({ name: 'Bloodstained Mire', type: 'Land' }),
      'oracle-bolt': meta({ name: 'Lightning Bolt', type: 'Instant', colorIdentity: ['R'] }),
    };
    expect(
      oracleIsMustKeepNonbasicLand(
        'oracle-mire',
        new Set(['R']),
        cardMeta,
        ['oracle-mire', 'oracle-bolt'],
        allBasics,
        3,
      ),
    ).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// pickForceCutBasic
// ---------------------------------------------------------------------------

describe('pickForceCutBasic', () => {
  test('prefers a basic matching an on-color subtype of the dual', () => {
    // Scrubland (Plains, Swamp) in mono-W → swap for Plains, not Swamp
    const cardMeta: LandMetaLookup = {
      'oracle-scrubland': meta({ name: 'Scrubland', type: 'Land' }),
    };
    const basics: BasicCardLike[] = [basic('B').basicCard, basic('W').basicCard];
    expect(pickForceCutBasic('oracle-scrubland', new Set(['W']), cardMeta, basics)).toBe('basic-W');
  });

  test('falls back to any on-color basic when no subtype matches', () => {
    // Stomping Ground (Mountain, Forest) in mono-W → no on-color subtype, swap for Plains
    const cardMeta: LandMetaLookup = {
      'oracle-sg': meta({ name: 'Stomping Ground', type: 'Land — Mountain Forest' }),
    };
    const basics: BasicCardLike[] = [basic('R').basicCard, basic('W').basicCard];
    expect(pickForceCutBasic('oracle-sg', new Set(['W']), cardMeta, basics)).toBe('basic-W');
  });

  test('returns null when no basics are available', () => {
    const cardMeta: LandMetaLookup = {
      'oracle-scrubland': meta({ name: 'Scrubland', type: 'Land' }),
    };
    expect(pickForceCutBasic('oracle-scrubland', new Set(['W']), cardMeta, [])).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// hasShuffleSynergy
// ---------------------------------------------------------------------------

describe('hasShuffleSynergy', () => {
  test('detects Brainstorm in the mainboard', () => {
    const cardMeta: LandMetaLookup = {
      'oracle-brainstorm': meta({ name: 'Brainstorm', type: 'Instant' }),
    };
    expect(hasShuffleSynergy(['oracle-brainstorm'], cardMeta)).toBe(true);
  });

  test('detects Jace, the Mind Sculptor', () => {
    const cardMeta: LandMetaLookup = {
      'oracle-jace': meta({ name: 'Jace, the Mind Sculptor', type: 'Legendary Planeswalker — Jace' }),
    };
    expect(hasShuffleSynergy(['oracle-jace'], cardMeta)).toBe(true);
  });

  test('detects Sylvan Library', () => {
    const cardMeta: LandMetaLookup = {
      'oracle-sylvan': meta({ name: 'Sylvan Library', type: 'Enchantment' }),
    };
    expect(hasShuffleSynergy(['oracle-sylvan'], cardMeta)).toBe(true);
  });

  test('returns false when no shuffle-synergy card is in the deck', () => {
    const cardMeta: LandMetaLookup = {
      'oracle-bolt': meta({ name: 'Lightning Bolt', type: 'Instant' }),
    };
    expect(hasShuffleSynergy(['oracle-bolt'], cardMeta)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// oracleIsUnderusedMultiColorLand
// ---------------------------------------------------------------------------

describe('oracleIsUnderusedMultiColorLand', () => {
  test('flags 2-color producers with 1 on-color (Adarkar Wastes in mono-W)', () => {
    const cardMeta: LandMetaLookup = {
      'oracle-adarkar': meta({
        name: 'Adarkar Wastes',
        type: 'Land',
        producedMana: ['W', 'U'],
        colorIdentity: ['W', 'U'],
      }),
    };
    expect(oracleIsUnderusedMultiColorLand('oracle-adarkar', new Set(['W']), cardMeta)).toBe(true);
  });

  test('flags 5-color producers with 1 on-color (Mana Confluence in mono-W)', () => {
    const cardMeta: LandMetaLookup = {
      'oracle-confluence': meta({
        name: 'Mana Confluence',
        type: 'Land',
        producedMana: ['W', 'U', 'B', 'R', 'G'],
        colorIdentity: ['W', 'U', 'B', 'R', 'G'],
      }),
    };
    expect(oracleIsUnderusedMultiColorLand('oracle-confluence', new Set(['W']), cardMeta)).toBe(true);
  });

  test('does not flag when ≥ 2 produced colors are on-color (Adarkar Wastes in UW)', () => {
    const cardMeta: LandMetaLookup = {
      'oracle-adarkar': meta({
        name: 'Adarkar Wastes',
        type: 'Land',
        producedMana: ['W', 'U'],
        colorIdentity: ['W', 'U'],
      }),
    };
    expect(oracleIsUnderusedMultiColorLand('oracle-adarkar', new Set(['W', 'U']), cardMeta)).toBe(false);
  });

  test('does not flag 1-color producers (handled by oracleIsAllOffColorLand)', () => {
    const cardMeta: LandMetaLookup = {
      'oracle-vs': meta({ name: "Volrath's Stronghold", type: 'Land', producedMana: ['B'], colorIdentity: ['B'] }),
    };
    expect(oracleIsUnderusedMultiColorLand('oracle-vs', new Set(['W']), cardMeta)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// oracleIsUnderusedSingleColorLand
// ---------------------------------------------------------------------------

describe('oracleIsUnderusedSingleColorLand', () => {
  test('flags Valakut in a 2-R-spell deck (light splash)', () => {
    const cardMeta: LandMetaLookup = {
      'oracle-valakut': meta({
        name: 'Valakut, the Molten Pinnacle',
        type: 'Legendary Land',
        producedMana: ['R'],
        colorIdentity: ['R'],
      }),
      'oracle-bolt': meta({ name: 'Lightning Bolt', type: 'Instant', colorIdentity: ['R'] }),
      'oracle-flame-slash': meta({ name: 'Flame Slash', type: 'Sorcery', colorIdentity: ['R'] }),
      'oracle-swords': meta({ name: 'Swords to Plowshares', type: 'Instant', colorIdentity: ['W'] }),
    };
    expect(
      oracleIsUnderusedSingleColorLand(
        'oracle-valakut',
        ['oracle-valakut', 'oracle-bolt', 'oracle-flame-slash', 'oracle-swords'],
        cardMeta,
      ),
    ).toBe(true);
  });

  test('does not flag Valakut when the deck runs 4+ red spells', () => {
    const cardMeta: LandMetaLookup = {
      'oracle-valakut': meta({
        name: 'Valakut, the Molten Pinnacle',
        type: 'Legendary Land',
        producedMana: ['R'],
        colorIdentity: ['R'],
      }),
      'oracle-bolt': meta({ name: 'Lightning Bolt', type: 'Instant', colorIdentity: ['R'] }),
      'oracle-flame-slash': meta({ name: 'Flame Slash', type: 'Sorcery', colorIdentity: ['R'] }),
      'oracle-anger': meta({ name: 'Anger', type: 'Creature', colorIdentity: ['R'] }),
      'oracle-pia': meta({ name: 'Pia Nalaar', type: 'Creature', colorIdentity: ['R'] }),
    };
    expect(
      oracleIsUnderusedSingleColorLand(
        'oracle-valakut',
        ['oracle-valakut', 'oracle-bolt', 'oracle-flame-slash', 'oracle-anger', 'oracle-pia'],
        cardMeta,
      ),
    ).toBe(false);
  });

  test('does not count lands toward the color-spell count', () => {
    // 6 Mountains in the mainboard shouldn't keep Valakut alive — it needs spell support.
    const cardMeta: LandMetaLookup = {
      'oracle-valakut': meta({
        name: 'Valakut, the Molten Pinnacle',
        type: 'Legendary Land',
        producedMana: ['R'],
        colorIdentity: ['R'],
      }),
      'oracle-mountain': meta({
        name: 'Mountain',
        type: 'Basic Land — Mountain',
        colorIdentity: ['R'],
        producedMana: ['R'],
      }),
      'oracle-bolt': meta({ name: 'Lightning Bolt', type: 'Instant', colorIdentity: ['R'] }),
    };
    const mainboard = [
      'oracle-valakut',
      'oracle-mountain',
      'oracle-mountain',
      'oracle-mountain',
      'oracle-mountain',
      'oracle-mountain',
      'oracle-mountain',
      'oracle-bolt',
    ];
    expect(oracleIsUnderusedSingleColorLand('oracle-valakut', mainboard, cardMeta)).toBe(true);
  });
});
