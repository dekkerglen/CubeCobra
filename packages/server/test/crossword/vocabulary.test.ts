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

import { CardDetails } from '@utils/datatypes/Card';
import SetInfo from '@utils/datatypes/SetInfo';
import cardCatalog from 'serverutils/cardCatalog';
import {
  clearVocabularyCache,
  getVocabulary,
  isCluableName,
  leavesCluableRemainder,
  nameTokens,
  normalize,
  oracleWords,
} from 'serverutils/crossword/vocabulary';

import { createCardDetails } from '../test-utils/data';

const mockCardCatalog = cardCatalog as unknown as Catalog;

// A real game piece: nothing here trips isExtraCard.
const playable: Partial<CardDetails> = {
  isExtra: false,
  isToken: false,
  digital: false,
  layout: 'normal',
  language: 'en',
  set_type: 'expansion',
  keywords: [],
  oracle_text: '',
};

const card = (name: string, overrides: Partial<CardDetails> = {}): CardDetails =>
  createCardDetails({
    ...playable,
    name,
    name_lower: name.toLowerCase(),
    set: 'tst',
    type: 'Creature — Human',
    ...overrides,
  });

const setInfo = (overrides: Partial<SetInfo> = {}): SetInfo => ({
  code: 'xxx',
  name: 'Some Set',
  setType: 'expansion',
  releasedAt: '2020-01-01',
  cardCount: 300,
  digital: false,
  icon: '',
  ...overrides,
});

/**
 * Card names sharing words. Every one of them is cluable — two words or more —
 * so each contributes both of its words to the pool.
 */
const namesWithSharedWords = [
  'Grizzly Bears',
  'Grizzly Ruins',
  'Grizzly Tundra',
  'Ancient Bears',
  'Sleeping Bears',
  'Timber Wolf',
  'Silver Wolf',
];

describe('crossword vocabulary: nameWord entries', () => {
  beforeEach(() => {
    mockCardCatalog.setdict = {};
    mockCardCatalog.printedCardList = namesWithSharedWords.map((name) => card(name));
    clearVocabularyCache();
  });

  afterEach(() => {
    clearVocabularyCache();
  });

  const nameWords = () => getVocabulary().entries.filter((entry) => entry.entryClass === 'nameWord');

  it('keeps a word seen in even one cluable card name', () => {
    const texts = nameWords().map((entry) => entry.text);
    expect(texts).toContain('GRIZZLY');
    expect(texts).toContain('BEARS');
    // Two cards.
    expect(texts).toContain('WOLF');
    // One card is enough now the clue blanks the word out of the name.
    expect(texts).toContain('TUNDRA');
  });

  it('calls a name cluable only when blanking a word leaves something behind', () => {
    // Blanking the only word of a one-word name leaves "____", which is no clue.
    expect(isCluableName('Duress')).toBe(false);
    expect(isCluableName('Never-Ending')).toBe(false);
    expect(isCluableName('Grizzly Bears')).toBe(true);
    // Split cards divide on the slash, so both halves are words of the name.
    expect(isCluableName('Fire // Ice')).toBe(true);
    expect(isCluableName('Never-Ending Torment')).toBe(true);
  });

  it('never sources a name word from a one-word name', () => {
    mockCardCatalog.printedCardList = [card('Duress'), card('Sleeping Bears'), card('Grizzly Bears')];
    clearVocabularyCache();
    const texts = nameWords().map((entry) => entry.text);

    // DURESS is in the vocabulary — as the card name it is — but never as a name
    // word, because there is no name left over to blank it out of. (The letters of
    // a one-word name are always its cardName entry too, and cardName outranks
    // nameWord, so the class flips rather than the word disappearing.)
    expect(texts).not.toContain('DURESS');
    expect(getVocabulary().entries.find((entry) => entry.text === 'DURESS')?.entryClass).toBe('cardName');
    expect(nameWords().find((entry) => entry.text === 'BEARS')?.sourceCardNames).toEqual([
      'Sleeping Bears',
      'Grizzly Bears',
    ]);
  });

  it('reports frequency as the number of cluable cards the word appears on', () => {
    for (const entry of nameWords()) {
      expect(entry.frequency).toBeGreaterThanOrEqual(1);
    }
    expect(nameWords().find((entry) => entry.text === 'GRIZZLY')?.frequency).toBe(3);
    expect(nameWords().find((entry) => entry.text === 'BEARS')?.frequency).toBe(3);
    // One sighting is enough: the clue blanks the word out of the name, so the
    // word doesn't have to be recognisable on its own.
    expect(nameWords().find((entry) => entry.text === 'TUNDRA')?.frequency).toBe(1);
  });

  it('counts a card once however many printings it has', () => {
    // Same three names, but every one printed five times over.
    mockCardCatalog.printedCardList = namesWithSharedWords.flatMap((name) =>
      Array.from({ length: 5 }, () => card(name)),
    );
    clearVocabularyCache();
    expect(nameWords().find((entry) => entry.text === 'GRIZZLY')?.frequency).toBe(3);
  });

  it('is at least MIN_LENGTH letters and letters only', () => {
    for (const entry of nameWords()) {
      expect(entry.text.length).toBeGreaterThanOrEqual(3);
      expect(entry.text).toMatch(/^[A-Z]+$/);
    }
  });

  it('carries source card names that really contain the word', () => {
    const entries = nameWords();
    expect(entries.length).toBeGreaterThan(0);
    for (const entry of entries) {
      // Every source gets blanked to make a clue, so the word has to be in all
      // of them — and each has to have a second word left over to clue with.
      expect(entry.sourceCardNames?.length).toBeGreaterThan(0);
      for (const source of entry.sourceCardNames!) {
        expect(normalize(source)).toContain(entry.text);
        expect(nameTokens(source).length).toBeGreaterThanOrEqual(2);
      }
      // The single-source fields stay in step for anything reading them.
      expect(entry.sourceCardName).toBe(entry.display);
      expect(entry.sourceCardNames![0]).toBe(entry.sourceCardName);
      expect(entry.sourceOracleId).toBeTruthy();
    }
  });

  it('stores several sources so successive puzzles can vary the clue, capped at six', () => {
    // Nine cards share a word, each in its own set so the spread rule is idle.
    mockCardCatalog.printedCardList = Array.from({ length: 9 }, (_, index) =>
      card(`Goblin Number${index}`, { set: `s${index}` }),
    );
    clearVocabularyCache();
    const goblin = nameWords().find((entry) => entry.text === 'GOBLIN');
    expect(goblin?.frequency).toBe(9);
    expect(goblin?.sourceCardNames).toEqual([
      'Goblin Number0',
      'Goblin Number1',
      'Goblin Number2',
      'Goblin Number3',
      'Goblin Number4',
      'Goblin Number5',
    ]);
  });

  it('spreads sources across sets so a pool is not six of one cycle', () => {
    mockCardCatalog.printedCardList = [
      // A five-card cycle in one set, then two cards from elsewhere.
      card('Azorius Guildmage', { set: 'rav' }),
      card('Boros Guildmage', { set: 'rav' }),
      card('Dimir Guildmage', { set: 'rav' }),
      card('Golgari Guildmage', { set: 'rav' }),
      card('Selesnya Guildmage', { set: 'rav' }),
      card('Shadowmoor Guildmage', { set: 'shm' }),
      card('Alara Guildmage', { set: 'ala' }),
    ];
    clearVocabularyCache();
    const sources = nameWords().find((entry) => entry.text === 'GUILDMAGE')?.sourceCardNames ?? [];
    // Two from the cycle's set, then the other sets, then the cycle's leftovers
    // top the pool back up — the cap costs the word nothing.
    expect(sources.slice(0, 4)).toEqual([
      'Azorius Guildmage',
      'Boros Guildmage',
      'Shadowmoor Guildmage',
      'Alara Guildmage',
    ]);
    expect(sources).toHaveLength(6);
  });

  it('splits split-card names on the slash', () => {
    mockCardCatalog.printedCardList = [
      card('Wear // Tear'),
      card('Wear // Rend'),
      card('Wear // Sunder'),
      card('Soaked Tear'),
      card('Bitter Tear'),
    ];
    clearVocabularyCache();
    const texts = nameWords().map((entry) => entry.text);
    expect(texts).toContain('WEAR');
    expect(texts).toContain('TEAR');
    // Never the two halves glued together.
    expect(texts).not.toContain('WEARTEAR');
  });

  it('drops English structural filler', () => {
    mockCardCatalog.printedCardList = [
      card('The Power And Glory'),
      card('The Wind And Rain'),
      card('The Deep And Dark'),
      card('Notion With Form'),
      card('Notion With Shape'),
      card('Notion With Edge'),
    ];
    clearVocabularyCache();
    const texts = nameWords().map((entry) => entry.text);
    expect(texts).toContain('NOTION');
    expect(texts).not.toContain('THE');
    expect(texts).not.toContain('AND');
    expect(texts).not.toContain('WITH');
  });

  it('yields the richer class when a word is also a creature type or keyword', () => {
    mockCardCatalog.printedCardList = [
      // ELF is both a creature subtype and a word in three card names.
      card('Elf Ruins', { type: 'Creature — Elf' }),
      card('Elf Tundra', { type: 'Creature — Elf' }),
      card('Elf Shrine', { type: 'Creature — Elf' }),
      card('Flying Ruins', { keywords: ['Flying'] }),
      card('Flying Tundra', { keywords: ['Flying'] }),
      card('Flying Shrine', { keywords: ['Flying'] }),
      card('Dark Ruins'),
    ];
    clearVocabularyCache();
    const byText = new Map(getVocabulary().entries.map((entry) => [entry.text, entry]));
    expect(byText.get('ELF')?.entryClass).toBe('creatureType');
    expect(byText.get('FLYING')?.entryClass).toBe('keyword');
    // RUINS has no richer home, so it stays a name word.
    expect(byText.get('RUINS')?.entryClass).toBe('nameWord');
  });
});

describe('crossword vocabulary: nameBigram entries', () => {
  const bigrams = () => getVocabulary().entries.filter((entry) => entry.entryClass === 'nameBigram');
  const bigramTexts = () => bigrams().map((entry) => entry.text);

  beforeEach(() => {
    mockCardCatalog.setdict = {};
    clearVocabularyCache();
  });

  afterEach(() => {
    clearVocabularyCache();
  });

  it('takes adjacent words in order, including the structural ones', () => {
    mockCardCatalog.printedCardList = [card('Jace, the Mind Sculptor'), card('Hour of Devastation')];
    clearVocabularyCache();
    const texts = bigramTexts();

    expect(texts).toContain('JACETHE');
    expect(texts).toContain('THEMIND');
    expect(texts).toContain('MINDSCULPTOR');
    expect(texts).toContain('HOUROF');
    expect(texts).toContain('OFDEVASTATION');
    // Non-adjacent, and reversed, are not pairs of the name.
    expect(texts).not.toContain('JACEMIND');
    expect(texts).not.toContain('JACESCULPTOR');
    expect(texts).not.toContain('SCULPTORMIND');
  });

  it('needs three words, so blanking two still leaves a clue', () => {
    mockCardCatalog.printedCardList = [card('Lightning Bolt'), card('Grizzly Bears'), card('Ancient Tomb Raider')];
    clearVocabularyCache();

    // Two-word names contribute nothing: "____ ____" is not a clue.
    expect(bigramTexts()).not.toContain('LIGHTNINGBOLT');
    expect(bigramTexts()).not.toContain('GRIZZLYBEARS');
    expect(bigramTexts()).toEqual(expect.arrayContaining(['ANCIENTTOMB', 'TOMBRAIDER']));
  });

  it('never pairs across the // of a split card', () => {
    mockCardCatalog.printedCardList = [
      card('Wear // Tear Apart'),
      card('Ondu Inversion // Ondu Skyruins'),
      card('Fire // Ice'),
    ];
    clearVocabularyCache();
    const texts = bigramTexts();

    // Inside one half, yes; across the slash, never.
    expect(texts).toContain('TEARAPART');
    expect(texts).not.toContain('WEARTEAR');
    expect(texts).not.toContain('INVERSIONONDU');
    expect(texts).not.toContain('FIREICE');
  });

  it('counts a pair once per card and keeps up to six sources, deterministically', () => {
    mockCardCatalog.printedCardList = [
      // Nine cards share the pair, each in its own set so the spread rule is idle.
      ...Array.from({ length: 9 }, (_, index) => card(`Ancient Tomb Raider${index}`, { set: `s${index}` })),
      // And one of them printed five times over.
      ...Array.from({ length: 5 }, () => card('Ancient Tomb Raider0', { set: 's0' })),
    ];
    clearVocabularyCache();
    const pair = bigrams().find((entry) => entry.text === 'ANCIENTTOMB');

    expect(pair?.frequency).toBe(9);
    expect(pair?.sourceCardNames).toEqual([
      'Ancient Tomb Raider0',
      'Ancient Tomb Raider1',
      'Ancient Tomb Raider2',
      'Ancient Tomb Raider3',
      'Ancient Tomb Raider4',
      'Ancient Tomb Raider5',
    ]);
    // Same catalog, same build: no Math.random anywhere in the pass.
    clearVocabularyCache();
    expect(bigrams().find((entry) => entry.text === 'ANCIENTTOMB')?.sourceCardNames).toEqual(pair?.sourceCardNames);
  });

  it('yields to the card name when a pair spells one', () => {
    mockCardCatalog.printedCardList = [card('Ancient Tomb Raider'), card('Ancient Tomb')];
    clearVocabularyCache();
    const byText = new Map(getVocabulary().entries.map((entry) => [entry.text, entry]));
    expect(byText.get('ANCIENTTOMB')?.entryClass).toBe('cardName');
    expect(byText.get('TOMBRAIDER')?.entryClass).toBe('nameBigram');
  });
});

/**
 * The invariant both name-derived classes live by, as one property over whatever
 * the catalog produced: an entry that eats N words of a name only ever cites names
 * with more than N words. `leavesCluableRemainder` is the single place that decides
 * it, and this is the test that it is applied at both widths.
 */
describe('crossword vocabulary: every source has a word left over', () => {
  const CONSUMED: Record<string, number> = { nameWord: 1, nameBigram: 2 };

  beforeEach(() => {
    mockCardCatalog.setdict = {};
    mockCardCatalog.printedCardList = [
      ...namesWithSharedWords.map((name) => card(name)),
      card('Jace, the Mind Sculptor'),
      card('Hour of Devastation'),
      card('Ancient Tomb Raider'),
      card('Wear // Tear Apart'),
      card('Never-Ending Torment of the Damned'),
      card('Duress'),
      card('Lightning Bolt'),
    ];
    clearVocabularyCache();
  });

  afterEach(() => {
    clearVocabularyCache();
  });

  it('holds for every stored source of every entry, at both widths', () => {
    const entries = getVocabulary().entries.filter((entry) => CONSUMED[entry.entryClass] !== undefined);
    expect(entries.length).toBeGreaterThan(20);

    for (const entry of entries) {
      const consumed = CONSUMED[entry.entryClass]!;
      expect(entry.sourceCardNames?.length).toBeGreaterThanOrEqual(1);
      for (const source of entry.sourceCardNames!) {
        expect(nameTokens(source).length).toBeGreaterThan(consumed);
        expect(leavesCluableRemainder(source, consumed)).toBe(true);
      }
    }
  });

  it('is the same predicate at both widths', () => {
    expect(isCluableName('Grizzly Bears')).toBe(true);
    expect(leavesCluableRemainder('Grizzly Bears', 1)).toBe(true);
    expect(leavesCluableRemainder('Grizzly Bears', 2)).toBe(false);
    expect(leavesCluableRemainder('Ancient Tomb Raider', 2)).toBe(true);
    expect(leavesCluableRemainder('Duress', 1)).toBe(false);
  });
});

describe('crossword vocabulary: oracleWord tokenizing', () => {
  /** Enough cards to clear MIN_ORACLE_WORD_CARDS, all with the same rules text. */
  const withText = (text: string, count = 10): CardDetails[] =>
    Array.from({ length: count }, (_, index) => card(`Rules Card ${index}`, { oracle_text: text }));

  beforeEach(() => {
    mockCardCatalog.setdict = {};
    clearVocabularyCache();
  });

  afterEach(() => {
    clearVocabularyCache();
  });

  it('folds contractions and hyphens into the word a reader would count', () => {
    mockCardCatalog.printedCardList = withText(
      "Creatures you control aren't non-Human. This double-sided permanent doesn't untap.",
    );
    clearVocabularyCache();
    const texts = getVocabulary()
      .entries.filter((entry) => entry.entryClass === 'oracleWord')
      .map((entry) => entry.text);

    expect(texts).toContain('ARENT');
    expect(texts).toContain('NONHUMAN');
    expect(texts).toContain('DOUBLESIDED');
    expect(texts).toContain('DOESNT');
    // The fragments the old tokenizer minted, which no clue could place.
    for (const junk of ['AREN', 'NON', 'HUMAN', 'SIDED', 'DOESN', 'DOUBLE']) {
      expect(texts).not.toContain(junk);
    }
  });

  it('never mints a contraction fragment from any card in the catalog', () => {
    mockCardCatalog.printedCardList = [
      ...withText("It isn't, they weren't, she hasn't, we don't, you can't, that wasn't, these aren't."),
      ...withText('A non-Human, double-sided, self-slinging, ever-living permanent.'),
    ];
    clearVocabularyCache();
    const texts = getVocabulary()
      .entries.filter((entry) => entry.entryClass === 'oracleWord')
      .map((entry) => entry.text);

    // Every entry is a whole token of some card, which is what makes a stated
    // word position true.
    const tokens = new Set(
      mockCardCatalog.printedCardList.flatMap((details) => oracleWords(details.oracle_text ?? '')),
    );
    for (const text of texts) {
      expect(tokens.has(text)).toBe(true);
    }
    for (const junk of ['ISN', 'WEREN', 'HASN', 'DON', 'CAN', 'WASN', 'AREN', 'SLINGING', 'LIVING']) {
      expect(texts).not.toContain(junk);
    }
  });
});

describe('crossword vocabulary: setCode entries', () => {
  beforeEach(() => {
    mockCardCatalog.printedCardList = [];
    clearVocabularyCache();
  });

  afterEach(() => {
    clearVocabularyCache();
  });

  const setCodes = () => getVocabulary().entries.filter((entry) => entry.entryClass === 'setCode');

  it('keeps expansion, core and masters sets above the card-count floor', () => {
    mockCardCatalog.setdict = {
      dom: setInfo({ code: 'dom', name: 'Dominaria', setType: 'expansion', cardCount: 269 }),
      isd: setInfo({ code: 'isd', name: 'Innistrad', setType: 'core', cardCount: 264 }),
      uma: setInfo({ code: 'uma', name: 'Ultimate Masters', setType: 'masters', cardCount: 254 }),
    };
    clearVocabularyCache();
    expect(
      setCodes()
        .map((entry) => entry.text)
        .sort(),
    ).toEqual(['DOM', 'ISD', 'UMA']);
  });

  it('drops codes containing digits, which a letters-only grid cannot hold', () => {
    mockCardCatalog.setdict = {
      // normalize() keeps A-Z only, so these shrink below the minimum length.
      m19: setInfo({ code: 'm19', name: 'Core Set 2019', setType: 'core', cardCount: 314 }),
      '40k': setInfo({ code: '40k', name: 'Warhammer 40,000', setType: 'masters', cardCount: 168 }),
      '3ed': setInfo({ code: '3ed', name: 'Revised Edition', setType: 'core', cardCount: 306 }),
      dom: setInfo({ code: 'dom', name: 'Dominaria', setType: 'expansion', cardCount: 269 }),
    };
    clearVocabularyCache();
    expect(setCodes().map((entry) => entry.text)).toEqual(['DOM']);
  });

  it('excludes Duel Decks, oversized and other unrecognisable products', () => {
    mockCardCatalog.setdict = {
      // The codes the owner called out as grid noise.
      ddh: setInfo({ code: 'ddh', name: 'Duel Decks: Ajani vs. Nicol Bolas', setType: 'duel_deck', cardCount: 80 }),
      gvl: setInfo({ code: 'gvl', name: 'Duel Decks: Garruk vs. Liliana', setType: 'duel_deck', cardCount: 63 }),
      ocmd: setInfo({ code: 'ocmd', name: 'Commander 2011 Oversized', setType: 'memorabilia', cardCount: 15 }),
      pgru: setInfo({ code: 'pgru', name: 'Gru Promos', setType: 'promo', cardCount: 20 }),
      // Right type, but too small to be a set anybody drafts.
      tny: setInfo({ code: 'tny', name: 'Tiny Expansion', setType: 'expansion', cardCount: 12 }),
      // Right type and size, but Arena-only.
      ana: setInfo({ code: 'ana', name: 'Arena New Player Experience', setType: 'expansion', digital: true }),
      // One good set so the assertion can't pass by emptiness.
      dom: setInfo({ code: 'dom', name: 'Dominaria', setType: 'expansion', cardCount: 269 }),
    };
    clearVocabularyCache();

    const texts = setCodes().map((entry) => entry.text);
    expect(texts).toEqual(['DOM']);
    for (const junk of ['DDH', 'GVL', 'OCMD', 'PGRU', 'TNY', 'ANA']) {
      expect(texts).not.toContain(junk);
    }
  });

  it('marks a set reprint-only when nothing had its first printing there', () => {
    mockCardCatalog.setdict = {
      dom: setInfo({ code: 'dom', name: 'Dominaria', setType: 'expansion', cardCount: 269 }),
      uma: setInfo({ code: 'uma', name: 'Ultimate Masters', setType: 'masters', cardCount: 254 }),
    };
    mockCardCatalog.printedCardList = [card('Llanowar Elves', { set: 'dom' })];
    clearVocabularyCache();

    const byText = new Map(setCodes().map((entry) => [entry.text, entry]));
    expect(byText.get('DOM')?.reprintOnly).toBe(false);
    expect(byText.get('UMA')?.reprintOnly).toBe(true);
  });

  it('credits the original printing even when the catalog lists a reprint first', () => {
    // The real printedCardList is not ordered oldest-first: Disintegrate turns up
    // under Summer Magic and Artisan of Kozilek under Ultimate Masters. Taking the
    // first printing seen made every recognisable set look as though something had
    // premiered there — all 97 of them, reprint sets included.
    mockCardCatalog.setdict = {
      lea: setInfo({ code: 'lea', name: 'Limited Edition Alpha', setType: 'core', cardCount: 295 }),
      sum: setInfo({ code: 'sum', name: 'Summer Magic', setType: 'core', cardCount: 302 }),
    };
    mockCardCatalog.printedCardList = [
      card('Disintegrate', { set: 'sum', setIndex: 10, released_at: '1994-06-21', reprint: true }),
      card('Disintegrate', { set: 'lea', setIndex: 0, released_at: '1993-08-05', reprint: false }),
    ];
    clearVocabularyCache();

    const byText = new Map(setCodes().map((entry) => [entry.text, entry]));
    expect(byText.get('LEA')?.reprintOnly).toBe(false);
    expect(byText.get('SUM')?.reprintOnly).toBe(true);
  });

  it('falls back to release order when no printing is flagged as the original', () => {
    mockCardCatalog.setdict = {
      lea: setInfo({ code: 'lea', name: 'Limited Edition Alpha', setType: 'core', cardCount: 295 }),
      chr: setInfo({ code: 'chr', name: 'Chronicles', setType: 'core', cardCount: 306 }),
    };
    mockCardCatalog.printedCardList = [
      card('Erhnam Djinn', { set: 'chr', setIndex: 12, released_at: '1995-07-01' }),
      card('Erhnam Djinn', { set: 'lea', setIndex: 0, released_at: '1993-08-05' }),
    ];
    clearVocabularyCache();

    const byText = new Map(setCodes().map((entry) => [entry.text, entry]));
    expect(byText.get('LEA')?.reprintOnly).toBe(false);
    expect(byText.get('CHR')?.reprintOnly).toBe(true);
  });
});
