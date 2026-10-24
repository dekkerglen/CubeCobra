import Card from '@utils/datatypes/Card';
import { makeFilter, MAX_FILTER_LENGTH } from '@utils/filtering/FilterCards';
import filterCardGrammar from '@utils/generated/filtering/cardFilters';
import { Grammar, Parser } from 'nearley';

import { createCardFromDetails } from '../test-utils/data';

const grammar = Grammar.fromCompiled(filterCardGrammar as any);

// Number of complete parse trees nearley produces for the input. Anything other than one
// either fails (0) or is ambiguous (>1); ambiguity used to grow combinatorially with the
// number of parenthesized bare words, which is what made the parser a DoS vector.
const parseCount = (text: string): number => {
  const parser = new Parser(grammar);
  parser.feed(text);
  return parser.results.length;
};

const card = (name: string, type: string, colors: string[]): Card =>
  createCardFromDetails({ name, name_lower: name.toLowerCase(), type, colors: colors as any });

describe('Filter parser ambiguity', () => {
  it.each([
    '(a)',
    '(a) or (b)',
    '(a) or (b) or (c) or (d) or (e) or (f) or (g) or (h) or (i) or (j)',
    '((((((((((a))))))))))',
    '-(dragon) (angel or demon)',
    '(t:creature or t:artifact) c:r',
    '((t:creature or t:artifact) and (c:r or c:g)) -o:flying',
    'Hazmat Suit (Used)',
    '"Hazmat Suit (Used)"',
    "name:'Erase (Not the Urza\\'s Legacy One)'",
    'o:"(this effect)"',
    'tag:removal(cheap)',
    'tag:removal(cheap) or (tag:ramp)',
    '(tag:a(b(c))d)',
    'n:Hazmat(Used)',
  ])('parses %s exactly once', (text) => {
    expect(parseCount(text)).toBe(1);
  });

  it('stays fast and unambiguous for many parenthesized bare-word groups', () => {
    // Twenty groups exhausted the heap before bare words stopped absorbing parentheses.
    const text = Array.from({ length: 40 }, (_, i) => `(w${i})`).join(' or ');
    const start = Date.now();
    expect(parseCount(text)).toBe(1);
    expect(Date.now() - start).toBeLessThan(2000);
  });

  it('stays fast and unambiguous for deeply nested parentheses inside and around words', () => {
    const start = Date.now();
    expect(parseCount(`${'('.repeat(200)}a${')'.repeat(200)}`)).toBe(1);
    expect(parseCount(`tag:a${'('.repeat(200)}b${')'.repeat(200)}`)).toBe(1);
    expect(Date.now() - start).toBeLessThan(2000);
  });

  it('keeps grouped type/color queries working', () => {
    const { err, filter } = makeFilter('(t:creature or t:artifact) c:r');
    expect(err).toBeFalsy();
    expect(filter).toBeInstanceOf(Function);

    expect(filter!(card('Goblin Guide', 'Creature — Goblin Scout', ['R']))).toBe(true);
    expect(filter!(card('Shrapnel Blast', 'Instant', ['R']))).toBe(false);
    expect(filter!(card('Myr Battlesphere', 'Artifact Creature — Myr Construct', []))).toBe(false);
    expect(filter!(card('Phyrexian Revoker', 'Artifact Creature — Phyrexian Myr', ['R']))).toBe(true);
    expect(filter!(card('Delver of Secrets', 'Creature — Human Wizard', ['U']))).toBe(false);
  });

  it('matches quoted names containing parentheses', () => {
    const hazmat = card('Hazmat Suit (Used)', 'Artifact — Equipment', []);
    const other = card('Hazmat Suit', 'Artifact — Equipment', []);

    for (const text of ['"Hazmat Suit (Used)"', "name:'Hazmat Suit (Used)'", 'name="Hazmat Suit (Used)"']) {
      const { err, filter } = makeFilter(text);
      expect(err).toBeFalsy();
      expect(filter!(hazmat)).toBe(true);
      expect(filter!(other)).toBe(false);
    }
  });

  it('treats a parenthesis at the start of a word as grouping', () => {
    // "Hazmat AND Suit AND (Used)": every word must appear in the name.
    const { err, filter } = makeFilter('Hazmat Suit (Used)');
    expect(err).toBeFalsy();
    expect(filter!(card('Hazmat Suit (Used)', 'Artifact', []))).toBe(true);
    expect(filter!(card('Hazmat Suit', 'Artifact', []))).toBe(false);
  });

  it('keeps balanced parentheses inside a word, such as a tag name', () => {
    const { err, filter } = makeFilter('tag:Removal(Cheap)');
    expect(err).toBeFalsy();
    const tagged = createCardFromDetails({ name: 'Shock' });
    tagged.tags = ['Removal(Cheap)'];
    const other = createCardFromDetails({ name: 'Murder' });
    other.tags = ['Removal'];
    expect(filter!(tagged)).toBe(true);
    expect(filter!(other)).toBe(false);
  });

  it.each(['o:draw(', 'o:draw)', 'tag:a(b', 'tag:a)b('])('rejects unbalanced parentheses in a word (%s)', (text) => {
    expect(makeFilter(text).err).toBeTruthy();
  });
});

describe('Filter length cap', () => {
  it('rejects filters longer than the cap without parsing them', () => {
    const { err, filter } = makeFilter('a'.repeat(MAX_FILTER_LENGTH + 1));
    expect(err).toBe('Filter is too long');
    expect(filter).toBeNull();
  });

  it('accepts a long filter at the cap', () => {
    const clause = 'n:"Lightning Bolt"';
    const parts: string[] = [];
    while ((parts.length + 1) * (clause.length + 4) < MAX_FILTER_LENGTH) parts.push(clause);
    const text = parts.join(' or ');
    expect(text.length).toBeLessThanOrEqual(MAX_FILTER_LENGTH);

    const { err, filter } = makeFilter(text);
    expect(err).toBeFalsy();
    expect(filter).toBeInstanceOf(Function);
  });
});
