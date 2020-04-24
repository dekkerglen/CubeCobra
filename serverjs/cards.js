const winston = require('winston');
const Card = require('../models/card');

const normalizeName = (name) =>
  name
    .trim()
    .normalize('NFD') // convert to consistent unicode format
    .replace(/[\u0300-\u036f]/g, '') // remove unicode
    .toLowerCase();

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
  const cards = await Card.find({ name_lower: normalizeName(name) }).lean();
  if (!cards) {
    return [];
  }
  return cards;
};

const namesToCardDict = async (names) => {
  const cards = await Card.find({ name_lower: { $in: names.map(normalizeName) } }).lean();
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

const getEnglishVersion = (id) => {
  // TODO: add english mapping
  // return data.english[id];
};

const mostReasonable = (cards, printing = 'recent') => {
  if (printing !== 'recent') {
    cards = [...cards];
    cards.reverse();
  }
  return cards.find(reasonableCard);
};

module.exports = {
  getEnglishVersion,
  mostReasonable,
  cardFromId,
  cardsFromIds,
  nameToCards,
  namesToCardDict,
  normalizeName,
};
