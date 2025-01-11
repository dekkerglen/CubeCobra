import json from 'big-json';
import fs from 'fs';

import { CardDetails } from 'datatypes/Card';
import { detailsToCard } from 'utils/cardutil';

import { filterCardsDetails, FilterFunction } from '../client/filtering/FilterCards';
import { SortFunctions } from '../client/utils/Sort';

interface Catalog {
  cardtree: Record<string, any>;
  imagedict: Record<string, any>;
  cardimages: Record<string, any>;
  cardnames: string[];
  full_names: string[];
  nameToId: Record<string, string[]>;
  oracleToId: Record<string, string[]>;
  english: Record<string, string>;
  _carddict: Record<string, any>;
  indexToOracle: string[];
  metadatadict: Record<string, Record<string, Record<string, number[]>>>;
  printedCardList: any[];
}

const catalog: Catalog = {
  cardtree: {},
  imagedict: {},
  cardimages: {},
  cardnames: [],
  full_names: [],
  nameToId: {},
  oracleToId: {},
  english: {},
  _carddict: {},
  indexToOracle: [],
  metadatadict: {},
  printedCardList: [], // for card filters
};

const fileToAttribute: Record<string, keyof Catalog> = {
  'carddict.json': '_carddict',
  'cardtree.json': 'cardtree',
  'names.json': 'cardnames',
  'nameToId.json': 'nameToId',
  'oracleToId.json': 'oracleToId',
  'full_names.json': 'full_names',
  'imagedict.json': 'imagedict',
  'cardimages.json': 'cardimages',
  'english.json': 'english',
  'indexToOracle.json': 'indexToOracle',
  'metadatadict.json': 'metadatadict',
};

// eslint-disable-next-line camelcase
function getPlaceholderCard(scryfall_id: string): CardDetails {
  // placeholder card if we don't find the one due to a scryfall ID update bug
  return {
    scryfall_id,
    oracle_id: '',
    released_at: '',
    isToken: false,
    finishes: [],
    set: '',
    collector_number: '',
    promo: false,
    reprint: false,
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
    colorcategory: 'Colorless',
    border_color: 'black',
    language: 'en',
    mtgo_id: 0,
    layout: '',
    tcgplayer_id: '',
    power: '',
    toughness: '',
    loyalty: '',
    error: true,
    full_art: false,
    prices: {},
    tokens: [],
    set_name: '',
  };
}

function cardFromId(id: string): CardDetails {
  let details;
  if (catalog._carddict[id]) {
    details = catalog._carddict[id];
  } else if (catalog.oracleToId[id]) {
    details = getFirstReasonable(catalog.oracleToId[id]);
  } else {
    details = getPlaceholderCard(id);
  }

  return details;
}

async function loadJSONFile(filename: string, attribute: keyof Catalog) {
  return new Promise<void>((resolve, reject) => {
    try {
      const readStream = fs.createReadStream(filename);
      const parseStream = json.createParseStream();

      parseStream.on('catalog', (parsed) => {
        catalog[attribute] = parsed;
      });

      readStream.pipe(parseStream);

      readStream.on('end', () => {
        // eslint-disable-next-line no-console
        console.info(`Loaded ${filename}.`);
        resolve();
      });
    } catch (e) {
      reject(e);
    }
  });
}

async function loadAllFiles() {
  await Promise.all(
    Object.entries(fileToAttribute).map(([filename, attribute]) => loadJSONFile(`private/${filename}`, attribute)),
  );
}

async function initializeCardDb() {
  // eslint-disable-next-line no-console
  console.info('Loading carddb...');
  await loadAllFiles();

  catalog.printedCardList = Object.values(catalog._carddict).filter((card) => !card.digital && !card.isToken);

  // eslint-disable-next-line no-console
  console.info('Finished loading carddb.');
}

function reasonableCard(card: CardDetails): boolean {
  return (
    !card.isExtra &&
    !card.promo &&
    !card.digital &&
    !card.isToken &&
    card.border_color !== 'gold' &&
    card.language === 'en' &&
    card.tcgplayer_id !== undefined &&
    card.set !== 'myb' &&
    card.set !== 'mb1' &&
    card.collector_number.indexOf('★') === -1 &&
    card.layout !== 'art_series'
  );
}

function reasonableId(id: string): boolean {
  return reasonableCard(cardFromId(id));
}

function getNameForComparison(name: string): string {
  return name
    .trim()
    .normalize('NFD') // convert to consistent unicode format
    .replace(/[\u0300-\u036f]/g, '') // remove unicode
    .toLowerCase();
}

function getIdsFromName(name: string): string[] {
  // this is a fully-spcecified card name
  if (name.includes('[') && name.includes(']')) {
    name = name.toLowerCase();
    const split = name.split('[');
    return getIdsFromName(split[0])
      .map((id) => cardFromId(id))
      .filter((card) => getNameForComparison(card.full_name) === getNameForComparison(name))
      .map((card) => card.scryfall_id);
  }

  return catalog.nameToId[getNameForComparison(name)];
}

// Printing = 'recent' or 'first'
function getMostReasonable(cardName: string, printing = 'recent', filter?: FilterFunction): CardDetails | null {
  let ids = getIdsFromName(cardName);
  if (ids === undefined || ids.length === 0) {
    // Try getting it by ID in case this is an ID.

    return getMostReasonableById(cardName, printing);
  }

  if (filter) {
    ids = ids
      .map((id) => detailsToCard(cardFromId(id)))
      .filter(filter)
      .map((card) => card.details?.scryfall_id)
      .filter((id) => id !== undefined) as string[];
  }

  if (ids.length === 0) {
    return null;
  }

  // sort chronologically by default
  const cards = ids.map((id) => ({
    details: cardFromId(id),
  }));
  cards.sort((a, b) => {
    const dateCompare = SortFunctions['Release date'](a, b);

    if (dateCompare !== 0) {
      return dateCompare;
    }

    return SortFunctions['Collector number'](a, b);
  });

  ids = cards.map((card) => card.details.scryfall_id);

  // Ids are stored in reverse chronological order, so reverse if we want first printing.
  if (printing !== 'recent') {
    ids = [...ids];
    ids.reverse();
  }
  return cardFromId(ids.find(reasonableId) || ids[0]);
}

function getMostReasonableById(id: string, printing = 'recent', filter?: FilterFunction): CardDetails | null {
  const card = cardFromId(id);
  if (card.error) {
    return null;
  }
  return getMostReasonable(card.name, printing, filter);
}

function getFirstReasonable(ids: string[]): CardDetails {
  return cardFromId(ids.find(reasonableId) || ids[0]);
}

function getEnglishVersion(id: string): string {
  return catalog.english[id];
}

function getVersionsByOracleId(oracleId: string): string[] {
  return catalog.oracleToId[oracleId];
}

const getReasonableCardByOracle = (oracleId: string): CardDetails => {
  const ids = catalog.oracleToId[oracleId];
  return getFirstReasonable(ids);
};

function isOracleBasic(oracleId: string): boolean {
  return cardFromId(catalog.oracleToId[oracleId][0]).type.includes('Basic');
}

function getRelatedCards(oracleId: string): Record<string, Record<string, CardDetails[]>> {
  const related = catalog.metadatadict[oracleId];

  if (!related) {
    return {
      cubedWith: {
        top: [],
        creatures: [],
        spells: [],
        other: [],
      },
      draftedWith: {
        top: [],
        creatures: [],
        spells: [],
        other: [],
      },
      synergistic: {
        top: [],
        creatures: [],
        spells: [],
        other: [],
      },
    };
  }

  return Object.fromEntries(
    Object.entries(related).map(([label, category]) => [
      label,
      Object.fromEntries(
        Object.entries(category).map(([type, indexes]) => [
          type,
          indexes.map((id) => cardFromId(catalog.indexToOracle[id])),
        ]),
      ),
    ]),
  );
}

const getAllMostReasonable = (filter: FilterFunction): CardDetails[] => {
  const cards = filterCardsDetails(catalog.printedCardList, filter);

  const keys = new Set();
  const filtered = [];
  for (const card of cards) {
    if (!keys.has(card.name_lower)) {
      filtered.push(getMostReasonableById(card.scryfall_id, 'recent', filter));
      keys.add(card.name_lower);
    }
  }
  return filtered.filter((card) => card !== null) as CardDetails[];
};

module.exports = {
  ...catalog,
  cardFromId,
  getIdsFromName,
  getEnglishVersion,
  getVersionsByOracleId,
  allVersions: (card: CardDetails) => getIdsFromName(card.name),
  allCards: () => Object.values(catalog._carddict),
  allOracleIds: () => Object.keys(catalog.oracleToId),
  initializeCardDb,
  loadJSONFile,
  getPlaceholderCard,
  getMostReasonable,
  getMostReasonableById,
  getFirstReasonable,
  reasonableId,
  reasonableCard,
  normalizedName: (card: CardDetails) => card.name_lower,
  fileToAttribute,
  loadAllFiles,
  isOracleBasic,
  getReasonableCardByOracle,
  getRelatedCards,
  getAllMostReasonable,
};
