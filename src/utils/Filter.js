import { normalizeName, propertyForCard } from './Card';
import { cardIsLabel } from './Sort';

const rarity_order = ['common', 'uncommon', 'rare', 'mythic'];

const categoryMap = new Map([
  ['m', 'mana'],
  ['mana', 'mana'],
  ['cmc', 'cmc'],
  ['c', 'color'],
  ['color', 'color'],
  ['ci', 'identity'],
  ['id', 'identity'],
  ['identity', 'identity'],
  ['t', 'type'],
  ['type', 'type'],
  ['o', 'oracle'],
  ['oracle', 'oracle'],
  ['s', 'set'],
  ['set', 'set'],
  ['pow', 'power'],
  ['power', 'power'],
  ['tou', 'toughness'],
  ['toughness', 'toughness'],
  ['name', 'name'],
  ['tag', 'tag'],
  ['finish', 'finish'],
  ['price', 'price'],
  ['pricefoil', 'pricefoil'],
  ['p', 'price'],
  ['pf', 'pricefoil'],
  ['status', 'status'],
  ['stat', 'status'],
  ['r', 'rarity'],
  ['rarity', 'rarity'],
  ['loy', 'loyalty'],
  ['loyalty', 'loyalty'],
  ['a', 'artist'],
  ['art', 'artist'],
  ['artist', 'artist'],
  ['is', 'is'],
  ['elo', 'elo'],
  ['picks', 'picks'],
  ['cubes', 'cubes'],
]);

const operators = ['>=', '<=', '<', '>', ':', '!=', '='];
export const operatorsRegex = new RegExp(`(?:${operators.join('|')})`);

function findEndingQuotePosition(filterText, num) {
  if (!num) {
    num = 1;
  }
  for (let i = 1; i < filterText.length; i++) {
    if (filterText[i] == '(') num++;
    else if (filterText[i] == ')') num--;
    if (num === 0) {
      return i;
    }
  }
  return false;
}

export function tokenizeInput(filterText, tokens) {
  filterText = filterText.trim().toLowerCase();
  if (!filterText) {
    return true;
  }

  // split string based on list of operators
  const operators_re = operatorsRegex;

  if (filterText.indexOf('(') == 0) {
    if (findEndingQuotePosition(filterText, 0)) {
      const token = {
        type: 'open',
      };
      tokens.push(token);
      return tokenizeInput(filterText.slice(1), tokens);
    }
    return false;
  }

  if (filterText.indexOf(')') == 0) {
    const token = {
      type: 'close',
    };
    tokens.push(token);
    return tokenizeInput(filterText.slice(1), tokens);
  }

  if (filterText.indexOf('or ') == 0 || (filterText.length == 2 && filterText.indexOf('or') == 0)) {
    tokens.push({
      type: 'or',
    });
    return tokenizeInput(filterText.slice(2), tokens);
  }

  if (filterText.indexOf('and ') == 0 || (filterText.length == 3 && filterText.indexOf('and') == 0)) {
    return tokenizeInput(filterText.slice(3), tokens);
  }

  const token = {
    type: 'token',
    not: false,
  };

  // find not
  if (filterText.indexOf('-') == 0) {
    token.not = true;
    filterText = filterText.slice(1);
  }

  const firstTerm = filterText.split(' ', 1);

  // find operand
  const operand = firstTerm[0].match(operators_re);
  if (operand) {
    token.operand = operand[0];
  } else {
    token.operand = 'none';
  }

  const quoteOp_re = new RegExp(`(?:${operators.join('|')})"`);
  let parens = false;

  // find category
  let category = '';
  if (token.operand == 'none') {
    category = 'name';
  } else {
    category = firstTerm[0].split(operators_re)[0];
  }

  // find arg value
  // if there are two quotes, and first char is quote
  if (filterText.indexOf('"') == 0 && filterText.split('"').length > 2) {
    // grab the quoted string, ignoring escaped quotes
    const quotes_re = new RegExp('"([^"\\\\]*(?:\\\\.[^"\\\\]*)*)"');
    // replace escaped quotes with plain quotes
    token.arg = filterText.match(quotes_re)[1];
    parens = true;
  } else if (firstTerm[0].search(quoteOp_re) > -1 && filterText.split('"').length > 2) {
    // check if there is a paren after an operator
    // TODO: make sure the closing paren isn't before the operator
    const quotes_re = new RegExp('"([^"\\\\]*(?:\\\\.[^"\\\\]*)*)"');
    token.arg = filterText.match(quotes_re)[1];
    parens = true;
  } else if (token.operand != 'none') {
    token.arg = firstTerm[0].slice(category.length + token.operand.length).split(')')[0];
  } else {
    token.arg = firstTerm[0].split(')')[0];
  }

  filterText = filterText.slice(
    (token.operand == 'none' ? token.arg.length : token.arg.length + token.operand.length + category.length) +
      (parens ? 2 : 0),
  );

  if (!categoryMap.has(category)) {
    return false;
  }

  token.category = categoryMap.get(category);
  token.arg = simplifyArg(token.arg, token.category);
  if (token.operand && token.category && token.arg) {
    // replace any escaped quotes with normal quotes
    if (parens && typeof token.arg === 'string') token.arg = token.arg.replace(/\\"/g, '"');
    tokens.push(token);
    return tokenizeInput(filterText, tokens);
  }
  return false;
}

const colorMap = new Map([
  ['white', 'w'],
  ['blue', 'u'],
  ['black', 'b'],
  ['red', 'r'],
  ['green', 'g'],
  ['colorless', 'c'],
  ['azorius', 'uw'],
  ['dimir', 'ub'],
  ['rakdos', 'rb'],
  ['gruul', 'rg'],
  ['selesnya', 'gw'],
  ['orzhov', 'bw'],
  ['izzet', 'ur'],
  ['golgari', 'gb'],
  ['boros', 'wr'],
  ['simic', 'ug'],
  ['bant', 'gwu'],
  ['esper', 'wub'],
  ['grixis', 'ubr'],
  ['jund', 'brg'],
  ['naya', 'rgw'],
  ['abzan', 'wbg'],
  ['jeskai', 'urw'],
  ['sultai', 'bgu'],
  ['mardu', 'rwb'],
  ['temur', 'rug'],
]);

const rarityMap = new Map([['c', 'common'], ['u', 'uncommon'], ['r', 'rare'], ['m', 'mythic']]);

// change arguments into their verifiable counteraprts, i.e. 'azorius' becomes 'uw'
function simplifyArg(arg, category) {
  let res = arg.toLowerCase();
  switch (category) {
    case 'color':
    case 'identity':
      res = colorMap.get(res) || res;
      res = res.toUpperCase().split('');
      break;
    case 'mana':
      res = parseManaCost(res);
      break;
    case 'rarity':
      res = rarityMap.get(res) || res;
      break;
  }
  return res;
}

export const verifyTokens = (tokens) => {
  const temp = tokens;
  const inBounds = (num) => {
    return num > -1 && num < temp.length;
  };
  const type = (i) => temp[i].type;
  const token = (i) => temp[i];

  for (let i = 0; i < temp.length; i++) {
    if (type(i) == 'open') {
      const closed = findClose(temp, i);
      if (!closed) return false;
      temp[closed].valid = true;
    }
    if (type(i) == 'close') {
      if (!temp[i].valid) return false;
    }
    if (type(i) == 'or') {
      if (!inBounds(i - 1) || !inBounds(i + 1)) return false;
      if (!(type(i - 1) == 'close' || type(i - 1) == 'token')) return false;
      if (!(type(i + 1) != 'open' || type(i + 1) != 'token')) return false;
    }
    if (type(i) == 'token') {
      switch (token(i).category) {
        case 'color':
        case 'identity':
          // can be a number (0-5) or color:
          const verifyColors = (element) => {
            return element.search(/^[WUBRGC012345]$/) < 0;
          };
          if (token(i).arg.every(verifyColors)) {
            return false;
          }
          break;
        case 'power':
        case 'toughness':
          if (token(i).arg.search(/^[-\+]?((\d+(\.5)?)|(\.5))$/) < 0) return false;
          break;
        case 'cmc':
          if (token(i).arg.search(/^\+?((\d+(\.5)?)|(\.5))$/) < 0) return false;
          break;
        case 'loyalty':
          if (token(i).arg.search(/^\d+$/) < 0) return false;
          break;
        case 'mana':
          const verifyMana = (element) => {
            element.search(/^(\d+|[wubrgscxyz]|{([wubrg2]\-[wubrg]|[wubrg]\-p)})$/) < 0;
          };
          if (token(i).arg.every(verifyMana)) {
            return false;
          }
          break;
        case 'rarity':
          if (token(i).arg.search(/^(common|uncommon|rare|mythic)$/) < 0) return false;
          break;
        case 'artist':
          break;
        case 'is':
          if (token(i).arg.search(/^(gold|hybrid|phyrexian)$/) < 0) return false;
          break;
      }
    }
  }
  return true;
};

const hybridMap = new Map([
  ['u-w', 'w-u'],
  ['b-w', 'w-b'],
  ['b-u', 'u-b'],
  ['r-u', 'u-r'],
  ['r-b', 'b-r'],
  ['g-b', 'b-g'],
  ['g-r', 'r-g'],
  ['w-r', 'r-w'],
  ['w-g', 'g-w'],
  ['u-g', 'g-u'],
]);

function parseManaCost(cost) {
  const res = [];
  for (let i = 0; i < cost.length; i++) {
    if (cost[i] == '{') {
      const str = cost.slice(i + 1, i + 4).toLowerCase();
      if (str.search(/[wubrg]\/p/) > -1) {
        res.push(`${cost[i + 1]}-p`);
        i += 4;
      } else if (str.search(/2\/[wubrg]/) > -1) {
        res.push(`2-${cost[i + 3]}`);
        i += 4;
      } else if (str.search(/[wubrg]\/[wubrg]/) > -1) {
        let symbol = `${cost[i + 1]}-${cost[i + 3]}`;
        if (hybridMap.has(symbol)) {
          symbol = hybridMap.get(symbol);
        }
        res.push(symbol);
        i += 4;
      } else if (str.search(/^[wubrgscxyz]}/) > -1) {
        res.push(cost[i + 1]);
        i += 2;
      } else if (str.search(/^[0-9]+}/) > -1) {
        const num = str.match(/[0-9]+/)[0];
        if (num.length <= 2) {
          res.push(num);
        }
        i = i + num.length + 1;
      }
    } else if (cost[i].search(/[wubrgscxyz]/) > -1) {
      res.push(cost[i]);
    } else if (cost[i].search(/[0-9]/) > -1) {
      const num = cost.slice(i).match(/[0-9]+/)[0];
      if (num.length <= 2) {
        res.push(num);
      } else {
        return false;
      }
    } else {
      return false;
    }
  }
  return res;
}

const findClose = (tokens, pos) => {
  if (!pos) pos = 0;
  let num = 1;
  for (let i = pos + 1; i < tokens.length; i++) {
    if (tokens[i].type == 'close') num--;
    else if (tokens[i].type == 'open') num++;
    if (num === 0) {
      return i;
    }
  }
  return false;
};

export const parseTokens = (tokens) => {
  const peek = () => tokens[0];
  const consume = peek;

  const result = [];
  if (peek().type == 'or') {
    return parseTokens(tokens.slice(1));
  }
  if (peek().type == 'open') {
    const end = findClose(tokens);
    if (end < tokens.length - 1 && tokens[end + 1].type == 'or') result.type = 'or';
    result.push(parseTokens(tokens.slice(1, end)));
    if (tokens.length > end + 1) result.push(parseTokens(tokens.slice(end + 1)));
    return result;
  }
  if (peek().type == 'token') {
    if (tokens.length == 1) {
      return consume();
    }
    if (tokens[1].type == 'or') result.type = 'or';
    result.push(consume());
    result.push(parseTokens(tokens.slice(1)));
    return result;
  }
};

/* inCube should be true when we are using a cube's card object and false otherwise (e.g. in Top Cards). */
export function filterCard(card, filters, inCube) {
  if (filters.length == 1) {
    if (filters[0].type == 'token') {
      return filterApply(card, filters[0], inCube);
    }
    return filterCard(card, filters[0], inCube);
  }
  if (filters.length === 0) {
    return true;
  }
  if (filters.type == 'or') {
    return (
      (filters[0].type == 'token' ? filterApply(card, filters[0], inCube) : filterCard(card, filters[0], inCube)) ||
      (filters[1].type == 'token' ? filterApply(card, filters[1], inCube) : filterCard(card, filters[1], inCube))
    );
  }
  return (
    (filters[0].type == 'token' ? filterApply(card, filters[0], inCube) : filterCard(card, filters[0], inCube)) &&
    (filters[1].type == 'token' ? filterApply(card, filters[1], inCube) : filterCard(card, filters[1], inCube))
  );
}

export function filterUses(filters, name) {
  if (Array.isArray(filters)) {
    if (filters.length === 0) {
      return true;
    } else if (filters.length === 1) {
      return filterUses(filters[0], name);
    } else {
      return filters.some((f) => filterUses(f, name));
    }
  }
  return filters.category === name;
}

export function filterCards(cards, filter, inCube) {
  return cards.filter((card) => filterCard(card, filter, inCube));
}

export function filterCardsDetails(cardsDetails, filter) {
  const cards = cardsDetails.map((details) => ({ details }));
  const filtered = filterCards(cards, filter, /* inCube */ false);
  return filtered.map((card) => propertyForCard(card, 'details'));
}

function areArraysEqualSets(a1, a2) {
  if (a1.length != a2.length) return false;
  const superSet = {};
  for (let i = 0; i < a1.length; i++) {
    const e = a1[i] + typeof a1[i];
    superSet[e] = 1;
  }

  for (let i = 0; i < a2.length; i++) {
    const e = a2[i] + typeof a2[i];
    if (!superSet[e]) {
      return false;
    }
    superSet[e] = 2;
  }

  for (const e in superSet) {
    if (superSet[e] === 1) {
      return false;
    }
  }

  return true;
}

function arrayContainsOtherArray(arr1, arr2) {
  return arr2.every((v) => arr1.includes(v));
}

function testNumeric(filter, value, arg) {
  switch (filter.operand) {
    case ':':
    case '=':
      return arg == value;
    case '<':
      return value < arg;
    case '>':
      return value > arg;
    case '<=':
      return value <= arg;
    case '>=':
      return value >= arg;
    default:
      return false;
  }
}

function testArray(filter, value) {
  switch (filter.operand) {
    case ':':
    case '=':
      return areArraysEqualSets(value, filter.arg);
    case '<':
      return arrayContainsOtherArray(filter.arg, value) && value.length < filter.arg.length;
    case '>':
      return arrayContainsOtherArray(value, filter.arg) && value.length > filter.arg.length;
    case '<=':
      return arrayContainsOtherArray(filter.arg, value);
    case '>=':
      return arrayContainsOtherArray(value, filter.arg);
    default:
      return false;
  }
}

function filterApply(card, filter, inCube) {
  let res = null;
  if (filter.operand === '!=') {
    filter.not = true;
    filter.operand = '=';
  }

  // handle cube overrides to colors
  if (typeof inCube === 'undefined') {
    inCube = true;
  }

  let cmc = propertyForCard(card, 'cmc');
  // NOTE: color naming is confusing:
  // colors = colors in mana cost
  // color_identity = (Commander style) colors anywhere on card
  // propertyForCard(card, 'colors') is an override for propertyForCard(card, 'color_identity')
  const color_identity = propertyForCard(card, 'color_identity');

  if (filter.category == 'name') {
    res = propertyForCard(card, 'name_lower').indexOf(normalizeName(filter.arg)) > -1;
  }
  if (filter.category == 'oracle' && propertyForCard(card, 'oracle_text')) {
    res =
      propertyForCard(card, 'oracle_text')
        .toLowerCase()
        .indexOf(filter.arg) > -1;
  }
  if (filter.category == 'color' && propertyForCard(card, 'colors') !== undefined) {
    const is_number = filter.arg.length == 1 && parseInt(filter.arg[0], 10) >= 0;
    if (!is_number) {
      if ([':', '='].includes(filter.operand) && filter.arg.length == 1 && filter.arg[0] == 'C') {
        res = propertyForCard(card, 'colors').length === 0;
      } else {
        res = testArray(filter, propertyForCard(card, 'colors'));
      }
    } else {
      // check for how many colors in identity
      const num_colors = propertyForCard(card, 'colors').length;
      const filter_num = parseInt(filter.arg[0], 10);
      res = testNumeric(filter, num_colors, filter_num);
    }
  }
  if (filter.category == 'identity' && color_identity !== undefined) {
    const is_number = filter.arg.length == 1 && parseInt(filter.arg[0], 10) >= 0;
    if (!is_number) {
      // handle args that are colors: e.g ci:wu, ci>wu
      const value = propertyForCard(card, 'colors') || propertyForCard(card, 'color_identity');
      if ([':', '='].includes(filter.operand) && filter.arg.length == 1 && filter.arg[0] == 'C') {
        res = value.length === 0;
      } else {
        res = testArray(filter, color_identity);
      }
    } else {
      // check for how many colors in identity
      const num_colors = color_identity.length;
      const filter_num = parseInt(filter.arg[0], 10);
      res = testNumeric(filter, num_colors, filter_num);
    }
  }
  if (filter.category == 'mana' && propertyForCard(card, 'parsed_cost')) {
    res = areArraysEqualSets(propertyForCard(card, 'parsed_cost'), filter.arg);
  }
  if (filter.category == 'cmc' && cmc !== undefined) {
    const arg = parseInt(filter.arg, 10);
    cmc = parseInt(cmc, 10);
    res = testNumeric(filter, cmc, arg);
  }
  const typeLine = propertyForCard(card, 'type_line');
  if (filter.category == 'type' && propertyForCard(card, 'type_line')) {
    if (
      propertyForCard(card, 'type_line')
        .toLowerCase()
        .includes(filter.arg.toLowerCase())
    ) {
      res = true;
    }
  }
  if (filter.category == 'set' && propertyForCard(card, 'set')) {
    if (
      propertyForCard(card, 'set')
        .toLowerCase()
        .indexOf(filter.arg.toLowerCase()) > -1
    ) {
      res = true;
    }
  }
  if (filter.category == 'power') {
    if (propertyForCard(card, 'power')) {
      const cardPower = parseInt(propertyForCard(card, 'power'), 10);
      const arg = parseInt(filter.arg, 10);
      res = testNumeric(filter, cardPower, arg);
    }
  }
  if (filter.category == 'toughness') {
    if (propertyForCard(card, 'toughness')) {
      const cardToughness = parseInt(propertyForCard(card, 'toughness'), 10);
      const arg = parseInt(filter.arg, 10);
      res = testNumeric(filter, cardToughness, arg);
    }
  }
  if (filter.category == 'loyalty') {
    if (propertyForCard(card, 'loyalty')) {
      const cardLoyalty = parseInt(propertyForCard(card, 'loyalty'), 10);
      const arg = parseInt(filter.arg, 10);
      res = testNumeric(filter, cardLoyalty, arg);
    }
  }
  if (filter.category == 'tag') {
    res =
      propertyForCard(card, 'tags') &&
      propertyForCard(card, 'tags').some((element) => {
        return element.toLowerCase() == filter.arg.toLowerCase();
      });
  }
  if (filter.category == 'finish') {
    res = propertyForCard(card, 'finish') && propertyForCard(card, 'finish').toLowerCase() === filter.arg.toLowerCase();
  }
  if (filter.category == 'status') {
    res = propertyForCard(card, 'status') && propertyForCard(card, 'status').toLowerCase() == filter.arg.toLowerCase();
  }

  if (filter.category == 'price') {
    if (propertyForCard(card, 'price') === null && propertyForCard(card, 'price_foil') === null) {
      // couldn't find price info, so no price available. return false.
      res = false;
    } else if (
      !Number.isFinite(propertyForCard(card, 'price')) &&
      !Number.isFinite(propertyForCard(card, 'price_foil'))
    ) {
      // never added, so can't filter on this basis - return true.
      res = true;
    } else {
      const price = propertyForCard(card, 'price') || propertyForCard(card, 'price_foil');
      const arg = parseFloat(filter.arg, 10);
      res = testNumeric(filter, price, arg);
    }
  }
  if (filter.category == 'pricefoil') {
    if (propertyForCard(card, 'price_foil') === null) {
      res = false;
    } else if (!Number.isFinite(propertyForCard(card, 'price_foil'))) {
      const arg = parseFloat(filter.arg, 10);
      res = testNumeric(filter, propertyForCard(card, 'price_foil'), arg);
    } else {
      res = true;
    }
  }
  if (filter.category == 'rarity') {
    const { rarity } = propertyForCard(card, 'details');
    const rarityNum = rarity_order.indexOf(rarity);
    const argNum = rarity_order.indexOf(filter.arg);
    res = testNumeric(filter, rarityNum, argNum);
  }
  if (filter.category == 'artist') {
    res =
      propertyForCard(card, 'artist')
        .toLowerCase()
        .indexOf(filter.arg.toLowerCase()) > -1;
  }
  if (filter.category == 'elo') {
    if (propertyForCard(card, 'elo') === undefined) {
      res = true;
    } else if (propertyForCard(card, 'elo') === null) {
      res = false;
    } else if (Number.isFinite(propertyForCard(card, 'elo'))) {
      const arg = parseInt(filter.arg, 10);
      res = testNumeric(filter, propertyForCard(card, 'elo'), arg);
    }
  }
  if (filter.category == 'picks') {
    if (propertyForCard(card, 'picks') === undefined) {
      res = true;
    } else if (propertyForCard(card, 'picks') === null) {
      res = false;
    } else if (Number.isFinite(propertyForCard(card, 'picks'))) {
      const arg = parseInt(filter.arg, 10);
      res = testNumeric(filter, propertyForCard(card, 'picks'), arg);
    }
  }
  if (filter.category == 'cubes') {
    if (propertyForCard(card, 'cubes') === undefined) {
      res = true;
    } else if (propertyForCard(card, 'cubes') === null) {
      res = false;
    } else if (Number.isFinite(propertyForCard(card, 'cubes'))) {
      const arg = parseInt(filter.arg, 10);
      res = testNumeric(filter, propertyForCard(card, 'cubes'), arg);
    }
  }
  if (filter.category == 'is') {
    switch (filter.arg) {
      case 'gold':
      case 'hybrid':
      case 'phyrexian':
        const type = filter.arg.substring(0, 1).toUpperCase() + filter.arg.substring(1);
        res = cardIsLabel(card, type, 'Manacost Type');
        break;
    }
  }

  if (filter.not) {
    return !res;
  }
  return res;
}

export function filterToString(filters) {
  if (Array.isArray(filters) && Array.isArray(filters[0])) {
    return filterToString(filters[0]);
  }
  const s = [];
  let f;
  let arg;
  let operand;
  for (let i = 0; i < filters.length; i++) {
    f = filters[i];
    if (f.type == 'token') {
      arg = f.arg;
      if (Array.isArray(arg)) {
        arg = arg.join('');
      }
      operand = f.operand;
      if (f.not) {
        operand = `!${operand}`;
      }
      s.push(f.category + operand + arg);
    }
  }

  let sep = ' and ';
  if (filters.type) {
    if (filters.type == 'or') {
      sep = ' or ';
    }
  }

  return s.join(sep);
}

export function makeFilter(filterText) {
  if (!filterText || filterText.trim() === '') {
    return {
      err: false,
      filter: [],
    };
  }

  const tokens = [];
  const valid = tokenizeInput(filterText, tokens) && verifyTokens(tokens);

  return {
    err: !valid,
    filter: valid ? [parseTokens(tokens)] : [],
  };
}

export default {
  operators,
  operatorsRegex,
  tokenizeInput,
  verifyTokens,
  parseTokens,
  filterCard,
  filterCards,
  filterCardsDetails,
  filterUses,
  filterToString,
  makeFilter,
};
