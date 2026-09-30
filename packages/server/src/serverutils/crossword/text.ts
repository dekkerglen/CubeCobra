/**
 * The pure text rules the crossword vocabulary and its clue writer both live by:
 * how a card name and a card's rules text are cut into words, what a card may be
 * quoted saying once its own name is taken out, and whether a given word can be
 * blanked back out of that text at all.
 *
 * This module exists because those two jobs have to agree and used to only agree
 * by convention. `vocabulary.ts` decides what a word *is* and `clues.ts` writes
 * about the same word later; when each held its own tokenizer the two drifted and
 * the vocabulary minted entries — AREN, NON, SIDED — that no clue could honestly
 * place, and when each would have held its own anonymiser one of them would have
 * been the one that leaks a card's name. Nothing here touches the catalog, the
 * vocabulary or a `ClueContext`, so both of those modules can import it and
 * neither has to import the other.
 *
 * Strings in, strings out. No randomness, no I/O.
 */

/** What the solver fills in. Four underscores read as a blank at any font size. */
export const BLANK = '____';

/**
 * How many cards each clue index remembers per key, and so how many a clue has to
 * choose between.
 *
 * The rules-word index shares this number with the vocabulary build, which is the
 * one place it matters: the build admits a rules word only if one of the first
 * `CLUE_SOURCES_PER_KEY` cards carrying it can be blanked (see
 * `blankWordInRulesText`), and the clue writer only ever looks at those same
 * cards. Let the two disagree and the build admits words the writer then can't
 * clue, which is the whole failure this constant's single definition prevents.
 *
 * Eight is plenty of variety for a bounded index.
 */
export const CLUE_SOURCES_PER_KEY = 8;

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

/**
 * Subtypes from a type line: "Legendary Creature — Elf Warrior" -> [Elf, Warrior].
 *
 * Shared because clue generation has to find a card for every creature type the
 * vocabulary mints; a copy that drifted would leave a type with no card to cite.
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
 * Shared because clue generation has to blank exactly the words the vocabulary
 * pass counted — a separate regex over there would silently mis-handle split cards
 * and hyphens, and the mismatch would only show up as clues that never render.
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
 *   on non-letters instead (as the vocabulary pass used to) mints AREN, ISN, NON
 *   and SIDED, entries no clue can honestly place.
 *
 * Shared because a word only becomes vocabulary if this tokenizer finds it, and
 * the clue writer has to find the same word in the same place. A second tokenizer
 * is exactly the drift this module exists to prevent.
 */
export const oracleTokens = (oracleText: string): string[] =>
  oracleText
    .replace(/\{[^}]*\}/g, ' ')
    .split(/\s+/)
    .filter((token) => /[A-Za-z0-9]/.test(token));

export const oracleWords = (oracleText: string): string[] => oracleTokens(oracleText).map(normalize);

/** Consecutive words of a clue, letters only: used to read an answer back out of it. */
const clueWords = (text: string): string[] => text.split(/\s+/).map(normalize).filter(Boolean);

/**
 * Whether a solver could read the answer straight off this text.
 *
 * Two ways that happens, and both are checked over every run of consecutive
 * words rather than over the whole string, because a substring test on letters
 * alone fires on accidents ("with" contains ITH, the legend Ith):
 *
 * - the words spell the answer — MINDSCULPTOR out of "... Mind Sculptor ...";
 * - their initials spell it, which is how an acronym clue leaks: TTLT out of any
 *   four consecutive words starting T, T, L, T. This is not a corner case in
 *   rules text either — the rules word ITS came out of one card as a sentence
 *   whose words ran "it ... targets ... something".
 *
 * `alsoSpelled` is a second string the text may not spell out — the source card's
 * name, since naming the card gives away every answer derived from it. Only the
 * answer itself is checked against the initials.
 *
 * Here rather than in the clue writer because the vocabulary build has to ask the
 * same question: a word whose only blankable sentence gives it away is no more
 * clueable than one with no blankable sentence at all.
 */
export const spellsOutAnswer = (text: string, answer: string, alsoSpelled = ''): boolean => {
  const words = clueWords(text);
  const spelled = new Set([answer, alsoSpelled].filter(Boolean));
  const longest = Math.max(...[...spelled].map((target) => target.length));
  for (let start = 0; start < words.length; start++) {
    let run = '';
    let initials = '';
    for (let end = start; end < words.length; end++) {
      run += words[end]!;
      initials += words[end]![0]!;
      if (spelled.has(run) || initials === answer) {
        return true;
      }
      // Both only grow from here, so once each is past its target the window is
      // spent and the next start is the only thing left to try.
      if (run.length >= longest && initials.length >= answer.length) {
        break;
      }
    }
  }
  return false;
};

/**
 * English structural words a clue may leave in place.
 *
 * Two jobs, one list, because it is one judgement: these words carry no Magic
 * content at all. The vocabulary drops them from the name-word pool, because
 * "____ Terror" for THE is unanswerable; `anonymiseCardName` declines to redact
 * them, because redacting "the" out of "Jace, the Mind Sculptor" would take it out
 * of "the battlefield" too and say nothing about the card in exchange.
 *
 * Bigrams (see `nameBigrams` in vocabulary.ts) deliberately do *not* consult it:
 * "____ ____ Terror" for OFTHE is answerable in a way "a word in the name of ..."
 * for OF never was, because the blank shows the solver both words are wanted.
 */
export const STRUCTURAL_WORDS = new Set([
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

/** The mark left where a card's own name was taken out of its rules text. */
export const NAME_REDACTION = '~';

/** Shortest name word worth redacting; below this it is punctuation, not a name. */
const MIN_REDACTED_WORD_LENGTH = 3;

/** Reminder text is parenthesised rules restatement — it would give the game away. */
const stripReminders = (text: string): string => text.replace(/\([^)]*\)/g, ' ');

/**
 * Sentences of a rules text, in printed order. Magic puts one rule per line and
 * one ability per sentence, so either break is a break.
 */
const sentencesOf = (text: string): string[] =>
  text
    .split(/(?<=[.!?])\s+|\n+/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);

/**
 * The card's own name taken out of its rules text, every occurrence replaced by
 * `NAME_REDACTION`: "Whenever ~ deals combat damage to a player, draw a card."
 *
 * Naming the card gives away every answer derived from it, so this runs before
 * any rules text reaches a solver. Three rules, each of which cost something to
 * learn:
 *
 * - `answer` is exempt. "Searing Blaze" says "Searing" in its own text, and
 *   redacting that along with the name left SEARING with nothing to be clued
 *   from; 37 rules words were unclueable for exactly this reason. Pass '' when
 *   the answer is the whole card and nothing needs exempting.
 * - Matching is on whole normalized words, not substrings. A raw
 *   `split(part).join('~')` also fires inside unrelated words — the name "Jace,
 *   the Mind Sculptor" turned "their" into "~ir" and a card named "Ice" turned
 *   "sacrifice" into "sacrif~" — which mangles the very sentence being quoted.
 * - A possessive counts as the word ("Urza's" for URZA), because Magic's
 *   templating uses one and a solver reads it as the name.
 */
const anonymiseCardName = (text: string, cardName: string, answer: string): string => {
  const whole = text.split(cardName).join(NAME_REDACTION);
  const redacted = new Set(
    nameTokens(cardName)
      .map(normalize)
      .filter((word) => word.length >= MIN_REDACTED_WORD_LENGTH && word !== answer && !STRUCTURAL_WORDS.has(word)),
  );
  if (redacted.size === 0) {
    return whole;
  }
  return splitNameParts(whole)
    .map((part, index) => {
      if (index % 2 !== 0) {
        return part;
      }
      const word = normalize(part);
      if (!redacted.has(word) && !(word.endsWith('S') && redacted.has(word.slice(0, -1)))) {
        return part;
      }
      const lead = /^[^A-Za-z]*/.exec(part)![0];
      const trail = /[^A-Za-z]*$/.exec(part)![0];
      return `${lead}${NAME_REDACTION}${trail}`;
    })
    .join('');
};

/** Long enough for most Magic sentences, short enough to still read as a clue. */
const MAX_BLANK_CLUE_LENGTH = 200;

/** Words kept either side of the anchor when a sentence is too long to quote whole. */
const EXCERPT_WORDS_EACH_SIDE = 6;

/**
 * Letters of context a blank needs to be a clue at all. The same rule the name
 * clues follow: a sentence that is only the answer collapses to a bare "____".
 */
const MIN_BLANK_CONTEXT_LETTERS = 3;

/**
 * Words a quoted line of rules text needs before it describes a card rather than
 * a mechanic. "Flying." and "Draw a card." are true of hundreds of cards; "Target
 * player draws three cards." is true of one.
 */
const MIN_RULES_LINE_WORDS = 5;

/**
 * A window of `parts` (a `splitNameParts` list) around the word at `target`,
 * elided at whichever end was cut.
 *
 * A clue doesn't have to be a whole sentence. Magic's longer rules text runs
 * well past what reads as a clue, and discarding those cards outright left 32
 * rules words with no clue at all.
 */
const excerptAt = (parts: string[], target: number): string | null => {
  if (target < 0) {
    return null;
  }
  // Parts alternate word/separator, so a word's neighbours are two apart.
  const first = Math.max(0, target - EXCERPT_WORDS_EACH_SIDE * 2);
  const last = Math.min(parts.length - 1, target + EXCERPT_WORDS_EACH_SIDE * 2);
  const body = parts
    .slice(first, last + 1)
    .join('')
    .trim();
  if (!body) {
    return null;
  }
  return `${first > 0 ? '…' : ''}${body}${last < parts.length - 1 ? '…' : ''}`;
};

/** The first word of `sentence` that `isAnchor` accepts, as a `splitNameParts` index. */
const anchorIndex = (parts: string[], isAnchor: (word: string) => boolean): number =>
  parts.findIndex((part, index) => index % 2 === 0 && isAnchor(part));

/**
 * One card's rules text with `word` blanked out of it, or null when this card
 * can't clue that word: "Destroy target ____." for CREATURE.
 *
 * The whole cluability of a rules word comes down to this function, which is why
 * it is here rather than in the clue writer. The vocabulary build admits a rules
 * word only if some card gives a non-null answer (see `CLUE_SOURCES_PER_KEY`),
 * and the clue writer then calls this same function to write the clue. There is
 * one implementation on purpose: two would let the build admit words the writer
 * can't clue, and the slot would ship with a clue stating nothing but its length.
 *
 * What it takes to succeed, in order:
 *
 * - reminder text goes, because it restates the rule in plainer words;
 * - the card's own name goes, because naming the card gives every answer away —
 *   except where a word of the name is the answer, which is the only occurrence
 *   some words have;
 * - the shortest sentence containing the word is quoted, because a long one reads
 *   as a wall of rules rather than a clue, and a sentence past
 *   MAX_BLANK_CLUE_LENGTH is cut down to a window around the answer;
 * - every occurrence is blanked, on normalized word boundaries rather than a raw
 *   regex: the grid holds YOURE while the card prints "you're", and \bYOURE\b can
 *   never match that — which is why every folded contraction used to come out
 *   unclueable. Punctuation around the word is kept so the sentence still reads:
 *   "creature." -> "____.";
 * - what is left has to be at least MIN_BLANK_CONTEXT_LETTERS of real text;
 * - and it must not spell the word back out. Blanking every occurrence is not
 *   enough on its own: "Any player may activate this ability" blanked for MAY
 *   still hands ITS over as the initials of three of its words.
 */
export const blankWordInRulesText = (oracleText: string, cardName: string, word: string): string | null => {
  const answer = normalize(word);
  if (!answer || !oracleText) {
    return null;
  }

  const anonymised = anonymiseCardName(stripReminders(oracleText), cardName, answer);

  // Shortest sentence that actually contains the word — long ones read as a wall
  // of rules rather than a clue.
  const sentence = sentencesOf(anonymised)
    .filter((part) => oracleWords(part).includes(answer))
    .sort((a, b) => a.length - b.length)[0];
  if (!sentence) {
    return null;
  }

  let quoted = sentence;
  if (sentence.length > MAX_BLANK_CLUE_LENGTH) {
    const parts = splitNameParts(sentence);
    const excerpt = excerptAt(
      parts,
      anchorIndex(parts, (token) => normalize(token) === answer),
    );
    if (!excerpt) {
      return null;
    }
    quoted = excerpt;
  }

  let matched = false;
  const blanked = splitNameParts(quoted)
    .map((part, index) => {
      if (index % 2 !== 0 || normalize(part) !== answer) {
        return part;
      }
      matched = true;
      const lead = /^[^A-Za-z]*/.exec(part)![0];
      const trail = /[^A-Za-z]*$/.exec(part)![0];
      return `${lead}${BLANK}${trail}`;
    })
    .join('');
  if (!matched) {
    return null;
  }

  const context = blanked
    .split(BLANK)
    .join(' ')
    .replace(/[^A-Za-z]+/g, '');
  if (context.length < MIN_BLANK_CONTEXT_LETTERS) {
    return null;
  }

  return spellsOutAnswer(blanked, answer) ? null : blanked;
};

/**
 * One line of a card's own rules text with the card's name redacted, or null when
 * the card hasn't got a line worth quoting: "Whenever ~ deals combat damage to a
 * player, draw a card."
 *
 * The clue shape a player actually wants for a whole-card answer. A filter
 * translated into English — "color identity is exactly Blue, mana value is 4" —
 * describes a spreadsheet row; a line of the card's text describes the card, and
 * it is the one thing the catalog holds that says what the card *does* in Magic's
 * own words.
 *
 * Same anonymiser as `blankWordInRulesText`, with nothing exempted, because here
 * the whole card is the answer and every word of its name is a give-away. Which
 * line:
 *
 * - it has to be at least MIN_RULES_LINE_WORDS long, or it describes a mechanic
 *   rather than a card, and a card with no such line gets no clue from here;
 * - a line that mentions the card itself is preferred, because "Whenever ~
 *   attacks" is a far tighter clue than a line of generic templating;
 * - then the shortest, for the same reason `blankWordInRulesText` takes the
 *   shortest sentence: a clue is a line, and Magic's longer abilities read as a
 *   wall of rules. Preferring the longest was tried and produced 200-character
 *   clues for three-letter answers.
 *
 * A line past MAX_BLANK_CLUE_LENGTH even so is cut to a window around the
 * redaction.
 *
 * It does not prove that the line identifies the card, which the filter shape does
 * do by counting matches. That is the trade: this shape is far more readable and
 * occasionally vaguer, so the caller picks between them rather than replacing one
 * with the other.
 */
export const redactedRulesLine = (oracleText: string, cardName: string): string | null => {
  if (!oracleText) {
    return null;
  }
  const anonymised = anonymiseCardName(stripReminders(oracleText), cardName, '');
  const lines = sentencesOf(anonymised).filter((line) => oracleTokens(line).length >= MIN_RULES_LINE_WORDS);
  if (lines.length === 0) {
    return null;
  }

  const rank = (line: string): [number, number] => [line.includes(NAME_REDACTION) ? 0 : 1, line.length];
  const best = (candidates: string[]): string =>
    candidates.reduce((winner, line) => {
      const [winnerNamed, winnerLength] = rank(winner);
      const [lineNamed, lineLength] = rank(line);
      return lineNamed < winnerNamed || (lineNamed === winnerNamed && lineLength < winnerLength) ? line : winner;
    });

  const withinLimit = lines.filter((line) => line.length <= MAX_BLANK_CLUE_LENGTH);
  if (withinLimit.length > 0) {
    return best(withinLimit);
  }

  const parts = splitNameParts(best(lines));
  return excerptAt(
    parts,
    Math.max(
      0,
      anchorIndex(parts, (token) => token.includes(NAME_REDACTION)),
    ),
  );
};
