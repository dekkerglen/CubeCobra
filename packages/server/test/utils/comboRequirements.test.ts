import {
  compileTemplateQuery,
  groupOrOperands,
  matchComboRequirements,
  requirementsAreMet,
} from '@utils/comboRequirements';
import Card from '@utils/datatypes/Card';
import { Combo } from '@utils/datatypes/CardCatalog';

import { createCard, createCardDetails } from '../test-utils/data';

const creature = (name: string, keywords: string[] = [], oracle_id = name): Card =>
  createCard({
    details: createCardDetails({ name, name_lower: name.toLowerCase(), oracle_id, type: 'Creature — Elf', keywords }),
  });

const combo = (uses: string[], requires: { query: string | null; quantity?: number }[]): Combo =>
  ({
    id: 'combo',
    uses: uses.map((oracleId) => ({ card: { oracleId, name: oracleId } })),
    requires: requires.map(({ query, quantity }) => ({
      quantity: quantity ?? 1,
      template: { id: 1, name: 'Template', scryfallQuery: query, scryfallApi: '' },
    })),
  }) as unknown as Combo;

describe('groupOrOperands', () => {
  it('makes AND bind tighter than OR, as on Scryfall', () => {
    expect(groupOrOperands('t:creature (kw:changeling or t:zombie t:cat)')).toBe(
      't:creature ((kw:changeling) or (t:zombie t:cat))',
    );
    expect(groupOrOperands('t:artifact t:creature o:"enters with" OR kw:modular')).toBe(
      '(t:artifact t:creature o:"enters with") or (kw:modular)',
    );
  });

  it('leaves queries without OR alone', () => {
    expect(groupOrOperands('keyword:persist t:creature')).toBe('keyword:persist t:creature');
  });

  it('does not split on "or" inside quotes or regexes', () => {
    expect(groupOrOperands('o:"one or more" t:elf')).toBe('o:"one or more" t:elf');
    expect(groupOrOperands('o:/(sacrifice|exile) or return/ t:elf')).toBe('o:/(sacrifice|exile) or return/ t:elf');
    expect(groupOrOperands("o:'this or that' or t:elf")).toBe("(o:'this or that') or (t:elf)");
  });

  it('returns unbalanced queries unchanged', () => {
    expect(groupOrOperands('(t:elf or t:goblin')).toBe('(t:elf or t:goblin');
    expect(groupOrOperands('t:elf) or t:goblin')).toBe('t:elf) or t:goblin');
  });
});

describe('compileTemplateQuery', () => {
  it('compiles supported Scryfall syntax, including regex', () => {
    expect(compileTemplateQuery('keyword:persist t:creature')).not.toBeNull();
    expect(compileTemplateQuery('otag:man-land o:/^{T}: Add/ -o:"~ enters tapped"')).not.toBeNull();
    expect(compileTemplateQuery('t:artifact mv=0 -m<{0} -!"Leyline Axe"')).not.toBeNull();
  });

  it('returns null for missing or unsupported queries', () => {
    expect(compileTemplateQuery(null)).toBeNull();
    expect(compileTemplateQuery('')).toBeNull();
    expect(compileTemplateQuery('t:forest produces:U')).toBeNull();
  });

  it('accepts typographic apostrophes', () => {
    const filter = compileTemplateQuery('o:"can’t be countered"');
    const card = createCard({ details: createCardDetails({ oracle_text: "This spell can't be countered." }) });
    expect(filter!(card)).toBe(true);
  });
});

describe('matchComboRequirements', () => {
  const finks = creature('Kitchen Finks', ['Persist']);
  const seer = creature('Viscera Seer');
  const crusade = creature("Cathars' Crusade");

  it('finds the cube cards that fill each slot', () => {
    const [match] = matchComboRequirements(combo(['Viscera Seer'], [{ query: 'keyword:persist t:creature' }]), [
      finks,
      seer,
    ]);
    expect(match!.cards).toEqual([finks]);
  });

  it('is unmet when nothing in the cube fills a slot', () => {
    const matches = matchComboRequirements(combo(['Viscera Seer'], [{ query: 'keyword:persist t:creature' }]), [
      seer,
      crusade,
    ]);
    expect(matches[0]!.cards).toEqual([]);
    expect(requirementsAreMet(matches)).toBe(false);
  });

  it('does not let a card named by the combo fill its open slot', () => {
    const matches = matchComboRequirements(combo(['Kitchen Finks'], [{ query: 'keyword:persist' }]), [finks]);
    expect(requirementsAreMet(matches)).toBe(false);
  });

  it('counts distinct cards against the quantity required', () => {
    const otherFinks = creature('Kitchen Finks', ['Persist']);
    const redcap = creature('Murderous Redcap', ['Persist']);
    const twoPersist = combo([], [{ query: 'keyword:persist', quantity: 2 }]);
    expect(requirementsAreMet(matchComboRequirements(twoPersist, [finks, otherFinks]))).toBe(false);
    expect(requirementsAreMet(matchComboRequirements(twoPersist, [finks, redcap]))).toBe(true);
  });

  it('matches oracle text without reminder text, as Scryfall does', () => {
    const moor = createCard({
      details: createCardDetails({
        name: 'Barren Moor',
        oracle_id: 'Barren Moor',
        type: 'Land',
        oracle_text: 'This land enters tapped.\n{T}: Add {B}.\nCycling {B} ({B}, Discard this card: Draw a card.)',
      }),
    });
    const [match] = matchComboRequirements(combo([], [{ query: 'o:/^cycling (\\{1\\}|\\sc)$/ t:land' }]), [moor]);
    expect(match!.cards).toEqual([moor]);
  });

  it('treats a requirement it cannot check as met', () => {
    const matches = matchComboRequirements(combo([], [{ query: null }, { query: 't:forest produces:U' }]), [seer]);
    expect(matches.map((match) => match.cards)).toEqual([null, null]);
    expect(requirementsAreMet(matches)).toBe(true);
  });
});
