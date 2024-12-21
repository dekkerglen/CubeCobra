const express = require('express');

const carddb = require('../serverjs/carddb');
const Cube = require('../dynamo/models/cube');
const CubeHash = require('../dynamo/models/cubeHash');

const { render } = require('../serverjs/render');
const { ensureAuth } = require('./middleware');
const { isCubeListed } = require('../serverjs/cubefn');

const router = express.Router();

const tokenize = (query) => {
  const tokens = [];
  let buffer = '';
  let inQuote = false;

  for (let i = 0; i < query.length; i++) {
    if (query[i] === '"') {
      inQuote = !inQuote;
      if (!inQuote) {
        // end of quote
        tokens.push(buffer);
        buffer = '';
      }
    } else if (query[i] === ' ' && !inQuote) {
      if (buffer.length > 0) {
        tokens.push(buffer);
        buffer = '';
      }
    } else {
      buffer += query[i];
    }
  }

  if (buffer.length > 0) {
    tokens.push(buffer);
  }

  return tokens;
};

const getCardQueries = (tokens) => {
  const queries = [];

  for (const token of tokens) {
    const split = token.split(':');

    if (split[0] === 'oracle') {
      queries.push({ type: 'oracle', value: split[1] });
    }

    if (split[0] === 'card') {
      const card = carddb.getMostReasonable(split[1]);

      if (card) {
        queries.push({ type: 'card', value: card.oracle_id });
      } else {
        queries.push({ type: 'card', value: '' });
      }
    }
  }

  return queries;
};

const getKeywordQueries = (tokens) => {
  const queries = [];

  for (const token of tokens) {
    const split = token.split(':');

    if (split[0] === 'keywords') {
      queries.push({ type: 'keywords', value: split[1] });
    }

    if (split.length === 1 && split[0].length > 0) {
      queries.push({ type: 'keywords', value: split[0] });
    }
  }

  return queries;
};

const getTagQueries = (tokens) => {
  const queries = [];

  for (const token of tokens) {
    const split = token.split(':');

    if (split[0] === 'tag') {
      queries.push({ type: 'tag', value: split[1] });
    }
  }

  return queries;
};

const getHumanReadableQuery = (cardQueries, keywordQueries, tagQueries) => {
  let result = [];

  for (const query of cardQueries) {
    if (query.value === '') {
      result.push(`Ignoring card query: could not identify card`);
    } else {
      const card = carddb.getReasonableCardByOracle(query.value);
      result.push(`Cube contains ${card.name}`);
    }
  }

  for (const query of keywordQueries) {
    result.push(`Cube name contains "${query.value}"`);
  }

  for (const query of tagQueries) {
    result.push(`Cube has tag "${query.value}"`);
  }

  if (result.length === 0) {
    result.push('All cubes');
  }

  return result;
};

const searchWithKeywordQuery = async (keywordQueries, order, lastKey, ascending, user) => {
  let result;
  const hashRows = [];

  do {
    result = await CubeHash.query(
      keywordQueries.length > 0 ? `keywords:${keywordQueries[0].value.toLowerCase()}` : `featured:false`,
      ascending,
      lastKey,
      order,
      128,
    );

    hashRows.push(
      ...result.items.filter((hash) => {
        for (const query of keywordQueries) {
          if (!hash.name.toLowerCase().includes(query.value.toLowerCase())) {
            return false;
          }
        }

        return true;
      }),
    );

    lastKey = result.lastKey;
  } while (hashRows.length < 36 && result.lastKey);

  const items = (result.items.length > 0 ? await Cube.batchGet(hashRows.map((hash) => hash.cube)) : []).filter((cube) =>
    isCubeListed(cube, user),
  );

  // make sure items is in same order as hashRows
  const cubes = hashRows
    .flat()
    .map((hash) => items.find((cube) => cube.id === hash.cube))
    .filter((cube) => cube);

  return {
    cubes: cubes,
    lastKey: result.lastKey,
  };
};

const searchWithCardQueries = async (cardQueries, keywordQueries, order, lastKey, ascending, user) => {
  if (cardQueries.length > 1) {
    return {
      error: 'Can only search for one card at a time',
      cubes: [],
      lastKey: null,
    };
  }

  let result;
  let iterations = 0;
  const hashRows = [];

  do {
    result = await CubeHash.query(`oracle:${cardQueries[0].value}`, ascending, lastKey, order, 128);
    iterations += 1;
    hashRows.push(
      ...result.items.filter((hash) => {
        for (const query of keywordQueries) {
          if (!hash.name.toLowerCase().includes(query.value.toLowerCase())) {
            return false;
          }
        }

        return true;
      }),
    );

    lastKey = result.lastKey;
  } while (hashRows.length < 36 && result.lastKey && iterations < 10);

  const items = (result.items.length > 0 ? await Cube.batchGet(hashRows.map((hash) => hash.cube)) : []).filter((cube) =>
    isCubeListed(cube, user),
  );

  // make sure items is in same order as hashRows
  const cubes = hashRows
    .flat()
    .map((hash) => items.find((cube) => cube.id === hash.cube))
    .filter((cube) => cube);

  return {
    cubes: cubes,
    lastKey: result.lastKey,
  };
};

const searchWithTagQueries = async (tagQueries, cardQueries, keywordQueries, order, lastKey, ascending, user) => {
  let result;
  const hashRows = [];

  do {
    result = await CubeHash.query(`tag:${tagQueries[0].value}`, ascending, lastKey, order, 128);

    hashRows.push(
      ...result.items.filter((hash) => {
        for (const query of keywordQueries) {
          if (!hash.name.toLowerCase().includes(query.value.toLowerCase())) {
            return false;
          }
        }

        return true;
      }),
    );

    lastKey = result.lastKey;
  } while (hashRows.length < 36 && result.lastKey);

  const items = (result.items.length > 0 ? await Cube.batchGet(hashRows.map((hash) => hash.cube)) : []).filter((cube) =>
    isCubeListed(cube, user),
  );

  // make sure items is in same order as hashRows
  const cubes = hashRows
    .flat()
    .map((hash) => items.find((cube) => cube.id === hash.cube))
    .filter((cube) => cube)
    .filter((cube) => {
      const lowerCaseTags = (cube.tags || []).map((tag) => tag.toLowerCase());
      for (const query of tagQueries) {
        if (!lowerCaseTags.includes(query.value.toLowerCase())) {
          return false;
        }
      }
      return true;
    });


    if (cardQueries.length === 0) {
      return {
        cubes: cubes,
        lastKey: result.lastKey,
      };
    }

    const cubeCards = await Promise.all(cubes.map((cube) => Cube.getCards(cube.id)));

    const cubeWithCardFilter = cubes.filter((cube, index) => {
      const cards = cubeCards[index];
      const oracleIds = cards.mainboard.map((card) => carddb.cardFromId(card.cardID).oracle_id);

      for (const query of cardQueries) {
        if (!oracleIds.some((oracle_id) => oracle_id === query.value)) {
          return false;
        }
      }
      
      return true;
    });

  return {
    cubes: cubeWithCardFilter,
    lastKey: result.lastKey,
  };
};

const searchCubes = async (query, order, lastKey, ascending, user) => {
  if (!['cards', 'pop', 'alpha'].includes(order)) {
    return {
      error: 'Invalid order',
      cubes: [],
      lastKey: null,
      parsedQuery: [],
    };
  }

  // separate query into tokens, respecting quotes
  const tokens = tokenize(query);

  const cardQueries = getCardQueries(tokens);
  const keywordQueries = getKeywordQueries(tokens);
  const tagQueries = getTagQueries(tokens);

  if (tagQueries.length > 0) {
    const searchResult = await searchWithTagQueries(
      tagQueries,
      cardQueries,
      keywordQueries,
      order,
      lastKey,
      ascending,
      user,
    );

    return {
      cubes: searchResult.cubes,
      lastKey: searchResult.lastKey,
      parsedQuery: getHumanReadableQuery(cardQueries, keywordQueries, tagQueries),
      error: searchResult.error,
    };
  }

  if (cardQueries.length > 0) {
    const searchResult = await searchWithCardQueries(cardQueries, keywordQueries, order, lastKey, ascending, user);

    return {
      cubes: searchResult.cubes,
      lastKey: searchResult.lastKey,
      parsedQuery: getHumanReadableQuery(cardQueries, keywordQueries, tagQueries),
      error: searchResult.error,
    };
  }

  const searchResult = await searchWithKeywordQuery(keywordQueries, order, lastKey, ascending, user);

  return {
    cubes: searchResult.cubes,
    lastKey: searchResult.lastKey,
    parsedQuery: getHumanReadableQuery(cardQueries, keywordQueries, tagQueries),
    error: searchResult.error,
  };
};

router.get('/search', async (req, res) => {
  const ascending = req.query.ascending || 'false';
  const order = req.query.order || 'pop';
  const query = req.query.q || '';

  const result = await searchCubes(query, order, null, ascending === 'true', req.user);

  if (result.error) {
    req.flash('danger', result.error);
  }

  return render(req, res, 'SearchPage', {
    cubes: result.cubes,
    lastKey: result.lastKey,
    parsedQuery: result.parsedQuery,
    query: query,
  });
});

router.post('/getmoresearchitems', ensureAuth, async (req, res) => {
  const { lastKey, query, order, ascending } = req.body;

  const result = await searchCubes(query, order, lastKey, ascending, req.user);

  return res.status(200).send({
    success: 'true',
    cubes: result.cubes,
    lastKey: result.lastKey,
    parsedQuery: result.parsedQuery,
    error: result.error,
  });
});

module.exports = router;
