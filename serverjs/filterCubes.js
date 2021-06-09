const unquote = (str) => {
  if (str.charAt(0) === '"' && str.charAt(str.length - 1) === '"') {
    return str.substring(1, str.length - 1);
  }
  return str;
};

// operators are [:, =, <, >, <=, >=]
const operators = ['!=', ':', '=', '<', '>', '>=', '<='];

const operatorToMongoose = {
  '!=': '$ne',
  ':': '$eq',
  '=': '$eq',
  '>': '$gt',
  '>=': '$gte',
  '<': '$lt',
  '<=': '$lte',
};

const parseToken = (token) => {
  for (const operator of operators) {
    const index = token.indexOf(operator);
    const quoteIndex = token.indexOf('"');
    if (index !== -1) {
      if (quoteIndex !== -1 && index > quoteIndex) {
        return { keywords: unquote(token) };
      }
      const res = {};
      res[token.substring(0, index)] = {
        operator: token.substring(index, index + operator.length),
        token: unquote(token.substring(index + operator.length, token.length)),
      };
      return res;
    }
  }
  return { keywords: unquote(token) };
};

const nameToOracle = (name, carddb) => {
  try {
    return carddb.cardFromId(carddb.getIdsFromName(name)[0]).oracle_id;
  } catch (err) {
    return { error: `"${name}" is not a valid card name` };
  }
};

async function makeFilter(filterText, carddb) {
  const query = {};
  const tokens = filterText.match(/(?:[^\s"]+|"[^"]*")+/g).map(parseToken);

  // handle generic keywords
  const keywords = tokens
    .map((token) => token.keywords)
    .filter((c) => c)
    .map((token) => token.toLowerCase());

  if (keywords.length > 1) {
    query.keywords = { $all: keywords };
  } else if (keywords.length === 1) {
    [query.keywords] = keywords;
  }

  // handles by user
  const owners = tokens.map((token) => token.owner).filter((c) => c);

  if (owners.length > 1) {
    return { error: 'Only one `owner` tag allowed' };
  }
  if (owners.length === 1) {
    if (owners[0].operator === ':' || owners[0].operator === '=') {
      query.owner_name = owners[0].token;
    } else {
      return { error: 'Invalid `owner` operator, please use = or :' };
    }
  }

  // handles number of decks
  const decks = tokens.map((token) => token.decks).filter((c) => c);
  if (decks.length > 1) {
    if (!query.$and) {
      query.$and = [];
    }
    query.$and.push(
      ...decks.map((deck) => {
        const res = {};
        res.numDecks = {};
        res.numDecks[operatorToMongoose[deck.operator]] = deck.token;
        return res;
      }),
    );
  }
  if (decks.length === 1) {
    query.numDecks = {};
    query.numDecks[operatorToMongoose[decks[0].operator]] = decks[0].token;
  }

  // handles number of cards
  const cards = tokens.map((token) => token.cards).filter((c) => c);
  if (cards.length > 1) {
    if (!query.$and) {
      query.$and = [];
    }
    query.$and.push(
      ...cards.map((deck) => {
        const res = {};
        res.card_count = {};
        res.card_count[operatorToMongoose[deck.operator]] = deck.token;
        return res;
      }),
    );
  }
  if (cards.length === 1) {
    query.card_count = {};
    query.card_count[operatorToMongoose[cards[0].operator]] = cards[0].token;
  }

  // handles by category
  const categories = tokens.map((token) => token.category).filter((c) => c);

  if (categories.length > 1) {
    query.categories = { $all: categories.map((token) => token.token.toLowerCase()) };
  }
  if (categories.length === 1) {
    if (categories[0].operator === ':' || categories[0].operator === '=') {
      query.categories = categories[0].token.toLowerCase();
    } else {
      return { error: 'Invalid `category` operator, please use = or :' };
    }
  }

  // handles cubes that include a card
  const cardNames = tokens.map((token) => token.card).filter((c) => c);

  const oracles = [];

  for (const name of cardNames) {
    if (name.operator === ':' || name.operator === '=') {
      const oracle = nameToOracle(name.token.toLowerCase(), carddb);
      if (oracle.error) {
        return oracle;
      }
      oracles.push(oracle);
    } else {
      return { error: 'Invalid `card` operator, please use = or :' };
    }
  }

  if (oracles.length > 1) {
    query.cardOracles = { $all: oracles };
  }
  if (oracles.length === 1) {
    [query.cardOracles] = oracles;
  }

  return query;
}

module.exports = {
  makeFilter,
};
