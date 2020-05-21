const { Grammar, Parser } = require('nearley');

const filterCubeGrammar = require('../dist/generated/filtering/cubeFilters');
const { fromEntries } = require('../dist/utils/Util');

const Card = require('../models/card');

const compiledGrammar = Grammar.fromCompiled(filterCubeGrammar);

const filterUses = ({ fieldsUsed }, name) => fieldsUsed.findIndex(name) >= 0;

// TODO: Implement
// eslint-disable-next-line no-unused-vars
function filterToString(filters) {
  return null;
}

async function getCardCubes(value, carddb) {
  const ids = carddb.getIdsFromName(value, carddb);
  if (ids) {
    return getCardCubes(carddb.getMostReasonable(value)._id, carddb);
  }

  // if id is a foreign cardname, redirect to english version
  const english = carddb.getEnglishVersion(value);
  if (english) {
    return getCardCubes(english, carddb);
  }

  // otherwise just go to this ID.
  const card = carddb.cardFromId(value);
  const data = await Card.findOne({ cardName: card.name_lower });
  if (!data) {
    return { _id: { $in: [] } };
  }

  return { _id: { $in: data.cubes } };
}

async function fillInCardQuery(query, carddb) {
  if (!query) {
    return query;
  }
  if (Array.isArray(query)) {
    return Promise.all(query.map(async (q) => fillInCardQuery(q, carddb)));
  }
  if (query.CARD) {
    return getCardCubes(query.CARD, carddb);
  }
  if (typeof query === 'object') {
    return fromEntries(
      await Promise.all(Object.entries(query).map(async ([key, value]) => [key, await fillInCardQuery(value, carddb)])),
    );
  }
  return query;
}

async function makeFilter(filterText, carddb) {
  if (!filterText || filterText.trim() === '') {
    return {
      err: false,
      filter: { query: {}, fieldsUsed: [] },
    };
  }

  const filterParser = new Parser(compiledGrammar);
  filterParser.feed(filterText);
  const { results } = filterParser;
  if (results.length === 1) {
    const [filter] = results;
    return {
      err: !filter,
      filter: filter && { ...filter, query: await fillInCardQuery(filter.query, carddb) },
    };
  }

  return {
    err: true,
    filter: null,
  };
}

module.exports = {
  filterUses,
  filterToString,
  makeFilter,
};
