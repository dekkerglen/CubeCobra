import {
  createTokenInstance,
  createToken,
  Alternation,
  EOF,
  Flat,
  Lexer,
  Option,
  Repetition,
  RepetitionMandatory,
  Terminal,
} from 'chevrotain';
import { RegExpParser, BaseRegExpVisitor } from 'regexp-to-ast';

const regexpParser = new RegExpParser();

export const TOKEN_TYPES = { EOF };

export function getOriginalString(ctx) {
  const tokens = [];
  for (const unorderedTokens of Object.values(ctx)) {
    tokens.push(...unorderedTokens);
  }
  tokens.sort((a, b) => a.startOffset - b.startOffset);
  return tokens.map((token) => token.image).join('');
}

const CATEGORIES = [];
export const CATEGORY_PREFIX = 'cat_';

function categoryToString(category) {
  const sorted = [...category].sort(
    (a, b) => (a.from === undefined ? a : a.from) - (b.from === undefined ? b : b.from),
  );
  return sorted.reduce((str, c) => `${str}_${c.from === undefined ? c : `${c.from}t${c.to}`}`, CATEGORY_PREFIX);
}

function findCategories(charCode) {
  const categories = [];
  for (const category of CATEGORIES) {
    let matches = true;
    for (const charRange of category) {
      if (charRange.from !== undefined) {
        if (charRange.from <= charCode && charCode <= charRange.to) {
          matches = false;
          break;
        }
      } else if (charRange === charCode) {
        matches = false;
        break;
      }
    }
    if (matches) {
      const name = categoryToString(category);
      if (TOKEN_TYPES[name]) {
        categories.push(TOKEN_TYPES(name));
      }
    }
  }
  return categories;
}

export const TOKEN_PREFIX = 'token_';

function getTokenType(c) {
  if (!TOKEN_TYPES[c]) {
    const charCode = c.charCodeAt();
    const categories = findCategories(charCode);
    const name = `${TOKEN_PREFIX}${charCode}`;
    if ('{}()[]?>*+-\\^$|'.includes(c)) {
      TOKEN_TYPES[c] = createToken({ name, pattern: new RegExp(`\\${c}`), label: c, categories });
    } else {
      TOKEN_TYPES[c] = createToken({ name, pattern: new RegExp(c), label: c, categories });
    }
  }
  return TOKEN_TYPES[c];
}

export function getCategory(ranges) {
  const name = categoryToString(ranges);
  if (!TOKEN_TYPES[name]) {
    CATEGORIES.push(ranges);
    TOKEN_TYPES[name] = createToken({ name, pattern: Lexer.IGNORE });
    for (const [tokenName, tokenType] of Object.entries(TOKEN_TYPES)) {
      if (tokenType.startsWith(TOKEN_PREFIX)) {
        const categories = findCategories(String.fromCharCode(tokenName.substring(TOKEN_PREFIX.length)));
        tokenType.CATEGORIES = categories;
      }
    }
  }
}

export function tokenize(input) {
  return Array.prototype.map.call(input, (c, i) => createTokenInstance(getTokenType(c), c, i, i, 1, 1, i, i));
}

export function consumeWord(word) {
  const terminals = Array.prototype.map.call(word, (c) => new Terminal({ terminalType: getTokenType(c) }));
  return terminals;
}

export function consumeOneOf(words) {
  const trie = {};
  for (const word of words) {
    let currentLevel = trie;
    for (const c of word) {
      if (!currentLevel[c]) {
        currentLevel[c] = {};
      }
      currentLevel = currentLevel[c];
    }
    currentLevel.EndWord = true;
  }

  const consumeTrie = (currentLevel, word) => {
    const keys = Object.keys(currentLevel);
    if (keys.length === 1) {
      const key = keys[0];
      if (key === 'EndWord') {
        return consumeWord(word);
      }
      return consumeTrie(currentLevel[key], word + key);
    }
    const alternation = new Alternation({
      definition: keys
        .filter((c) => c !== 'EndWord')
        .map((c) => new Flat({ definition: consumeTrie(currentLevel[c], c === 'EndWord' ? '' : c) })),
    });
    if (currentLevel.EndWord) {
      return [...consumeWord(word), new Option({ definition: [alternation] })];
    }
    return [...consumeWord(word), alternation];
  };

  return consumeTrie(trie, '');
}

function handleQuantifier(operations, quantifier) {
  if (!quantifier) {
    return operations;
  }
  if (quantifier.atLeast === 0 && quantifier.atMost === Infinity) {
    return [new Repetition({ definition: operations })];
  }
  if (quantifier.atLeast === 1 && quantifier.atMost === Infinity) {
    return [new RepetitionMandatory({ definition: operations })];
  }
  if (quantifier.atLeast === 0 && quantifier.atMost === 1) {
    return [new Option({ definition: operations })];
  }
  throw new Error(`Unsupported quantifier type ${quantifier}`);
}

class RegexpVisitor extends BaseRegExpVisitor {
  visitPattern(node) {
    return this.visitDisjunction(node.value);
  }

  visitDisjunction(node) {
    if (node.value.length === 1) {
      return this.visitAlternative(node.value[0]);
    }
    return [new Alternation({ definition: node.value.map((a) => new Flat({ definition: this.visitAlternative(a) })) })];
  }

  visitAlternative(node) {
    return node.value
      .filter((n) => n.type === 'Character' || n.type === 'Set' || n.type === 'Group')
      .reduce((operations, n) => operations.concat(this[`visit${n.type}`](n)), []);
  }

  // eslint-disable-next-line class-methods-use-this
  visitCharacter(node) {
    return handleQuantifier(consumeWord(String.fromCharCode(node.value)), node.quantifier);
  }

  // eslint-disable-next-line class-methods-use-this
  visitSet(node) {
    if (node.complement) {
      const tokenType = getCategory(node.value);
      return handleQuantifier([new Terminal({ terminalType: tokenType })]);
    }
    const charsInRanges = new Set();
    for (const charCode of node.value) {
      if (charCode.from !== undefined) {
        for (let c = charCode.from; c <= charCode.to; c++) {
          charsInRanges.add(c);
        }
      } else {
        charsInRanges.add(charCode);
      }
    }
    const charsList = [...charsInRanges].map((c) => String.fromCharCode(c));
    return handleQuantifier(
      [new Alternation({ definition: charsList.map((c) => new Flat({ definition: consumeWord(c) })) })],
      node.quantifier,
    );
  }

  visitGroup(node) {
    return handleQuantifier(this.visitDisjunction(node.value), node.quantifier);
  }
}

const regexpVisitor = new RegexpVisitor();

export function consumeRegex(regex) {
  const regexpAst = regexpParser.pattern(regex.toString());
  return regexpVisitor.visitPattern(regexpAst);
}

export default {
  CATEGORY_PREFIX,
  TOKEN_PREFIX,
  TOKEN_TYPES,
  consumeWord,
  consumeOneOf,
  consumeRegex,
  getCategory,
  getOriginalString,
  getTokenType,
  tokenize,
};
