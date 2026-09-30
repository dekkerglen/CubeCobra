import { Catalog } from '@utils/datatypes/CardCatalog';

// Built inside the factory: the transform hoists jest.mock above module-scope
// declarations, so an outer const would be in the TDZ when the factory runs.
jest.mock('serverutils/cardCatalog', () => ({
  __esModule: true,
  default: {
    imagedict: {},
    cardimages: {},
    cardnames: [],
    comboTree: {},
    full_names: [],
    nameToId: {},
    oracleToId: {},
    english: {},
    _carddict: {},
    indexToOracle: [],
    oracleToIndex: {},
    metadatadict: {},
    printedCardList: [],
    printedCardListWithExtras: [],
    comboOracleToIndex: {},
    reasonable_names: [],
    reasonable_full_names: [],
    setdict: {},
  },
  whenCardDbReady: () => Promise.resolve(),
  isCardDbReady: () => true,
}));

import Card, { CardDetails } from '@utils/datatypes/Card';
import { ALL_CROSSWORD_CLASSES, CrosswordEntryClass, CrosswordVocabEntry } from '@utils/datatypes/Crossword';
import { makeFilter } from '@utils/filtering/FilterCards';
import seedrandom from 'seedrandom';
import cardCatalog from 'serverutils/cardCatalog';
import { normalizeName } from '@utils/cardutil';
import { clearClueContextCache, ClueContext, clueFor, getClueContext } from 'serverutils/crossword/clues';
import { CROSSWORD_SYNONYMS } from 'serverutils/crossword/synonyms.generated';
import { blankWordInRulesText, normalize, oracleWords } from 'serverutils/crossword/text';
import { MIN_RECOGNISABLE_TAG_NAMES } from 'serverutils/tagEligibility';

import { createCardDetails } from '../test-utils/data';

const mockCardCatalog = cardCatalog as unknown as Catalog;

const card = (overrides: Partial<CardDetails> & { name: string }): CardDetails =>
  createCardDetails({
    isExtra: false,
    isToken: false,
    digital: false,
    layout: 'normal',
    language: 'en',
    set_type: 'expansion',
    keywords: [],
    oracle_text: '',
    // The catalog's own key function, which folds accents: "Gríma" indexes as
    // "grima". A clue looking a card up has to fold the same way.
    name_lower: normalizeName(overrides.name),
    ...overrides,
  });

/**
 * A deliberately small catalog with known attributes, plus thirty near-identical
 * green bears and thirty blue wizards so a narrowing filter actually has to narrow
 * rather than stopping at its first term.
 *
 * The bears are named "Filler Cub" rather than "Filler Bear" deliberately: a term
 * repeating a word of the card's own name is dropped (see the Goblin Chieftain
 * test), and naming them Bear would drop `t:bear` and take the filter's second
 * term with it.
 */
const FILLER_COUNT = 30;

const catalogCards = (): CardDetails[] => [
  card({
    name: 'Llanowar Elves',
    type: 'Creature — Elf Druid',
    cmc: 1,
    colors: ['G'],
    color_identity: ['G'],
    power: '1',
    toughness: '1',
    rarity: 'common',
    set: 'lea',
    firstPrintYear: 1993,
    oracle_text: '{T}: Add {G}.',
  }),
  card({
    name: 'Elvish Archers',
    type: 'Creature — Elf Archer',
    cmc: 2,
    colors: ['G'],
    color_identity: ['G'],
    power: '2',
    toughness: '1',
    rarity: 'rare',
    set: 'lea',
    firstPrintYear: 1993,
    keywords: ['First strike'],
    oracle_text: 'First strike',
  }),
  card({
    name: 'Birds of Paradise',
    type: 'Creature — Bird',
    cmc: 1,
    colors: ['G'],
    color_identity: ['G'],
    power: '0',
    toughness: '1',
    rarity: 'rare',
    set: 'lea',
    firstPrintYear: 1993,
    keywords: ['Flying'],
    oracle_text: 'Flying\n{T}: Add one mana of any color.',
  }),
  card({
    name: 'Grizzly Bears',
    type: 'Creature — Bear',
    cmc: 2,
    colors: ['G'],
    color_identity: ['G'],
    power: '2',
    toughness: '2',
    rarity: 'common',
    set: 'lea',
    firstPrintYear: 1993,
    oracle_text: '',
  }),
  card({
    name: 'Ancestral Recall',
    type: 'Instant',
    cmc: 1,
    colors: ['U'],
    color_identity: ['U'],
    rarity: 'rare',
    set: 'lea',
    firstPrintYear: 1993,
    oracle_text: 'Target player draws three cards.',
  }),
  card({
    name: 'Lightning Bolt',
    type: 'Instant',
    cmc: 1,
    colors: ['R'],
    color_identity: ['R'],
    rarity: 'common',
    set: 'lea',
    firstPrintYear: 1993,
    oracle_text: 'Lightning Bolt deals 3 damage to any target.',
  }),
  card({
    name: 'Jace, the Mind Sculptor',
    type: 'Legendary Planeswalker — Jace',
    cmc: 4,
    colors: ['U'],
    color_identity: ['U'],
    rarity: 'mythic',
    set: 'wwk',
    firstPrintYear: 2010,
    oracle_text: 'Unsummon target creature.',
  }),
  // The keyword FEAR has a card named exactly that, which a clue must not cite.
  card({
    name: 'Fear',
    type: 'Enchantment — Aura',
    cmc: 2,
    colors: ['B'],
    color_identity: ['B'],
    rarity: 'common',
    set: 'lea',
    firstPrintYear: 1993,
    keywords: ['Fear'],
    oracle_text: 'Enchanted creature has fear.',
  }),
  card({
    name: 'Dread Reaper',
    type: 'Creature — Horror',
    cmc: 5,
    colors: ['B'],
    color_identity: ['B'],
    power: '6',
    toughness: '5',
    rarity: 'rare',
    set: 'tmp',
    firstPrintYear: 1997,
    keywords: ['Fear'],
    oracle_text: 'Flying, fear',
  }),
  // Two printings of one card, reprint first — which is how the real catalog
  // holds them. The original printing is the one a clue may attribute to a set.
  card({
    name: 'Disintegrate',
    type: 'Sorcery',
    cmc: 3,
    colors: ['R'],
    color_identity: ['R'],
    rarity: 'common',
    set: 'sum',
    setIndex: 10,
    released_at: '1994-06-21',
    reprint: true,
    firstPrintYear: 1993,
    oracle_text: 'Destroy target creature.',
  }),
  card({
    name: 'Disintegrate',
    type: 'Sorcery',
    cmc: 3,
    colors: ['R'],
    color_identity: ['R'],
    rarity: 'common',
    set: 'lea',
    setIndex: 0,
    released_at: '1993-08-05',
    reprint: false,
    firstPrintYear: 1993,
    oracle_text: 'Destroy target creature.',
  }),
  // Holds a contraction, which the shared tokenizer counts as one word (ARENT) and
  // the old rules-word split cut into AREN and T.
  card({
    name: 'Stubborn Denial',
    type: 'Instant',
    cmc: 1,
    colors: ['U'],
    color_identity: ['U'],
    rarity: 'common',
    set: 'khm',
    oracle_text: "Counter target spell unless its controller pays 1 more, if they aren't ready.",
  }),
  // Two cards whose names carry commas, so the clue has to disambiguate them from
  // its own ", and " join.
  card({
    name: 'Mutagen Man, Living Ooze',
    type: 'Creature — Ooze',
    cmc: 4,
    colors: ['B'],
    color_identity: ['B'],
    rarity: 'rare',
    set: 'pip',
    oracle_text: 'Skulk',
  }),
  card({
    name: 'Yes Man, Personal Securitron',
    type: 'Creature — Robot',
    cmc: 3,
    colors: ['B'],
    color_identity: ['B'],
    rarity: 'rare',
    set: 'pip',
    oracle_text: 'Flying, skulk',
  }),
  // An accented name, which the catalog keys as "grima, saruman's footman".
  card({
    name: "Gríma, Saruman's Footman",
    type: 'Legendary Creature — Human Advisor',
    cmc: 2,
    colors: ['B'],
    color_identity: ['B'],
    power: '1',
    toughness: '3',
    rarity: 'uncommon',
    set: 'ltr',
    oracle_text: 'Menace',
  }),
  // Its type is in its name, so a clue may not use it: `t:goblin` would put a
  // word of the answer in the clue.
  card({
    name: 'Goblin Chieftain',
    type: 'Creature — Goblin Warrior',
    cmc: 3,
    colors: ['R'],
    color_identity: ['R'],
    power: '2',
    toughness: '2',
    rarity: 'rare',
    set: 'm10',
    keywords: ['Haste'],
    oracle_text: 'Haste',
  }),
  ...Array.from({ length: FILLER_COUNT }, (_, index) =>
    card({
      name: `Filler Cub ${index + 1}`,
      type: 'Creature — Bear',
      cmc: 3,
      colors: ['G'],
      color_identity: ['G'],
      power: '3',
      toughness: '3',
      rarity: 'common',
      set: 'tst',
      oracle_text: '',
    }),
  ),
  // Blue in bulk, so `ci=u` alone doesn't identify the one blue legend.
  ...Array.from({ length: FILLER_COUNT }, (_, index) =>
    card({
      name: `Filler Wizard ${index + 1}`,
      type: 'Creature — Human Wizard',
      cmc: 2,
      colors: ['U'],
      color_identity: ['U'],
      power: '1',
      toughness: '2',
      rarity: 'common',
      set: 'tst',
      oracle_text: '',
    }),
  ),
];

const entry = (overrides: Partial<CrosswordVocabEntry> & { text: string; entryClass: CrosswordEntryClass }) => ({
  display: overrides.text,
  ...overrides,
});

/** One representative entry per class, all answerable from the catalog above. */
const ENTRIES: Record<CrosswordEntryClass, CrosswordVocabEntry> = {
  cardName: entry({
    text: 'LLANOWARELVES',
    display: 'Llanowar Elves',
    entryClass: 'cardName',
    sourceCardName: 'Llanowar Elves',
  }),
  nameWord: entry({
    text: 'BEARS',
    display: 'Grizzly Bears',
    entryClass: 'nameWord',
    sourceCardName: 'Grizzly Bears',
    sourceCardNames: ['Grizzly Bears'],
  }),
  nameBigram: entry({
    text: 'MINDSCULPTOR',
    display: 'Jace, the Mind Sculptor',
    entryClass: 'nameBigram',
    sourceCardName: 'Jace, the Mind Sculptor',
    sourceCardNames: ['Jace, the Mind Sculptor'],
  }),
  acronym: entry({
    text: 'JTMS',
    display: 'Jace, the Mind Sculptor',
    entryClass: 'acronym',
    sourceCardName: 'Jace, the Mind Sculptor',
  }),
  creatureType: entry({ text: 'ELF', display: 'Elf', entryClass: 'creatureType' }),
  keyword: entry({ text: 'FEAR', display: 'Fear', entryClass: 'keyword' }),
  legendName: entry({
    text: 'JACE',
    display: 'Jace',
    entryClass: 'legendName',
    sourceCardName: 'Jace, the Mind Sculptor',
  }),
  legendTitle: entry({
    text: 'THEMINDSCULPTOR',
    display: 'the Mind Sculptor',
    entryClass: 'legendTitle',
    sourceCardName: 'Jace, the Mind Sculptor',
  }),
  setCode: entry({
    text: 'LEA',
    display: 'Limited Edition Alpha',
    entryClass: 'setCode',
    setCode: 'LEA',
    setReleasedAt: '1993-08-05',
    reprintOnly: false,
  }),
  oracleWord: entry({ text: 'TARGET', display: 'TARGET', entryClass: 'oracleWord', frequency: 3 }),
};

/** An rng that hands out a fixed sequence, so a pick is a known index. */
const fakeRng = (...values: number[]): (() => number) => {
  let index = 0;
  return () => values[Math.min(index++, values.length - 1)]!;
};

/**
 * The words of a card's rules text, at the positions an oracleWord clue counts.
 *
 * Deliberately the production tokenizer rather than a re-derivation: the point of
 * `oracleWords` being shared between the vocabulary pass and the clue writer is
 * that there is exactly one answer to "which word is the 8th", and a test with a
 * fourth opinion on that would only ever disagree with all three.
 */
const wordsOnCard = (oracleText: string): string[] => oracleWords(oracleText);

/** Consecutive-word runs of a clue, as a solver would read them: no punctuation. */
const clueWordRuns = (clue: string): { spelled: string[]; initials: string[] } => {
  const words = clue.split(/\s+/).map(normalize).filter(Boolean);
  const spelled: string[] = [];
  const initials: string[] = [];
  for (let start = 0; start < words.length; start++) {
    let run = '';
    let firsts = '';
    for (let end = start; end < words.length; end++) {
      run += words[end]!;
      firsts += words[end]![0]!;
      spelled.push(run);
      initials.push(firsts);
    }
  }
  return { spelled, initials };
};

/**
 * The invariant every class has to keep: a solver cannot read the answer off the
 * clue. Two ways that happens, and both are checked over every run of consecutive
 * words — spelled out, and as the run's initials, which is how an acronym clue
 * leaks ('"Thrun, the Last Troll", as an acronym' gives up TTLT for free).
 */
const handsOverAnswer = (clue: string, answer: string): boolean => {
  const { spelled, initials } = clueWordRuns(clue);
  return spelled.includes(answer) || initials.includes(answer);
};

let ctx: ClueContext;

beforeEach(() => {
  mockCardCatalog.printedCardList = catalogCards();
  // Tag eligibility counts distinct oracle ids off these two, so an untagged
  // fixture has to empty them or the previous test's tags stay recognisable.
  mockCardCatalog._carddict = {};
  mockCardCatalog.oracleToId = {};
  clearClueContextCache();
  ctx = getClueContext();
});

afterEach(() => {
  clearClueContextCache();
});

describe('clueFor, one class at a time', () => {
  it('covers every class in ALL_CROSSWORD_CLASSES', () => {
    expect(Object.keys(ENTRIES).sort()).toEqual([...ALL_CROSSWORD_CLASSES].sort());
  });

  for (const entryClass of ALL_CROSSWORD_CLASSES) {
    it(`writes a usable clue for ${entryClass}`, () => {
      const { clue } = clueFor(ENTRIES[entryClass], fakeRng(0), ctx);
      expect(clue.length).toBeGreaterThan(0);
      expect(clue.trim()).toBe(clue);
      expect(clue).not.toContain('undefined');
      expect(clue).not.toContain('null');
      expect(clue).not.toContain('NaN');
      // A clue never hands the answer over, spelled or as initials.
      expect(handsOverAnswer(clue, ENTRIES[entryClass].text)).toBe(false);
      // Nor does it state how many cards it admits.
      expect(clue).not.toMatch(/\d+ match/);
    });
  }

  it('clues a card name by translating a filter that parses and really matches it', () => {
    const { clue, clueFilter } = clueFor(ENTRIES.cardName, fakeRng(0), ctx);
    expect(clueFilter).toBe('ci=g t:druid');
    expect(clue).toBe('color identity is exactly Green, type line includes Druid');

    const { err, filter } = makeFilter(clueFilter!);
    expect(err).toBeFalsy();
    expect(filter).toBeTruthy();

    const matches = ctx.cards.filter((details) => filter!({ details } as Card));
    expect(matches.length).toBeGreaterThanOrEqual(1);
    expect(matches.map((details) => details.name)).toContain('Llanowar Elves');
  });

  it('keeps adding attributes until the filter is selective, then stops', () => {
    // ci=g alone matches 34 of this catalog, so a second term was forced on, and
    // the second one got it under the target so there is no third.
    expect(clueFor(ENTRIES.cardName, fakeRng(0), ctx).clueFilter).toBe('ci=g t:druid');
  });

  it('opens on colour identity whatever else it reaches for', () => {
    // The one anchored term. Everything after it is drawn per clue, so it is the
    // only thing a solver can count on being told first.
    for (const roll of [0, 0.2, 0.4, 0.6, 0.8, 0.99]) {
      expect(clueFor(ENTRIES.cardName, fakeRng(roll), ctx).clueFilter).toMatch(/^ci=/);
      expect(clueFor(ENTRIES.cardName, fakeRng(roll), ctx).clue).toMatch(/^color identity is/);
    }
  });

  it('reaches for different attributes on different draws', () => {
    // The whole point of shuffling the candidates: a fixed order meant colour and
    // type line led every clue in every puzzle and the rest was never reached.
    // Llanowar Elves can be identified by either of its subtypes, by its set or by
    // the year, and over a handful of seeds it uses more than one of them.
    const filters = new Set(
      ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].map(
        (seed) => clueFor(ENTRIES.cardName, seedrandom(seed), ctx).clueFilter!,
      ),
    );
    expect(filters.size).toBeGreaterThan(1);
    // Every one of them still parses and still matches the card it clues.
    for (const clueFilter of filters) {
      const { err, filter } = makeFilter(clueFilter);
      expect(err).toBeFalsy();
      expect(ctx.cards.filter((details) => filter!({ details } as Card)).map((details) => details.name)).toContain(
        'Llanowar Elves',
      );
    }
  });

  it('never states how many cards a filter matches, however many that is', () => {
    // The thirty filler cubs are identical in every attribute the builder knows,
    // so the filter runs out of terms with the whole flock still matching. It
    // ships anyway — but the count that decided it stays internal, and the terms
    // that would have narrowed nothing are left off rather than padding the clue.
    const cub = entry({
      text: 'FILLERCUB7',
      display: 'Filler Cub 7',
      entryClass: 'cardName',
      sourceCardName: 'Filler Cub 7',
    });
    for (const seed of ['a', 'b', 'c', 'd']) {
      const { clue, clueFilter } = clueFor(cub, seedrandom(seed), ctx);
      expect(clue).not.toMatch(/\d+ match/);
      const { err, filter } = makeFilter(clueFilter!);
      expect(err).toBeFalsy();
      // The count the clue refuses to state is real, and large: whatever the
      // filter says, it cannot tell one cub from another.
      expect(ctx.cards.filter((details) => filter!({ details } as Card)).length).toBeGreaterThanOrEqual(FILLER_COUNT);
    }
  });

  it('drops a filter term that repeats a word of the card name', () => {
    // `t:goblin` narrows Goblin Chieftain beautifully and is unusable: a clue may
    // not contain a word of its own answer.
    const { clue, clueFilter } = clueFor(
      entry({
        text: 'GOBLINCHIEFTAIN',
        display: 'Goblin Chieftain',
        entryClass: 'cardName',
        sourceCardName: 'Goblin Chieftain',
      }),
      fakeRng(0),
      ctx,
    );
    expect(clueFilter).not.toContain('goblin');
    expect(clue.toLowerCase()).not.toContain('goblin');
    // Something else identified it instead — here the colour alone, since this
    // catalog holds only three red cards.
    expect(clueFilter).toBe('ci=r');
  });

  it('blanks a name word out of one of its cards', () => {
    expect(clueFor(ENTRIES.nameWord, fakeRng(0), ctx).clue).toBe('Grizzly ____');
  });

  it('blanks an adjacent pair of words, one blank each', () => {
    // Two blanks, because the answer is two words and the solver has to know.
    expect(clueFor(ENTRIES.nameBigram, fakeRng(0), ctx).clue).toBe('Jace, the ____ ____');
  });

  it('clues an acronym by describing the card instead of naming it', () => {
    const { clue, clueFilter } = clueFor(ENTRIES.acronym, fakeRng(0), ctx);
    expect(clue).toBe('color identity is exactly Blue, type line includes Planeswalker, as an acronym');
    expect(clueFilter).toBe('ci=u t:planeswalker');
    // The old format was '"Jace, the Mind Sculptor", as an acronym' — the answer
    // by first letters. Neither the name nor its initials survive.
    expect(clue).not.toContain('Jace');
    expect(handsOverAnswer(clue, 'JTMS')).toBe(false);
  });

  it('clues a creature type with a card carrying it', () => {
    expect(clueFor(ENTRIES.creatureType, fakeRng(0), ctx).clue).toBe('a type of Llanowar Elves');
    expect(clueFor(ENTRIES.creatureType, fakeRng(0.99), ctx).clue).toBe('a type of Elvish Archers');
  });

  it('clues a keyword without citing the card that is named after it', () => {
    // "Fear has this keyword" would be free, so the card called Fear is skipped
    // however the rng falls.
    for (const roll of [0, 0.25, 0.5, 0.75, 0.99]) {
      expect(clueFor(ENTRIES.keyword, fakeRng(roll), ctx).clue).toBe('Dread Reaper has this keyword');
    }
  });

  it('clues a set code with a card that premiered there', () => {
    expect(clueFor(ENTRIES.setCode, fakeRng(0), ctx).clue).toBe('Llanowar Elves was first printed in this set');
  });

  it('quotes a cited card name with a comma of its own, whatever cites it', () => {
    // "a type of Greasefang, Okiba Boss" reads as two clues; the quotes fix that
    // for every class that names a card, not just the rules-word one.
    mockCardCatalog.printedCardList = [
      card({ name: 'Slimy Lord, Bearer of Goo', type: 'Creature — Ooze', cmc: 4, set: 'tst', keywords: ['Skulk'] }),
    ];
    clearClueContextCache();
    const context = getClueContext();
    expect(
      clueFor(entry({ text: 'OOZE', display: 'Ooze', entryClass: 'creatureType' }), fakeRng(0), context).clue,
    ).toBe('a type of "Slimy Lord, Bearer of Goo"');
    expect(clueFor(entry({ text: 'SKULK', display: 'Skulk', entryClass: 'keyword' }), fakeRng(0), context).clue).toBe(
      '"Slimy Lord, Bearer of Goo" has this keyword',
    );
  });

  it('attributes a card to the set that premiered it, not to a reprint', () => {
    // The catalog lists Summer Magic before Alpha, so first-one-wins would claim
    // Disintegrate premiered in Summer Magic. It didn't.
    expect(ctx.cards.find((details) => details.name === 'Disintegrate')!.set).toBe('lea');
    expect(ctx.bySetCode.get('lea')!.map((index) => ctx.cards[index]!.name)).toContain('Disintegrate');
    expect(ctx.bySetCode.get('sum')).toBeUndefined();

    const summer = entry({
      text: 'SUM',
      display: 'Summer Magic',
      entryClass: 'setCode',
      setCode: 'SUM',
      setReleasedAt: '1994-06-21',
      // Flagged as having premiered something, which is what a caller passing a
      // stale entry would do. The clue degrades to the release date rather than
      // lying about a first printing.
      reprintOnly: false,
    });
    expect(clueFor(summer, fakeRng(0), ctx).clue).toBe('set released on 1994-06-21');
  });

  it('clues a reprint-only set by its release date, since nothing premiered there', () => {
    const chronicles = entry({
      text: 'CHR',
      display: 'Chronicles',
      entryClass: 'setCode',
      setCode: 'CHR',
      setReleasedAt: '1995-07-01',
      reprintOnly: true,
    });
    expect(clueFor(chronicles, fakeRng(0), ctx).clue).toBe('reprint-only set released on 1995-07-01');
  });

  it('never prints a missing release date as "null"', () => {
    const unknown = entry({
      text: 'XYZ',
      display: 'Unknown',
      entryClass: 'setCode',
      setCode: 'xyz',
      setReleasedAt: null,
      reprintOnly: true,
    });
    expect(clueFor(unknown, fakeRng(0), ctx).clue).toBe('a reprint-only set');
  });

  it('falls back to naming the kind of answer when a class has no sources at all', () => {
    const missing = entry({ text: 'ZOMBIE', display: 'Zombie', entryClass: 'creatureType' });
    expect(clueFor(missing, fakeRng(0), ctx).clue).toBe('6-letter creature type');
  });

  it('falls back rather than leave the answer readable in a clue of any class', () => {
    // Both of these are real. "B.F.M. (Big Furry Monster)" sources the name word
    // BFM, and blanking it leaves "____ (Big Furry Monster)" — the answer, as the
    // initials of the words that are left. MASTICORE is a creature type whose every
    // card is named after it, so the usual give-away filter has nothing left to
    // pick and takes a card that spells the answer out.
    expect(
      clueFor(
        entry({
          text: 'BFM',
          display: 'B.F.M. (Big Furry Monster)',
          entryClass: 'nameWord',
          sourceCardName: 'B.F.M. (Big Furry Monster)',
          sourceCardNames: ['B.F.M. (Big Furry Monster)'],
        }),
        fakeRng(0),
        ctx,
      ).clue,
    ).toBe('3-letter word from a card name');

    mockCardCatalog.printedCardList = [
      card({ name: 'Masticore', type: 'Creature — Masticore', cmc: 4, set: 'usg' }),
      card({ name: 'Razormane Masticore', type: 'Creature — Masticore', cmc: 5, set: 'tsp' }),
    ];
    clearClueContextCache();
    const masticore = entry({ text: 'MASTICORE', display: 'Masticore', entryClass: 'creatureType' });
    expect(clueFor(masticore, fakeRng(0), getClueContext()).clue).toBe('9-letter creature type');
  });
});

/**
 * Oracle tags — Scryfall Tagger's functional slugs — are what a filter clue is
 * built out of ahead of the numeric tail, because "oracle tag is "tutor"" says
 * what a card does and "mana value is 3" says what it costs.
 *
 * Which slugs count as recognisable is `serverutils/tagEligibility`'s decision,
 * shared with ManaMatrix's tag categories, and that module counts distinct
 * oracle ids off `oracleToId`/`_carddict` rather than `printedCardList` — so
 * these fixtures publish all three.
 */
describe('oracle tags in filter clues', () => {
  /** Puts a card list where both the clue context and the tag counter read it. */
  const publish = (cards: CardDetails[]): ClueContext => {
    mockCardCatalog.printedCardList = cards;
    mockCardCatalog._carddict = Object.fromEntries(cards.map((details) => [details.scryfall_id, details]));
    mockCardCatalog.oracleToId = Object.fromEntries(cards.map((details) => [details.oracle_id, [details.scryfall_id]]));
    clearClueContextCache();
    return getClueContext();
  };

  /** `count` interchangeable cards, so the tags they carry clear the floor. */
  const bulk = (prefix: string, count: number, overrides: Partial<CardDetails>): CardDetails[] =>
    Array.from({ length: count }, (_, index) =>
      card({ name: `${prefix} ${index + 1}`, type: 'Sorcery', cmc: 2, set: 'tst', ...overrides }),
    );

  const FLOOR = MIN_RECOGNISABLE_TAG_NAMES;

  /**
   * One blue instant worth cluing, against enough bulk to make five of its six
   * tags recognisable and two of those three unusable. Counting the target in:
   *
   *   nudity     FLOOR + 2   blocked by substring
   *   reprint    FLOOR + 5   blocked by slug
   *   tutor      FLOOR + 11  eligible, and the rarest eligible one
   *   draw       FLOOR + 151 eligible
   *   junk-tag   1           far under the floor
   */
  const taggedCatalog = (): CardDetails[] => [
    card({
      name: 'Arcane Inquiry',
      type: 'Instant',
      cmc: 3,
      colors: ['U'],
      color_identity: ['U'],
      rarity: 'rare',
      set: 'tst',
      oracle_tags: ['draw', 'tutor', 'reprint', 'nudity', 'junk-tag'],
    }),
    ...bulk('Bulk Study', FLOOR + 1, { color_identity: ['B'], oracle_tags: ['nudity'] }),
    ...bulk('Bulk Search', FLOOR + 4, { color_identity: ['B'], oracle_tags: ['reprint'] }),
    ...bulk('Bulk Fetch', FLOOR + 10, { color_identity: ['B'], oracle_tags: ['tutor'] }),
    ...bulk('Bulk Peek', FLOOR + 150, { color_identity: ['B'], oracle_tags: ['draw'] }),
    // Blue in bulk, and untagged, so `ci=u` alone can't identify the target and
    // a tag term is the only thing that finishes the job.
    ...bulk('Bulk Cantrip', FLOOR, { type: 'Instant', cmc: 1, colors: ['U'], color_identity: ['U'] }),
  ];

  const inquiry = entry({
    text: 'ARCANEINQUIRY',
    display: 'Arcane Inquiry',
    entryClass: 'cardName',
    sourceCardName: 'Arcane Inquiry',
  });

  it('clues a card with a tag term that parses and really matches it', () => {
    const context = publish(taggedCatalog());
    const { clue, clueFilter } = clueFor(inquiry, fakeRng(0), context);

    // The rarest eligible tag leads: it is the one that says something about
    // this card rather than about half the catalog, and it narrows fastest.
    expect(clueFilter).toBe('ci=u otag:"tutor"');
    expect(clue).toBe('color identity is exactly Blue, oracle tag is "tutor"');

    const { err, filter } = makeFilter(clueFilter!);
    expect(err).toBeFalsy();
    expect(filter).toBeTruthy();
    const matches = context.cards.filter((details) => filter!({ details } as Card));
    expect(matches.map((details) => details.name)).toContain('Arcane Inquiry');
    // Still no match count, however few there are.
    expect(clue).not.toMatch(/\d+ match/);
  });

  it('quotes the tag value, because a bare one is a substring match', () => {
    const context = publish(taggedCatalog());
    const { clueFilter } = clueFor(inquiry, fakeRng(0), context);
    expect(clueFilter).toContain('otag:"tutor"');

    // 'oracle tag is "tutor"' is a claim of exactness, and only the quoted form
    // makes it true: unquoted, `otag:tutor` would also admit `tutor-to-hand`.
    const exact = makeFilter('otag:"tutor"').filter!;
    const loose = makeFilter('otag:tutor').filter!;
    const tutorish = { details: card({ name: 'Wide Net', set: 'tst', oracle_tags: ['tutor-to-hand'] }) } as Card;
    expect(exact(tutorish)).toBe(false);
    expect(loose(tutorish)).toBe(true);
  });

  it('never names a tag the shared eligibility rules out', () => {
    const context = publish(taggedCatalog());
    const { clue, clueFilter } = clueFor(inquiry, fakeRng(0), context);

    // Under the floor: one card carries it, so it identifies the answer without
    // describing it.
    expect(clueFilter).not.toContain('junk-tag');
    // Over the floor and still blocked — by slug, and by substring. Both are
    // rarer than `tutor`, so they would have led the filter if they were allowed.
    expect(clueFilter).not.toContain('reprint');
    expect(clueFilter).not.toContain('nudity');
    expect(clue).not.toContain('reprint');
    expect(clue).not.toContain('nudity');
  });

  it('drops a tag that spells the answer, and clues the card anyway', () => {
    // COUNTERSPELL is the whole answer, and `otag:"counterspell"` prints it.
    const context = publish([
      card({
        name: 'Counterspell',
        type: 'Instant',
        cmc: 2,
        colors: ['U'],
        color_identity: ['U'],
        set: 'tst',
        oracle_tags: ['counterspell', 'draw'],
      }),
      ...bulk('Bulk Denial', FLOOR, { color_identity: ['B'], oracle_tags: ['counterspell'] }),
      ...bulk('Bulk Peek', FLOOR + 50, { color_identity: ['B'], oracle_tags: ['draw'] }),
      ...bulk('Bulk Cantrip', FLOOR, { type: 'Instant', cmc: 1, colors: ['U'], color_identity: ['U'] }),
    ]);
    const { clue, clueFilter } = clueFor(
      entry({
        text: 'COUNTERSPELL',
        display: 'Counterspell',
        entryClass: 'cardName',
        sourceCardName: 'Counterspell',
      }),
      fakeRng(0),
      context,
    );
    expect(clueFilter).not.toContain('counterspell');
    expect(clue.toLowerCase()).not.toContain('counterspell');
    expect(handsOverAnswer(clue, 'COUNTERSPELL')).toBe(false);
    // The other tag still describes it, so the clue is a filter clue rather than
    // the bare fallback.
    expect(clueFilter).toBe('ci=u otag:"draw"');
  });

  it('drops a tag whose first word is the answer, hyphen and all', () => {
    // `otag:"reanimate-creature"` is not the string REANIMATE, so nothing that
    // compares whole values catches it — but a solver reads two words and the
    // first one fills the grid.
    const context = publish([
      card({
        name: 'Reanimate',
        type: 'Sorcery',
        cmc: 1,
        colors: ['B'],
        color_identity: ['B'],
        set: 'tst',
        oracle_tags: ['reanimate-creature', 'drawback'],
      }),
      ...bulk('Bulk Raise', FLOOR, { color_identity: ['U'], oracle_tags: ['reanimate-creature'] }),
      ...bulk('Bulk Cost', FLOOR + 50, { color_identity: ['U'], oracle_tags: ['drawback'] }),
      ...bulk('Bulk Curse', FLOOR, { color_identity: ['B'] }),
    ]);
    const { clue, clueFilter } = clueFor(
      entry({ text: 'REANIMATE', display: 'Reanimate', entryClass: 'cardName', sourceCardName: 'Reanimate' }),
      fakeRng(0),
      context,
    );
    expect(clueFilter).not.toContain('reanimate');
    expect(clue.toLowerCase()).not.toContain('reanimate');
    expect(clueFilter).toContain('otag:"drawback"');
  });

  it("drops a tag that spells a legend's title, which the name check cannot see", () => {
    // MIRRORBREAKER is no word of "Kiki, Mirror Breaker" — the name's words are
    // KIKI, MIRROR and BREAKER — so only the entry text catches this one. Left
    // in, the whole filter clue would be thrown away as a leak and the card
    // would fall back to its type line.
    const context = publish([
      card({
        name: 'Kiki, Mirror Breaker',
        type: 'Legendary Creature — Goblin Shaman',
        cmc: 5,
        colors: ['R'],
        color_identity: ['R'],
        set: 'tst',
        oracle_tags: ['mirror-breaker', 'copy'],
      }),
      ...bulk('Bulk Reflection', FLOOR, { color_identity: ['B'], oracle_tags: ['mirror-breaker'] }),
      ...bulk('Bulk Clone', FLOOR + 50, { color_identity: ['B'], oracle_tags: ['copy'] }),
      // Same subtypes as the legend, so neither type term narrows and the tags
      // are what the filter has to finish on.
      ...bulk('Bulk Goblin', FLOOR, {
        type: 'Creature — Goblin Shaman',
        cmc: 2,
        colors: ['R'],
        color_identity: ['R'],
      }),
    ]);
    const kiki = entry({
      text: 'MIRRORBREAKER',
      display: 'Mirror Breaker',
      entryClass: 'legendTitle',
      sourceCardName: 'Kiki, Mirror Breaker',
    });

    // Never, on any draw: the leaking tag is dropped before the shuffle sees it.
    const filters = new Set<string>();
    for (const seed of ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']) {
      const { clue, clueFilter } = clueFor(kiki, seedrandom(seed), context);
      expect(clueFilter).not.toContain('mirror-breaker');
      expect(handsOverAnswer(clue, 'MIRRORBREAKER')).toBe(false);
      expect(clue).not.toMatch(/^\d+-letter /);
      filters.add(clueFilter!);
    }
    // And the other tag is still reachable, on the draws that get to it.
    expect([...filters].some((clueFilter) => clueFilter.includes('otag:"copy"'))).toBe(true);
  });

  it('spends its two tag slots on two different families, and stops at two', () => {
    // A card tagged removal, removal-creature and removal-destroy has said
    // "removal" once, so one of the three is worth a slot and the other slot
    // goes to a different family. A fifth eligible tag is left unsaid.
    //
    // The blue instants are split so that each tag the filter reaches still
    // trims the match set — a term that narrows nothing is dropped whatever it
    // says, which would hide the rule under test.
    const HALF = Math.floor(FLOOR / 2);
    const blue = { type: 'Instant', colors: ['U'], color_identity: ['U'] };
    const context = publish([
      card({
        ...blue,
        name: 'Arcane Inquiry',
        cmc: 3,
        set: 'tst',
        oracle_tags: ['removal-destroy', 'removal-creature', 'removal', 'draw', 'tutor'],
      }),
      // Blue, tagless, so `ci=u` is nowhere near narrow on its own.
      ...bulk('Bulk Cantrip', FLOOR, { ...blue, cmc: 1 }),
      // Blue, and tagged the way the target is bar `draw` — half of them also
      // tutor, so the second tag term is the one that tells them apart. All at
      // mana value 4, so `mv=3` is what finally isolates the target.
      ...bulk('Bulk Trick', HALF, {
        ...blue,
        cmc: 4,
        oracle_tags: ['removal-destroy', 'removal-creature', 'removal', 'tutor'],
      }),
      ...bulk('Bulk Feint', FLOOR - HALF, {
        ...blue,
        cmc: 4,
        oracle_tags: ['removal-destroy', 'removal-creature', 'removal'],
      }),
      // Off-colour bulk, purely to set each tag's catalog count and so the order
      // the card's own tags are ranked in:
      //   removal-destroy   FLOOR + 1   rarest, so it leads
      //   removal-creature  FLOOR + 2   same family, skipped
      //   removal           FLOOR + 3   same family, skipped
      //   tutor             FLOOR + 4   second slot
      //   draw              FLOOR + 6   eligible, and never reached
      ...bulk('Bulk Slay', 1, { color_identity: ['B'], oracle_tags: ['removal-creature'] }),
      ...bulk('Bulk Kill', 2, { color_identity: ['B'], oracle_tags: ['removal'] }),
      ...bulk('Bulk Fetch', FLOOR - HALF + 3, { color_identity: ['B'], oracle_tags: ['tutor'] }),
      ...bulk('Bulk Peek', FLOOR + 5, { color_identity: ['B'], oracle_tags: ['draw'] }),
    ]);
    const { clue, clueFilter } = clueFor(inquiry, fakeRng(0), context);
    const tags = [...clueFilter!.matchAll(/otag:"([^"]+)"/g)].map((match) => match[1]!);
    expect(tags).toEqual(['removal-destroy', 'tutor']);
    expect(tags.filter((slug) => slug.startsWith('removal')).length).toBe(1);
    expect(clue).toBe(
      'color identity is exactly Blue, oracle tag is "removal-destroy", oracle tag is "tutor", mana value is 3',
    );
  });
});

/**
 * The second shape a card-part answer can be clued in: one line of the card's own
 * rules text, its name redacted.
 *
 * The clue material a player actually wants. "color identity is exactly Blue, mana
 * value is 4" describes a spreadsheet row; "Whenever ~ deals combat damage to a
 * player, draw a card." describes a card. Drawn against the filter shape with the
 * puzzle's rng, so both keep happening.
 */
describe('a line of the card own rules text', () => {
  /** rng values: the first decides the shape, so 0 asks for rules text. */
  const RULES_FIRST = 0;
  const FILTER_FIRST = 0.99;

  const publish = (cards: CardDetails[]): ClueContext => {
    mockCardCatalog.printedCardList = cards;
    mockCardCatalog._carddict = {};
    mockCardCatalog.oracleToId = {};
    clearClueContextCache();
    return getClueContext();
  };

  const cardNameEntry = (name: string): CrosswordVocabEntry =>
    entry({ text: normalize(name), display: name, entryClass: 'cardName', sourceCardName: name });

  it('quotes the line and redacts the name out of it', () => {
    const context = publish([
      card({
        name: 'Shivan Dragon',
        type: 'Creature — Dragon',
        cmc: 6,
        colors: ['R'],
        color_identity: ['R'],
        power: '5',
        toughness: '5',
        set: 'lea',
        keywords: ['Flying'],
        oracle_text: 'Flying\n{R}: Shivan Dragon gets +1/+0 until end of turn.',
      }),
    ]);
    const { clue, clueFilter } = clueFor(cardNameEntry('Shivan Dragon'), fakeRng(RULES_FIRST), context);

    expect(clue).toBe('{R}: ~ gets +1/+0 until end of turn.');
    // Not a filter clue, so no Scryfall syntax goes with it.
    expect(clueFilter).toBeUndefined();
    // "Flying" is the card's other line and is not a clue to anything.
    expect(clue).not.toBe('Flying');
    expect(handsOverAnswer(clue, 'SHIVANDRAGON')).toBe(false);
  });

  it('takes the filter shape instead for a card with nothing quotable', () => {
    // A vanilla bear has no rules text, and "Flying" on its own is a mechanic
    // rather than a card, so both fall through to the filter.
    const context = publish([
      card({ name: 'Grizzly Bears', type: 'Creature — Bear', cmc: 2, color_identity: ['G'], set: 'lea' }),
      card({
        name: 'Wind Drake',
        type: 'Creature — Bird',
        cmc: 3,
        color_identity: ['U'],
        set: 'lea',
        keywords: ['Flying'],
        oracle_text: 'Flying',
      }),
    ]);
    for (const name of ['Grizzly Bears', 'Wind Drake']) {
      const { clue, clueFilter } = clueFor(cardNameEntry(name), fakeRng(RULES_FIRST), context);
      expect(clueFilter).toBeDefined();
      expect(clue).not.toContain('~');
    }
  });

  it('leaves the sentence intact instead of redacting inside other words', () => {
    // The name's structural words are left alone. Redacting "the" out of "Jace,
    // the Mind Sculptor" also took it out of "then" and "their", and the clue came
    // out as "~n ~ir opponents" — a mangled sentence rather than a redacted one.
    const context = publish([
      card({
        name: 'Jace, the Mind Sculptor',
        type: 'Legendary Planeswalker — Jace',
        cmc: 4,
        colors: ['U'],
        color_identity: ['U'],
        set: 'wwk',
        oracle_text: 'Target player draws a card, then their opponents each discard a card.',
      }),
    ]);
    const { clue } = clueFor(cardNameEntry('Jace, the Mind Sculptor'), fakeRng(RULES_FIRST), context);

    expect(clue).toBe('Target player draws a card, then their opponents each discard a card.');
    expect(clue).not.toContain('~');
  });

  it('redacts a possessive form of a name word', () => {
    // Magic's templating writes "Urza's", which is the name as a solver reads it.
    const context = publish([
      card({
        name: 'Urza, Lord Protector',
        type: 'Legendary Creature — Human Artificer',
        cmc: 3,
        colors: ['U'],
        color_identity: ['U'],
        power: '1',
        toughness: '4',
        set: 'bro',
        oracle_text: "Whenever you cast an artifact spell, Urza's controller draws a card.",
      }),
    ]);
    const { clue } = clueFor(cardNameEntry('Urza, Lord Protector'), fakeRng(RULES_FIRST), context);

    expect(clue.toLowerCase()).not.toContain('urza');
    expect(clue).toBe('Whenever you cast an artifact spell, ~ controller draws a card.');
  });

  it('drops the full stop before a suffix, so the suffix reads as a clause', () => {
    // "Unsummon target creature., abbrev." is not a sentence anybody wrote.
    const context = publish([
      card({
        name: 'Urza, Lord Protector',
        type: 'Legendary Creature — Human Artificer',
        cmc: 3,
        colors: ['U'],
        color_identity: ['U'],
        set: 'bro',
        oracle_text: 'Whenever you cast an artifact spell, that spell costs one less to cast.',
      }),
    ]);
    for (const [entryClass, suffix] of [
      ['legendName', ', abbrev.'],
      ['legendTitle', ', title'],
      ['acronym', ', as an acronym'],
    ] as const) {
      const { clue } = clueFor(
        entry({ text: 'URZA', display: 'Urza', entryClass, sourceCardName: 'Urza, Lord Protector' }),
        fakeRng(RULES_FIRST),
        context,
      );
      expect(clue).toBe(`Whenever you cast an artifact spell, that spell costs one less to cast${suffix}`);
      expect(clue).not.toContain('.,');
    }
  });

  it('is one shape of two, drawn with the rng rather than replacing the other', () => {
    const context = publish([
      card({
        name: 'Shivan Dragon',
        type: 'Creature — Dragon',
        cmc: 6,
        colors: ['R'],
        color_identity: ['R'],
        set: 'lea',
        keywords: ['Flying'],
        oracle_text: '{R}: Shivan Dragon gets +1/+0 until end of turn.',
      }),
      // Something for the filter to narrow away from, or no term narrows and the
      // filter shape has nothing to say whatever the rng asks for.
      ...Array.from({ length: 20 }, (_, index) =>
        card({ name: `Bulk Goblin ${index}`, type: 'Creature — Goblin', cmc: 1, color_identity: ['R'], set: 'lea' }),
      ),
    ]);
    const dragon = cardNameEntry('Shivan Dragon');
    expect(clueFor(dragon, fakeRng(RULES_FIRST), context).clueFilter).toBeUndefined();
    expect(clueFor(dragon, fakeRng(FILTER_FIRST), context).clueFilter).toBeDefined();

    // And over real seeds both shapes turn up.
    const shapes = new Set(
      ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].map((seed) =>
        clueFor(dragon, seedrandom(seed), context).clueFilter === undefined ? 'rules' : 'filter',
      ),
    );
    expect(shapes).toEqual(new Set(['rules', 'filter']));
  });

  it('falls through to the filter when the quoted line would leak the answer', () => {
    // A card that spells its own name out in words the redaction cannot see.
    const context = publish([
      card({
        name: 'Loyal Retainers',
        type: 'Creature — Human',
        cmc: 2,
        colors: ['W'],
        color_identity: ['W'],
        set: 'chr',
        oracle_text: 'A loyal retainer serves loyally: choose one loyal retainers reference here.',
      }),
    ]);
    const { clue } = clueFor(cardNameEntry('Loyal Retainers'), fakeRng(RULES_FIRST), context);
    expect(handsOverAnswer(clue, 'LOYALRETAINERS')).toBe(false);
  });
});

/**
 * The three classes whose answer is part of a card name, and which used to print
 * that name: "Jace, the Mind Sculptor, abbrev." for JACE, "Richard Garfield,
 * Ph.D., title" for PHD, '"Thrun, the Last Troll", as an acronym' for TTLT. All
 * three now describe a filter that narrows to the card instead.
 */
describe('clues for part of a card never contain the card', () => {
  const PART_CLASSES: CrosswordEntryClass[] = ['legendName', 'legendTitle', 'acronym'];

  it('translates a real filter, with the raw syntax alongside', () => {
    expect(clueFor(ENTRIES.legendName, fakeRng(0), ctx)).toEqual({
      clue: 'color identity is exactly Blue, type line includes Planeswalker, abbrev.',
      clueFilter: 'ci=u t:planeswalker',
    });
    expect(clueFor(ENTRIES.legendTitle, fakeRng(0), ctx)).toEqual({
      clue: 'color identity is exactly Blue, type line includes Planeswalker, title',
      clueFilter: 'ci=u t:planeswalker',
    });
  });

  for (const entryClass of PART_CLASSES) {
    it(`${entryClass}: the filter parses, matches the card, and the clue gives nothing away`, () => {
      const vocabEntry = ENTRIES[entryClass];
      const { clue, clueFilter } = clueFor(vocabEntry, fakeRng(0), ctx);
      expect(clueFilter).toBeDefined();

      const { err, filter } = makeFilter(clueFilter!);
      expect(err).toBeFalsy();
      expect(filter).toBeTruthy();
      const matches = ctx.cards.filter((details) => filter!({ details } as Card));
      expect(matches.map((details) => details.name)).toContain(vocabEntry.sourceCardName);

      // Not the answer, spelled or as the initials of consecutive words.
      expect(handsOverAnswer(clue, vocabEntry.text)).toBe(false);
      // Nor the card the answer came out of.
      expect(clue).not.toContain(vocabEntry.sourceCardName!);
      expect(handsOverAnswer(clue, normalize(vocabEntry.sourceCardName!))).toBe(false);
      for (const word of vocabEntry.sourceCardName!.split(/[\s,]+/).filter(Boolean)) {
        expect(clue).not.toContain(word);
      }
    });
  }

  it('finds the card behind an accented name, instead of giving up on it', () => {
    // The vocabulary stores the name as printed while the catalog keys it folded,
    // so a plain lowercase lookup missed every accented card — and Gríma, Sméagol,
    // Altaïr, Éowyn and the Palantír all came out with a generic clue.
    const { clue, clueFilter } = clueFor(
      entry({
        text: 'SARUMANSFOOTMAN',
        display: "Saruman's Footman",
        entryClass: 'legendTitle',
        sourceCardName: "Gríma, Saruman's Footman",
      }),
      fakeRng(0),
      ctx,
    );
    expect(clueFilter).toBeDefined();
    expect(clue).not.toMatch(/^\d+-letter /);
    expect(clue.endsWith(', title')).toBe(true);
  });

  it('refuses the filter clue rather than leak, when the description spells the answer', () => {
    // A legend whose title is its colour identity: "color identity is exactly
    // Green, title" answers itself. The filter is dropped — count and all — and
    // the type line clues the card instead.
    mockCardCatalog.printedCardList = [
      card({
        name: 'Something, Green',
        type: 'Legendary Creature — Avatar',
        cmc: 5,
        colors: ['G'],
        color_identity: ['G'],
        rarity: 'rare',
        set: 'tst',
      }),
      card({ name: 'Not Green', type: 'Instant', cmc: 1, colors: ['R'], color_identity: ['R'], set: 'tst' }),
    ];
    clearClueContextCache();
    const leaky = entry({
      text: 'GREEN',
      display: 'Green',
      entryClass: 'legendTitle',
      sourceCardName: 'Something, Green',
    });
    const { clue, clueFilter } = clueFor(leaky, fakeRng(0), getClueContext());
    expect(clue).toBe('Legendary Creature — Avatar, mana value 5, title');
    expect(clueFilter).toBeUndefined();
    expect(handsOverAnswer(clue, 'GREEN')).toBe(false);
  });
});

describe('oracleWord clues are a synonym, or the word blanked out of rules text', () => {
  const SYNONYM_WORDS = Object.keys(CROSSWORD_SYNONYMS);

  /** A rules word the bake found nothing for, so it must take the blank path. */
  const wordWithoutSynonym = (): string => {
    for (const details of ctx.cards) {
      for (const word of wordsOnCard(details.oracle_text)) {
        if (word.length >= 3 && !CROSSWORD_SYNONYMS[word]) {
          return word;
        }
      }
    }
    throw new Error('fixture catalog has no rules word outside the synonym map');
  };

  it('never states a word position, the form that was removed', () => {
    const words = [...SYNONYM_WORDS.slice(0, 40), wordWithoutSynonym(), ENTRIES.oracleWord.text];
    for (const text of words) {
      const { clue } = clueFor(entry({ text, display: text, entryClass: 'oracleWord' }), fakeRng(0), ctx);
      expect(clue).not.toMatch(/\d+(st|nd|rd|th) word on/);
    }
  });

  it('clues a word the thesaurus knows with its baked synonyms', () => {
    const text = SYNONYM_WORDS[0]!;
    const { clue } = clueFor(entry({ text, display: text, entryClass: 'oracleWord' }), fakeRng(0), ctx);
    expect(CROSSWORD_SYNONYMS[text]!.some((synonym) => clue.toLowerCase().includes(synonym))).toBe(true);
  });

  it('blanks the word out of real rules text when no synonym exists', () => {
    const text = wordWithoutSynonym();
    const { clue } = clueFor(entry({ text, display: text, entryClass: 'oracleWord' }), fakeRng(0), ctx);
    expect(clue).toContain('____');
    expect(clue.toUpperCase()).not.toContain(text);
  });

  it('never leaves a bare blank with nothing around it', () => {
    // Blanking has to leave context behind, the same rule the name clues follow:
    // a sentence that is only the answer collapses to "____", which is not a clue.
    for (const details of ctx.cards) {
      for (const text of new Set(wordsOnCard(details.oracle_text))) {
        if (text.length < 3 || CROSSWORD_SYNONYMS[text]) {
          continue;
        }
        const { clue } = clueFor(entry({ text, display: text, entryClass: 'oracleWord' }), fakeRng(0), ctx);
        if (clue.includes('____')) {
          expect(
            clue
              .split('____')
              .join(' ')
              .replace(/[^A-Za-z]+/g, '').length,
          ).toBeGreaterThanOrEqual(3);
        }
      }
    }
  });
});

/**
 * Which card a clue is about, for the shapes that pick one out of a pool.
 *
 * The answer key reads `clueSource` in place of `entry.display`, so a clue that
 * cites a card has to say which — REITO clued as "____ Lantern" came back in the
 * key as "Reito Sentinel", a card the clue never mentioned.
 */
describe('a clue reports the card it cited', () => {
  it('blanks a rules word out of the card it names as the source', () => {
    // A word the thesaurus bake found nothing for, so the clue is the blank and
    // the blank came off one particular card.
    const text = ctx.cards
      .flatMap((details) => oracleWords(details.oracle_text))
      .find((word) => word.length >= 3 && !CROSSWORD_SYNONYMS[word])!;
    const { clue, clueSource } = clueFor(
      entry({ text, display: text, entryClass: 'oracleWord', frequency: 1 }),
      fakeRng(0),
      ctx,
    );
    expect(clue).toContain('____');
    expect(clueSource).toBeDefined();
    // The clue really is that card's own text with the word blanked out of it.
    const cited = ctx.cards.find((details) => details.name === clueSource)!;
    expect(blankWordInRulesText(cited.oracle_text, cited.name, text)).toBe(clue);
  });

  it('quotes the card it names as the source', () => {
    mockCardCatalog.printedCardList = [
      card({
        name: 'Shivan Dragon',
        type: 'Creature — Dragon',
        cmc: 6,
        color_identity: ['R'],
        set: 'lea',
        oracle_text: '{R}: Shivan Dragon gets +1/+0 until end of turn.',
      }),
    ];
    clearClueContextCache();
    const { clue, clueSource } = clueFor(
      entry({
        text: 'SHIVANDRAGON',
        display: 'Shivan Dragon',
        entryClass: 'cardName',
        sourceCardName: 'Shivan Dragon',
      }),
      fakeRng(0),
      getClueContext(),
    );
    expect(clueSource).toBe('Shivan Dragon');
    expect(clue).toContain('~');
  });

  it('says nothing about a source when it cited no particular card', () => {
    // A creature type, a keyword and a set code are clued *with* a card and
    // answered by themselves, so the key's own display name is the right thing.
    for (const entryClass of ['creatureType', 'keyword', 'setCode'] as const) {
      expect(clueFor(ENTRIES[entryClass], fakeRng(0), ctx).clueSource).toBeUndefined();
    }
    // And neither does the clue of last resort, which cites nothing at all.
    expect(
      clueFor(entry({ text: 'ZOMBIE', display: 'Zombie', entryClass: 'creatureType' }), fakeRng(0), ctx).clueSource,
    ).toBeUndefined();
  });

  it('names a card that really is one of the entry sources, for every citing class', () => {
    const sources = ['Grizzly Bears', 'Ancient Bears', 'Sleeping Bears', 'Dancing Bears'];
    const seen = new Set<string>();
    for (const seed of ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']) {
      const { clue, clueSource } = clueFor(
        entry({
          text: 'BEARS',
          display: 'Grizzly Bears',
          entryClass: 'nameWord',
          sourceCardName: 'Grizzly Bears',
          sourceCardNames: sources,
        }),
        seedrandom(seed),
        ctx,
      );
      expect(sources).toContain(clueSource);
      // The cited card is the one the clue blanked, whichever it was.
      expect(clue).toBe(clueSource!.replace('Bears', '____'));
      seen.add(clueSource!);
    }
    // The pool is the point: more than one card gets cited across seeds.
    expect(seen.size).toBeGreaterThan(1);
  });
});

describe('determinism', () => {
  const cluesForSeed = (seed: string): string[] => {
    const rng = seedrandom(`${seed}:clues`);
    // Several classes and several entries with deep pools, generated in one pass
    // off one rng — the way a puzzle does it.
    const entries: CrosswordVocabEntry[] = [
      ENTRIES.creatureType,
      entry({ text: 'BEAR', display: 'Bear', entryClass: 'creatureType' }),
      ENTRIES.keyword,
      ENTRIES.oracleWord,
      ENTRIES.setCode,
      entry({
        text: 'BEARS',
        display: 'Grizzly Bears',
        entryClass: 'nameWord',
        sourceCardName: 'Grizzly Bears',
        sourceCardNames: ['Grizzly Bears', 'Ancient Bears', 'Sleeping Bears', 'Dancing Bears'],
      }),
      ENTRIES.cardName,
      ENTRIES.nameBigram,
      ENTRIES.acronym,
    ];
    return entries.map((vocabEntry) => JSON.stringify(clueFor(vocabEntry, rng, ctx)));
  };

  it('reproduces every clue for the same seed', () => {
    expect(cluesForSeed('seed-a')).toEqual(cluesForSeed('seed-a'));
    expect(cluesForSeed('seed-a')).toEqual(cluesForSeed('seed-a'));
  });

  it('varies at least one clue across seeds', () => {
    const baseline = cluesForSeed('seed-a').join('|');
    const others = ['seed-b', 'seed-c', 'seed-d', 'seed-e'].map((seed) => cluesForSeed(seed).join('|'));
    expect(others.some((other) => other !== baseline)).toBe(true);
  });

  it('is unaffected by Math.random', () => {
    const spy = jest.spyOn(Math, 'random');
    cluesForSeed('seed-a');
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});
