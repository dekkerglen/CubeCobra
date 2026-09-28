import { FilterFunction, makeFilter } from '@utils/filtering/FilterCards';
import catalog from 'serverutils/cardCatalog';

/**
 * Plain-English wording for a single Scryfall-style filter term, as a sentence
 * fragment: `ci=g` -> "color identity is exactly Green".
 *
 * The filter grammar composes a `.describe` fragment as it parses (see
 * FuncOperations), and for most terms that fragment is exactly what a reader
 * wants. A handful read badly enough to be worth overriding, and those are the
 * only reason this module exists — the alternative was every caller inventing its
 * own wording, which is how the ManaMatrix generator and the crossword clue
 * writer came to need the same three fixes.
 *
 * `filterToReadableString` is deliberately not used: it wraps the fragment in
 * "Matching cards where ... .", which is a sentence rather than the fragment a
 * category label or a crossword clue needs.
 */

/** A value lifted out of a term: `t:"human wizard"` -> "human wizard". */
const termValue = (raw: string): string => raw.trim().replace(/^"(.*)"$/, '$1');

/** "human wizard" -> "Human Wizard", for values printed rather than quoted. */
const titleCase = (value: string): string => value.replace(/\b[a-z]/g, (letter) => letter.toUpperCase());

/**
 * One fragment for however many type terms a filter carries.
 *
 * Joined with "and" rather than listed one term each: the description is itself a
 * comma-separated list, so "type line includes Legendary, type line includes
 * Planeswalker" both repeats itself and reads as two unrelated conditions.
 */
const typeWording = (values: string[]): string => `type line includes ${values.map(titleCase).join(' and ')}`;

/**
 * Bespoke wording, tried before the grammar's own fragment.
 *
 * - Tags: the generated fragment is 'atag contains exactly "..."', which is about
 *   the data model rather than the card.
 * - Sets: 'set is "dst"' asks the reader to know set codes; the catalog has the
 *   name.
 * - Type lines: 'type contains "elf"' nests quotes inside whatever sentence it
 *   lands in, and lowercases a word Magic capitalises.
 * - First printed: 'first printed is 1993' is missing its preposition.
 */
/** Matches a type term, the one kind a filter routinely carries several of. */
const TYPE_TERM = /^(?:type|t):(.+)$/;

const OVERRIDES: { pattern: RegExp; wording: (value: string, field: string) => string }[] = [
  {
    pattern: /^(otag|atag):(.+)$/,
    wording: (value, field) => `${field === 'otag' ? 'oracle' : 'art'} tag is "${value}"`,
  },
  {
    pattern: /^(set|s):(.+)$/,
    wording: (value) => {
      const name = catalog.setdict[value.toLowerCase()]?.name;
      return name ? `printed in ${name} (${value.toUpperCase()})` : `printed in set "${value}"`;
    },
  },
  { pattern: /^(type|t):(.+)$/, wording: (value) => typeWording([value]) },
  { pattern: /^(fy)=(\d+)$/, wording: (value) => `first printed in ${value}` },
];

/**
 * One term in plain English. Falls back to the term itself for a term that
 * doesn't parse or that the grammar has no fragment for, so the result always
 * describes the same cards the term does — a term is never silently dropped.
 *
 * `parsed` is the term's already-compiled filter, for callers that have one;
 * without it the term is compiled here just for its fragment.
 */
export const describeFilterTerm = (termText: string, parsed?: FilterFunction | null): string => {
  const term = termText.trim();
  for (const { pattern, wording } of OVERRIDES) {
    const match = term.match(pattern);
    if (match) {
      return wording(termValue(match[2]!), match[1]!);
    }
  }
  const filter = parsed ?? (parsed === null ? null : makeFilter(term).filter);
  const fragment = filter?.describe?.trim();
  return fragment && fragment.length > 0 ? fragment : term;
};

/**
 * Space-separated terms — an AND in the filter grammar — as a comma-separated
 * English list: `ci=g t:elf mv=1` -> "color identity is exactly Green, type line
 * includes Elf, mana value is 1".
 *
 * Every term is described, so the description and the filter always describe the
 * same set of cards. The type terms are gathered into one fragment, in the place
 * the first of them held: a filter narrowing to a card commonly carries two or
 * three (`t:legendary t:planeswalker t:jace`), and a fragment each makes the clue
 * read like a form being filled in.
 */
export const describeFilterTerms = (terms: string[]): string => {
  const fragments: string[] = [];
  const typeValues: string[] = [];
  let typeSlot = -1;

  for (const term of terms) {
    const type = term.trim().match(TYPE_TERM);
    if (type) {
      if (typeSlot < 0) {
        typeSlot = fragments.length;
        fragments.push('');
      }
      typeValues.push(termValue(type[1]!));
      continue;
    }
    fragments.push(describeFilterTerm(term));
  }
  if (typeSlot >= 0) {
    fragments[typeSlot] = typeWording(typeValues);
  }
  return fragments.join(', ');
};
