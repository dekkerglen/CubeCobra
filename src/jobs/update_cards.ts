import dotenv from 'dotenv';

import 'module-alias/register';
dotenv.config();

import AWS from 'aws-sdk';
import json from 'big-json';
import es from 'event-stream';
import fs from 'fs';
import { createWriteStream } from 'fs';
import JSONStream from 'JSONStream';
import fetch from 'node-fetch';
import { join } from 'path';
import path from 'path';
import { pipeline } from 'stream';
import stream from 'stream';

import { CardDetails, ColorCategory, DefaultElo } from 'datatypes/Card';
import { ManaSymbol } from 'datatypes/Mana';

import * as cardutil from '../client/utils/cardutil';
import { CardMetadata, fileToAttribute, reasonableCard } from '../util/carddb';
import * as util from '../util/util';

interface ScryfallCard {
  id: string;
  name: string;
  lang: string;
  set: string;
  collector_number: string;
  set_name: string;
  released_at: string;
  reprint: boolean;
  border_color: string;
  promo: boolean;
  digital: boolean;
  finishes: string[];
  prices: {
    usd: string | null;
    usd_foil: string | null;
    usd_etched: string | null;
    eur: string | null;
    tix: string | null;
  };
  image_uris: {
    small: string;
    normal: string;
    art_crop: string;
  };
  card_faces?: ScryfallCard[];
  loyalty?: string;
  power?: string;
  toughness?: string;
  type_line: string;
  oracle_text: string;
  mana_cost: string;
  cmc: number;
  colors: string[];
  color_identity: string[];
  produced_mana: string[];
  legalities: {
    legacy: string;
    modern: string;
    standard: string;
    pioneer: string;
    pauper: string;
    brawl: string;
    historic: string;
    commander: string;
    penny: string;
    vintage: string;
  };
  layout: string;
  rarity: string;
  artist: string;
  scryfall_uri: string;
  mtgo_id: number;
  textless: boolean;
  tcgplayer_id: string;
  oracle_id: string;
  full_art: boolean;
  flavor_text: string;
  frame_effects: string[];
  frame: string;
  card_back_id: string;
  artist_id: string;
  illustration_id: string;
  content_warning: boolean;
  variation: boolean;
  preview: {
    source: string;
    source_uri: string;
    previewed_at: string;
  };
  related_uris: {
    gatherer: string;
    tcgplayer_decks: string;
    edhrec: string;
    mtgtop8: string;
  };
  all_parts: {
    object: string;
    id: string;
    component: string;
    name: string;
    type_line: string;
    uri: string;
  }[];
}

interface Catalog {
  dict: Record<string, CardDetails>;
  names: string[];
  nameToId: Record<string, string[]>;
  full_names: string[];
  imagedict: Record<string, any>;
  cardimages: Record<string, any>;
  oracleToId: Record<string, string[]>;
  english: Record<string, string>;
  metadatadict: Record<string, CardMetadata>;
  indexToOracleId: string[];
}

const catalog: Catalog = {
  dict: {},
  names: [],
  nameToId: {},
  full_names: [],
  imagedict: {},
  cardimages: {},
  oracleToId: {},
  english: {},
  metadatadict: {},
  indexToOracleId: [],
};

async function downloadFile(url: string, filePath: string) {
  const folder = join(__dirname, `../${filePath.substring(0, filePath.lastIndexOf('/'))}`);
  if (!fs.existsSync(folder)) {
    fs.mkdirSync(folder, { recursive: true });
  }

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Request to '${url}' failed with status: ${response.statusText}`);
  }

  return new Promise<void>((resolve, reject) => {
    const fileStream = createWriteStream(filePath);
    pipeline(response.body, fileStream, (err) => {
      if (err) {
        reject(new Error(`Download error for '${url}':\n${err.message}`));
      } else {
        resolve();
      }
    });
  });
}

async function downloadDefaultCards() {
  let defaultUrl;
  let allUrl;

  const res = await fetch('https://api.scryfall.com/bulk-data');
  if (!res.ok) throw new Error(`Download of /bulk-data failed with code ${res.status}`);
  const resjson = await res.json();

  for (const data of resjson.data) {
    if (data.type === 'default_cards') {
      defaultUrl = data.download_uri;
    } else if (data.type === 'all_cards') {
      allUrl = data.download_uri;
    }
  }

  if (!defaultUrl) throw new Error('URL for Default cards not found in /bulk-data response');
  if (!allUrl) throw new Error('URL for All cards not found in /bulk-data response');

  return Promise.all([
    downloadFile(defaultUrl, './private/cards.json'),
    downloadFile(allUrl, './private/all-cards.json'),
  ]);
}

function addCardToCatalog(card: CardDetails, isExtra?: boolean) {
  catalog.dict[card.scryfall_id] = card;
  const normalizedFullName = cardutil.normalizeName(card.full_name);
  const normalizedName = cardutil.normalizeName(card.name);
  catalog.imagedict[normalizedFullName] = {
    uri: card.art_crop,
    artist: card.artist,
    id: card.scryfall_id,
    imageName: normalizedFullName,
  };
  if (isExtra !== true) {
    const cardImages: any = {
      image_normal: card.image_normal,
    };
    if (card.image_flip) {
      cardImages.image_flip = card.image_flip;
    }
    if (reasonableCard(card)) {
      catalog.cardimages[normalizedName] = cardImages;
    }
  }
  // only add if it doesn't exist, this makes the default the newest edition
  if (!catalog.nameToId[normalizedName]) {
    catalog.nameToId[normalizedName] = [];
  }
  if (!catalog.nameToId[normalizedName].includes(card.scryfall_id)) {
    catalog.nameToId[normalizedName].push(card.scryfall_id);
  }
  if (!catalog.oracleToId[card.oracle_id]) {
    catalog.oracleToId[card.oracle_id] = [];
  }
  catalog.oracleToId[card.oracle_id].push(card.scryfall_id);
  util.binaryInsert(normalizedName, catalog.names);
  util.binaryInsert(normalizedFullName, catalog.full_names);
}

async function writeFile(filepath: string, data: any) {
  return new Promise<void>((resolve, reject) => {
    try {
      // data is too big to stringify, so we write it to a file using big-json
      const stringifyStream = json.createStringifyStream({
        body: data,
      });

      // create empty file
      const fd = fs.openSync(filepath, 'w');

      stringifyStream.on('data', (strChunk) => {
        fs.writeSync(fd, strChunk);
      });

      stringifyStream.on('end', () => {
        fs.closeSync(fd);
        resolve();
      });
    } catch (err) {
      reject(err);
    }
  });
}

// These tokens don't match any of the filters below. The first 4 are "face down" tokens, and Halfling is a "Tolkien" creature
// This list was calculated with a script that parsed every scryfall object that was part of a 'token' set that didn't match the below filters
const miscTokens = ['Manifest', 'A Mysterious Creature', 'Cyberman', 'Morph', 'Halfling'];

function getScryfallTokensForCard(card: ScryfallCard) {
  const allParts = card.all_parts || [];
  return (
    allParts
      // the 'Card' type includes helper cards that aren't technically tokens like Monarch, Day-Night tracker, etc. Exclude "CheckLists" for flip cards
      .filter(
        (element) =>
          element.component === 'token' ||
          element.type_line.includes('Emblem') ||
          element.type_line.includes('Dungeon') ||
          (element.type_line.includes('Card') && !element.name.includes('Checklist')) ||
          miscTokens.includes(element.name),
      )
      .map(({ id }) => id)
  );
}

// As of writing Scryfall doesn't include the tokens that dungeons may create.
// If that changes, this function can be deleted
function getExtraTokensForDungeons(card: ScryfallCard) {
  const extraTokens: string[] = [];
  const allParts = card.all_parts || [];
  if (allParts.some((element) => element.name === 'Undercity // The Initiative')) {
    // Treasure
    extraTokens.push('1be23c27-d8b6-4f59-8ab8-9ce80e9e29dd');
    // 4/1 Skeleton with menace
    extraTokens.push('cf4c245f-af2f-46a7-81f3-670a04940901');
  }
  // As of writing, if one dungeon is included, all are, so only check for one
  if (allParts.some((element) => element.name === 'Dungeon of the Mad Mage')) {
    // Treasure
    extraTokens.push('1be23c27-d8b6-4f59-8ab8-9ce80e9e29dd');
    // 1/1 Skeleton
    extraTokens.push('b63b11cd-4a96-49d5-aee1-b0ff02ef49bb');
    // 1/1 Goblin
    extraTokens.push('b37f4fdb-1533-4c38-a654-f715fbef6abf');
    // The Atropal
    extraTokens.push('65f8e40f-fb5e-4ab8-add3-a8b87e7bcdd9');
  }
  return extraTokens;
}

function getTokens(card: ScryfallCard) {
  return getScryfallTokensForCard(card).concat(getExtraTokensForDungeons(card));
}

function convertCmc(card: ScryfallCard, preflipped: boolean, faceAttributeSource: ScryfallCard) {
  if (preflipped) {
    if (faceAttributeSource.cmc) {
      return faceAttributeSource.cmc;
    }
  }

  return card.cmc || 0;
}

function convertLegalities(
  card: ScryfallCard,
  preflipped?: boolean,
): Record<string, 'legal' | 'not_legal' | 'banned' | 'restricted'> {
  if (preflipped) {
    return {
      Legacy: 'not_legal',
      Modern: 'not_legal',
      Standard: 'not_legal',
      Pioneer: 'not_legal',
      Pauper: 'not_legal',
      Brawl: 'not_legal',
      Historic: 'not_legal',
      Commander: 'not_legal',
      Penny: 'not_legal',
      Vintage: 'not_legal',
    };
  }
  return {
    Legacy: card.legalities.legacy as 'legal' | 'not_legal' | 'banned' | 'restricted',
    Modern: card.legalities.modern as 'legal' | 'not_legal' | 'banned' | 'restricted',
    Standard: card.legalities.standard as 'legal' | 'not_legal' | 'banned' | 'restricted',
    Pioneer: card.legalities.pioneer as 'legal' | 'not_legal' | 'banned' | 'restricted',
    Pauper: card.legalities.pauper as 'legal' | 'not_legal' | 'banned' | 'restricted',
    Brawl: card.legalities.brawl as 'legal' | 'not_legal' | 'banned' | 'restricted',
    Historic: card.legalities.historic as 'legal' | 'not_legal' | 'banned' | 'restricted',
    Commander: card.legalities.commander as 'legal' | 'not_legal' | 'banned' | 'restricted',
    Penny: card.legalities.penny as 'legal' | 'not_legal' | 'banned' | 'restricted',
    Vintage: card.legalities.vintage as 'legal' | 'not_legal' | 'banned' | 'restricted',
  };
}

function convertParsedCost(card: ScryfallCard, preflipped?: boolean) {
  if (preflipped) {
    return [];
  }

  let parsedCost: string[] = [];
  if (!card.card_faces || card.layout === 'flip') {
    parsedCost = card.mana_cost
      .substr(1, card.mana_cost.length - 2)
      .toLowerCase()
      .split('}{')
      .reverse();
  } else if (card.layout === 'split' || card.layout === 'adventure') {
    parsedCost = card.mana_cost
      .substr(1, card.mana_cost.length - 2)
      .replace(' // ', '{split}')
      .toLowerCase()
      .split('}{')
      .reverse();
  } else if (Array.isArray(card.card_faces) && card.card_faces[0].colors) {
    parsedCost = card.card_faces[0].mana_cost
      .substr(1, card.card_faces[0].mana_cost.length - 2)
      .toLowerCase()
      .split('}{')
      .reverse();
  } else {
    // eslint-disable-next-line no-console
    console.error(`Error converting parsed colors: (isExtra:${preflipped}) ${card.name}`);
  }

  if (parsedCost) {
    parsedCost.forEach((item, index) => {
      parsedCost[index] = item.split('/').join('-');
    });
  }
  return parsedCost;
}

function convertColors(card: ScryfallCard, preflipped?: boolean) {
  if (preflipped) {
    if (!card.card_faces || card.card_faces.length < 2) {
      return [];
    }

    // special case: Adventure faces currently do not have colors on Scryfall (but probably should)
    if (card.layout === 'adventure') {
      return Array.from(card.colors);
    }

    // TODO: handle cards with more than 2 faces
    return Array.from(card.card_faces[1].colors);
  }

  if (!card.card_faces) {
    return Array.from(card.colors);
  }

  // card has faces
  switch (card.layout) {
    // NOTE: flip, split and Adventure cards include colors in the main details but not in the card faces
    case 'flip':
    case 'split':
    case 'adventure':
      return Array.from(card.colors);
    default:
  }

  // otherwise use the colors from the first face
  if (card.card_faces[0].colors) {
    return Array.from(card.card_faces[0].colors);
  }

  // eslint-disable-next-line no-console
  console.error(`Error converting colors: (isExtra:${preflipped}) ${card.name}`);
  return [];
}

function convertType(card: ScryfallCard, preflipped: boolean, faceAttributeSource: ScryfallCard) {
  let type = faceAttributeSource.type_line;
  if (!type) {
    type = card.type_line;
    if (preflipped) {
      type = type.substring(type.indexOf('/') + 2);
    } else if (type.includes('//')) {
      type = type.substring(0, type.indexOf('/'));
    }
  }

  if (type === 'Artifact — Contraption') {
    type = 'Artifact Contraption';
  }

  if (!type) {
    // eslint-disable-next-line no-console
    console.error(`Error converting type: (isExtra:${preflipped}) ${card.name} (id: ${card.id})`);
    return '';
  }
  return type.trim();
}

function convertId(card: ScryfallCard, preflipped: boolean) {
  if (preflipped) {
    return `${card.id}2`;
  }
  return card.id;
}

function convertName(card: ScryfallCard, preflipped: boolean) {
  let str = card.name;

  if (preflipped) {
    str = str.substring(str.indexOf('/') + 2); // second name
  } else if (card.name.includes('/') && card.layout !== 'split') {
    // NOTE: we want split cards to include both names
    // but other double face to use the first name
    str = str.substring(0, str.indexOf('/')); // first name
  }

  if (card.layout === 'art_series') {
    str = `${str} Art Card`;
  }

  return str.trim();
}

function getFaceAttributeSource(card: ScryfallCard, preflipped: boolean) {
  let faceAttributeSource;
  if (preflipped && card.card_faces) {
    faceAttributeSource = card.card_faces[1];
  } else if (card.card_faces) {
    [faceAttributeSource] = card.card_faces;
  } else {
    faceAttributeSource = card;
  }
  return faceAttributeSource;
}

function convertCard(card: ScryfallCard, metadata: CardMetadata, preflipped: boolean): CardDetails {
  const faceAttributeSource = getFaceAttributeSource(card as ScryfallCard, preflipped);

  const newcard: Partial<CardDetails> = {};
  if (preflipped) {
    card = { ...card };
    card.card_faces = [faceAttributeSource];
  }
  newcard.elo = DefaultElo;
  newcard.popularity = 0;
  newcard.cubeCount = 0;
  newcard.pickCount = 0;
  newcard.isExtra = !!preflipped;
  if (metadata) {
    newcard.elo = metadata.elo;
    newcard.popularity = metadata.popularity;
    newcard.cubeCount = metadata.cubes;
    newcard.pickCount = metadata.picks;
  }

  const name = convertName(card, preflipped);
  newcard.color_identity = Array.from(card.color_identity);
  newcard.set = card.set;
  newcard.set_name = card.set_name;
  newcard.finishes = card.finishes;
  newcard.collector_number = card.collector_number;
  newcard.released_at = card.released_at;
  newcard.reprint = card.reprint;

  newcard.promo =
    card.promo ||
    (card.frame_effects && card.frame_effects.includes('extendedart')) ||
    (card.frame_effects && card.frame_effects.includes('showcase')) ||
    card.textless ||
    card.frame === 'art_series' ||
    card.set.toLowerCase() === 'mps' || // kaladesh masterpieces
    card.set.toLowerCase() === 'mp2' || // invocations
    card.set.toLowerCase() === 'exp' || // expeditions
    card.set.toLowerCase() === 'amh1'; // mh1 art cards
  newcard.prices = {
    usd: card.prices.usd ? parseFloat(card.prices.usd) : undefined,
    usd_foil: card.prices.usd_foil ? parseFloat(card.prices.usd_foil) : undefined,
    usd_etched: card.prices.usd_etched ? parseFloat(card.prices.usd_etched) : undefined,
    eur: card.prices.eur ? parseFloat(card.prices.eur) : undefined,
    tix: card.prices.tix ? parseFloat(card.prices.tix) : undefined,
  };

  newcard.digital = card.digital;
  newcard.isToken = card.layout === 'token';
  newcard.border_color = card.border_color as 'black' | 'white' | 'silver' | 'gold' | undefined;
  newcard.name = name;
  newcard.name_lower = cardutil.normalizeName(name);
  newcard.full_name = `${name} [${card.set}-${card.collector_number}]`;
  newcard.artist = card.artist;
  newcard.scryfall_uri = card.scryfall_uri;
  newcard.rarity = card.rarity;
  if (card.produced_mana) {
    newcard.produced_mana = card.produced_mana.map((p) => p.toUpperCase() as ManaSymbol);
  } else {
    newcard.produced_mana = [];
  }
  if (typeof card.card_faces === 'undefined') {
    newcard.oracle_text = card.oracle_text;
  } else {
    // concatenate all card face text to allow it to be found in searches
    newcard.oracle_text = card.card_faces.map((face) => face.oracle_text).join('\n');
  }
  newcard.scryfall_id = convertId(card, preflipped);
  // reversible cards have a separate oracle ID on each face
  newcard.oracle_id = faceAttributeSource.oracle_id || card.oracle_id;
  newcard.cmc = convertCmc(card, preflipped, faceAttributeSource);
  newcard.legalities = convertLegalities(card, preflipped);
  newcard.parsed_cost = convertParsedCost(card, preflipped);
  newcard.colors = convertColors(card, preflipped);
  newcard.type = convertType(card, preflipped, faceAttributeSource);
  newcard.full_art = card.full_art;
  newcard.language = card.lang;
  newcard.mtgo_id = card.mtgo_id;
  newcard.layout = card.layout;

  if (card.tcgplayer_id) {
    newcard.tcgplayer_id = card.tcgplayer_id;
  }
  if (faceAttributeSource.loyalty) {
    newcard.loyalty = faceAttributeSource.loyalty;
  }
  if (faceAttributeSource.power) {
    newcard.power = faceAttributeSource.power;
  }
  if (faceAttributeSource.toughness) {
    newcard.toughness = faceAttributeSource.toughness;
  }
  if (faceAttributeSource.image_uris) {
    newcard.image_small = faceAttributeSource.image_uris.small;
    newcard.image_normal = faceAttributeSource.image_uris.normal;
    newcard.art_crop = faceAttributeSource.image_uris.art_crop;
  } else if (card.image_uris) {
    newcard.image_small = card.image_uris.small;
    newcard.image_normal = card.image_uris.normal;
    newcard.art_crop = card.image_uris.art_crop;
  }
  if (card.card_faces && card.card_faces.length >= 2 && card.card_faces[1].image_uris) {
    newcard.image_flip = card.card_faces[1].image_uris.normal;
  }
  if (newcard.type.toLowerCase().includes('land')) {
    newcard.colorcategory = 'Lands';
  } else if (newcard.color_identity.length === 0) {
    newcard.colorcategory = 'Colorless';
  } else if (newcard.color_identity.length > 1) {
    newcard.colorcategory = 'Multicolored';
  } else if (newcard.color_identity.length === 1) {
    const legacyColorCategoryToCurrentMap = new Map([
      ['w', 'White'],
      ['u', 'Blue'],
      ['b', 'Black'],
      ['r', 'Red'],
      ['g', 'Green'],
    ]);

    const colorFromIdentity = newcard.color_identity[0].toLowerCase();
    if (legacyColorCategoryToCurrentMap.get(colorFromIdentity) !== undefined) {
      newcard.colorcategory = legacyColorCategoryToCurrentMap.get(colorFromIdentity) as ColorCategory;
    } else {
      newcard.colorcategory = colorFromIdentity as ColorCategory;
    }
  }

  const tokens = getTokens(card);
  if (tokens.length > 0) {
    newcard.tokens = tokens;
  }

  return newcard as CardDetails;
}

function addLanguageMapping(card: ScryfallCard) {
  if (card.lang === 'en') {
    return;
  }

  const sameOracle = catalog.oracleToId[card.oracle_id] || [];
  for (const otherId of sameOracle) {
    const otherCard = catalog.dict[otherId];
    if (card.set === otherCard.set && card.collector_number === otherCard.collector_number) {
      catalog.english[card.id] = otherId;
      return;
    }
  }

  const name = cardutil.normalizeName(convertName(card, false));
  for (const otherId of catalog.nameToId[name]) {
    const otherCard = catalog.dict[otherId];
    if (card.set === otherCard.set && card.collector_number === otherCard.collector_number) {
      catalog.english[card.id] = otherId;
      return;
    }
  }
}

async function writeCatalog(basePath = 'private') {
  if (!fs.existsSync(basePath)) {
    fs.mkdirSync(basePath);
  }

  await writeFile(path.join(basePath, 'names.json'), catalog.names);
  await writeFile(path.join(basePath, 'cardtree.json'), util.turnToTree(catalog.names));
  await writeFile(path.join(basePath, 'carddict.json'), catalog.dict);
  await writeFile(path.join(basePath, 'nameToId.json'), catalog.nameToId);
  await writeFile(path.join(basePath, 'oracleToId.json'), catalog.oracleToId);
  await writeFile(path.join(basePath, 'english.json'), catalog.english);
  await writeFile(path.join(basePath, 'full_names.json'), util.turnToTree(catalog.full_names));
  await writeFile(path.join(basePath, 'imagedict.json'), catalog.imagedict);
  await writeFile(path.join(basePath, 'cardimages.json'), catalog.cardimages);
  await writeFile(path.join(basePath, 'metadatadict.json'), catalog.metadatadict);
  await writeFile(path.join(basePath, 'indexToOracle.json'), catalog.indexToOracleId);

  // eslint-disable-next-line no-console
  console.info('All JSON files saved.');
}

function saveEnglishCard(card: ScryfallCard, metadata: CardMetadata) {
  if (card.layout === 'transform') {
    addCardToCatalog(convertCard(card, metadata, true), true);
  }
  addCardToCatalog(convertCard(card, metadata, false), false);
}

async function saveAllCards(metadatadict: Record<string, CardMetadata>, indexToOracle: string[]) {
  // eslint-disable-next-line no-console
  console.info('Processing cards...');
  await new Promise((resolve) =>
    fs
      .createReadStream('./private/cards.json')
      .pipe(JSONStream.parse('*'))
      // @ts-expect-error idk why but this works
      .pipe(es.mapSync((item) => saveEnglishCard(item, metadatadict[item.oracle_id])))
      .on('close', resolve),
  );

  // eslint-disable-next-line no-console
  console.info('Creating language mappings...');
  await new Promise((resolve) =>
    fs
      .createReadStream('./private/all-cards.json')
      .pipe(JSONStream.parse('*'))
      .pipe(es.mapSync(addLanguageMapping))
      .on('close', resolve),
  );

  catalog.indexToOracleId = indexToOracle;
  catalog.metadatadict = metadatadict;

  // eslint-disable-next-line no-console
  console.info('Saving cardbase files...');
  await writeCatalog('./private');
}

const downloadFromScryfall = async (metadatadict: Record<string, CardMetadata>, indexToOracle: string[]) => {
  // eslint-disable-next-line no-console
  console.info('Downloading files from scryfall...');
  try {
    // the module.exports line is necessary to correctly mock this function in unit tests
    await downloadDefaultCards();
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Downloading card data failed:');
    // eslint-disable-next-line no-console
    console.error(error);
    // eslint-disable-next-line no-console
    console.error('Cardbase was not updated');
    return;
  }

  // eslint-disable-next-line no-console
  console.info('Creating objects...');
  try {
    await saveAllCards(metadatadict, indexToOracle);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Updating cardbase objects failed:');
    // eslint-disable-next-line no-console
    console.error(error);
    // eslint-disable-next-line no-console
    console.error('Cardbase update may not have fully completed');
  }

  // eslint-disable-next-line no-console
  console.info('Finished cardbase update...');
};

const s3 = new AWS.S3({
  endpoint: process.env.AWS_ENDPOINT || undefined,
  s3ForcePathStyle: !!process.env.AWS_ENDPOINT,
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION || 'us-east-2',
});

const uploadStream = (key: string) => {
  const pass = new stream.PassThrough();
  return {
    writeStream: pass,
    promise: s3.upload({ Bucket: process.env.DATA_BUCKET || '', Key: key, Body: pass }).promise(),
  };
};

const uploadLargeObjectToS3 = async (file: any, key: string) => {
  await new Promise<void>((resolve, reject) => {
    try {
      const { writeStream, promise } = uploadStream(key);
      const readStream = fs.createReadStream(file);

      readStream.pipe(writeStream);

      promise
        .then(() => {
          resolve();
        })
        .catch((err) => {
          reject(err);
        });
    } catch (error) {
      reject(error);
    }
  });
};

const uploadCardDb = async () => {
  for (const file of Object.keys(fileToAttribute)) {
    // eslint-disable-next-line no-console
    console.log(`Uploading ${file}...`);

    await uploadLargeObjectToS3(`private/${file}`, `cards/${file}`);

    // eslint-disable-next-line no-console
    console.log(`Finished ${file}`);
  }

  // eslint-disable-next-line no-console
  console.log('Uploading manifest...');
  await s3
    .upload({
      Bucket: process.env.DATA_BUCKET || '',
      Key: `cards/manifest.json`,
      Body: JSON.stringify({ date_exported: new Date() }),
    })
    .promise();
  // eslint-disable-next-line no-console
  console.log('Finished manifest');

  // eslint-disable-next-line no-console
  console.log('done');
};

const loadMetadatadict = async () => {
  if (fs.existsSync('./temp') && fs.existsSync('./temp/metadatadict.json')) {
    const metadatadict = JSON.parse(fs.readFileSync('./temp/metadatadict.json', 'utf8'));
    const indexToOracle = JSON.parse(fs.readFileSync('./temp/indexToOracle.json', 'utf8'));

    return {
      metadatadict,
      indexToOracle,
    };
  }

  // eslint-disable-next-line no-console
  console.log("Couldn't find metadatadict.json");
  return {
    metadatadict: {},
    indexToOracle: [],
  };
};

(async () => {
  try {
    const { metadatadict, indexToOracle } = await loadMetadatadict();
    await downloadFromScryfall(metadatadict, indexToOracle);
    await uploadCardDb();

    // eslint-disable-next-line no-console
    console.log('Complete');

    process.exit();
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(error);
  }
})();
