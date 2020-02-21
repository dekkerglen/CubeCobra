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

  rules.push(new Rule({ name: 'positiveHalfIntegerValue', definition: consumeRegex('\\d+(\\.(0|5))?|\\.(0|5)') }));
  rules.push(new Rule({ name: 'halfIntegerValue', definition: consumeRegex('-\\d+|\\d+(\\.(0|5))?|\\.(0|5)') }));

  rules.push(createCondition('cmc', ['c', 'cmc', 'cost'], ALL_OPERATORS, 'positiveHalfIntegerValue', this));
  rules.push(createCondition('power', ['p', 'pow', 'power'], ALL_OPERATORS, 'halfIntegerValue', this));
  rules.push(createCondition('toughness', ['t', 'tough', 'toughness'], ALL_OPERATORS, 'halfIntegerValue', this));

  rules.push(
    new Rule({
      name: 'filter',
      definition: [
        new Repetition({
          definition: [new Alternation({ definition: conditions.map((c) => new Flat({ definition: [c] })) })],
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
