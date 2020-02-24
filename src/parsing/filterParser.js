import {
  assignOccurrenceIndices,
  generateParserFactory,
  resolveGrammar,
  validateGrammar,
  Alternation,
  EOF,
  Flat,
  NonTerminal,
  Option,
  Repetition,
  RepetitionMandatory,
  Rule,
  Terminal,
} from 'chevrotain';

import { TOKEN_TYPES, consumeOneOf, consumeRegex, consumeWord } from 'parsing/parsingHelpers';

export const FIELDS_MAP = {};

export const COLOR_COMBINATIONS = {
  colorless: '',
  white: 'w',
  blue: 'u',
  black: 'b',
  red: 'r',
  green: 'g',
  azorious: 'wu',
  dimir: 'ub',
  rakdos: 'br',
  gruul: 'rg',
  selesnya: 'gw',
  orzhov: 'wb',
  izzet: 'ur',
  golgari: 'bg',
  boros: 'rw',
  simic: 'gu',
  bant: 'gwu',
  esper: 'wub',
  grixis: 'ubr',
  jund: 'brg',
  naya: 'rgw',
  mardu: 'bwr',
  temur: 'rug',
  abzan: 'gbw',
  jeskai: 'wru',
  sultai: 'ugb',
};

const ALL_OPERATORS = [':', '=', '<', '<=', '>', '>='];

export function getFilterParser() {
  const conditions = [];

  const createCondition = (field, abbrvs, operators, valueType) => {
    for (const abbrv of abbrvs) {
      if (FIELDS_MAP[abbrv] && FIELDS_MAP[abbrv] !== field) {
        throw new Error(`Trying to map multiple fields (${FIELDS_MAP[abbrv]} and ${field}) to abbreviation ${abbrv}`);
      }
      FIELDS_MAP[abbrv] = field;
    }
    const sanitizedField = field.replace(/\./g, '_');
    conditions.push(new NonTerminal({ nonTerminalName: `${sanitizedField}Condition` }));
    // An optional - followed by one of the abbrvs, one of the operators, and a value.
    return new Rule({
      name: `${sanitizedField}Condition`,
      definition: [
        new Option({ definition: [...consumeWord('-')], name: '$negation' }),
        new Alternation({
          definition: [new Flat({ definition: consumeOneOf(abbrvs), name: '$field' })],
          name: 'field',
        }),
        new Alternation({
          definition: [new Flat({ definition: consumeOneOf(operators), name: '$operator' })],
          name: 'operator',
        }),
        new Alternation({
          definition: [new Flat({ definition: [new NonTerminal({ nonTerminalName: valueType })], name: '$value' })],
          name: 'value',
        }),
      ],
    });
  };
  const rules = [];

  // A non-negative integer that can also end with .0 or .5 in which case the integer part is optional.
  rules.push(new Rule({ name: 'positiveHalfIntegerValue', definition: consumeRegex(/\d+(\.(0|5))?|\.(0|5)/) }));
  // Same but allowing for pure integers to be negative
  rules.push(new Rule({ name: 'halfIntegerValue', definition: consumeRegex(/-\d+|\d+(\.(0|5))?|\.(0|5)/) }));
  // A simple integer (series of digits).
  rules.push(new Rule({ name: 'integerValue', definition: consumeRegex(/\d+/) }));
  // An optional $ followed by an integer an optional . followed by one or two more digits.
  rules.push(new Rule({ name: 'dollarValue', definition: consumeRegex(/\$?\d+(\.\d\d?)?/) }));
  // foil or non-foil. We assume the input string is lowercase.
  rules.push(new Rule({ name: 'finishValue', definition: consumeOneOf(['foil', 'non-foil']) }));
  // either gold, hybrid, or phyrexian.
  rules.push(new Rule({ name: 'isValue', definition: consumeOneOf('gold', 'hybrid', 'phyrexian') }));
  // either owned, 'not owned', or 'premium owned' and can use double quotes.
  rules.push(
    new Rule({
      name: 'statusValue',
      definition: consumeOneOf(['owned', '"not owned"', "'not owned'", '"premium owned"', "'premium owned'"]),
    }),
  );
  // common, uncommon, rare, mythic, special or their starting character.
  rules.push(
    new Rule({
      name: 'rarityValue',
      definition: consumeOneOf(['mythic', 'm', 'common', 'c', 'rare', 'r', 'uncommon', 'u', 'special', 's']),
    }),
  );
  // integer followed by some number of a color, 2, or p, optionally followed by / and another one wrapped in curly brackets.
  rules.push(
    new Rule({
      name: 'manaCostValue',
      definition: [new RepetitionMandatory({ definition: consumeRegex(/(\d|\{[wubrgcp2](\/[wubrgcp2])?\})+/) })],
    }),
  );
  // String literal. Allows whitespace if wrapped in quotes. Only allowed escape sequences are \' \" and \n
  rules.push(
    new Rule({
      name: 'stringValue',
      definition: consumeRegex(/[^"'\s][^\s]*|"([^"\\]|\\['n"])*"|'([^'\\]|\\['n"])*'/),
    }),
  );
  // alphanumeric sequence
  rules.push(
    new Rule({
      name: 'setValue',
      definition: [new RepetitionMandatory({ definition: consumeOneOf('abcdefghijklmnopqrstuvwxyz') })],
    }),
  );
  // repetition of color letters or a color combination as defined in COLOR_COMBINATIONS.
  rules.push(
    new Rule({
      name: 'colorCombinationValue',
      definition: [
        new Alternation({
          definition: [
            new RepetitionMandatory({ definition: consumeOneOf('wubrgc') }),
            new Flat({ definition: consumeOneOf(Object.keys(COLOR_COMBINATIONS)) }),
          ],
        }),
      ],
    }),
  );

  rules.push(createCondition('details.mana', ['m', 'mana'], ['=', ':'], 'manaCostValue'));
  rules.push(createCondition('cmc', ['cmc', 'cost'], ALL_OPERATORS, 'positiveHalfIntegerValue'));
  rules.push(createCondition('details.color', ['c', 'color'], ALL_OPERATORS, 'colorCombinationValue'));
  rules.push(createCondition('color', ['ci', 'id', 'identity'], ALL_OPERATORS, 'colorCombinationValue'));
  rules.push(createCondition('type_line', ['t', 'type'], [':', '='], 'stringValue'));
  rules.push(createCondition('details.oracle', ['o', 'oracle'], [':', '='], 'stringValue'));
  rules.push(createCondition('set', ['s', 'set'], ['=', ':'], 'setValue'));
  rules.push(createCondition('power', ['pow', 'power'], ALL_OPERATORS, 'halfIntegerValue'));
  rules.push(createCondition('toughness', ['tough', 'toughness'], ALL_OPERATORS, 'halfIntegerValue'));
  rules.push(createCondition('tags', ['tag'], [':'], 'stringValue'));
  rules.push(createCondition('finish', ['fin', 'finish'], [':', '='], 'finishValue'));
  rules.push(createCondition('price', ['p', 'price'], ALL_OPERATORS, 'dollarValue'));
  rules.push(createCondition('details.price', ['np', 'pn', 'normal', 'normalprice'], ALL_OPERATORS, 'dollarValue'));
  rules.push(createCondition('details.foil_price', ['fp', 'pf', 'foil', 'foilprice'], ALL_OPERATORS, 'dollarValue'));
  rules.push(createCondition('status', ['stat', 'status'], ['=', ':'], 'statusValue'));
  rules.push(createCondition('details.rarity', ['r', 'rar', 'rarity'], ALL_OPERATORS, 'rarityValue'));
  rules.push(createCondition('details.loyalty', ['l', 'loy', 'loyal', 'loyalty'], ALL_OPERATORS, 'integerValue'));
  rules.push(createCondition('details.artist', ['a', 'art', 'artist'], [':', '='], 'stringValue'));
  rules.push(createCondition('details', ['is'], [':'], 'isValue'));
  rules.push(createCondition('details.elo', ['elo'], ALL_OPERATORS, 'integerValue'));
  rules.push(createCondition('details.picks', ['picks'], ALL_OPERATORS, 'integerValue'));
  rules.push(createCondition('details.cubes', ['cubes'], ALL_OPERATORS, 'integerValue'));

  // One of the above defined conditions.
  rules.push(
    new Rule({
      name: 'condition',
      definition: [new Alternation({ definition: conditions.map((c) => new Flat({ definition: [c] })) })],
    }),
  );
  rules.push(
    new Rule({
      name: 'filter',
      definition: [
        // A condition followed by one or more conditions separated by whitespace.
        // Assumes string is trimmed at ends.
        new Option({
          definition: [
            new NonTerminal({ nonTerminalName: 'condition' }),
            new Repetition({ definition: [...consumeRegex(/\s+/), new NonTerminal({ nonTerminalName: 'condition' })] }),
          ],
        }),
        // Guarantee we consume the whole string.
        new Terminal({ terminalType: EOF }),
      ],
    }),
  );

  assignOccurrenceIndices({ rules });
  resolveGrammar({ rules });
  validateGrammar({
    rules,
    tokenTypes: Object.values(TOKEN_TYPES),
    grammarName: 'FilterParser',
  });

  return generateParserFactory({
    name: 'FilterParser',
    rules,
    tokenVocabulary: Object.values(TOKEN_TYPES),
  })(Object.values(TOKEN_TYPES), { skipValidations: true });
}

const FilterParser = getFilterParser();

export default FilterParser;
