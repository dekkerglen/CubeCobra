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

import { consumeWord, consumeRegex, tokenTypes } from 'parsing/parsingUtils';

const fieldsMap = {};
const conditions = [];

const createCondition = (field, abbrvRegex, operatorRegex, valueType) => {
  fieldsMap[abbrvRegex] = field;
  conditions.push(new NonTerminal( { nonTerminalName: `${field}Condition` }));
  return new Rule({
    name: `${field}Condition`,
    definition: [
      new Option({ definition: [...consumeWord('-')], name: '$negation' }),
      new Alternation({
        definition: [new Flat({ definition: consumeRegex(abbrvRegex), name: '$field' })],
        name: 'field',
      }),
      new Alternation({
        definition: [new Flat({ definition: consumeRegex(operatorRegex), name: '$operation' })],
        name: 'operation',
      }),
      new Alternation({
        definition: [new Flat({ definition: [new NonTerminal({ nonTerminalName: valueType })], name: '$value' })],
        name: 'value',
      }),
    ],
  });
};

export function getFilterParser() {
  const rules = [];

  rules.push(new Rule({ name: 'positiveHalfIntegerValue', definition: consumeRegex('\\d+(\\.(0|5))?|\\.(0|5)') }));
  rules.push(new Rule({ name: 'halfIntegerValue', definition: consumeRegex('-\\d+|\\d+(\\.(0|5))?|\\.(0|5)') }));

  rules.push(createCondition('cmc', 'c(mc)?', ':|=|<=?|>=?', 'positiveHalfIntegerValue', this));
  rules.push(createCondition('power', 'p(ow(er)?)?', ':|=|<=?|>=?', 'halfIntegerValue', this));
  rules.push(createCondition('toughness', 't(ough(ness)?)?', ':|=|<=?|>=?', 'halfIntegerValue', this));

  rules.push(
    new Rule({
      name: 'filter',
      definition: [
        new Repetition({
          definition: [
            new Alternation({ definition: conditions.map((c) => new Flat({ definition: [c] })) }),
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
    tokenTypes: Object.values(tokenTypes),
    grammarName: 'FilterParser',
  });

  console.log(rules);

  return generateParserFactory({
    name: 'FilterParser',
    rules,
    tokenVocabulary: Object.values(tokenTypes),
  })(Object.values(tokenTypes), { skipValidations: true });
}

const FilterParser = getFilterParser();

export default FilterParser;
