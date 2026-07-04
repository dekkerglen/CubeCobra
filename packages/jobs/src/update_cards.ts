import crypto from 'crypto';
import dotenv from 'dotenv';

import 'module-alias/register';
dotenv.config({ path: require('path').join(__dirname, '..', '..', '.env') });

import { GetObjectCommand } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import { cardUpdateTaskDao } from '@server/dynamo/daos';
import { s3 } from '@server/dynamo/s3client';
import { binaryInsert } from '@server/serverutils/util';
import * as cardutil from '@utils/cardutil';
import { CardDetails, ColorCategory, DefaultElo, Game, Legality } from '@utils/datatypes/Card';
import { CardMetadata } from '@utils/datatypes/CardCatalog';
import { ManaSymbol } from '@utils/datatypes/Mana';
import { SetInfo } from '@utils/datatypes/SetInfo';
import es from 'event-stream';
import fs, { createWriteStream } from 'fs';
// @ts-ignore - JSONStream doesn't have proper types
import JSONStream from 'JSONStream';
import fetch from 'node-fetch';
import path from 'path';
import stream, { pipeline } from 'stream';
import zlib from 'zlib';

import { syncCardImages } from './sync_card_images';
import { syncSetSymbols, toSymbolSources } from './sync_set_symbols';
import { downloadJson, uploadFile } from './utils/s3';
import { SCRYFALL_HEADERS } from './utils/scryfall';
import {
  convertName,
  ScryfallCard,
  ScryfallCardFace,
  ScryfallLegalityFormats,
  ScryfallSet,
  SUPPORTED_SCRYFALL_FORMATS,
} from './utils/update_cards';

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
  illustrationIdToScryfallIds: Record<string, string[]>;
}

interface SetRelease {
  code: string;
  released_at: Date;
  set_type: string;
}

const sets: SetRelease[] = [];
let orderedSetCodes: string[] = [];

// Full set metadata keyed by set code, written to setdict.json and served to the
// Explore -> Sets page. Populated alongside `sets` during processSets.
const setdict: Record<string, SetInfo> = {};

// Raw Scryfall icon_svg_uri per set code — the source for the R2 symbol sync.
// Kept separate from setdict.icon, which may already be rewritten to our CDN.
const scryfallSetIcons: Record<string, string> = {};

// When configured, set symbols are served from our R2 cache at
// {SET_SYMBOL_BASE_URL}/{code}.svg; otherwise we hotlink Scryfall's icon.
const setSymbolBase = process.env.SET_SYMBOL_BASE_URL?.replace(/\/$/, '');

// Lookup set_type by set code (populated during processSets)
const setTypeByCode: Record<string, string> = {};

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
  illustrationIdToScryfallIds: {},
};

// Track the earliest released_at per oracle_id to compute firstPrintYear
const earliestReleaseByOracle: Record<string, string> = {};

// Track which oracle_ids have appeared in an expansion set
const oracleInExpansion: Set<string> = new Set();

const PRIVATE_DIR = path.resolve(__dirname, '..', '..', 'server', 'private');

// When `gunzip` is true the response is un-gzipped before being written to disk.
// Scryfall's bulk exports are now served as standalone .jsonl.gz files (a gzipped
// file on disk, not gzip transfer-encoding), so fetch hands us the raw gzip bytes
// and we must inflate them ourselves. Other downloads (sets, price lists) are
// plain JSON and pass gunzip=false.
async function downloadFile(url: string, filePath: string, gunzip = false) {
  // filePath should be an absolute path
  const folder = filePath.substring(0, filePath.lastIndexOf(path.sep));
  if (!fs.existsSync(folder)) {
    fs.mkdirSync(folder, { recursive: true });
  }

  const response = await fetch(url, { headers: SCRYFALL_HEADERS });
  if (!response.ok) {
    throw new Error(`Request to '${url}' failed with status: ${response.statusText}`);
  }

  if (!response.body) {
    throw new Error(`Response body is null for URL: ${url}`);
  }

  return new Promise<void>((resolve, reject) => {
    const fileStream = createWriteStream(filePath);
    const onDone = (err: NodeJS.ErrnoException | null) => {
      if (err) {
        reject(new Error(`Download error for '${url}':\n${err.message}`));
      } else {
        resolve();
      }
    };
    if (gunzip) {
      pipeline(response.body!, zlib.createGunzip(), fileStream, onDone);
    } else {
      pipeline(response.body!, fileStream, onDone);
    }
  });
}

// Helper to download file - always fetches fresh data for update jobs
async function getFileWithCache(
  url: string,
  filePath: string,
  useS3Cache?: boolean,
  gunzip?: boolean,
): Promise<fs.ReadStream> {
  // For update jobs, always download fresh data - skip S3 cache check
  // The cache is only useful for non-update operations

  // Download file
  await downloadFile(url, filePath, gunzip);

  if (useS3Cache) {
    // Upload to S3 cache using streaming to avoid memory issues with large files
    const fileName = path.basename(filePath);
    const cacheKey = `cache/${fileName}`;
    await uploadFile(cacheKey, filePath, 'application/json');
  }

  return fs.createReadStream(filePath);
}

async function downloadDefaultCards(useS3Cache?: boolean): Promise<{ updatedAt: string; fileSize: number }> {
  let defaultUrl;
  let allUrl;
  let allCardsMetadata: { updated_at: string; size: number } | undefined;

  const res = await fetch('https://api.scryfall.com/bulk-data', { headers: SCRYFALL_HEADERS });
  if (!res.ok) throw new Error(`Download of /bulk-data failed with code ${res.status}`);
  const resjson = (await res.json()) as {
    data: Array<{
      type: string;
      // Scryfall's newer bulk format: a gzipped JSONL file (one card per line).
      // download_uri (the deprecated streaming-gzip JSON array) is retired after
      // 2026-07-20, so we consume jsonl_download_uri exclusively.
      jsonl_download_uri: string;
      updated_at: string;
      size: number;
    }>;
  };

  for (const data of resjson.data) {
    if (data.type === 'default_cards') {
      defaultUrl = data.jsonl_download_uri;
    } else if (data.type === 'all_cards') {
      allUrl = data.jsonl_download_uri;
      allCardsMetadata = { updated_at: data.updated_at, size: data.size };
    }
  }

  if (!defaultUrl) throw new Error('URL for Default cards not found in /bulk-data response');
  if (!allUrl) throw new Error('URL for All cards not found in /bulk-data response');
  if (!allCardsMetadata) throw new Error('Metadata for All cards not found in /bulk-data response');

  // The bulk files are gzipped JSONL — gunzip on download so the .jsonl files on
  // disk are plain newline-delimited JSON for saveAllCards to stream line-by-line.
  await Promise.all([
    getFileWithCache(defaultUrl, `${PRIVATE_DIR}/cards.jsonl`, useS3Cache, true),
    getFileWithCache(allUrl, `${PRIVATE_DIR}/all-cards.jsonl`, useS3Cache, true),
  ]);

  return {
    updatedAt: allCardsMetadata.updated_at,
    fileSize: allCardsMetadata.size,
  };
}

async function downloadSets(useS3Cache?: boolean) {
  await getFileWithCache('https://api.scryfall.com/sets', `${PRIVATE_DIR}/sets.json`, useS3Cache);
}

const addToNameToIdMap = (normalizedName: string, scryFallId: string) => {
  // only add if it doesn't exist, this makes the default the newest edition
  if (!catalog.nameToId[normalizedName]) {
    catalog.nameToId[normalizedName] = [];
  }
  if (!catalog.nameToId[normalizedName].includes(scryFallId)) {
    catalog.nameToId[normalizedName].push(scryFallId);
  }
};

function addCardToCatalog(card: CardDetails, isExtra?: boolean) {
  catalog.dict[card.scryfall_id] = card;

  // Track earliest release date per oracle_id
  if (card.oracle_id && card.released_at) {
    const existing = earliestReleaseByOracle[card.oracle_id];
    if (!existing || card.released_at < existing) {
      earliestReleaseByOracle[card.oracle_id] = card.released_at;
    }
  }

  // Track if this oracle has ever appeared in an expansion set
  if (card.oracle_id && card.set_type === 'expansion') {
    oracleInExpansion.add(card.oracle_id);
  }

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
    if (cardutil.reasonableCard(card)) {
      catalog.cardimages[normalizedName] = cardImages;
    }
  }
  addToNameToIdMap(normalizedName, card.scryfall_id);
  if (!catalog.oracleToId[card.oracle_id]) {
    catalog.oracleToId[card.oracle_id] = [];
  }
  catalog.oracleToId[card.oracle_id]!.push(card.scryfall_id);
  binaryInsert(normalizedName, catalog.names);
  binaryInsert(normalizedFullName, catalog.full_names);
}

// Stream a Scryfall JSONL bulk file, invoking `onItem` for each card. The bulk
// exports are newline-delimited JSON (one object per line, no wrapping array),
// so we split on newlines and JSON.parse each line rather than walking array
// elements the way JSONStream.parse('*') did for the old JSON-array format.
function processJsonlFile(filePath: string, onItem: (item: any) => void): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    fs.createReadStream(filePath)
      .pipe(es.split())
      .pipe(
        es.mapSync((line: string) => {
          // es.split() yields a trailing empty string for the final newline; skip it.
          if (line.length === 0) return;
          onItem(JSON.parse(line));
        }),
      )
      .on('close', resolve)
      .on('error', reject);
  });
}

async function writeFile(filepath: string, data: any) {
  return new Promise<void>((resolve, reject) => {
    try {
      const writeStart = Date.now();
      // Create write stream
      const writeStream = fs.createWriteStream(filepath);

      // Create a readable stream
      const readable = stream.Readable.from([data]);

      // Create JSON stringifier so it doesn't wrap in [] or {} unnecessarily
      const stringifier = JSONStream.stringify('', ',', '') as stream.Transform;

      // Use pipeline to handle streams
      pipeline(readable, stringifier, writeStream, (err: NodeJS.ErrnoException | null) => {
        if (err) {
          reject(err);
          return;
        }
        const writeDuration = (Date.now() - writeStart) / 1000;

        console.log(`Finished writing ${filepath}. Duration: ${writeDuration.toFixed(2)}s`);
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

// Storm permanents create copies of themselves, so they need the Copy token
function getExtraTokensForStorm(card: ScryfallCard) {
  const extraTokens: string[] = [];

  // Check if it's a permanent spell (not an instant or sorcery) with Storm keyword
  if (card.keywords && card.keywords.includes('Storm')) {
    const isPermanent = !card.type_line.includes('Instant') && !card.type_line.includes('Sorcery');

    if (isPermanent) {
      // Copy token
      extraTokens.push('61328aec-ba26-4142-a774-96924303786d');
    }
  }

  return extraTokens;
}

function getTokens(card: ScryfallCard) {
  return getScryfallTokensForCard(card).concat(getExtraTokensForDungeons(card)).concat(getExtraTokensForStorm(card));
}

function convertCmc(card: ScryfallCard, preflipped: boolean, faceAttributeSource: ScryfallCardFace) {
  if (preflipped) {
    if (faceAttributeSource.cmc) {
      return faceAttributeSource.cmc;
    }
  }

  // For some DFC layouts the top-level cmc is 0 even though the printed front
  // face has a real mana value. This is true of "reversible_card" promos and
  // of Secret Lair same-face DFC promos (e.g. the Birds of Paradise promo where
  // both faces are Birds — top-level cmc is 0 but each face is 1).
  // Fall back to the face cmc when the top-level value would otherwise drop a
  // real mana cost. Normal DFCs (Delver, etc.) already carry card.cmc, so they
  // are unaffected.
  if (!card.cmc && faceAttributeSource.cmc) {
    return faceAttributeSource.cmc;
  }

  return card.cmc || 0;
}

function convertLegalities(card: ScryfallCard, preflipped?: boolean): Record<ScryfallLegalityFormats, Legality> {
  if (preflipped) {
    return { ...ALL_NOT_LEGAL };
  }
  return Object.fromEntries(
    SUPPORTED_SCRYFALL_FORMATS.map((format) => [format, card.legalities[format.toLowerCase()] as Legality]),
  );
}

function convertGames(card: ScryfallCard): Game[] | undefined {
  return card.games;
}

function convertParsedCost(card: ScryfallCard, preflipped?: boolean) {
  if (preflipped) {
    return [];
  }

  let parsedCost: string[] = [];

  // Debug logging
  // console.log(`Processing card: ${card.name}, layout: ${card.layout}, mana_cost: ${card.mana_cost}, has_card_faces: ${!!card.card_faces}, type_line: ${card.type_line}`);

  // Handle cards without mana cost (lands, tokens, etc.)
  if (!card.mana_cost && (!card.card_faces || !card.card_faces[0]?.mana_cost)) {
    return []; // Return empty array for cards without mana cost
  }

  // First check if the card has a mana_cost at the card level
  if (card.mana_cost && (!card.card_faces || card.layout === 'flip')) {
    parsedCost = card.mana_cost
      .substr(1, card.mana_cost.length - 2)
      .toLowerCase()
      .split('}{')
      .reverse();
  } else if (card.mana_cost && (card.layout === 'split' || card.layout === 'adventure' || card.layout === 'prepare')) {
    // 'prepare' (Secrets of Strixhaven) uses the adventure-style inset layout: a
    // creature with a small spell inset on the right, top-level mana_cost is
    // "{front} // {prepare}" — same shape as adventure cards.
    parsedCost = card.mana_cost
      .substr(1, card.mana_cost.length - 2)
      .replace(' // ', '{split}')
      .toLowerCase()
      .split('}{')
      .reverse();
  } else if (Array.isArray(card.card_faces) && card.card_faces[0]?.mana_cost) {
    // For double-faced cards, use the first face's mana cost
    parsedCost = card.card_faces[0].mana_cost
      .substr(1, card.card_faces[0].mana_cost.length - 2)
      .toLowerCase()
      .split('}{')
      .reverse();
  } else if (card.mana_cost) {
    // Fallback to card-level mana cost for other layouts
    parsedCost = card.mana_cost
      .substr(1, card.mana_cost.length - 2)
      .toLowerCase()
      .split('}{')
      .reverse();
  } else {
    // Only log error if there's truly no mana cost anywhere and it's not a land/token

    console.error(
      `Error converting parsed cost: (isExtra:${preflipped}) ${card.name} - layout: ${card.layout}, mana_cost: ${card.mana_cost}, type_line: ${card.type_line}`,
    );
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
    if (card.card_faces[1]?.colors) {
      return Array.from(card.card_faces[1].colors);
    }
  }

  if (!card.card_faces) {
    return Array.from(card.colors);
  }

  // card has faces
  switch (card.layout) {
    // NOTE: flip, split, Adventure, and Prepare (Strixhaven inset spell) cards
    // include colors in the main details but not in the card faces.
    case 'flip':
    case 'split':
    case 'adventure':
    case 'prepare':
      return Array.from(card.colors);
    default:
  }

  // otherwise use the colors from the first face
  if (card.card_faces[0]?.colors) {
    return Array.from(card.card_faces[0].colors);
  }

  console.error(`Error converting colors: (isExtra:${preflipped}) ${card.name}`);
  return [];
}

function convertType(card: ScryfallCard, preflipped: boolean, faceAttributeSource: ScryfallCardFace) {
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

  if (!type && card.id !== 'custom-card') {
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

function getFaceAttributeSource(card: ScryfallCard, preflipped: boolean): ScryfallCardFace {
  let faceAttributeSource: ScryfallCardFace;
  if (preflipped && card.card_faces && card.card_faces[1]) {
    faceAttributeSource = card.card_faces[1];
  } else if (card.card_faces && card.card_faces[0]) {
    faceAttributeSource = card.card_faces[0];
  } else {
    faceAttributeSource = {
      ...card,
      object: 'card_face',
    } as ScryfallCardFace;
  }
  return faceAttributeSource;
}

function convertCard(
  card: ScryfallCard,
  metadata: CardMetadata | undefined,
  ckPrice: number | undefined,
  mpPrice: number | undefined,
  preflipped: boolean,
): CardDetails {
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

  // Mark component=meld_result as extra.
  const isMeldResult =
    card.layout === 'meld' && card.all_parts?.some((part) => part.id === card.id && part.component === 'meld_result');
  newcard.isExtra = !!preflipped || !!isMeldResult;

  if (metadata) {
    newcard.elo = metadata.elo;
    newcard.popularity = metadata.popularity;
    newcard.cubeCount = metadata.cubes;
    newcard.pickCount = metadata.picks;
  }
  newcard.hasFlavorName = !!card.flavor_name;

  const name = convertName(card, preflipped);
  newcard.color_identity = Array.from(card.color_identity);
  newcard.set = card.set;
  newcard.set_name = card.set_name;
  newcard.set_type = setTypeByCode[card.set] || undefined;
  newcard.setIndex = orderedSetCodes.indexOf(newcard.set);
  newcard.finishes = card.finishes;
  newcard.collector_number = card.collector_number;
  newcard.released_at = card.released_at;
  newcard.reprint = card.reprint;

  newcard.promo = card.promo;
  newcard.prices = {
    usd: card.prices.usd ? parseFloat(card.prices.usd) : undefined,
    usd_foil: card.prices.usd_foil ? parseFloat(card.prices.usd_foil) : undefined,
    usd_etched: card.prices.usd_etched ? parseFloat(card.prices.usd_etched) : undefined,
    eur: card.prices.eur ? parseFloat(card.prices.eur) : undefined,
    tix: card.prices.tix ? parseFloat(card.prices.tix) : undefined,
    ck: ckPrice,
    mp: mpPrice,
  };
  newcard.promo_types = card.promo_types || undefined;

  newcard.digital = card.digital;
  newcard.isToken = card.layout === 'token' || card.layout === 'double_faced_token';
  newcard.border_color = card.border_color as 'black' | 'white' | 'silver' | 'gold' | undefined;
  newcard.name = name;
  newcard.name_lower = cardutil.normalizeName(name);
  newcard.full_name = `${name} [${card.set}-${card.collector_number}]`;
  newcard.artist = card.artist;
  newcard.scryfall_uri = card.scryfall_uri;
  newcard.rarity = card.rarity;
  newcard.reserved = card.reserved;
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
  newcard.games = convertGames(card);
  newcard.gamesEverAvailable = newcard.games || [];
  newcard.parsed_cost = convertParsedCost(card, preflipped);
  newcard.colors = convertColors(card, preflipped);
  newcard.type = convertType(card, preflipped, faceAttributeSource);
  newcard.full_art = card.full_art;
  newcard.language = card.lang;
  newcard.mtgo_id = card.mtgo_id;
  newcard.layout = card.layout;
  newcard.keywords = card.keywords;

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
  // When CARD_IMAGE_BASE_URL is set, emit URLs for our self-hosted webp images
  // (R2 via Cloudflare) instead of hotlinking Scryfall. Layout is
  // {base}/{scryfall_id}/{normal|small|art_crop}[_back].webp — see
  // packages/jobs/src/sync_card_images.ts and packages/scripts/seed-cardimages.mjs.
  // Reversible "preflipped" entries get id `${card.id}2` (convertId), but their
  // art lives under the real card.id's back face, so we use card.id + _back.
  const cardImageBase = process.env.CARD_IMAGE_BASE_URL?.replace(/\/$/, '');
  if (cardImageBase) {
    const face = preflipped ? '_back' : '';
    newcard.image_small = `${cardImageBase}/${card.id}/small${face}.webp`;
    newcard.image_normal = `${cardImageBase}/${card.id}/normal${face}.webp`;
    newcard.art_crop = `${cardImageBase}/${card.id}/art_crop${face}.webp`;
    if (!preflipped && card.card_faces && card.card_faces.length >= 2 && card.card_faces[1]?.image_uris) {
      newcard.image_flip = `${cardImageBase}/${card.id}/normal_back.webp`;
    }
  } else if (faceAttributeSource.image_uris) {
    newcard.image_small = faceAttributeSource.image_uris.small;
    newcard.image_normal = faceAttributeSource.image_uris.normal;
    newcard.art_crop = faceAttributeSource.image_uris.art_crop;
  } else if (card.image_uris) {
    newcard.image_small = card.image_uris.small;
    newcard.image_normal = card.image_uris.normal;
    newcard.art_crop = card.image_uris.art_crop;
  }
  if (!cardImageBase && card.card_faces && card.card_faces.length >= 2 && card.card_faces[1]?.image_uris) {
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

    const colorFromIdentity = newcard.color_identity[0]?.toLowerCase();
    if (colorFromIdentity && legacyColorCategoryToCurrentMap.get(colorFromIdentity) !== undefined) {
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
    if (otherCard && card.set === otherCard.set && card.collector_number === otherCard.collector_number) {
      catalog.english[card.id] = otherId;
      return;
    }
  }

  const name = cardutil.normalizeName(convertName(card, false));
  const nameToIdArray = catalog.nameToId[name];
  if (nameToIdArray) {
    for (const otherId of nameToIdArray) {
      const otherCard = catalog.dict[otherId];
      if (otherCard && card.set === otherCard.set && card.collector_number === otherCard.collector_number) {
        catalog.english[card.id] = otherId;
        return;
      }
    }
  }
}

async function writeCatalog(basePath = PRIVATE_DIR) {
  if (!fs.existsSync(basePath)) {
    fs.mkdirSync(basePath);
  }

  const start = Date.now();

  await writeFile(path.join(basePath, 'names.json'), catalog.names);
  await writeFile(path.join(basePath, 'carddict.json'), catalog.dict);
  await writeFile(path.join(basePath, 'nameToId.json'), catalog.nameToId);
  await writeFile(path.join(basePath, 'oracleToId.json'), catalog.oracleToId);
  await writeFile(path.join(basePath, 'english.json'), catalog.english);
  // full_names is a sorted string array; the server loads it into memory for
  // the /tool/api/cardnames autocomplete endpoint (matching runs server-side).
  await writeFile(path.join(basePath, 'full_names.json'), catalog.full_names);
  await writeFile(path.join(basePath, 'imagedict.json'), catalog.imagedict);
  await writeFile(path.join(basePath, 'cardimages.json'), catalog.cardimages);
  await writeFile(path.join(basePath, 'metadatadict.json'), catalog.metadatadict);
  await writeFile(path.join(basePath, 'indexToOracle.json'), catalog.indexToOracleId);
  await writeFile(path.join(basePath, 'illustrationIdToScryfallIds.json'), catalog.illustrationIdToScryfallIds);
  await writeFile(path.join(basePath, 'setdict.json'), setdict);

  const duration = (Date.now() - start) / 1000;

  console.info(`All JSON files saved. Duration: ${duration.toFixed(2)}s`);
}

function saveCard(card: ScryfallCard, metadata: CardMetadata | undefined, ckPrice: number, mpPrice: number) {
  if (card.layout === 'transform') {
    addCardToCatalog(convertCard(card, metadata, ckPrice, mpPrice, true), true);
  }
  const convertedCard = convertCard(card, metadata, ckPrice, mpPrice, false);
  addCardToCatalog(convertedCard, false);
  //card.name contains both faces name
  addToNameToIdMap(cardutil.normalizeName(card.name), convertedCard.scryfall_id);

  // Map illustration_id -> scryfall_ids for illustration tag lookups
  if (card.illustration_id) {
    if (!catalog.illustrationIdToScryfallIds[card.illustration_id]) {
      catalog.illustrationIdToScryfallIds[card.illustration_id] = [];
    }
    catalog.illustrationIdToScryfallIds[card.illustration_id]!.push(convertedCard.scryfall_id);
  }
}

const ALL_NOT_LEGAL = Object.fromEntries(SUPPORTED_SCRYFALL_FORMATS.map((format) => [format, 'not_legal' as const]));

// Static cards to be added to the import pipeline
// These cards will be processed alongside cards downloaded from Scryfall
const STATIC_CARDS: ScryfallCard[] = [
  {
    id: 'custom-card',
    oracle_id: 'custom-card',
    name: 'Custom Card',
    printed_name: undefined,
    lang: 'en',
    set: '',
    set_name: '',
    collector_number: '',
    released_at: '',
    reprint: false,
    border_color: 'black',
    promo: false,
    promo_types: [],
    digital: false,
    finishes: [],
    prices: {
      usd: null,
      usd_foil: null,
      usd_etched: null,
      eur: null,
      tix: null,
    },
    image_uris: {
      small: '',
      normal: '/content/custom_card.png',
      art_crop: '/content/custom_card_art_crop.png',
    },
    card_faces: undefined,
    loyalty: undefined,
    power: undefined,
    toughness: undefined,
    type_line: '',
    oracle_text: '',
    mana_cost: '',
    cmc: 0,
    colors: [],
    color_identity: [],
    keywords: [],
    produced_mana: [],
    legalities: { ...ALL_NOT_LEGAL },
    layout: 'normal',
    rarity: 'common',
    artist: '',
    scryfall_uri: '',
    mtgo_id: 0,
    textless: false,
    tcgplayer_id: '',
    full_art: false,
    flavor_text: '',
    frame_effects: [],
    frame: '',
    card_back_id: '',
    artist_id: '',
    illustration_id: '',
    content_warning: false,
    variation: false,
    games: [],
    reserved: false,
    preview: {
      source: '',
      source_uri: '',
      previewed_at: '',
    },
    related_uris: {
      gatherer: '',
      tcgplayer_decks: '',
      edhrec: '',
      mtgtop8: '',
    },
    all_parts: [],
    object: 'card',
  },
  {
    id: 'voucher',
    oracle_id: 'voucher',
    name: 'Voucher',
    printed_name: undefined,
    lang: 'en',
    set: '',
    set_name: '',
    collector_number: '',
    released_at: '',
    reprint: false,
    border_color: 'black',
    promo: false,
    promo_types: [],
    digital: false,
    finishes: [],
    prices: {
      usd: null,
      usd_foil: null,
      usd_etched: null,
      eur: null,
      tix: null,
    },
    image_uris: {
      small: '',
      normal: '/content/custom_card.png',
      art_crop: '/content/custom_card_art_crop.png',
    },
    card_faces: undefined,
    loyalty: undefined,
    power: undefined,
    toughness: undefined,
    type_line: '',
    oracle_text: '',
    mana_cost: '',
    cmc: 0,
    colors: [],
    color_identity: [],
    keywords: [],
    produced_mana: [],
    legalities: { ...ALL_NOT_LEGAL },
    layout: 'normal',
    rarity: 'common',
    artist: '',
    scryfall_uri: '',
    mtgo_id: 0,
    textless: false,
    tcgplayer_id: '',
    full_art: false,
    flavor_text: '',
    frame_effects: [],
    frame: '',
    card_back_id: '',
    artist_id: '',
    illustration_id: '',
    content_warning: false,
    variation: false,
    games: [],
    reserved: false,
    preview: {
      source: '',
      source_uri: '',
      previewed_at: '',
    },
    related_uris: {
      gatherer: '',
      tcgplayer_decks: '',
      edhrec: '',
      mtgtop8: '',
    },
    all_parts: [],
    object: 'card',
  },
];

async function saveAllCards(
  metadatadict: Record<string, CardMetadata>,
  indexToOracle: string[],
  ckPrices: Record<string, number>,
  mpPrices: Record<string, number>,
) {
  console.info('Processing static cards...');
  for (const staticCard of STATIC_CARDS) {
    saveCard(
      staticCard,
      metadatadict[staticCard.oracle_id],
      ckPrices[staticCard.id] ?? 0,
      mpPrices[staticCard.id] ?? 0,
    );
  }

  console.info(`Processed ${STATIC_CARDS.length} static cards.`);

  console.info('Processing cards...');
  const processingCardsStart = Date.now();
  await processJsonlFile(`${PRIVATE_DIR}/cards.jsonl`, (item) =>
    // ckPrices/mpPrices may not have an entry for every card; passing undefined
    // through (rather than 0) keeps "no price" distinct from "$0.00", same as before.
    saveCard(item, metadatadict[item.oracle_id], ckPrices[item.id] as number, mpPrices[item.id] as number),
  );
  const processingCardsDuration = (Date.now() - processingCardsStart) / 1000;
  const cardCount = Object.keys(catalog.dict).length;

  console.log(
    `Finished processing ${cardCount} cards. Duration: ${processingCardsDuration.toFixed(2)}s, RPS: ${(cardCount / processingCardsDuration).toFixed(2)}`,
  );

  console.info('Creating language mappings...');
  const languageMappingsStart = Date.now();
  await processJsonlFile(`${PRIVATE_DIR}/all-cards.jsonl`, addLanguageMapping);
  const languageMappingCount = Object.keys(catalog.english).length;
  const languageMappingsDuration = (Date.now() - languageMappingsStart) / 1000;

  console.log(
    `Finished proccessing ${languageMappingCount} language mappings. Duration: ${languageMappingsDuration.toFixed(2)}s, RPS: ${(languageMappingCount / languageMappingsDuration).toFixed(2)}`,
  );

  catalog.indexToOracleId = indexToOracle;
  catalog.metadatadict = metadatadict;

  // Set firstPrintYear and printedInExpansion on all cards based on oracle_id data
  console.info('Computing firstPrintYear and printedInExpansion for all cards...');
  for (const card of Object.values(catalog.dict)) {
    const earliest = earliestReleaseByOracle[card.oracle_id];
    if (earliest) {
      const year = parseInt(earliest.substring(0, 4), 10);
      if (!isNaN(year)) {
        card.firstPrintYear = year;
      }
    }
    card.printedInExpansion = oracleInExpansion.has(card.oracle_id);
  }
  console.info('Finished computing firstPrintYear and printedInExpansion.');

  // Compute gamesEverAvailable: union of games across all versions sharing the same oracle_id
  console.info('Computing gamesEverAvailable for all cards...');
  const gamesByOracle: Record<string, Set<Game>> = {};
  for (const card of Object.values(catalog.dict)) {
    if (!card.oracle_id) continue;
    if (!gamesByOracle[card.oracle_id]) {
      gamesByOracle[card.oracle_id] = new Set();
    }
    for (const game of card.games || []) {
      gamesByOracle[card.oracle_id]!.add(game);
    }
  }
  for (const card of Object.values(catalog.dict)) {
    const oracleGames = gamesByOracle[card.oracle_id];
    card.gamesEverAvailable = oracleGames ? Array.from(oracleGames) : card.games || [];
  }
  console.info('Finished computing gamesEverAvailable.');
}

async function saveSet(set: ScryfallSet) {
  //According to the API this could be undefined or null, but didn't find any instances
  if (!set.released_at) {
    console.log(`Set ${set.code} has no release at date`);
  }

  sets.push({
    code: set.code,
    //Set Pacific time offset based on Scryfalls API. Even though JS dates suck at timezones
    released_at: new Date(`${set.released_at!}T00:00:00-08:00`),
    set_type: set.set_type,
  });

  setdict[set.code] = {
    code: set.code,
    name: set.name,
    setType: set.set_type,
    releasedAt: set.released_at ?? null,
    cardCount: set.card_count,
    parentSetCode: set.parent_set_code,
    digital: set.digital,
    icon: setSymbolBase ? `${setSymbolBase}/${set.code}.svg` : set.icon_svg_uri,
  };
  if (set.icon_svg_uri) {
    scryfallSetIcons[set.code] = set.icon_svg_uri;
  }
}

async function processSets() {
  console.info('Processing sets...');
  await new Promise((resolve) =>
    fs
      .createReadStream(`${PRIVATE_DIR}/sets.json`)
      .pipe(JSONStream.parse('data.*'))
      .pipe(
        // @ts-expect-error idk why but this works
        es.mapSync((item) => saveSet(item)),
      )
      .on('close', resolve),
  );

  await sortSets();
}

const sortSets = async () => {
  //Sort by ascending date
  sets.sort((a, b) => {
    return a.released_at.getTime() - b.released_at.getTime();
  });

  orderedSetCodes = sets.map((set) => set.code);

  // Build set_type lookup by set code
  for (const set of sets) {
    setTypeByCode[set.code] = set.set_type;
  }
};

const downloadFromScryfall = async (
  metadatadict: Record<string, CardMetadata>,
  indexToOracle: string[],
  ckPrices: Record<string, number>,
  mpPrices: Record<string, number>,
  useS3Cache?: boolean,
  taskId?: string,
): Promise<{ updatedAt: string; fileSize: number } | undefined> => {
  try {
    if (taskId) {
      await cardUpdateTaskDao.updateStep(taskId, 'Downloading set data');
    }
    await downloadSets(useS3Cache);
    await processSets();
  } catch (error) {
    console.error('Downloading set data failed:');

    console.error(error);

    console.error('Sets were not updated');
    return undefined;
  }

  console.info('Downloading files from scryfall or cache...');
  let scryfallMetadata: { updatedAt: string; fileSize: number };
  try {
    if (taskId) {
      await cardUpdateTaskDao.updateStep(taskId, 'Downloading card data from Scryfall');
    }
    scryfallMetadata = await downloadDefaultCards(useS3Cache);
  } catch (error) {
    console.error('Downloading card data failed:');

    console.error(error);

    console.error('Cardbase was not updated');
    return undefined;
  }

  console.info('Creating objects...');
  try {
    if (taskId) {
      await cardUpdateTaskDao.updateStep(taskId, 'Creating card objects');
    }
    await saveAllCards(metadatadict, indexToOracle, ckPrices, mpPrices);
  } catch (error) {
    console.error('Updating cardbase objects failed:');

    console.error(error);

    console.error('Cardbase update may not have fully completed');
  }

  try {
    console.info('Saving catalog...');
    if (taskId) {
      await cardUpdateTaskDao.updateStep(taskId, 'Saving catalog');
    }
    await writeCatalog(PRIVATE_DIR);
  } catch (error) {
    console.error('Updating cardbase objects failed:');

    console.error(error);

    console.error('Cardbase update may not have fully completed');
  }

  console.info('Finished cardbase update...');
  return scryfallMetadata;
};

const uploadLargeObjectToS3 = async (file: any, key: string) => {
  try {
    const pass = new stream.PassThrough();
    const readStream = fs.createReadStream(file);
    const upload = new Upload({ client: s3, params: { Bucket: process.env.DATA_BUCKET || '', Key: key, Body: pass } });

    readStream.pipe(pass);

    await upload.done();
  } catch (error) {
    console.error(`Failed to upload ${error}`);
  }
};

// Files that the card update job uploads under cards/. Includes metadatadict/indexToOracle
// (generated by update_metadata_dict and re-uploaded here so the server, which reads from
// cards/, sees the latest version). Excludes combo files which are generated by update_combos.
const CARD_UPDATE_FILES = [
  'carddict.json',
  'names.json',
  'nameToId.json',
  'oracleToId.json',
  'full_names.json',
  'imagedict.json',
  'cardimages.json',
  'english.json',
  'illustrationIdToScryfallIds.json',
  'metadatadict.json',
  'indexToOracle.json',
  'setdict.json',
];

const uploadCardDb = async (scryfallMetadata: { updatedAt: string; fileSize: number }, taskId?: string) => {
  // Calculate current card count
  const currentCardCount = Object.keys(catalog.dict).length;
  console.log(`Current card count: ${currentCardCount}`);

  // Try to get previous card count from the old manifest
  let previousCardCount = 0;
  try {
    const previousManifest = await s3.send(
      new GetObjectCommand({
        Bucket: process.env.DATA_BUCKET || '',
        Key: 'cards/manifest.json',
      }),
    );
    const manifestContent = await previousManifest.Body?.transformToString();
    if (manifestContent) {
      const oldManifest = JSON.parse(manifestContent);
      // If old manifest had totalCards, use it; otherwise try to get from old all_cards.json
      if (oldManifest.totalCards) {
        previousCardCount = oldManifest.totalCards;
        console.log(`Found previous manifest with ${previousCardCount} cards`);
      } else {
        console.log('Previous manifest found but missing totalCards field');
      }
    }
  } catch (error) {
    console.log(`No previous manifest found: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  // If we still don't have previous count, try to get it from S3 carddict.json
  if (previousCardCount === 0) {
    console.log('Attempting to fetch previous carddict.json for card count...');
    try {
      const previousCardDict = await s3.send(
        new GetObjectCommand({
          Bucket: process.env.DATA_BUCKET || '',
          Key: 'cards/carddict.json',
        }),
      );
      const cardDictContent = await previousCardDict.Body?.transformToString();
      if (cardDictContent) {
        const previousDict = JSON.parse(cardDictContent);
        previousCardCount = Object.keys(previousDict).length;
        console.log(`Fetched previous card count from carddict.json: ${previousCardCount}`);
      }
    } catch (error) {
      console.log(
        `Could not fetch previous carddict.json: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  console.log(`Previous card count: ${previousCardCount}`);

  // Calculate changes
  const cardsAdded = Math.max(0, currentCardCount - previousCardCount);

  console.log(`Cards added: ${cardsAdded}`);

  // Update step: Uploading files
  if (taskId) {
    await cardUpdateTaskDao.updateStep(taskId, 'Uploading card files');
  }

  for (const file of CARD_UPDATE_FILES) {
    console.log(`Uploading ${file}...`);

    await uploadLargeObjectToS3(`${PRIVATE_DIR}/${file}`, `cards/${file}`);

    console.log(`Finished ${file}`);
  }

  // Calculate checksum of the carddict.json file (main card database)
  const cardDictPath = `${PRIVATE_DIR}/carddict.json`;
  const cardDictContent = fs.readFileSync(cardDictPath, 'utf-8');
  const checksum = crypto.createHash('sha256').update(cardDictContent).digest('hex');

  console.log(`Calculated checksum: ${checksum}`);

  if (taskId) {
    await cardUpdateTaskDao.updateStep(taskId, 'Uploading manifest');
  }

  console.log('Uploading manifest...');
  const manifest = {
    checksum: checksum,
    scryfallUpdatedAt: scryfallMetadata.updatedAt,
    scryfallFileSize: scryfallMetadata.fileSize,
    totalCards: currentCardCount,
    cardsAdded: cardsAdded,
    version: '1.0.0',
  };

  await new Upload({
    client: s3,

    params: {
      Bucket: process.env.DATA_BUCKET || '',
      Key: `cards/manifest.json`,
      Body: JSON.stringify(manifest, null, 2),
    },
  }).done();

  console.log('Finished manifest');
  console.log(`Manifest: ${JSON.stringify(manifest)}`);

  // Update the task with final statistics
  if (taskId) {
    const task = await cardUpdateTaskDao.getById(taskId);
    if (task) {
      task.checksum = checksum;
      task.cardsAdded = cardsAdded;
      task.totalCards = currentCardCount;
      task.step = 'Finalizing';
      await cardUpdateTaskDao.update(task);
    }
  }

  console.log('done');
  return checksum;
};

const loadMetadatadict = async () => {
  const metadatadict = await downloadJson('metadatadict.json');
  const indexToOracle = await downloadJson('indexToOracle.json');

  if (metadatadict && indexToOracle) {
    return {
      metadatadict,
      indexToOracle,
    };
  }

  console.log("Couldn't find metadatadict.json in S3 (that is OK)");
  return {
    metadatadict: {},
    indexToOracle: [],
  };
};

const loadCardKingdomPrices = async (useS3Cache?: boolean): Promise<Record<string, number>> => {
  // Use cache if available
  const url = 'https://api.cardkingdom.com/api/v2/pricelist';
  const filePath = `${PRIVATE_DIR}/cardkingdom-prices.json`;
  let stream;
  if (useS3Cache) {
    stream = await getFileWithCache(url, filePath, useS3Cache);
  } else {
    await downloadFile(url, filePath);
    stream = fs.createReadStream(filePath);
  }
  const chunks: Buffer[] = [];
  await new Promise<void>((resolve, reject) => {
    stream.on('data', (chunk) => {
      if (typeof chunk === 'string') {
        chunks.push(Buffer.from(chunk));
      } else {
        chunks.push(chunk);
      }
    });
    stream.on('end', () => resolve());
    stream.on('error', reject);
  });
  const json = JSON.parse(Buffer.concat(chunks).toString('utf8'));

  console.log(`Loaded ${json.data.length} cards from Card Kingdom`);
  return Object.fromEntries(json.data.map((card: any) => [card.scryfall_id, parseFloat(card.price_cents) / 100]));
};

const loadManaPoolPrices = async (useS3Cache?: boolean): Promise<Record<string, number>> => {
  const url = 'https://manapool.com/api/v1/prices/singles';
  const filePath = `${PRIVATE_DIR}/manapool-prices.json`;
  let stream;
  if (useS3Cache) {
    stream = await getFileWithCache(url, filePath, useS3Cache);
  } else {
    await downloadFile(url, filePath);
    stream = fs.createReadStream(filePath);
  }
  const chunks: Buffer[] = [];
  await new Promise<void>((resolve, reject) => {
    stream.on('data', (chunk) => {
      if (typeof chunk === 'string') {
        chunks.push(Buffer.from(chunk));
      } else {
        chunks.push(chunk);
      }
    });
    stream.on('end', () => resolve());
    stream.on('error', reject);
  });
  const json = JSON.parse(Buffer.concat(chunks).toString('utf8'));

  console.log(`Loaded ${json.data.length} cards from Mana Pool`);
  return Object.fromEntries(json.data.map((card: any) => [card.scryfall_id, parseFloat(card.price_cents) / 100]));
};

// Use S3 for caching if DATA_BUCKET is set
const useS3Cache = !!process.env.DATA_BUCKET;
const taskId = process.env.CARD_UPDATE_TASK_ID;

(async () => {
  try {
    if (taskId) {
      await cardUpdateTaskDao.updateStep(taskId, 'Initializing');
    }

    const { metadatadict, indexToOracle } = await loadMetadatadict();

    if (taskId) {
      await cardUpdateTaskDao.updateStep(taskId, 'Loading price data');
    }
    const manaPoolPrices = await loadManaPoolPrices(useS3Cache);
    const cardKingdomPrices = await loadCardKingdomPrices(useS3Cache);

    const scryfallMetadata = await downloadFromScryfall(
      metadatadict,
      indexToOracle,
      cardKingdomPrices,
      manaPoolPrices,
      useS3Cache,
      taskId,
    );

    if (!scryfallMetadata) {
      console.error('Failed to download card data from Scryfall');
      if (taskId) {
        await cardUpdateTaskDao.markAsFailed(taskId, 'Failed to download card data from Scryfall');
      }
      process.exit(1);
    }

    await uploadCardDb(scryfallMetadata, taskId);

    // Sync any card images Scryfall re-rendered since our last run into R2, and
    // record how many image files were upserted on the task for the admin view.
    // Non-fatal: a sync hiccup shouldn't fail an otherwise-successful catalog update.
    if (taskId) {
      await cardUpdateTaskDao.updateStep(taskId, 'Syncing card images');
    }
    let imagesUpserted = 0;
    try {
      const syncResult = await syncCardImages();
      imagesUpserted = syncResult.imagesUpserted;
    } catch (err) {
      console.error('Card image sync failed (non-fatal):', err);
    }

    // Cache any newly-seen set symbols into R2. Non-fatal, same as image sync.
    if (taskId) {
      await cardUpdateTaskDao.updateStep(taskId, 'Syncing set symbols');
    }
    try {
      await syncSetSymbols(toSymbolSources(setdict, scryfallSetIcons));
    } catch (err) {
      console.error('Set symbol sync failed (non-fatal):', err);
    }

    if (taskId) {
      // Pass imagesUpserted so it's written in the completion update itself,
      // rather than a separate update() that this re-read would clobber.
      await cardUpdateTaskDao.markAsCompleted(taskId, imagesUpserted);
    }

    console.log('Complete');

    process.exit();
  } catch (error) {
    console.error(error);
    if (taskId) {
      await cardUpdateTaskDao.markAsFailed(
        taskId,
        error instanceof Error ? error.message : 'Unknown error during card update',
      );
    }
    process.exit(1);
  }
})();
