import { isExtraCard } from '@utils/cardutil';
import Card from '@utils/datatypes/Card';
import { CrosswordEntryClass, CrosswordVocabEntry } from '@utils/datatypes/Crossword';
import { makeFilter } from '@utils/filtering/FilterCards';
import catalog from 'serverutils/cardCatalog';
import { clearPrintingIndexCache, originalPrintings, setsWithFirstPrinting } from 'serverutils/cardPrintings';
import { isRecognisableSet } from 'serverutils/setEligibility';

/**
 * The crossword vocabulary, derived from the card catalog. Every entry keeps
 * the class it came from so clue generation can phrase it correctly later
 * (clues themselves are generated per-puzzle, never stored here).
 *
 * Built lazily on first use — it's a full pass over the catalog — and cached
 * for the process lifetime.
 */

// Grid entries are letters only. Accents are folded so "Márton" indexes as MARTON.
export const normalize = (text: string): string =>
  text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z]/g, '');

/** Initials of every word: "Thrun, the Last Troll" -> "TTLT". */
export const acronymOf = (name: string): string =>
  name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .split(/[\s]+/)
    .map((word) => word.replace(/[^A-Za-z]/g, ''))
    .filter((word) => word.length > 0)
    .map((word) => word[0]!.toUpperCase())
    .join('');

// Anything outside this range is unusable in a crossword of sane dimensions.
const MIN_LENGTH = 3;
const MAX_LENGTH = 21;
// A rules word has to appear on at least this many cards to be fair game —
// it guarantees a clue can cite real cards and filters out flavour one-offs.
const MIN_ORACLE_WORD_CARDS = 8;
/**
 * A word from a card name has to appear in this many distinct *cluable* card
 * names (see `isCluableName`).
 *
 * This used to be three, on the reasoning that a word sighted once is a syllable
 * rather than a word: the pool fills up with fragments like QAL, GED and SHU
 * that no solver could produce from "a word in the name of ...". The clue format
 * is what changed that. A fill-in-the-blank clue carries the obscurity itself —
 * "a word in the name of Qal Sisma" is unanswerable, but "____ Sisma" with
 * crossing letters is perfectly fair — so there is nothing left for a
 * recognisability floor to protect, and supply is worth far more than it. Length
 * 3 is the binding constraint on every grid the generator produces, and that
 * scarcity is what forces the black squares.
 *
 * The multi-token requirement is now the only gate on the class.
 */
const MIN_NAME_WORD_CARDS = 1;
/**
 * How many cluable names a *pair* of adjacent name words has to appear in, for the
 * same reason as MIN_NAME_WORD_CARDS: the clue blanks the pair out of a name
 * ("Jace, the ____ ____"), so one sighting is a fair clue.
 */
const MIN_NAME_BIGRAM_CARDS = 1;
/**
 * How many cards a name word remembers. Clues are generated per puzzle and never
 * stored, so a single source means every puzzle blanks the same name; a pool
 * lets them vary. Six is plenty of variety for the cost of five extra strings.
 */
const MAX_NAME_WORD_SOURCES = 6;
/**
 * Sources kept from any one set before the rest are held in reserve. Cycles live
 * inside a set ("Azorius Guildmage", "Boros Guildmage", ...), so this is the
 * cheap way to stop a word's whole pool being one cycle. Reserves top the pool
 * back up to MAX_NAME_WORD_SOURCES, so no word loses sources to the cap.
 */
const MAX_SOURCES_PER_SET = 2;
/**
 * English structural words to drop from the name-word pool. Deliberately a
 * short blocklist rather than a stopword corpus: only words whose clue would be
 * unanswerable because they carry no Magic content at all. Entries below
 * MIN_LENGTH can't survive the length filter anyway and are listed for the
 * record.
 *
 * Bigrams (see `nameBigrams`) deliberately do *not* consult this list: "____
 * ____ Terror" for OFTHE is answerable in a way "a word in the name of ..." for
 * OF never was, because the blank shows the solver both words are wanted.
 */
const NAME_WORD_BLOCKLIST = new Set([
  'A',
  'AN',
  'AND',
  'FOR',
  'FROM',
  'IN',
  'INTO',
  'ITS',
  'OF',
  'ON',
  'THAT',
  'THE',
  'THIS',
  'TO',
  'UPON',
  'WITH',
]);

/**
 * Which class wins when two sources produce the same letters, lowest first.
 *
 * Creature types and keywords are the most crossword-friendly, then rules
 * words, then whole card names and the two halves of a legend's name. The
 * bottom three are the classes that read as filler in a finished grid, so they
 * only ever supply letters nothing better could.
 *
 * `setCode` used to rank alongside `cardName`, which meant a three-letter set
 * code took the slot from a legend's name spelling the same letters. It now
 * sits below `nameWord`, because a single integer scale can only put `nameWord`
 * under `legendTitle` and over `setCode` if `setCode` moves down.
 *
 * `nameBigram` sits directly under `nameWord`: both are fill-in-the-blank clues
 * off a card name, and the single word is the tighter clue of the two. It stays
 * under `cardName` so a bigram that happens to spell a real card name ("Ancient
 * Tomb" is also the pair in "Ancient Tomb Raider") is clued as the card.
 */
const CLASS_PRIORITY: Record<CrosswordEntryClass, number> = {
  creatureType: 0,
  keyword: 1,
  oracleWord: 1,
  cardName: 2,
  legendName: 3,
  legendTitle: 4,
  nameWord: 5,
  nameBigram: 6,
  setCode: 7,
  acronym: 8,
};

const emptyCounts = (): Record<CrosswordEntryClass, number> => ({
  cardName: 0,
  nameWord: 0,
  nameBigram: 0,
  acronym: 0,
  creatureType: 0,
  keyword: 0,
  legendName: 0,
  legendTitle: 0,
  setCode: 0,
  oracleWord: 0,
});

export interface Vocabulary {
  entries: CrosswordVocabEntry[];
  /** Word indices bucketed by length. */
  byLength: Map<number, number[]>;
  /** length -> "pos:letter" -> word indices, for fast pattern matching. */
  byLengthPosLetter: Map<number, Map<string, number[]>>;
  counts: Record<CrosswordEntryClass, number>;
}

let cached: Vocabulary | undefined;

/**
 * Records an entry unless the same letters are already spoken for by a class
 * that ranks at least as high. Because the decision reads CLASS_PRIORITY on both
 * sides, the outcome doesn't depend on the order sources are scanned in: ELF
 * stays a creatureType whether the name-word pass runs before or after it.
 */
const addEntry = (
  seen: Map<string, CrosswordVocabEntry>,
  entry: CrosswordVocabEntry,
  priorities: Map<string, number>,
): void => {
  if (entry.text.length < MIN_LENGTH || entry.text.length > MAX_LENGTH) {
    return;
  }
  const priority = CLASS_PRIORITY[entry.entryClass];
  const existingPriority = priorities.get(entry.text);
  if (existingPriority !== undefined && existingPriority <= priority) {
    return;
  }
  seen.set(entry.text, entry);
  priorities.set(entry.text, priority);
};

/**
 * Subtypes from a type line: "Legendary Creature — Elf Warrior" -> [Elf, Warrior].
 *
 * Exported because clue generation has to find a card for every creature type
 * this mints; it used to hold a copy, and a copy that drifted would leave a type
 * with no card to cite.
 */
export const creatureSubtypes = (typeLine: string): string[] => {
  if (!typeLine.includes('Creature')) {
    return [];
  }
  const parts = typeLine.split('—');
  if (parts.length < 2) {
    return [];
  }
  return parts[1]!.trim().split(/\s+/).filter(Boolean);
};

/**
 * A card name cut into alternating words and separators, so that `parts.join('')`
 * is the name again: "Fire // Ice" -> ["Fire", " // ", "Ice"]. Even indices are
 * words, odd indices the whitespace (and split-card slashes) between them.
 *
 * Exported because clue generation has to blank exactly the words this pass
 * counted — a separate regex over there would silently mis-handle split cards and
 * hyphens, and the mismatch would only show up as clues that never render.
 */
export const splitNameParts = (name: string): string[] => name.split(/([\s/]+)/);

/**
 * The words of a card name, as printed: "Fire // Ice" -> [Fire, Ice],
 * "Never-Ending Torment" -> [Never-Ending, Torment]. Hyphens and apostrophes are
 * inside a word, not between words, so they don't split.
 */
export const nameTokens = (name: string): string[] =>
  splitNameParts(name).filter((part, index) => index % 2 === 0 && part.length > 0);

/**
 * Whether a name still says something once `consumedTokens` of its words are
 * blanked out. Blanking the only word of "Duress" leaves "____", which is not a
 * clue; blanking both words of "Lightning Bolt" leaves "____ ____", which is no
 * better. So an entry that eats one word needs two, and a bigram needs three.
 *
 * One predicate for both classes on purpose: they are the same rule at different
 * widths, and the invariant a test can state ("every source of every entry has
 * more tokens than the entry consumes") is only true by construction if there is
 * one place that decides it.
 */
export const leavesCluableRemainder = (name: string, consumedTokens: number): boolean =>
  nameTokens(name).length > consumedTokens;

/** Whether blanking one word of this name leaves a clue behind. */
export const isCluableName = (name: string): boolean => leavesCluableRemainder(name, 1);

/**
 * The individual words of a card name, normalized: "Fire // Ice" -> [FIRE, ICE],
 * "Llanowar Elves" -> [LLANOWAR, ELVES]. Split cards separate on the slash, so
 * both halves contribute.
 */
const nameWords = (name: string): string[] =>
  nameTokens(name)
    .map((word) => normalize(word))
    .filter((word) => word.length >= MIN_LENGTH && !NAME_WORD_BLOCKLIST.has(word));

/**
 * Adjacent pairs of words from a card name, concatenated: "Jace, the Mind
 * Sculptor" -> [JACETHE, THEMIND, MINDSCULPTOR].
 *
 * Adjacent and in printed order, so the clue is a pair of blanks in the name
 * ("Jace, the ____ ____") rather than a riddle. A pair is never taken across the
 * `//` of a split card: "Fire // Ice" is two names, and "FIREICE" is a string no
 * reader of the card would produce.
 */
const nameBigrams = (name: string): string[] => {
  const parts = splitNameParts(name);
  const pairs: string[] = [];
  for (let index = 0; index + 2 < parts.length; index += 2) {
    const first = parts[index]!;
    const separator = parts[index + 1]!;
    const second = parts[index + 2]!;
    if (!first || !second || separator.includes('/')) {
      continue;
    }
    const text = normalize(`${first}${second}`);
    if (text.length >= MIN_LENGTH) {
      pairs.push(text);
    }
  }
  return pairs;
};

/**
 * The words of a card's rules text, normalized, at their printed positions.
 *
 * Positions have to be the ones a reader counting words off the card would get,
 * so the rules here are chosen for that and nothing else:
 *
 * - `{T}`, `{2}{G}` and loyalty symbols go first. A solver counting the words of
 *   "{T}: Add {G}." calls "Add" the first word; a clue saying "second" is wrong.
 * - A token counts as a word if it has a letter *or a digit*, so "3" in
 *   "deals 3 damage" occupies a position — a reader would count it. Numbers
 *   normalize to '' and stay in the array as position holders, which is why the
 *   filter runs before the map.
 * - Splitting is on whitespace only, so punctuation never shifts a position and
 *   intra-word punctuation binds: "aren't" is ARENT, "non-Human" is NONHUMAN.
 *   That is the word a reader would count, which is the whole point — splitting
 *   on non-letters instead (as this pass used to) mints AREN, ISN, NON and SIDED,
 *   entries no clue can honestly place.
 *
 * Exported because clue generation states positions from this same array: a word
 * only becomes vocabulary if this tokenizer finds it, so every stated position
 * holds. A second tokenizer over there is exactly the drift being prevented.
 */
export const oracleTokens = (oracleText: string): string[] =>
  oracleText
    .replace(/\{[^}]*\}/g, ' ')
    .split(/\s+/)
    .filter((token) => /[A-Za-z0-9]/.test(token));

export const oracleWords = (oracleText: string): string[] => oracleTokens(oracleText).map(normalize);

interface NameWordSource {
  name: string;
  oracleId: string;
  /** Original printing, used only to keep a word's pool off one cycle. */
  set: string;
}

interface NameWordStats {
  /** Distinct cluable card names using the word. */
  count: number;
  sources: NameWordSource[];
  /** Held back by MAX_SOURCES_PER_SET; used to top `sources` back up at the end. */
  reserves: NameWordSource[];
}

/**
 * Notes one more cluable card for a word, keeping the first
 * MAX_NAME_WORD_SOURCES it can while spreading them over sets.
 *
 * printedCardList has a stable order, so which cards a word ends up remembering
 * is fixed — no randomness anywhere in the build.
 */
const addNameWordSource = (stats: NameWordStats, source: NameWordSource): void => {
  stats.count += 1;
  if (stats.sources.length >= MAX_NAME_WORD_SOURCES) {
    return;
  }
  const fromSameSet = stats.sources.reduce((total, kept) => total + (kept.set === source.set ? 1 : 0), 0);
  if (fromSameSet < MAX_SOURCES_PER_SET) {
    stats.sources.push(source);
  } else if (stats.reserves.length < MAX_NAME_WORD_SOURCES) {
    stats.reserves.push(source);
  }
};

const nameWordSources = (stats: NameWordStats): NameWordSource[] =>
  [...stats.sources, ...stats.reserves].slice(0, MAX_NAME_WORD_SOURCES);

/** Counts one more cluable card against a word (or a word pair), creating its stats. */
const noteSource = (stats: Map<string, NameWordStats>, text: string, source: NameWordSource): void => {
  const known = stats.get(text);
  if (known) {
    addNameWordSource(known, source);
  } else {
    stats.set(text, { count: 1, sources: [source], reserves: [] });
  }
};

const buildVocabulary = (): Vocabulary => {
  const seen = new Map<string, CrosswordVocabEntry>();
  const priorities = new Map<string, number>();
  const creatureTypes = new Set<string>();
  const keywords = new Set<string>();
  // Word -> how many distinct cards use it, so common rules words rank first.
  const oracleWordCounts = new Map<string, number>();
  // Word from a card name -> how many distinct cluable cards, plus the cards a
  // clue may cite. Same shape for adjacent pairs of words.
  const nameWordCards = new Map<string, NameWordStats>();
  const nameBigramCards = new Map<string, NameWordStats>();
  // Sets that are somebody's first printing; everything else is reprint-only.
  const premiereSets = setsWithFirstPrinting();

  // Types and keywords are read off every printing, because a reprint can carry a
  // type line or a keyword the original didn't.
  for (const details of catalog.printedCardList) {
    if (isExtraCard(details)) {
      continue;
    }
    for (const subtype of creatureSubtypes(details.type)) {
      creatureTypes.add(subtype);
    }
    for (const keyword of details.keywords ?? []) {
      keywords.add(keyword);
    }
  }

  for (const details of originalPrintings().values()) {
    // Rules-text vocabulary, counted once per card.
    //
    // A card names itself in its own rules text ("Searing Blaze deals 1 damage
    // to target player"), and a self-reference doesn't make the word part of
    // Magic's rules vocabulary — SEARING, LAVA, URZAS and CHANDRAS were claimed
    // here on that basis alone. Since oracleWord outranks nameWord in
    // CLASS_PRIORITY, claiming them made them unclueable: the clue has to
    // anonymise the card's name, which removes their only occurrence. Skipping
    // them lets the name-word pass take them instead, where they get a
    // fill-in-the-blank clue against the very name they came from.
    if (details.oracle_text) {
      const selfReference = new Set(nameTokens(details.name).map(normalize));
      const wordsOnCard = new Set<string>(
        oracleWords(details.oracle_text).filter(
          (word) => word.length >= MIN_LENGTH && word.length <= MAX_LENGTH && !selfReference.has(word),
        ),
      );
      for (const word of wordsOnCard) {
        oracleWordCounts.set(word, (oracleWordCounts.get(word) ?? 0) + 1);
      }
    }

    const name = details.name;
    const source = { sourceCardName: name, sourceOracleId: details.oracle_id };
    const nameSource: NameWordSource = { name, oracleId: details.oracle_id, set: details.set ?? '' };

    // Individual words of the name, counted once per card so a card with thirty
    // printings doesn't vote thirty times. Names that can't be clued are skipped
    // outright — they neither count towards the floor nor supply a clue — so a
    // word seen only in one-word names is never a name word. It is still in the
    // vocabulary, as the whole card name it is, which is why this rule costs no
    // supply at all: it only stops a clue from coming out as a bare "____".
    if (leavesCluableRemainder(name, 1)) {
      for (const word of new Set(nameWords(name))) {
        noteSource(nameWordCards, word, nameSource);
      }
    }
    // Adjacent pairs, which eat two words, so the name needs three to have one
    // left to clue with: "Lightning Bolt" contributes none.
    if (leavesCluableRemainder(name, 2)) {
      for (const pair of new Set(nameBigrams(name))) {
        noteSource(nameBigramCards, pair, nameSource);
      }
    }

    // Full card name.
    addEntry(seen, { text: normalize(name), display: name, entryClass: 'cardName', ...source }, priorities);

    // Initials of the name.
    const acronym = acronymOf(name);
    addEntry(seen, { text: acronym, display: name, entryClass: 'acronym', ...source }, priorities);

    // Legendary cards split on the first comma into a name and a title.
    if (details.type.includes('Legendary') && name.includes(',')) {
      const commaIndex = name.indexOf(',');
      const legendName = name.slice(0, commaIndex).trim();
      const legendTitle = name.slice(commaIndex + 1).trim();
      addEntry(
        seen,
        { text: normalize(legendName), display: legendName, entryClass: 'legendName', ...source },
        priorities,
      );
      addEntry(
        seen,
        { text: normalize(legendTitle), display: legendTitle, entryClass: 'legendTitle', ...source },
        priorities,
      );
    }
  }

  // Types and keywords are the most crossword-friendly, so they win ties.
  for (const creatureType of creatureTypes) {
    addEntry(seen, { text: normalize(creatureType), display: creatureType, entryClass: 'creatureType' }, priorities);
  }
  for (const keyword of keywords) {
    addEntry(seen, { text: normalize(keyword), display: keyword, entryClass: 'keyword' }, priorities);
  }

  // Words lifted out of card names. This is where the short slots get answers a
  // solver can actually reason about — RUN, SEA, AXE — instead of initialisms.
  // Every source is a card whose name the clue can blank the word out of; the
  // test enforces that for all of them, not just the first.
  //
  // Then the same again for adjacent pairs, which is where the *long* slots get
  // answers: a pair is typically 8-14 letters, the lengths at which whole card
  // names were previously the only supply.
  const addNameEntries = (
    stats: Map<string, NameWordStats>,
    entryClass: 'nameWord' | 'nameBigram',
    minCards: number,
  ): void => {
    for (const [text, counted] of stats) {
      if (counted.count < minCards) {
        continue;
      }
      const sources = nameWordSources(counted);
      const first = sources[0]!;
      addEntry(
        seen,
        {
          text,
          display: first.name,
          entryClass,
          sourceCardName: first.name,
          sourceOracleId: first.oracleId,
          sourceCardNames: sources.map((source) => source.name),
          frequency: counted.count,
        },
        priorities,
      );
    }
  };
  addNameEntries(nameWordCards, 'nameWord', MIN_NAME_WORD_CARDS);
  addNameEntries(nameBigramCards, 'nameBigram', MIN_NAME_BIGRAM_CARDS);

  // Set codes: short, which is exactly what the 3-4 letter slots were starving
  // for, but only for sets a player would recognise. Scryfall lists over a
  // thousand, and the long tail is Duel Decks, oversized reprints and promo
  // drops — DDH, GVL, AYLI, OCMD fill a slot without being answerable.
  for (const set of Object.values(catalog.setdict)) {
    if (!set.code || !isRecognisableSet(set)) {
      continue;
    }
    addEntry(
      seen,
      {
        text: normalize(set.code),
        display: set.name,
        entryClass: 'setCode',
        setCode: set.code,
        setReleasedAt: set.releasedAt,
        reprintOnly: !premiereSets.has(set.code.toLowerCase()),
      },
      priorities,
    );
  }

  // Generic Magic vocabulary from rules text. Only words that appear on enough
  // distinct cards, so clues can always cite real cards.
  for (const [word, frequency] of oracleWordCounts) {
    if (frequency < MIN_ORACLE_WORD_CARDS) {
      continue;
    }
    addEntry(seen, { text: word, display: word, entryClass: 'oracleWord', frequency }, priorities);
  }

  const entries = [...seen.values()];
  const byLength = new Map<number, number[]>();
  const byLengthPosLetter = new Map<number, Map<string, number[]>>();
  const counts = emptyCounts();

  entries.forEach((entry, index) => {
    counts[entry.entryClass] += 1;

    const length = entry.text.length;
    if (!byLength.has(length)) {
      byLength.set(length, []);
      byLengthPosLetter.set(length, new Map());
    }
    byLength.get(length)!.push(index);

    const posMap = byLengthPosLetter.get(length)!;
    for (let pos = 0; pos < length; pos++) {
      const key = `${pos}:${entry.text[pos]}`;
      if (!posMap.has(key)) {
        posMap.set(key, []);
      }
      posMap.get(key)!.push(index);
    }
  });

  return { entries, byLength, byLengthPosLetter, counts };
};

export const getVocabulary = (): Vocabulary => {
  if (!cached) {
    const start = Date.now();
    cached = buildVocabulary();
    console.info(
      `Crossword vocabulary built in ${Date.now() - start}ms: ${cached.entries.length} entries (${Object.entries(
        cached.counts,
      )
        .map(([key, value]) => `${key}=${value}`)
        .join(', ')})`,
    );
  }
  return cached;
};

/**
 * Test seam: drop the cache so a rebuilt catalog is re-scanned. The printing
 * index goes with it — the vocabulary is built from it, so leaving it cached
 * would describe the previous catalog.
 */
export const clearVocabularyCache = (): void => {
  cached = undefined;
  filteredCache.clear();
  themeCache.clear();
  clearPrintingIndexCache();
};

/**
 * Word indices matching a pattern, where '' means "any letter". Starts from the
 * most selective constraint so the intersection stays small.
 */
export const candidatesForPattern = (vocab: Vocabulary, pattern: string[]): number[] => {
  const length = pattern.length;
  const posMap = vocab.byLengthPosLetter.get(length);
  if (!posMap) {
    return [];
  }

  const constraints: number[][] = [];
  for (let pos = 0; pos < length; pos++) {
    const letter = pattern[pos];
    if (letter) {
      const bucket = posMap.get(`${pos}:${letter}`);
      if (!bucket) {
        return [];
      }
      constraints.push(bucket);
    }
  }

  if (constraints.length === 0) {
    return vocab.byLength.get(length) ?? [];
  }

  constraints.sort((a, b) => a.length - b.length);
  let result = constraints[0]!;
  for (let i = 1; i < constraints.length && result.length > 0; i++) {
    const filter = new Set(constraints[i]!);
    result = result.filter((index) => filter.has(index));
  }
  return result;
};

/**
 * A view of the vocabulary restricted to certain classes, with its own indexes.
 *
 * The fill loop asks for candidates thousands of times; filtering by class on
 * every one of those calls dominated the runtime. Building the restricted index
 * once per class-set (and caching it) keeps the hot path to a pure lookup.
 */
const filteredCache = new Map<string, Vocabulary>();

export const vocabularyForClasses = (allowed: CrosswordEntryClass[]): Vocabulary => {
  const key = [...allowed].sort().join(',');
  const hit = filteredCache.get(key);
  if (hit) {
    return hit;
  }

  const full = getVocabulary();
  const allowedSet = new Set(allowed);
  const entries = full.entries.filter((entry) => allowedSet.has(entry.entryClass));

  const byLength = new Map<number, number[]>();
  const byLengthPosLetter = new Map<number, Map<string, number[]>>();
  const counts = emptyCounts();

  entries.forEach((entry, index) => {
    counts[entry.entryClass] += 1;
    const length = entry.text.length;
    if (!byLength.has(length)) {
      byLength.set(length, []);
      byLengthPosLetter.set(length, new Map());
    }
    byLength.get(length)!.push(index);
    const posMap = byLengthPosLetter.get(length)!;
    for (let pos = 0; pos < length; pos++) {
      const posKey = `${pos}:${entry.text[pos]}`;
      if (!posMap.has(posKey)) {
        posMap.set(posKey, []);
      }
      posMap.get(posKey)!.push(index);
    }
  });

  const filtered: Vocabulary = { entries, byLength, byLengthPosLetter, counts };
  filteredCache.set(key, filtered);
  return filtered;
};

/** Letters that can legally appear at a position, given the rest of a pattern. */
export const feasibleLetters = (vocab: Vocabulary, pattern: string[], position: number): string[] => {
  const candidates = candidatesForPattern(vocab, pattern);
  const letters = new Set<string>();
  for (const index of candidates) {
    letters.add(vocab.entries[index]!.text[position]!);
  }
  return [...letters];
};

/**
 * Card names matching a Scryfall-style filter, as normalized grid text.
 *
 * The long slots are filled from here so a puzzle has a theme (e.g. `ci=g` or
 * `t:elf`). Card names are by far the deepest pool at long lengths, which is
 * exactly where the generic vocabulary runs out.
 */
const themeCache = new Map<string, Set<string>>();

export const themedCardTexts = (filterText: string): Set<string> | null => {
  const key = filterText.trim();
  if (!key) {
    return null;
  }
  const hit = themeCache.get(key);
  if (hit) {
    return hit;
  }

  const { err, filter } = makeFilter(key);
  if (err || !filter) {
    return null;
  }

  const texts = new Set<string>();
  for (const details of catalog.printedCardList) {
    if (isExtraCard(details)) {
      continue;
    }
    if (filter({ details } as Card)) {
      const text = normalize(details.name);
      if (text.length >= MIN_LENGTH && text.length <= MAX_LENGTH) {
        texts.add(text);
      }
    }
  }

  themeCache.set(key, texts);
  return texts;
};
