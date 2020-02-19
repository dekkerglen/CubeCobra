import {
  createTokenInstance,
  createToken,
  Alternation,
  Flat,
  Option,
  Repetition,
  RepetitionMandatory,
  Terminal,
} from 'chevrotain';

export const tokenTypes = {};

export function getTokenType(c) {
  if (!tokenTypes[c]) {
    if ('{}()[]?>*+-\\^$|'.includes(c)) {
      tokenTypes[c] = createToken({ name: `token_${c.charCodeAt()}`, pattern: new RegExp(`\\${c}`) });
    } else {
      tokenTypes[c] = createToken({ name: `token_${c.charCodeAt()}`, pattern: new RegExp(c) });
    }
  }
  return tokenTypes[c];
}

export function tokenize(input) {
  return Array.prototype.map.call(input, (c, i) => createTokenInstance(getTokenType(c), c, i, i, 1, 1, i, i));
}

export function consumeWord(word) {
  const terminals = Array.prototype.map.call(word, (c) => new Terminal({ terminalType: getTokenType(c) }));
  return terminals;
}

export function consumeOneOf(words) {
  return new Alternation({
    definition: Array.prototype.map.call(words, (w) => new Flat({ definition: consumeWord(w) })),
  });
}

export function consumeLetter() {
  return consumeOneOf('abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ');
}

export function consumeNumber() {
  return consumeOneOf('1234567890');
}

// Prepopulate the tokenTypes cache.
consumeLetter();
consumeNumber();
consumeOneOf('{}()[]?<>*+-\\^$|:= ');

// Requires the left hand side of alternation(|) be wrapped in parentheses
export function consumeRegex(regex) {
  const consumeRegexInternal = (startIndex, inGroup) => {
    let lastGroup = null;
    let operations = [];
    let internalCall = null;
    for (let i = startIndex; i < regex.length; i++) {
      switch (regex[i]) {
        case '(':
          internalCall = consumeRegexInternal(i + 1, true);
          lastGroup = internalCall.operations;
          i = internalCall.endIndex;
          break;
        case ')':
          if (inGroup) {
            if (lastGroup) {
              operations.push(...lastGroup);
              lastGroup = null;
            }
            return { endIndex: i, operations };
          }
          throw new Error(`No matching open parentheses for closed paren at ${i} in "${regex}"`);
        case '*':
          if (lastGroup !== null) {
            operations.push(new Repetition({ definition: lastGroup }));
            lastGroup = null;
          } else if (operations.length > 0) {
            operations[operations.length - 1] = new Repetition({ definition: [operations[operations.length - 1]] });
          } else {
            throw new Error(`Nothing to repeat for * in "${regex}" at position ${i}`);
          }
          break;
        case '+':
          if (lastGroup !== null) {
            operations.push(new RepetitionMandatory({ definition: lastGroup }));
            lastGroup = null;
          } else if (operations.length > 0) {
            operations[operations.length - 1] = new RepetitionMandatory({
              definition: [operations[operations.length - 1]],
            });
          } else {
            throw new Error(`Nothing to repeat for + in "${regex}" at position ${i}`);
          }
          break;
        case '?':
          if (lastGroup !== null) {
            operations.push(new Option({ definition: lastGroup }));
            lastGroup = null;
          } else if (operations.length > 0) {
            operations[operations.length - 1] = new Option({ definition: [operations[operations.length - 1]] });
          } else {
            throw new Error(`Nothing to repeat for * in "${regex}" at position ${i}`);
          }
          break;
        case '|':
          if (lastGroup) {
            operations.push(...lastGroup);
            lastGroup = null;
          }
          if (operations.length === 0) {
            throw new Error(`Nothing to alternate for | in "${regex}" at position ${i}`);
          }
          internalCall = consumeRegexInternal(i + 1, inGroup);
          operations = [
            new Alternation({
              definition: [
                new Flat({ definition: [...operations] }),
                new Flat({ definition: internalCall.operations }),
              ],
            }),
          ];
          i = internalCall.endIndex;
          if (i < regex.length && regex[i] === ')') {
            i -= 1;
          }
          break;
        case '\\':
          if (regex.length <= i + 1) {
            throw new Error(`\\ is not escaping anything in "${regex}" at position ${i}`);
          }
          if (lastGroup !== null) {
            operations.push(...lastGroup);
            lastGroup = null;
          }
          switch (regex[i + 1]) {
            case 'a':
              operations.push(consumeLetter());
              break;
            case 'd':
              operations.push(consumeNumber());
              break;
            case '(':
            case ')':
            case '*':
            case '+':
            case '|':
            case '\\':
            case '.':
              operations.push(new Terminal({ terminalType: getTokenType(regex[i + 1]) }));
              break;
            default:
              throw new Error(`Invalid escape sequence in "${regex}" at position ${i}`);
          }
          i += 1;
          break;
        default:
          if (lastGroup !== null) {
            operations.push(...lastGroup);
            lastGroup = null;
          }
          operations.push(new Terminal({ terminalType: getTokenType(regex[i]) }));
          break;
      }
    }
    if (inGroup) {
      throw new Error(`Unterminated paren in "${regex}"`);
    }
    if (lastGroup) {
      operations.push(...lastGroup);
    }
    if (operations.length === 0) {
      throw new Error(`No group found to consume in ${regex}`);
    }
    return { endIndex: regex.length, operations };
  };

  const { operations } = consumeRegexInternal(0, false);
  return operations;
}

export default {
  getTokenType,
  tokenize,
  consumeWord,
  consumeOneOf,
  consumeLetter,
  consumeNumber,
  consumeRegex,
  tokenTypes,
};
