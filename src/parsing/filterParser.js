import { assignOccurrenceIndices, generateParserFactory, resolveGrammar, validateGrammar, Alternation, Flat, NonTerminal, Option, Repetition, Rule } from 'chevrotain';

import { consumeWord, consumeRegex, tokenTypes } from 'parsing/parsingUtils';

const fieldsMap = {};

const createCondition = (field, abbrvRegex, operatorRegex, valueType) => {
  fieldsMap[abbrvRegex] = field
  return new Flat({
    definition: [
      new Alternation({definition: [new Flat({ definition: consumeRegex(abbrvRegex), name: '$field' })], name: 'field' }),
      new Alternation({definition: [new Flat({ definition: consumeRegex(operatorRegex), name: '$operation' })], name: 'operation' }),
      new Alternation({definition: [new Flat({ definition: [new NonTerminal({ nonTerminalName: valueType })], name: '$value' })], name: 'value' }),
    ],
  });
}

export function getFilterParser() {
  const rules = [];
  const conditions = [];
  
  rules.push(new Rule({ name: 'halfPositiveIntegerValue', definition: consumeRegex("-\\d+|\\d+(\\.(0|5))?|\\.(0|5)") }));
  
  conditions.push(createCondition(
    'cmc',
    'c(ost|mc)',
    ':|=|<=?|>=?',
    'halfPositiveIntegerValue',
    this
  ));
  
  rules.push(new Rule({
    name: 'filter',
    definition: [new Repetition({
      definition: [
        new Option({ definition: [...consumeWord('-')], name: '$negation' }),
        new Alternation({ definition: conditions }),
      ],
      name: '$condition'
    })],
  }));
  
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
    tokenVocabulary: Object.values(tokenTypes)
  })(Object.values(tokenTypes), { skipValidations: true });
}
export default getFilterParser;

// HalfPositiveIntegerValue
// this.OR(
//   [
//     {
//       ALT: () => {
//         this.AT_LEAST_ONE(() => number(this), { LABEL: 'integer' });
//         this.OPTION(() => {
//           this.OR(
//             [
//               { ALT: () => consumeWord('.5') },
//               { ALT: () => consumeWord('.0') }
//             ],
//             { NAME: 'fraction' }
//           );
//         });
//       }
//     },
//     {
//       ALT: () => {
//         this.OR(
//           [
//             { ALT: () => consumeWord('.5') },
//             { ALT: () => consumeWord('.0') }
//           ],
//           { NAME: 'fraction' }
//         );
//       }
//     },
//   ],
//   { NAME: 'value' }
// );
