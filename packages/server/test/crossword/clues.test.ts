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
import { CrosswordVocabEntry } from '@utils/datatypes/Crossword';
import cardCatalog from 'serverutils/cardCatalog';
import { blankNameBigram, blankNameWord, nameWordClue } from 'serverutils/crossword/clues';
import { nameTokens } from 'serverutils/crossword/text';
import { clearVocabularyCache, getVocabulary } from 'serverutils/crossword/vocabulary';

import { createCardDetails } from '../test-utils/data';

const mockCardCatalog = cardCatalog as unknown as Catalog;

const card = (name: string, set = 'tst'): CardDetails =>
  createCardDetails({
    isExtra: false,
    isToken: false,
    digital: false,
    layout: 'normal',
    language: 'en',
    set_type: 'expansion',
    keywords: [],
    oracle_text: '',
    name,
    name_lower: name.toLowerCase(),
    set,
    type: 'Creature — Beast',
  });

const entry = (text: string, sourceCardNames: string[]): CrosswordVocabEntry => ({
  text,
  display: sourceCardNames[0]!,
  entryClass: 'nameWord',
  sourceCardName: sourceCardNames[0],
  sourceCardNames,
});

/** An rng that hands out a fixed sequence, so a pick is a known index. */
const fakeRng = (...values: number[]): (() => number) => {
  let index = 0;
  return () => values[Math.min(index++, values.length - 1)]!;
};

describe('blankNameWord', () => {
  it('blanks the word and leaves every other word exactly as printed', () => {
    expect(blankNameWord('Jace, the Mind Sculptor', 'MIND')).toBe('Jace, the ____ Sculptor');
  });

  it('blanks every occurrence when a word repeats', () => {
    expect(blankNameWord('Ondu Inversion // Ondu Skyruins', 'ONDU')).toBe('____ Inversion // ____ Skyruins');
  });

  it('keeps the slashes of a split card', () => {
    expect(blankNameWord('Wear // Tear', 'TEAR')).toBe('Wear // ____');
    expect(blankNameWord('Fire // Ice', 'FIRE')).toBe('____ // Ice');
  });

  it('treats a hyphenated word as one word, matching the vocabulary pass', () => {
    expect(blankNameWord('Never-Ending Torment', 'NEVERENDING')).toBe('____ Torment');
    // The halves of a hyphenated word are not words of their own, so neither of
    // these is a source the vocabulary could have produced.
    expect(blankNameWord('Never-Ending Torment', 'ENDING')).toBeNull();
    expect(blankNameWord('Never-Ending Torment', 'NEVER')).toBeNull();
  });

  it('matches through apostrophes and accents, which the grid cannot hold', () => {
    expect(blankNameWord("Jace's Phantasm", 'JACES')).toBe('____ Phantasm');
    expect(blankNameWord('Márton Stromgald', 'MARTON')).toBe('____ Stromgald');
    expect(blankNameWord('Ach! Hans, Run!', 'HANS')).toBe('Ach! ____ Run!');
  });

  it('returns null when the word is in no part of the name', () => {
    expect(blankNameWord('Jace, the Mind Sculptor', 'ELF')).toBeNull();
    // A word the name only contains as a substring is not a word of the name.
    expect(blankNameWord('Llanowar Elves', 'ELF')).toBeNull();
    expect(blankNameWord('Llanowar Elves', '')).toBeNull();
  });
});

describe('nameWordClue', () => {
  it('picks a source with the rng it is handed', () => {
    const bears = entry('BEARS', ['Grizzly Bears', 'Ancient Bears', 'Sleeping Bears']);
    expect(nameWordClue(bears, fakeRng(0))).toEqual({ clue: 'Grizzly ____', clueSource: 'Grizzly Bears' });
    expect(nameWordClue(bears, fakeRng(0.9))).toEqual({ clue: 'Sleeping ____', clueSource: 'Sleeping Bears' });
    // Same rng, same clue: a seed reproduces its puzzle's clues.
    expect(nameWordClue(bears, fakeRng(0.5))).toEqual(nameWordClue(bears, fakeRng(0.5)));
  });

  it('reports the card it cited, not the one the entry is displayed as', () => {
    // The bug this field exists for: the clue blanks a card the rng chose, while
    // the answer key used to read `display` and name a different card. REITO clued
    // as "____ Lantern" came back as "Reito Sentinel".
    const reito = entry('REITO', ['Reito Sentinel', 'Reito Lantern']);
    const built = nameWordClue(reito, fakeRng(0.9))!;
    expect(built.clue).toBe('____ Lantern');
    expect(built.clueSource).toBe('Reito Lantern');
    // And the source it names really is the name it blanked.
    expect(blankNameWord(built.clueSource!, 'REITO')).toBe(built.clue);
  });

  it('moves on to the next source when one cannot be blanked', () => {
    const bears = entry('BEARS', ['Sanctuary Bear', 'Grizzly Bears']);
    expect(nameWordClue(bears, fakeRng(0))).toEqual({ clue: 'Grizzly ____', clueSource: 'Grizzly Bears' });
  });

  it('falls back to the single-source field and gives up when nothing blanks', () => {
    expect(
      nameWordClue(
        { text: 'BEARS', display: 'Grizzly Bears', entryClass: 'nameWord', sourceCardName: 'Grizzly Bears' },
        fakeRng(0),
      ),
    ).toEqual({ clue: 'Grizzly ____', clueSource: 'Grizzly Bears' });
    expect(nameWordClue({ text: 'BEARS', display: 'BEARS', entryClass: 'nameWord' }, fakeRng(0))).toBeNull();
    expect(nameWordClue(entry('BEARS', ['Sanctuary Bear']), fakeRng(0))).toBeNull();
  });
});

describe('blankNameBigram', () => {
  it('blanks both words, keeping the separator between them', () => {
    expect(blankNameBigram('Jace, the Mind Sculptor', 'MINDSCULPTOR')).toBe('Jace, the ____ ____');
    // A blanked word takes its own punctuation with it, exactly as blankNameWord
    // does: the comma belongs to "Jace," and is not a separator.
    expect(blankNameBigram('Jace, the Mind Sculptor', 'JACETHE')).toBe('____ ____ Mind Sculptor');
    expect(blankNameBigram('Hour of Devastation', 'HOUROF')).toBe('____ ____ Devastation');
  });

  it('blanks every occurrence when a pair repeats', () => {
    expect(blankNameBigram('Ondu Skyruins Ondu Skyruins Rise', 'ONDUSKYRUINS')).toBe('____ ____ ____ ____ Rise');
  });

  it('never matches a pair spanning the slash of a split card', () => {
    expect(blankNameBigram('Wear // Tear Apart', 'TEARAPART')).toBe('Wear // ____ ____');
    expect(blankNameBigram('Wear // Tear Apart', 'WEARTEAR')).toBeNull();
    expect(blankNameBigram('Fire // Ice', 'FIREICE')).toBeNull();
  });

  it('returns null when the pair is not adjacent, or not there at all', () => {
    expect(blankNameBigram('Jace, the Mind Sculptor', 'JACEMIND')).toBeNull();
    expect(blankNameBigram('Jace, the Mind Sculptor', 'SCULPTORMIND')).toBeNull();
    expect(blankNameBigram('Grizzly Bears', 'ELFWARRIOR')).toBeNull();
    expect(blankNameBigram('Grizzly Bears', '')).toBeNull();
  });
});

/**
 * The guard that matters: the vocabulary pass and the clue helper have to cut a
 * name into the same words. They share `splitNameParts` to make that true by
 * construction, but a future change to either side could drift apart, and the
 * only symptom would be name words whose clues silently refuse to render. So
 * every source of every entry built from an adversarially punctuated catalog is
 * blanked for real.
 */
describe('every stored source can be clued', () => {
  // Invented words, all distinct, so every one is its own entry. Several hundred
  // of them, because the guard is only worth anything at scale.
  const words = ['B', 'C', 'D', 'F', 'G', 'H', 'J', 'K', 'L', 'M', 'N', 'P', 'R', 'S', 'T', 'V', 'W', 'X', 'Y', 'Z']
    .flatMap((consonant) => ['a', 'e', 'i', 'o', 'u'].map((vowel) => `${consonant}${vowel}`))
    .flatMap((stem) => ['rax', 'len', 'mith', 'doth', 'zurn'].map((tail) => `${stem}${tail}`));

  /** Every shape of name the tokenizer has to survive. */
  const shapes: ((a: string, b: string) => string)[] = [
    (a, b) => `${a} ${b}`,
    (a, b) => `${a} // ${b}`,
    (a, b) => `${a}, the ${b}`,
    (a, b) => `${a}'s ${b}`,
    (a, b) => `${a}-${b} Ruins`,
    (a, b) => `${a}! ${b}?`,
    (a, b) => `Már${a} ${b}`,
    (a, b) => `${a} ${b} ${a}`,
    (a, b) => `${a} 40,000 ${b}`,
    (a, b) => `${a}  //  ${b} // ${a}`,
  ];

  beforeEach(() => {
    mockCardCatalog.setdict = {};
    mockCardCatalog.printedCardList = [
      // Two passes over the word list with different partners, so most words
      // appear under more than one shape.
      ...words.map((word, index) => card(shapes[index % shapes.length]!(word, words[(index + 1) % words.length]!))),
      ...words.map((word, index) =>
        card(shapes[(index + 3) % shapes.length]!(word, words[(index + 7) % words.length]!), `s${index % 5}`),
      ),
      // Single-word names, which must never become a source.
      ...words.map((word) => card(word)),
    ];
    clearVocabularyCache();
  });

  afterEach(() => {
    clearVocabularyCache();
  });

  const BLANKERS = {
    nameWord: { blank: blankNameWord, consumed: 1 },
    nameBigram: { blank: blankNameBigram, consumed: 2 },
  };

  for (const [entryClass, { blank, consumed }] of Object.entries(BLANKERS)) {
    it(`blanks every source of every ${entryClass}, on a sample well over 200`, () => {
      const entries = getVocabulary().entries.filter((vocabEntry) => vocabEntry.entryClass === entryClass);
      expect(entries.length).toBeGreaterThanOrEqual(200);

      for (const vocabEntry of entries) {
        expect(vocabEntry.sourceCardNames?.length).toBeGreaterThanOrEqual(1);
        for (const source of vocabEntry.sourceCardNames!) {
          // Cluable: more words than the entry consumes, so blanking leaves
          // something behind.
          expect(nameTokens(source).length).toBeGreaterThan(consumed);
          const clue = blank(source, vocabEntry.text);
          expect(clue).not.toBeNull();
          expect(clue).toContain('____');
          // The blank replaced something: a clue is never the name back again.
          expect(clue).not.toBe(source);
        }
      }
    });
  }
});
