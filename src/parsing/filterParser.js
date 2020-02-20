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

const createCondition = (field, abbrvRegex, operatorRegex, valueType) => {
  fieldsMap[abbrvRegex] = field;
  return new Flat({
    definition: [
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
  const conditions = [];

  rules.push(new Rule({ name: 'positiveHalfIntegerValue', definition: consumeRegex('\\d+(\\.(0|5))?|\\.(0|5)') }));

  conditions.push(createCondition('cmc', 'cmc', ':|=|<=?|>=?', 'positiveHalfIntegerValue', this));

  rules.push(
    new Rule({
      name: 'filter',
      definition: [
        new Repetition({
          definition: [
            new Option({ definition: [...consumeWord('-')], name: '$negation' }),
            new Alternation({ definition: conditions }),
          ],
          name: '$condition',
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

  return generateParserFactory({
    name: 'FilterParser',
    rules,
    tokenVocabulary: Object.values(tokenTypes),
  })(Object.values(tokenTypes), { skipValidations: true });
}

export default getFilterParser;
