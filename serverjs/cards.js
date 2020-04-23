const winston = require('winston');
const Card = require('../models/card');

function getPlaceholderCard(_id) {
  // placeholder card if we don't find the one due to a scryfall ID update bug
  return {
    _id,
    set: '',
    collector_number: '',
    promo: false,
    digital: false,
    full_name: 'Invalid Card',
    name: 'Invalid Card',
    name_lower: 'invalid card',
    artist: '',
    scryfall_uri: '',
    rarity: '',
    legalities: {},
    oracle_text: '',
    image_normal: 'https://img.scryfall.com/errors/missing.jpg',
    cmc: 0,
    type: '',
    colors: [],
    color_identity: [],
    parsed_cost: [],
    colorcategory: 'c',
    error: true,
  };
}

const cardsFromIds = async (ids) => {
  const cards = await Card.find({ scryfall_id: { $in: ids } }).lean();
  const dict = {};
  for (const card of cards) {
    dict[card.scryfall_id] = card;
  }
  return ids.map((id) => dict[id]);
};

const cardFromId = async (id) => {
  const card = await Card.findOne({ scryfall_id: id }).lean();
  if (!card) {
    // TODO: replace this back with error. it was clogging the logs.
    winston.info(null, { error: new Error(`Could not find card from id: ${JSON.stringify(id, null, 2)}`) });
    return getPlaceholderCard(id);
  }
  return card;
};

const nameToCards = async (name) => {
  const cards = await Card.find({ name_lower: name }).lean();
  if (!cards) {
    return [];
  }
  return cards;
};

const namesToCardDict = async (names) => {
  const cards = await Card.find({ name_lower: { $in: names } }).lean();
  if (!cards) {
    return {};
  }
  const dict = {};
  for (const card of cards) {
    if (!dict[card.name_lower]) {
      dict[card.name_lower] = [];
    }
    dict[card.name_lower].push(card);
  }
  return cards;
};

function getCardDetails(card) {
  if (data._carddict[card.cardID]) {
    const details = data._carddict[card.cardID];
    card.details = details;
    return details;
  }
  winston.error(null, { error: new Error(`Could not find card details: ${card.cardID}`) });
  return getPlaceholderCard(card.cardID);
}

function reasonableCard(card) {
  return (
    !card.promo &&
    !card.digital &&
    card.border_color !== 'gold' &&
    card.language === 'en' &&
    card.tcgplayer_id &&
    card.set !== 'myb' &&
    card.set !== 'mb1' &&
    card.collector_number.indexOf('★') === -1
  );
}

function reasonableId(id) {
  return reasonableCard(cardFromId(id));
}

function getIdsFromName(name) {
  return data.nameToId[
    name
      .trim()
      .normalize('NFD') // convert to consistent unicode format
      .replace(/[\u0300-\u036f]/g, '') // remove unicode
      .toLowerCase()
  ];
}

// Printing = 'recent' or 'first'
function getMostReasonable(cardName, printing = 'recent') {
  let ids = getIdsFromName(cardName);
  if (ids === undefined || ids.length === 0) {
    // Try getting it by ID in case this is an ID.
    // eslint-disable-next-line no-use-before-define
    return getMostReasonableById(cardName, printing);
  }

  // Ids are stored in reverse chronological order, so reverse if we want first printing.
  if (printing !== 'recent') {
    ids = [...ids];
    ids.reverse();
  }
  return cardFromId(ids.find(reasonableId) || ids[0]);
}

function getMostReasonableById(id, printing = 'recent') {
  const card = cardFromId(id);
  if (card.error) {
    winston.info(`Error finding most reasonable for id ${id}`);
    return null;
  }
  return getMostReasonable(card.name, printing);
}

function getEnglishVersion(id) {
  // TODO: add english mapping
  // return data.english[id];
}

module.exports = {
  getEnglishVersion,
  getMostReasonableById,
  getMostReasonable,
  getIdsFromName,
  reasonableId,
  reasonableCard,
  getCardDetails,
  cardFromId,
  cardsFromIds,
  nameToCards,
  namesToCardDict,
};
