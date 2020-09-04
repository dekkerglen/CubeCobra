const carddb = require('../../serverjs/cards');

function getBlankCardHistory(id) {
  const card = carddb.cardFromId(id);
  const cardVersions = carddb.getVersionsByOracleId(card.oracle_id);

  const data = {
    current: {
      rating: null,
      elo: card.elo,
      picks: 0,
      total: [0, 0],
      size180: [0, 0],
      size360: [0, 0],
      size450: [0, 0],
      size540: [0, 0],
      size720: [0, 0],
      pauper: [0, 0],
      legacy: [0, 0],
      modern: [0, 0],
      standard: [0, 0],
      vintage: [0, 0],
      cubes: 0,
      prices: cardVersions.map((cardId) => {
        return { ...carddb.cardFromId(cardId), version: carddb.cardFromId(cardId)._id };
      }),
    },
    cubedWith: {
      synergistic: [],
      top: [],
      creatures: [],
      spells: [],
      other: [],
    },
    versions: cardVersions,
    cubes: [],
    history: [
      {
        data: {
          size180: [0, 0],
          size360: [0, 0],
          size450: [0, 0],
          size540: [0, 0],
          size720: [0, 0],
          pauper: [0, 0],
          legacy: [0, 0],
          modern: [0, 0],
          standard: [0, 0],
          vintage: [0, 0],
          total: [0, 0],
          rating: null,
          elo: null,
          picks: 0,
          cubes: 0,
          prices: [],
        },
        date: '',
      },
    ],
    cardName: card.name,
    oracleId: card.oracle_id,
    __v: 0,
  };

  return data;
}

module.exports = getBlankCardHistory;
