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

  rules.push(new Rule({ name: 'positiveHalfIntegerValue', definition: consumeRegex(/\d+(\.(0|5))?|\.(0|5)/) }));
  rules.push(new Rule({ name: 'halfIntegerValue', definition: consumeRegex(/-\d+|\d+(\.(0|5))?|\.(0|5)/) }));
  rules.push(new Rule({ name: 'integerValue', definition: consumeRegex(/\d+/) }));
  rules.push(new Rule({ name: 'dollarValue', definition: consumeRegex(/\$?\d+(\.\d\d?)?/) }));
  rules.push(new Rule({ name: 'finishValue', definition: consumeOneOf(['Foil', 'Non-foil']) }));
  rules.push(new Rule({ name: 'statusValue', definition: consumeOneOf(['Owned', 'Not Owned', 'Premium Owned']) }));
  rules.push(new Rule({ name: 'isValue', definition: consumeOneOf('gold', 'hybrid', 'phyrexian') }));
  rules.push(
    new Rule({
      name: 'colorCombinationValue',
      definition: [new RepetitionMandatory({ definition: consumeOneOf('WUBRGCwubrgc') })],
    }),
  );
  rules.push(
    new Rule({
      name: 'manaCostValue',
      definition: [
        new RepetitionMandatory({ definition: consumeRegex(/(\d|\{[WUBRGCPwubrgcp2](\/[WUBRGCPwubrgcp2])?\})+/) }),
      ],
    }),
  );
  rules.push(
    new Rule({
      name: 'setValue',
      definition: [
        new RepetitionMandatory({
          definition: consumeOneOf('abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'),
        }),
      ],
    }),
  );
  rules.push(
    new Rule({
      name: 'rarityValue',
      definition: consumeOneOf([
        'Mythic',
        'mythic',
        'm',
        'Common',
        'common',
        'c',
        'Rare',
        'rare',
        'r',
        'Uncommon',
        'uncommon',
        'u',
        'Special',
        'special',
        's',
      ]),
    }),
  );

  rules.push(createCondition('details.mana', ['m', 'mana'], ['=', ':'], 'manaCostValue'));
  rules.push(createCondition('cmc', ['cmc', 'cost'], ALL_OPERATORS, 'positiveHalfIntegerValue'));
  rules.push(createCondition('details.color', ['c', 'color'], ALL_OPERATORS, 'colorCombinationValue'));
  rules.push(createCondition('color', ['ci', 'id', 'identity'], ALL_OPERATORS, 'colorCombinationValue'));
  // rules.push(createCondition('type_line', ['t', 'type'], [':', '='], 'stringValue'));
  // rules.push(createCondition('details.oracle', ['o', 'oracle'], [':', '='], 'stringValue'));
  rules.push(createCondition('set', ['s', 'set'], ['=', ':'], 'setValue'));
  rules.push(createCondition('power', ['pow', 'power'], ALL_OPERATORS, 'halfIntegerValue'));
  rules.push(createCondition('toughness', ['tough', 'toughness'], ALL_OPERATORS, 'halfIntegerValue'));
  // rules.push(createCondition('tags', ['tag'], [':'], 'stringValue'));
  rules.push(createCondition('finish', ['fin', 'finish'], [':', '='], 'finishValue'));
  rules.push(createCondition('price', ['p', 'price'], ALL_OPERATORS, 'dollarValue'));
  rules.push(createCondition('details.price', ['np', 'pn', 'normal', 'normalprice'], ALL_OPERATORS, 'dollarValue'));
  rules.push(createCondition('details.foil_price', ['fp', 'pf', 'foil', 'foilprice'], ALL_OPERATORS, 'dollarValue'));
  rules.push(createCondition('status', ['stat', 'status'], ['=', ':'], 'statusValue'));
  rules.push(createCondition('details.rarity', ['r', 'rar', 'rarity'], ALL_OPERATORS, 'rarityValue'));
  rules.push(createCondition('details.loyalty', ['l', 'loy', 'loyal', 'loyalty'], ALL_OPERATORS, 'integerValue'));
  // rules.push(createCondition('details.artist', ['a', 'art', 'artist'], [':', '='], 'stringValue'));
  rules.push(createCondition('details.is', ['is'], [':'], 'isValue'));
  rules.push(createCondition('details.elo', ['elo'], ALL_OPERATORS, 'integerValue'));
  rules.push(createCondition('details.picks', ['picks'], ALL_OPERATORS, 'integerValue'));
  rules.push(createCondition('details.cubes', ['cubes'], ALL_OPERATORS, 'integerValue'));
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
        new Option({
          definition: [
            new NonTerminal({ nonTerminalName: 'condition' }),
            new Repetition({ definition: [...consumeRegex(/\s+/), new NonTerminal({ nonTerminalName: 'condition' })] }),
          ],
        }),
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
