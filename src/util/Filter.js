let rarity_order = ['common', 'uncommon', 'rare', 'mythic'];

let categoryMap = new Map([
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
  ['pow', 'power'],
  ['power', 'power'],
  ['tou', 'toughness'],
  ['toughness', 'toughness'],
  ['name', 'name'],
  ['tag', 'tag'],
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
]);

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

function tokenizeInput(filterText, tokens) {
  filterText = filterText.trim();
  if (!filterText) {
    return true;
  }

  const operators = '>=|<=|<|>|:|='
  //split string based on list of operators
  let operators_re = new RegExp('(?:' + operators + ')');

  if (filterText.indexOf('(') == 0) {
    if (findEndingQuotePosition(filterText, 0)) {
      let token = {
        type: 'open',
      }
      tokens.push(token);
      return tokenizeInput(filterText.slice(1), tokens);
    } else {
      return false;
    }
  }

  if (filterText.indexOf(')') == 0) {
    let token = {
      type: 'close'
    }
    tokens.push(token);
    return tokenizeInput(filterText.slice(1), tokens);
  }

  if (filterText.indexOf('or ') == 0 || (filterText.length == 2 && filterText.indexOf('or') == 0)) {
    tokens.push({
      type: 'or'
    });
    return tokenizeInput(filterText.slice(2), tokens);
  }

  if (filterText.indexOf('and ') == 0 || (filterText.length == 3 && filterText.indexOf('and') == 0)) {
    return tokenizeInput(filterText.slice(3), tokens);
  }

  let token = {
    type: 'token',
    not: false,
  };

  //find not
  if (filterText.indexOf('-') == 0) {
    token.not = true;
    filterText = filterText.slice(1);
  }

  let firstTerm = filterText.split(' ', 1);

  //find operand
  let operand = firstTerm[0].match(operators_re);
  if (operand) {
    operand = operand[0];
    token.operand = operand;
  } else {
    token.operand = 'none';
  }

  let quoteOp_re = new RegExp('(?:' + operators + ')"');
  let parens = false;

  //find category
  let category = '';
  if (token.operand == 'none') {
    category = 'name';
  } else {
    category = firstTerm[0].split(operators_re)[0];
  }

  //find arg value
  //if there are two quotes, and first char is quote
  if (filterText.indexOf('"') == 0 && filterText.split('"').length > 2) {
    //grab the quoted string, ignoring escaped quotes
    let quotes_re = new RegExp('"([^"\\\\]*(?:\\\\.[^"\\\\]*)*)"');
    //replace escaped quotes with plain quotes
    token.arg = filterText.match(quotes_re)[1];
    parens = true;
  } else if (firstTerm[0].search(quoteOp_re) > -1 && filterText.split('"').length > 2) {
    //check if there is a paren after an operator
    //TODO: make sure the closing paren isn't before the operator
    let quotes_re = new RegExp('"([^"\\\\]*(?:\\\\.[^"\\\\]*)*)"');
    token.arg = filterText.match(quotes_re)[1];
    parens = true;
  } else if (token.operand != 'none') {
    token.arg = firstTerm[0].slice(category.length + token.operand.length).split(')')[0];
  } else {
    token.arg = firstTerm[0].split(')')[0];
  }


  filterText = filterText.slice((token.operand == 'none' ? (token.arg.length) : (token.arg.length + token.operand.length + category.length)) + (parens ? 2 : 0));

  if (!categoryMap.has(category)) {
    return false;
  }


  token.category = categoryMap.get(category);
  token.arg = simplifyArg(token.arg, token.category);
  if (token.operand && token.category && token.arg) {
    //replace any escaped quotes with normal quotes
    if (parens) token.arg = token.arg.replace(/\\"/g, '"');
    tokens.push(token);
    return tokenizeInput(filterText, tokens);
  } else {
    return false;
  }

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
  ['temur', 'rug']
]);

//change arguments into their verifiable counteraprts, i.e. 'azorius' becomes 'uw'
function simplifyArg(arg, category) {
  let res = '';
  switch (category) {
    case 'color':
    case 'identity':
      if (colorMap.has(arg)) {
        res = colorMap.get(arg);
      } else {
        res = arg;
      }
      res = res.split('').map((element) => element.toUpperCase());
      break;
    case 'mana':
      res = parseManaCost(arg)
      break;
    default:
      res = arg;
      break;
  }
  return res;
}

const verifyTokens = (tokens) => {
  let temp = tokens;
  let inBounds = (num) => {
    return num > -1 && num < temp.length;
  }
  let type = (i) => temp[i].type;
  let token = (i) => temp[i];

  for (let i = 0; i < temp.length; i++) {
    if (type(i) == 'open') {
      let closed = findClose(temp, i);
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
          let verifyColors = (element) => {
            return element.search(/^[WUBRGC]$/) < 0;
          }
          if (token(i).arg.every(verifyColors)) {
            return false;
          }
          break;
        case 'cmc':
        case 'power':
        case 'toughness':
        case 'loyalty':
          if (token(i).arg.search(/^\d+$/) < 0) return false;
          break;
        case 'mana':
          let verifyMana = (element) => {
            element.search(/^(\d+|[wubrgscxyz]|{([wubrg2]\-[wubrg]|[wubrg]\-p)})$/) < 0;
          }
          if (token(i).arg.every(verifyMana)) {
            return false;
          }
          break;
        case 'rarity':
          if (token(i).arg.search(/^(common|uncommon|rare|mythic)$/) < 0) return false;
          break;
      }
    }

  }
  return true;
}

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
  ['u-g', 'g-u']
]);

function parseManaCost(cost) {
  let res = [];
  for (let i = 0; i < cost.length; i++) {
    if (cost[i] == '{') {
      let str = cost.slice(i + 1, i + 4).toLowerCase();
      if (str.search(/[wubrg]\/p/) > -1) {
        res.push(cost[i + 1] + '-p');
        i = i + 4;
      } else if (str.search(/2\/[wubrg]/) > -1) {
        res.push('2-' + cost[i + 3]);
        i = i + 4;
      } else if (str.search(/[wubrg]\/[wubrg]/) > -1) {
        let symbol = cost[i + 1] + '-' + cost[i + 3];
        if (hybridMap.has(symbol)) {
          symbol = hybridMap.get(symbol);
        }
        res.push(symbol);
        i = i + 4;
      } else if (str.search(/^[wubrgscxyz]}/) > -1) {
        res.push(cost[i + 1]);
        i = i + 2;
      } else if (str.search(/^[0-9]+}/) > -1) {
        let num = str.match(/[0-9]+/)[0];
        if (num.length <= 2) {
          res.push(num);
        }
        i = i + num.length + 1;
      }
    } else if (cost[i].search(/[wubrgscxyz]/) > -1) {
      res.push(cost[i]);
    } else if (cost[i].search(/[0-9]/) > -1) {
      let num = cost.slice(i).match(/[0-9]+/)[0];
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
}

const parseTokens = (tokens) => {
  let peek = () => tokens[0];
  let consume = peek;

  let result = [];
  if (peek().type == 'or') {
    return parseTokens(tokens.slice(1));
  }
  if (peek().type == 'open') {
    let end = findClose(tokens);
    if (end < tokens.length - 1 && tokens[end + 1].type == 'or') result.type = 'or';
    result.push(parseTokens(tokens.slice(1, end)));
    if (tokens.length > end + 1) result.push(parseTokens(tokens.slice(end + 1)));
    return result;
  } else if (peek().type == 'token') {
    if (tokens.length == 1) {
      return consume();
    } else {
      if (tokens[1].type == 'or') result.type = 'or';
      result.push(consume());
      result.push(parseTokens(tokens.slice(1)));
      return result;
    }
  }
}

function filterCard(card, filters) {
  if (filters.length == 1) {
    if (filters[0].type == 'token') {
      return filterApply(card, filters[0]);
    } else {
      return filterCard(card, filters[0]);
    }
  } else {
    if (filters.type == 'or') {
      return (filters[0].type == 'token' ? filterApply(card, filters[0]) : filterCard(card, filters[0])) || (filters[1].type == 'token' ? filterApply(card, filters[1]) : filterCard(card, filters[1]))
    } else {
      return (filters[0].type == 'token' ? filterApply(card, filters[0]) : filterCard(card, filters[0])) && (filters[1].type == 'token' ? filterApply(card, filters[1]) : filterCard(card, filters[1]))
    }
  }

}

function areArraysEqualSets(a1, a2) {
  if (a1.length != a2.length) return false;
  let superSet = {};
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

  for (let e in superSet) {
    if (superSet[e] === 1) {
      return false;
    }
  }

  return true;
}

function arrayContainsOtherArray(arr1, arr2) {
  return arr2.every(v => arr1.includes(v));
}

function filterApply(card, filter) {
  let res = null;
  if (filter.category == 'name') {
    res = card.details.name_lower.indexOf(filter.arg) > -1;
  }
  if (filter.category == 'oracle' && card.details.oracle_text) {
    res = card.details.oracle_text.toLowerCase().indexOf(filter.arg) > -1;
  }
  if (filter.category == 'color' && card.details.colors) {
    switch (filter.operand) {
      case ':':
      case '=':
        if (filter.arg.length == 1 && filter.arg[0] == 'C') {
          res = !card.details.colors.length;
        } else {
          res = areArraysEqualSets(card.details.colors, filter.arg);
        }
        break;
      case '<':
        res = arrayContainsOtherArray(filter.arg, card.details.colors) && card.details.colors.length < filter.arg.length;
        break;
      case '>':
        res = arrayContainsOtherArray(card.details.colors, filter.arg) && card.details.colors.length > filter.arg.length;
        break;
      case '<=':
        res = arrayContainsOtherArray(filter.arg, card.details.colors) && card.details.colors.length <= filter.arg.length;
        break;
      case '>=':
        res = arrayContainsOtherArray(card.details.colors, filter.arg) && card.details.colors.length >= filter.arg.length;
        break;
    }
  }
  if (filter.category == 'identity' && card.colors) {
    switch (filter.operand) {
      case ':':
      case '=':
        if (filter.arg.length == 1 && filter.arg[0] == 'C') {
          res = !card.colors.length;
        } else {
          res = areArraysEqualSets(card.colors, filter.arg);
        }
        break;
      case '<':
        res = arrayContainsOtherArray(filter.arg, card.colors) && card.details.color_identity.length < filter.arg.length;
        break;
      case '>':
        res = arrayContainsOtherArray(card.colors, filter.arg) && card.details.color_identity.length > filter.arg.length;
        break;
      case '<=':
        res = arrayContainsOtherArray(filter.arg, card.colors) && card.details.color_identity.length <= filter.arg.length;
        break;
      case '>=':
        res = arrayContainsOtherArray(card.colors, filter.arg) && card.details.color_identity.length >= filter.arg.length;
        break;
    }
  }
  if (filter.category == 'mana' && card.details.parsed_cost) {
    res = areArraysEqualSets(card.details.parsed_cost, filter.arg);
  }
  if (filter.category == 'cmc' && card.cmc) {
    switch (filter.operand) {
      case ':':
      case '=':
        res = filter.arg == card.cmc;
        break;
      case '<':
        res = card.cmc < filter.arg;
        break;
      case '>':
        res = card.cmc > filter.arg;
        break;
      case '<=':
        res = card.cmc <= filter.arg;
        break;
      case '>=':
        res = card.cmc >= filter.arg;
        break;
    }
  }
  if (filter.category == 'type' && card.details.type) {
    if (card.details.type.toLowerCase().indexOf(filter.arg) > -1) {
      res = true;
    }
  }
  if (filter.category == 'power') {
    if (card.details.power) {
      switch (filter.operand) {
        case ':':
        case '=':
          res = filter.arg == card.details.power;
          break;
        case '<':
          res = card.details.power < filter.arg;
          break;
        case '>':
          res = card.details.power > filter.arg;
          break;
        case '<=':
          res = card.details.power <= filter.arg;
          break;
        case '>=':
          res = card.details.power >= filter.arg;
          break;
      }
    }
  }
  if (filter.category == 'toughness') {
    if (card.details.toughness) {
      switch (filter.operand) {
        case ':':
        case '=':
          res = filter.arg == card.details.toughness;
          break;
        case '<':
          res = card.details.toughness < filter.arg;
          break;
        case '>':
          res = card.details.toughness > filter.arg;
          break;
        case '<=':
          res = card.details.toughness <= filter.arg;
          break;
        case '>=':
          res = card.details.toughness >= filter.arg;
          break;
      }
    }
  }
  if (filter.category == 'loyalty') {
    if (card.details.loyalty) {
      switch (filter.operand) {
        case ':':
        case '=':
          res = card.details.loyalty == filter.arg;
          break;
        case '<':
          res = card.details.loyalty < filter.arg;
          break;
        case '>':
          res = card.details.loyalty > filter.arg;
          break;
        case '<=':
          res = card.details.loyalty <= filter.arg;
          break;
        case '>=':
          res = card.details.loyalty >= filter.arg;
          break;
      }
    }
  }
  if (filter.category == 'tag') {
    res = card.tags.some(element => {
      return element.toLowerCase() == filter.arg;
    });
  }
  if (filter.category == 'status') {
    if (card.status.toLowerCase() == filter.arg) {
      res = true;
    }
  }

  if (filter.category == 'price') {
    var price = null;
    if (card.details.price) {
      price = card.details.price;
    } else if (card.details.price_foil) {
      price = card.details.price_foil;
    }
    if (price) {
      switch (filter.operand) {
        case ':':
        case '=':
          res = filter.arg == price;
          break;
        case '<':
          res = price < filter.arg;
          break;
        case '>':
          res = price > filter.arg;
          break;
        case '<=':
          res = price <= filter.arg;
          break;
        case '>=':
          res = price >= filter.arg;
          break;
      }
    }
  }
  if (filter.category == 'pricefoil') {
    var price = card.details.price_foil || null
    if (price) {
      switch (filter.operand) {
        case ':':
        case '=':
          res = filter.arg == price;
          break;
        case '<':
          res = price < filter.arg;
          break;
        case '>':
          res = price > filter.arg;
          break;
        case '<=':
          res = price <= filter.arg;
          break;
        case '>=':
          res = price >= filter.arg;
          break;
      }
    }
  }
  if (filter.category == 'rarity') {
    let rarity = card.details.rarity;
    switch (filter.operand) {
      case ':':
      case '=':
        res = rarity == filter.arg;
        break;
      case '<':
        res = rarity_order.indexOf(rarity) < rarity_order.indexOf(filter.arg);
        break;
      case '>':
        res = rarity_order.indexOf(rarity) > rarity_order.indexOf(filter.arg);
        break;
      case '<=':
        res = rarity_order.indexOf(rarity) <= rarity_order.indexOf(filter.arg);
        break;
      case '>=':
        res = rarity_order.indexOf(rarity) >= rarity_order.indexOf(filter.arg);
        break;
    }
  }

  if (filter.not) {
    return !res;
  } else {
    return res;
  }
}

export default {
  tokenizeInput,
  verifyTokens,
  parseTokens,
  filterCard
};