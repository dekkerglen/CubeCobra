import { Catalog } from '@utils/datatypes/CardCatalog';

// Built inside the factory: the transform hoists jest.mock above module-scope
// declarations, so an outer const would be in the TDZ when the factory runs.
jest.mock('serverutils/cardCatalog', () => ({
  __esModule: true,
  default: { setdict: {} },
  whenCardDbReady: () => Promise.resolve(),
  isCardDbReady: () => true,
}));

import { makeFilter } from '@utils/filtering/FilterCards';
import cardCatalog from 'serverutils/cardCatalog';
import { describeFilterTerm, describeFilterTerms } from 'serverutils/filterDescription';

const mockCardCatalog = cardCatalog as unknown as Catalog;

beforeEach(() => {
  mockCardCatalog.setdict = {
    dom: {
      code: 'dom',
      name: 'Dominaria',
      setType: 'expansion',
      releasedAt: '2018-04-27',
      cardCount: 269,
      digital: false,
      icon: '',
    },
  };
});

/**
 * The wording shared by the ManaMatrix category labels and the crossword clue
 * writer. Both need a sentence *fragment*, which is what the filter grammar's own
 * `.describe` gives — `filterToReadableString` wraps it in "Matching cards where
 * ... .", a sentence that reads wrong as either a label or a clue.
 */
describe('describeFilterTerm', () => {
  it('uses the grammar’s own fragment where it reads well', () => {
    expect(describeFilterTerm('ci=g')).toBe('color identity is exactly Green');
    expect(describeFilterTerm('mv=3')).toBe('mana value is 3');
    expect(describeFilterTerm('pow=2')).toBe('power is 2');
    expect(describeFilterTerm('r:common')).toBe('rarity is common');
    // No sentence wrapper, no trailing full stop.
    expect(describeFilterTerm('ci=g')).not.toMatch(/^Matching|\.$/);
  });

  it('overrides the fragments that read badly', () => {
    // 'type contains "elf"' nests quotes in whatever sentence it lands in.
    expect(describeFilterTerm('t:elf')).toBe('type line includes Elf');
    expect(describeFilterTerm('t:"human wizard"')).toBe('type line includes Human Wizard');
    // 'first printed is 1993' is missing its preposition.
    expect(describeFilterTerm('fy=1993')).toBe('first printed in 1993');
    // 'set is "dom"' asks the reader to know set codes.
    expect(describeFilterTerm('s:dom')).toBe('printed in Dominaria (DOM)');
    expect(describeFilterTerm('set:dom')).toBe('printed in Dominaria (DOM)');
    expect(describeFilterTerm('s:zzz')).toBe('printed in set "zzz"');
    // 'atag contains exactly "..."' is about the data model, not the card.
    expect(describeFilterTerm('otag:"ramp"')).toBe('oracle tag is "ramp"');
    expect(describeFilterTerm('atag:"dragon"')).toBe('art tag is "dragon"');
  });

  it('falls back to the term itself rather than describing nothing', () => {
    // A term that doesn't parse still has to be described as something, or a caller
    // would show an empty condition and no longer match its own filter.
    expect(makeFilter('mv=abc').err).toBeTruthy();
    expect(describeFilterTerm('mv=abc')).toBe('mv=abc');
  });
});

describe('describeFilterTerms', () => {
  it('describes every term of the filter, comma separated', () => {
    expect(describeFilterTerms(['ci=g', 't:elf', 'mv=1'])).toBe(
      'color identity is exactly Green, type line includes Elf, mana value is 1',
    );
  });

  it('gathers the type terms into one fragment, where the first of them was', () => {
    expect(describeFilterTerms(['ci=w', 'mv=4', 't:legendary', 't:enchantment'])).toBe(
      'color identity is exactly White, mana value is 4, type line includes Legendary and Enchantment',
    );
    expect(describeFilterTerms(['ci=g', 't:human', 'mv=4', 't:legendary'])).toBe(
      'color identity is exactly Green, type line includes Human and Legendary, mana value is 4',
    );
  });

  it('describes the same cards the filter matches, term for term', () => {
    // Nothing is dropped to shorten the wording: every term is accounted for, so
    // the description and the filter cannot drift apart.
    const terms = ['ci=g', 't:elf', 'mv=1', 'pow=1', 'r:common', 'fy=1993', 's:dom'];
    const described = describeFilterTerms(terms);
    expect(makeFilter(terms.join(' ')).err).toBeFalsy();
    expect(described.split(', ')).toHaveLength(terms.length);
  });
});
