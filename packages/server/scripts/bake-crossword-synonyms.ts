/**
 * Bakes thesaurus clues for the crossword's rules-word vocabulary.
 *
 * Rules words used to be clued by position ("32nd word on Sword of Body and
 * Mind"), which is not a puzzle so much as a counting exercise. Synonyms make
 * them solvable, but the lookup is a network call against Datamuse and the
 * daily generator can't be making those, so the mapping is baked here and
 * committed.
 *
 * Emits a .ts module rather than JSON on purpose: the server build only copies
 * .pug/public/content into dist, so a .json file under src would compile fine
 * and then be missing at runtime.
 *
 * Run: npm run bake-crossword-synonyms --workspace=packages/server
 */
import fs from 'fs';
import path from 'path';

import { initializeCardDb } from '../src/serverutils/cardCatalog';
import { getVocabulary } from '../src/serverutils/crossword/vocabulary';

const OUT = path.join(__dirname, '../src/serverutils/crossword/synonyms.generated.ts');
const MAX_SYNONYMS = 5;
/**
 * Floor on a "means like" score. Datamuse returns a long tail of weak
 * associations; only the strong head reads as a clue.
 */
const MIN_MEANS_LIKE_SCORE = 20_000;

/** Datamuse asks callers to be reasonable; this is well inside their limits. */
const DELAY_MS = 40;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Function words have no clueable synonym — "any", "was", "each" are structural
 * rather than meaningful, and a thesaurus either returns nothing or reaches for
 * something absurd. They get the oracle-text blank instead, where context does
 * the work.
 */
const FUNCTION_WORDS = new Set(
  (
    'the a an and or of to in on for it its is are was were be been being has have had do does did ' +
    'you your this that these those any all each both either neither other another may might can could ' +
    'will would shall should must if when then than as at by from with without up down out into onto ' +
    'upon not no nor so such same only also more most less least first next last until while where ' +
    'which what who whose whom there here their them they he she his her him one two three four five ' +
    'but per via than about after before during between among under over again once still just even'
  ).split(' '),
);

interface DatamuseWord {
  word: string;
  score?: number;
}

const fetchRelated = async (word: string, rel: 'rel_syn' | 'ml'): Promise<DatamuseWord[]> => {
  const url = `https://api.datamuse.com/words?${rel}=${encodeURIComponent(word.toLowerCase())}&max=20`;
  try {
    const response = await fetch(url);
    if (!response.ok) return [];
    return (await response.json()) as DatamuseWord[];
  } catch {
    return [];
  }
};

/**
 * A synonym that contains the answer, is contained by it, or shares its stem
 * hands the solver the answer. Multi-word and hyphenated results are dropped
 * because they read badly as a one-word clue.
 */
const usable = (candidate: string, answer: string): boolean => {
  const synonym = candidate.toLowerCase();
  const target = answer.toLowerCase();
  if (!/^[a-z]+$/.test(synonym)) return false;
  if (synonym.length < 3) return false;
  if (synonym === target || synonym.includes(target) || target.includes(synonym)) return false;
  const stem = Math.min(4, Math.min(synonym.length, target.length));
  return synonym.slice(0, stem) !== target.slice(0, stem);
};

(async () => {
  await initializeCardDb();
  const vocab = getVocabulary();

  // Magic keywords are where a general thesaurus doesn't just come up empty,
  // it lies: "mill" -> "grind", "tap" -> "faucet". Those words fall through to
  // the oracle-text blank instead of getting a misleading synonym.
  const jargon = new Set(
    vocab.entries.filter((entry) => entry.entryClass === 'keyword').map((entry) => entry.text.toLowerCase()),
  );

  const words = [...new Set(vocab.entries.filter((e) => e.entryClass === 'oracleWord').map((e) => e.text))].sort();

  console.log(`${words.length} rules words; ${jargon.size} Magic keywords excluded from the thesaurus.`);

  const result: Record<string, string[]> = {};
  let withSynonyms = 0;
  let skippedJargon = 0;

  for (let i = 0; i < words.length; i++) {
    const word = words[i]!;
    // Magic keywords never reach here: `addEntry` gives them their own
    // higher-priority class, so a keyword is never also a rules word. The
    // check stays as a guard in case that priority order ever changes.
    if (jargon.has(word.toLowerCase()) || FUNCTION_WORDS.has(word.toLowerCase())) {
      skippedJargon += 1;
      continue;
    }

    // True synonyms first. "Means like" is a fallback rather than the first
    // choice because it is looser — but it is worth having: a synonym reads as
    // a real crossword clue where the oracle-text blank is a consolation.
    //
    // It was disabled once for returning noise (WAS -> ["pls","heh","layla"]),
    // but that was a function word, and those no longer reach the thesaurus at
    // all. For content words a score floor keeps the tail off.
    let candidates = await fetchRelated(word, 'rel_syn');
    if (candidates.length === 0) {
      candidates = (await fetchRelated(word, 'ml')).filter((c) => (c.score ?? 0) >= MIN_MEANS_LIKE_SCORE);
    }

    const synonyms = candidates
      .filter((candidate) => usable(candidate.word, word))
      .slice(0, MAX_SYNONYMS)
      .map((candidate) => candidate.word);

    if (synonyms.length > 0) {
      result[word] = synonyms;
      withSynonyms += 1;
    }

    if (i % 50 === 0) {
      console.log(`  ${i}/${words.length} (${withSynonyms} with synonyms)`);
    }
    await sleep(DELAY_MS);
  }

  const body = Object.keys(result)
    .sort()
    .map((word) => `  ${word}: ${JSON.stringify(result[word])},`)
    .join('\n');

  fs.writeFileSync(
    OUT,
    `// Generated by scripts/bake-crossword-synonyms.ts — do not edit by hand.\n` +
      `// Source: Datamuse (https://api.datamuse.com). Re-run the script to refresh.\n\n` +
      `export const CROSSWORD_SYNONYMS: Record<string, string[]> = {\n${body}\n};\n`,
  );

  console.log(
    `\nWrote ${OUT}\n` +
      `  ${withSynonyms} words with synonyms\n` +
      `  ${skippedJargon} keywords/function words skipped (oracle-text blank instead)\n` +
      `  ${words.length - withSynonyms - skippedJargon} no usable synonym (oracle-text blank instead)`,
  );
  process.exit(0);
})();
