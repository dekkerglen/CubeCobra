import NodeCache from 'node-cache';
import Papa from 'papaparse';
// @ts-ignore - no types available
import sanitizeHtml from 'sanitize-html';

import _ from 'lodash';
import Cube from 'dynamo/models/cube';
import { convertFromLegacyCardColorCategory } from '@utils/cardutil';
import { cardFromId, getAllVersionIds, reasonableId } from './carddb';

import * as util from './util';
import { getDraftFormat, createDraft } from '@utils/drafting/createdraft';
import { getBotPrediction } from './userUtil';
import type { CardDetails } from '@utils/datatypes/Card';
import type { TagColor } from '@utils/datatypes/Cube';

interface CubeCard {
  cardID: string;
  status: string;
  cmc: number;
  type_line?: string;
  tags: string[];
  colors: string | string[];
  finish?: string;
  addedTmsp?: Date;
  collector_number?: string;
  imgUrl?: string | null;
  imgBackUrl?: string | null;
  notes?: string;
  rarity?: string | null;
  colorCategory?: string | null;
  custom_name?: string;
  name?: string;
  details?: CardDetails;
}

interface CubeTypeResult {
  pauper: boolean;
  peasant: boolean;
  type: number;
}

function getCubeId(cube: { shortId?: string; id: string }): string {
  if (cube.shortId) return cube.shortId;
  return cube.id;
}

const FORMATS = ['Vintage', 'Legacy', 'Modern', 'Pioneer', 'Standard'];

function intToLegality(val: number): string | undefined {
  return FORMATS[val];
}

function legalityToInt(legality: string): number | undefined {
  let res: number | undefined;
  FORMATS.forEach((format, index) => {
    if (legality === format) res = index;
  });

  return res;
}

function cardsAreEquivalent(card: CubeCard, details: CubeCard): boolean {
  if (card.cardID !== details.cardID) {
    return false;
  }
  if (card.status !== details.status) {
    return false;
  }
  if (card.cmc !== details.cmc) {
    return false;
  }
  if (card.type_line && details.type_line && card.type_line !== details.type_line) {
    return false;
  }
  if (!util.arraysEqual(card.tags, details.tags)) {
    return false;
  }
  const cardColors = typeof card.colors === 'string' ? [...card.colors] : card.colors;
  const detailsColors = typeof details.colors === 'string' ? [...details.colors] : details.colors;
  if (!util.arraysEqual(cardColors, detailsColors)) {
    return false;
  }
  if (card.finish && details.finish && card.finish !== details.finish) {
    return false;
  }

  return true;
}

function cardIsLegal(card: any, legality: string): boolean {
  return card.legalities[legality] === 'legal' || card.legalities[legality] === 'banned';
}

function getCubeTypes(cards: CubeCard[]): CubeTypeResult {
  let pauper = true;
  let peasant = false;
  let type = FORMATS.length - 1;
  for (const card of cards) {
    if (pauper && !cardIsLegal(cardFromId(card.cardID), 'Pauper')) {
      pauper = false;
      peasant = true;
    }
    if (!pauper && peasant) {
      // check rarities of all card versions
      const versions = getAllVersionIds(cardFromId(card.cardID));
      if (versions) {
        const rarities = versions.map((id) => cardFromId(id).rarity);
        if (!rarities.includes('common') && !rarities.includes('uncommon')) {
          peasant = false;
        }
      }
    }
    const legality = intToLegality(type);
    while (type > 0 && legality && !cardIsLegal(cardFromId(card.cardID), legality)) {
      type -= 1;
    }
  }

  return { pauper, peasant, type };
}

function setCubeType(cube: any): any {
  const { pauper, peasant, type } = getCubeTypes(cube.cards);

  cube.type = intToLegality(type);
  if (pauper) {
    cube.type += ' Pauper';
  }
  if (peasant) {
    cube.type += ' Peasant';
  }

  if (cube.overrideCategory) {
    cube.categories = [
      cube.categoryOverride.toLowerCase(),
      ...cube.categoryPrefixes.map((c: string) => c.toLowerCase()),
    ];
  } else {
    cube.categories = Array.from(new Set(`${cube.type}`.toLowerCase().split(' ')));
  }

  cube.cardOracles = Array.from(new Set(cube.cards.map((card: CubeCard) => cardFromId(card.cardID).oracle_id)));
  cube.keywords = `${cube.type} ${cube.name} ${cube.owner_name}`
    .replace(/[^\w\s]/gi, '')
    .toLowerCase()
    .split(' ')
    .filter((keyword) => keyword.length > 0);
  cube.keywords.push(
    ...(cube.tags || [])
      .filter((tag: string) => tag && tag.length > 0)
      .map((tag: string) => tag.replace(/[^\w\s]/gi, '').toLowerCase()),
  );
  cube.keywords.push(...cube.categories);
  cube.keywords = Array.from(new Set(cube.keywords));

  cube.card_count = cube.cards.length;

  return cube;
}

function cardHtml(card: any): string {
  if (card.image_flip) {
    return `<a class="dynamic-autocard" card="${card.image_normal}" card_flip="${card.image_flip}">${card.name}</a>`;
  }
  return `<a class="dynamic-autocard" card="${card.image_normal}">${card.name}</a>`;
}

function addCardHtml(card: any): string {
  return `<span style="font-family: &quot;Lucida Console&quot;, Monaco, monospace;" class="badge badge-success">+</span> ${cardHtml(
    card,
  )}<br/>`;
}

function removeCardHtml(card: any): string {
  return `<span style="font-family: &quot;Lucida Console&quot;, Monaco, monospace;" class="badge badge-danger">-</span> ${cardHtml(
    card,
  )}<br/>`;
}

function replaceCardHtml(oldCard: any, newCard: any): string {
  return `<span style="font-family: &quot;Lucida Console&quot;, Monaco, monospace;" class="badge badge-primary">→</span> ${cardHtml(
    oldCard,
  )} &gt; ${cardHtml(newCard)}<br/>`;
}

function abbreviate(name: string): string {
  return name.length < 20 ? name : `${name.slice(0, 20)}…`;
}

function buildTagColors(cube: any, cards: CubeCard[]): TagColor[] {
  const { tagColors } = cube;
  const tags = tagColors.map((item: TagColor) => item.tag);
  const notFound = tagColors.map((item: TagColor) => item.tag);

  for (const card of cards) {
    for (let tag of card.tags) {
      tag = tag.trim();
      if (!tags.includes(tag)) {
        tagColors.push({
          tag,
          color: null,
        });
        tags.push(tag);
      }
      if (notFound.includes(tag)) notFound.splice(notFound.indexOf(tag), 1);
    }
  }

  const tmp = [];
  for (const color of tagColors) {
    if (!notFound.includes(color.tag)) tmp.push(color);
  }

  return tmp;
}

function cubeCardTags(cubeCards: CubeCard[]): string[] {
  const tags: string[] = [];
  for (const card of cubeCards) {
    if (card.tags) {
      for (let tag of card.tags) {
        tag = tag.trim();
        if (!tags.includes(tag)) {
          tags.push(tag);
        }
      }
    }
  }
  return tags;
}

function camelizeDataRows(data: any[]): any[] {
  return data.map((row: any) =>
    Object.fromEntries(Object.entries(row).map(([key, value]) => [_.camelCase(key), value])),
  );
}

interface CSVResult {
  newCards: CubeCard[];
  newMaybe: CubeCard[];
  missing: string[];
}

function CSVtoCards(csvString: string): CSVResult {
  const { data } = Papa.parse(csvString.trim(), { header: true });
  const camelizedRows = camelizeDataRows(data);
  const missing = [];
  const newCards = [];
  const newMaybe = [];
  for (const {
    name,
    cmc,
    type,
    color,
    set,
    collectorNumber,
    status,
    finish,
    maybeboard,
    imageUrl,
    imageBackUrl,
    tags,
    notes,
    colorCategory,
    rarity,
    custom,
  } of camelizedRows) {
    if (name) {
      const upperSet = (set || '').toUpperCase();

      const validatedColorCategory = convertFromLegacyCardColorCategory(colorCategory);

      const card: any = {
        name,
        cmc: cmc || null,
        type_line: (type || null) && type.replace('-', '—'),
        colors: (color || null) && color.split('').filter((c: string) => [...'WUBRG'].includes(c)),
        addedTmsp: new Date(),
        collector_number: collectorNumber && collectorNumber.toUpperCase(),
        status: status || 'Not Owned',
        finish: finish || 'Non-foil',
        imgUrl: (imageUrl || null) && imageUrl !== 'undefined' ? imageUrl : null,
        imgBackUrl: (imageBackUrl || null) && imageBackUrl !== 'undefined' ? imageBackUrl : null,
        tags: tags && tags.length > 0 ? tags.split(';').map((t: string) => t.trim()) : [],
        notes: notes || '',
        rarity: rarity || null,
        colorCategory: validatedColorCategory || null,
      };

      let potentialIds = [];
      if (custom?.toLowerCase() === 'true') {
        potentialIds = ['custom-card'];
        card.custom_name = name;
        card.name = 'custom-card';
      } else {
        potentialIds = getAllVersionIds(card);
      }

      if (potentialIds && potentialIds.length > 0) {
        // First, try to find the correct set.
        const matchingSetAndNumber = potentialIds.find((id) => {
          const dbCard = cardFromId(id);
          return (
            upperSet === dbCard.set.toUpperCase() && card.collector_number === dbCard.collector_number.toUpperCase()
          );
        });
        const matchingSet = potentialIds.find((id) => cardFromId(id).set.toUpperCase() === upperSet);
        const nonPromo = potentialIds.find(reasonableId);
        const first = potentialIds[0];
        card.cardID = matchingSetAndNumber || matchingSet || nonPromo || first;
        if (typeof maybeboard === 'string' && maybeboard.toLowerCase() === 'true') {
          newMaybe.push(card);
        } else {
          newCards.push(card);
        }
      } else {
        missing.push(card.name);
      }
    }
  }
  return { newCards, newMaybe, missing };
}

async function compareCubes(cardsA: any, cardsB: any): Promise<any> {
  const inBoth: any[] = [];
  const onlyA = cardsA.mainboard.slice(0);
  const onlyB = cardsB.mainboard.slice(0);
  const aOracles = onlyA.map((card: any) => card.details.oracle_id);
  const bOracles = onlyB.map((card: any) => card.details.oracle_id);
  for (const card of cardsA.mainboard) {
    if (bOracles.includes(card.details.oracle_id)) {
      inBoth.push(card);

      onlyA.splice(aOracles.indexOf(card.details.oracle_id), 1);
      onlyB.splice(bOracles.indexOf(card.details.oracle_id), 1);

      aOracles.splice(aOracles.indexOf(card.details.oracle_id), 1);
      bOracles.splice(bOracles.indexOf(card.details.oracle_id), 1);
    }
  }

  const allCards = inBoth.concat(onlyA).concat(onlyB);
  return {
    inBoth,
    onlyA,
    onlyB,
    aOracles,
    bOracles,
    allCards,
  };
}

// A cache for promises that are expensive to compute and will always produce
// the same value, such as pack images. If a promise produces an error, it's
// removed from the cache. Each promise lives five minutes by default.
const promiseCache = new NodeCache({ stdTTL: 60 * 5, useClones: false });

// / Caches the result of the given callback in `promiseCache` with the given
// / key.
function cachePromise<T>(key: string, callback: () => Promise<T>): Promise<T> {
  const existingPromise = promiseCache.get(key);
  if (existingPromise) return existingPromise as Promise<T>;

  const newPromise = callback().catch((error: any) => {
    promiseCache.del(key);
    throw error;
  });
  promiseCache.set(key, newPromise);
  return newPromise;
}

function isCubeViewable(cube: any, user: any): boolean {
  if (!cube) {
    return false;
  }

  if (cube.visibility === Cube.VISIBILITY.PUBLIC || cube.visibility === Cube.VISIBILITY.UNLISTED) {
    return true;
  }

  return user && (cube.owner.id === user.id || util.isAdmin(user));
}

function isCubeEditable(cube: any, user: any): boolean {
  if (!cube) {
    return false;
  }

  if (user && (cube.owner.id === user.id || util.isAdmin(user))) {
    return true;
  }

  return false;
}

function isCubeListed(cube: any, user: any): boolean {
  if (!cube) {
    return false;
  }

  if (user && (cube.owner.id === user.id || util.isAdmin(user))) {
    return true;
  }

  if (cube.cardCount === 0) {
    return false;
  }

  if (cube.visibility === Cube.VISIBILITY.PUBLIC) {
    return true;
  }

  return false;
}

/**
 * Generate multiple pack candidates and select the one with the lowest maximum bot weight
 * @param {Object} cube - The cube object
 * @param {Object} cards - The cards object with mainboard property
 * @param {string} seedPrefix - Base seed prefix for pack generation
 * @param {number} candidateCount - Number of pack candidates to generate (default: 10)
 * @returns {Promise<Object>} The selected pack result with bot data
 */
async function generateBalancedPack(
  cube: any,
  cards: any,
  seedPrefix: string,
  candidateCount: number = 10,
  deterministicSeed: number | null = null,
): Promise<any> {
  // Use deterministicSeed if provided (for routes), otherwise use Date.now() (for daily P1P1)
  const baseSeed = deterministicSeed || Date.now();
  const packCandidates = [];

  for (let i = 0; i < candidateCount; i++) {
    const seed = `${seedPrefix}-${baseSeed}-${i}`;
    const formatId = cube.defaultFormat === undefined ? -1 : cube.defaultFormat;
    const format = getDraftFormat({ id: formatId, packs: 1, players: 1 }, cube);
    const draft = createDraft(cube, format, [...cards.mainboard], 1, { username: 'Anonymous' } as any, seed);
    const packResult = {
      seed: seedPrefix,
      pack:
        draft.InitialState?.[0]?.[0]?.cards.map((cardIndex: number) => {
          const card = draft.cards![cardIndex];
          return {
            ...card,
            details: card ? cardFromId(card.cardID) : undefined,
          };
        }) ?? [],
    };

    // Extract oracle IDs for bot prediction
    const oracleIds = packResult.pack.map((card: any) => card.details?.oracle_id).filter(Boolean);

    // Get bot prediction
    const botResult = await getBotPrediction(oracleIds);

    // Calculate the maximum bot weight for this pack
    const maxBotWeight = Math.max(...(botResult.botWeights.length > 0 ? botResult.botWeights : [0]));

    packCandidates.push({
      packResult,
      botResult,
      maxBotWeight,
      seed: seedPrefix, // Use original seedPrefix for consistency
    });
  }

  // Select the pack with the lowest maximum bot weight
  const selectedCandidate = packCandidates.reduce((best, current) =>
    current.maxBotWeight < best.maxBotWeight ? current : best,
  );

  return {
    packResult: selectedCandidate.packResult,
    botResult: selectedCandidate.botResult,
    seed: selectedCandidate.seed,
    maxBotWeight: selectedCandidate.maxBotWeight,
    allCandidates: packCandidates,
  };
}

function sanitize(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: ['div', 'p', 'strike', 'strong', 'b', 'i', 'em', 'u', 'a', 'h5', 'h6', 'ul', 'ol', 'li', 'span', 'br'],
    selfClosing: ['br'],
  });
}

async function generatePack(cube: any, cards: any, seed?: string): Promise<any> {
  if (!seed) {
    seed = Date.now().toString();
  }
  const formatId = cube.defaultFormat === undefined ? -1 : cube.defaultFormat;
  const format = getDraftFormat({ id: formatId, packs: 1, players: 1 }, cube);
  const draft = createDraft(cube, format, cards.mainboard, 1, { username: 'Anonymous' } as any, seed);
  return {
    seed,
    pack:
      draft.InitialState?.[0]?.[0]?.cards.map((cardIndex: number) => {
        const card = draft.cards![cardIndex];
        return {
          ...card,
          details: card ? cardFromId(card.cardID) : undefined,
        };
      }) ?? [],
  };
}

const methods = {
  setCubeType,
  cardsAreEquivalent,
  sanitize,
  generatePack,
  generateBalancedPack,
  getCubeId,
  intToLegality,
  legalityToInt,
  addCardHtml,
  removeCardHtml,
  replaceCardHtml,
  abbreviate,
  buildTagColors,
  cubeCardTags,
  CSVtoCards,
  compareCubes,
  cachePromise,
  isCubeViewable,
  isCubeListed,
  getCubeTypes,
  isCubeEditable,
};

export default methods;
export {
  setCubeType,
  cardsAreEquivalent,
  sanitize,
  generatePack,
  generateBalancedPack,
  getCubeId,
  intToLegality,
  legalityToInt,
  addCardHtml,
  removeCardHtml,
  replaceCardHtml,
  abbreviate,
  buildTagColors,
  cubeCardTags,
  CSVtoCards,
  compareCubes,
  cachePromise,
  isCubeViewable,
  isCubeListed,
  getCubeTypes,
  isCubeEditable,
};
