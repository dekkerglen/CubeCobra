import { cardNameLower, cardOracleId, convertFromLegacyCardColorCategory, isCustomOrVoucher } from '@utils/cardutil';
import type { CardDetails } from '@utils/datatypes/Card';
import Card, { BoardChanges, Changes } from '@utils/datatypes/Card';
import { CUBE_VISIBILITY, type CubeCards, type TagColor } from '@utils/datatypes/Cube';
import type { DraftFormat } from '@utils/datatypes/Draft';
import { createDraft, getDraftFormat } from '@utils/drafting/createdraft';
import { safeHttpUrl } from '@utils/safeUrl';
import _ from 'lodash';
import Papa from 'papaparse';
import sanitizeHtml from 'sanitize-html';

import { cardFromId, getAllVersionIds, reasonableId } from './carddb';
import { fromCsvCell } from './csv';
import { IMPORT_TOO_LARGE_MESSAGE, MAX_IMPORT_CARDS } from './importParsing';
import { batchDraft } from './ml';
import * as util from './util';

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
  /**
   * Every format the whole cube is legal in, least to most restrictive. The
   * last entry is therefore the tightest format the cube fits in.
   */
  eligibleFormats: LegalityFormat[];
}

export interface GeneratePackResult {
  seed: string;
  pack: any[];
}

export interface BalancedPackCandidate {
  packResult: GeneratePackResult;
  botResult: {
    botPickIndex: number | null;
    botWeights: number[];
  };
  maxBotWeight: number;
  seed: string;
}

export interface BalancedPackResult extends GeneratePackResult {
  packResult: GeneratePackResult;
  botResult: {
    botPickIndex: number | null;
    botWeights: number[];
  };
  maxBotWeight: number;
  allCandidates: BalancedPackCandidate[];
}

function getCubeId(cube: { shortId?: string; id: string }): string {
  if (cube.shortId) return cube.shortId;
  return cube.id;
}

// Least to most restrictive. Declared as a const tuple so LegalityFormat below
// is derived from it, making a mistyped format name a compile error rather than
// a silent non-match.
const FORMATS = ['Vintage', 'Legacy', 'Modern', 'Pioneer', 'Standard'] as const;
const VINTAGE = 0;

export type LegalityFormat = (typeof FORMATS)[number];

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
  const status = card.legalities[legality];
  // Restricted cards are playable (capped at one copy); banned cards are not.
  // Counting banned as playable would read Deathrite Shaman, banned in Modern,
  // as a Modern card.
  return status === 'legal' || status === 'restricted';
}

function getCubeTypes(cards: CubeCard[]): CubeTypeResult {
  let pauper = true;
  let peasant = false;
  // Each format is evaluated on its own merits rather than by walking down a
  // chain, because legality does not nest. Deathrite Shaman is playable in
  // Pioneer yet banned in the wider Modern, and Geological Appraiser is
  // playable in Standard yet banned in the wider Pioneer.
  //
  // Vintage is deliberately never checked, so it stays eligible. A Vintage cube
  // means "anything goes", making it the floor for cubes that qualify for no
  // tighter format, including those holding power, custom cards, or un-cards.
  const eligible = FORMATS.map(() => true);

  for (const card of cards) {
    const details = cardFromId(card.cardID);

    if (pauper && !cardIsLegal(details, 'Pauper')) {
      pauper = false;
      peasant = true;
    }
    if (!pauper && peasant) {
      // check rarities of all card versions
      const versions = getAllVersionIds(details);
      if (versions) {
        const rarities = versions.map((id) => cardFromId(id).rarity);
        if (!rarities.includes('common') && !rarities.includes('uncommon')) {
          peasant = false;
        }
      }
    }

    FORMATS.forEach((format, index) => {
      if (index !== VINTAGE && eligible[index] && !cardIsLegal(details, format)) {
        eligible[index] = false;
      }
    });
  }

  const eligibleFormats = FORMATS.filter((_format, index) => eligible[index]);

  return { pauper, peasant, eligibleFormats };
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

/**
 * Flattens every board's cards into one list.
 *
 * Boards are user-definable, so anything that means "all the cards in this cube" has
 * to walk the whole cards object rather than assuming mainboard + maybeboard. The
 * cards object also carries a non-array `id` property, which is skipped.
 */
function allCardsFromBoards(cubeCards: CubeCards): Card[] {
  const allCards: Card[] = [];
  for (const [board, list] of Object.entries(cubeCards)) {
    if (board !== 'id' && Array.isArray(list)) {
      allCards.push(...list);
    }
  }
  return allCards;
}

function buildTagColors(cube: any, cubeCards: CubeCards): TagColor[] {
  const { tagColors } = cube;
  const tags = tagColors.map((item: TagColor) => item.tag);
  const notFound = tagColors.map((item: TagColor) => item.tag);

  const allCards = allCardsFromBoards(cubeCards);
  for (const card of allCards) {
    if (card.tags) {
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
  }

  const tmp = [];
  for (const color of tagColors) {
    if (!notFound.includes(color.tag)) tmp.push(color);
  }

  return tmp;
}

function cubeCardTags(cubeCards: CubeCards): string[] {
  const tags: string[] = [];
  const allCards = allCardsFromBoards(cubeCards);
  for (const card of allCards) {
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
    Object.fromEntries(Object.entries(row).map(([key, value]) => [_.camelCase(key), fromCsvCell(value)])),
  );
}

interface CSVResult {
  newCards: CubeCard[];
  newMaybe: CubeCard[];
  cardsByBoard: Record<string, CubeCard[]>;
  missing: string[];
}

const MAX_IMAGE_URL_LENGTH = 2048;

// Custom image URLs end up in <img src> and are fetched server-side for pack images, so only
// absolute http(s) URLs of a sane length are kept.
const importedImageUrl = (value: unknown): string | null => {
  const url = safeHttpUrl(value);
  return url && url.length <= MAX_IMAGE_URL_LENGTH ? url : null;
};

function CSVtoCards(csvString: string): CSVResult {
  const { data } = Papa.parse(csvString.trim(), { header: true });
  if (data.length > MAX_IMPORT_CARDS) {
    throw new Error(IMPORT_TOO_LARGE_MESSAGE);
  }
  const camelizedRows = camelizeDataRows(data);
  const missing: string[] = [];
  const newCards: CubeCard[] = [];
  const newMaybe: CubeCard[] = [];
  const cardsByBoard: Record<string, CubeCard[]> = {};

  // Check if the CSV has a "board" column by inspecting the first row
  const hasBoardColumn = camelizedRows.length > 0 && Object.prototype.hasOwnProperty.call(camelizedRows[0], 'board');

  for (const {
    name,
    cmc,
    type,
    color,
    set,
    collectorNumber,
    status,
    finish,
    board,
    maybeboard,
    imageUrl,
    imageBackUrl,
    tags,
    notes,
    colorCategory,
    rarity,
    custom,
    voucher,
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
        imgUrl: importedImageUrl(imageUrl),
        imgBackUrl: importedImageUrl(imageBackUrl),
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
      } else if (voucher?.toLowerCase() === 'true') {
        potentialIds = ['voucher'];
        card.custom_name = name;
        card.name = 'voucher';
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

        // Determine which board this card belongs to
        let boardName = 'mainboard';
        if (hasBoardColumn && typeof board === 'string' && board.trim().length > 0) {
          // Use the "board" column value (normalize to lowercase, strip spaces)
          boardName = board.trim().toLowerCase().replace(/\s+/g, '');
        } else if (typeof maybeboard === 'string' && maybeboard.toLowerCase() === 'true') {
          // Legacy fallback: use "maybeboard" column only if "board" column is absent
          boardName = 'maybeboard';
        }

        // Populate cardsByBoard
        if (!cardsByBoard[boardName]) {
          cardsByBoard[boardName] = [];
        }
        cardsByBoard[boardName]!.push(card);

        // Legacy support: also populate newCards/newMaybe for backwards compat
        if (boardName === 'maybeboard') {
          newMaybe.push(card);
        } else {
          newCards.push(card);
        }
      } else {
        missing.push(card.name);
      }
    }
  }
  return { newCards, newMaybe, cardsByBoard, missing };
}

export interface ComparedCubes {
  inBoth: Card[];
  onlyA: Card[];
  onlyB: Card[];
  allCards: Card[];
  inBothIndices: number[];
  onlyAIndices: number[];
  onlyBIndices: number[];
}

async function compareCubes(cardsA: CubeCards, cardsB: CubeCards): Promise<ComparedCubes> {
  // Separate custom/voucher and regular cards in a single pass
  const customCardsA: Card[] = [];
  const regularCardsA: Card[] = [];
  for (const card of cardsA.mainboard) {
    if (isCustomOrVoucher(card)) {
      customCardsA.push(card);
    } else {
      regularCardsA.push(card);
    }
  }

  const customCardsB: Card[] = [];
  const regularCardsB: Card[] = [];
  for (const card of cardsB.mainboard) {
    if (isCustomOrVoucher(card)) {
      customCardsB.push(card);
    } else {
      regularCardsB.push(card);
    }
  }

  // Compare regular cards by oracle_id (existing logic)
  const inBothRegular: Card[] = [];
  const inBothRegularIndices: { a: number; b: number }[] = [];
  const onlyARegular = regularCardsA.slice(0);
  const onlyBRegular = regularCardsB.slice(0);
  const onlyARegularIndices: number[] = [];
  const onlyBRegularIndices: number[] = [];
  const aOracles = onlyARegular.map((card) => cardOracleId(card));
  const bOracles = onlyBRegular.map((card) => cardOracleId(card));

  for (let aIdx = 0; aIdx < regularCardsA.length; aIdx++) {
    const card = regularCardsA[aIdx]!;
    const bIdx = bOracles.indexOf(cardOracleId(card));
    if (bIdx !== -1) {
      inBothRegular.push(card);
      inBothRegularIndices.push({ a: aIdx, b: bIdx });

      const oracleId = cardOracleId(card);
      const onlyAIdx = aOracles.indexOf(oracleId);
      if (onlyAIdx !== -1) {
        onlyARegular.splice(onlyAIdx, 1);
        aOracles.splice(onlyAIdx, 1);
      }
      const onlyBIdx = bOracles.indexOf(oracleId);
      if (onlyBIdx !== -1) {
        onlyBRegular.splice(onlyBIdx, 1);
        bOracles.splice(onlyBIdx, 1);
      }
    }
  }

  // Build onlyA and onlyB indices from regularCardsA/B
  for (let i = 0; i < regularCardsA.length; i++) {
    if (onlyARegular.includes(regularCardsA[i]!)) {
      onlyARegularIndices.push(i);
    }
  }
  for (let i = 0; i < regularCardsB.length; i++) {
    if (onlyBRegular.includes(regularCardsB[i]!)) {
      onlyBRegularIndices.push(i);
    }
  }

  // Compare custom cards by name (case-insensitive)
  const inBothCustom: Card[] = [];
  const inBothCustomIndices: { a: number; b: number }[] = [];
  const onlyACustom = customCardsA.slice(0);
  const onlyBCustom = customCardsB.slice(0);
  const matchedBIndices = new Set<number>(); // Track which indices in customCardsB have been matched

  for (let aIdx = 0; aIdx < customCardsA.length; aIdx++) {
    const card = customCardsA[aIdx]!;
    const customNameLower = cardNameLower(card);

    // Find matching card in customCardsB (not already matched)
    let bIdx = -1;
    for (let i = 0; i < customCardsB.length; i++) {
      if (!matchedBIndices.has(i) && cardNameLower(customCardsB[i]!) === customNameLower) {
        bIdx = i;
        break;
      }
    }

    if (bIdx !== -1) {
      inBothCustom.push(card);
      inBothCustomIndices.push({ a: aIdx, b: bIdx });
      matchedBIndices.add(bIdx);

      const matchedCard = customCardsB[bIdx]!;
      const originalIndex = onlyBCustom.indexOf(matchedCard);
      if (originalIndex !== -1) {
        onlyBCustom.splice(originalIndex, 1);
      }

      const aIndex = onlyACustom.indexOf(card);
      if (aIndex !== -1) {
        onlyACustom.splice(aIndex, 1);
      }
    }
  }

  // Combine results
  const inBoth = inBothRegular.concat(inBothCustom);
  const onlyA = onlyARegular.concat(onlyACustom);
  const onlyB = onlyBRegular.concat(onlyBCustom);
  const allCards = inBoth.concat(onlyA).concat(onlyB);

  // Compute indices in the final allCards array
  const inBothIndices = inBoth.map((card) => allCards.indexOf(card));
  const onlyAIndices = onlyA.map((card) => allCards.indexOf(card));
  const onlyBIndices = onlyB.map((card) => allCards.indexOf(card));

  return {
    inBoth,
    onlyA,
    onlyB,
    allCards,
    inBothIndices,
    onlyAIndices,
    onlyBIndices,
  };
}

// A cache for promises that are expensive to compute and will always produce
// the same value, such as pack images. If a promise produces an error, it's
// removed from the cache. Each promise lives five minutes. The cache is a small
// LRU bounded both by entry count and by the bytes of resolved Buffers, so a
// flood of distinct keys (e.g. fresh pack seeds) evicts old entries instead of
// growing memory or failing the request.
const PROMISE_CACHE_TTL_MS = 5 * 60 * 1000;
const PROMISE_CACHE_MAX_ENTRIES = 2000;
const PROMISE_CACHE_MAX_BYTES = 128 * 1024 * 1024;

interface PromiseCacheEntry {
  promise: Promise<unknown>;
  expires: number;
  bytes: number;
}

// Map iteration order is insertion order, so the first key is the least recently used.
const promiseCache = new Map<string, PromiseCacheEntry>();
let promiseCacheBytes = 0;

const evictPromise = (key: string): void => {
  const entry = promiseCache.get(key);
  if (entry) {
    promiseCacheBytes -= entry.bytes;
    promiseCache.delete(key);
  }
};

const trimPromiseCache = (): void => {
  for (const key of promiseCache.keys()) {
    if (promiseCache.size <= PROMISE_CACHE_MAX_ENTRIES && promiseCacheBytes <= PROMISE_CACHE_MAX_BYTES) {
      return;
    }
    evictPromise(key);
  }
};

// / Caches the result of the given callback in `promiseCache` with the given
// / key.
function cachePromise<T>(key: string, callback: () => Promise<T>): Promise<T> {
  const now = Date.now();
  const existing = promiseCache.get(key);
  if (existing && existing.expires > now) {
    // Mark as most recently used.
    promiseCache.delete(key);
    promiseCache.set(key, existing);
    return existing.promise as Promise<T>;
  }
  evictPromise(key);

  const entry: PromiseCacheEntry = { promise: Promise.resolve(), expires: now + PROMISE_CACHE_TTL_MS, bytes: 0 };
  const newPromise = callback().then(
    (value) => {
      if (promiseCache.get(key) === entry && Buffer.isBuffer(value)) {
        entry.bytes = value.length;
        promiseCacheBytes += value.length;
        trimPromiseCache();
      }
      return value;
    },
    (error: any) => {
      if (promiseCache.get(key) === entry) {
        evictPromise(key);
      }
      throw error;
    },
  );
  entry.promise = newPromise;
  promiseCache.set(key, entry);
  trimPromiseCache();
  return newPromise;
}

function isCubeViewable(cube: any, user: any): boolean {
  if (!cube) {
    return false;
  }

  if (cube.visibility === CUBE_VISIBILITY.PUBLIC || cube.visibility === CUBE_VISIBILITY.UNLISTED) {
    return true;
  }

  if (!user) {
    return false;
  }

  if (cube.owner.id === user.id || util.isAdmin(user)) {
    return true;
  }

  if (Array.isArray(cube.collaborators) && cube.collaborators.includes(user.id)) {
    return true;
  }

  return false;
}

function isCubeEditable(cube: any, user: any): boolean {
  if (!cube) {
    return false;
  }

  if (!user) {
    return false;
  }

  if (cube.owner.id === user.id || util.isAdmin(user)) {
    return true;
  }

  if (Array.isArray(cube.collaborators) && cube.collaborators.includes(user.id)) {
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

  if (cube.visibility === CUBE_VISIBILITY.PUBLIC) {
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
// Sample packs only ever show the first pack, and the pack image renders every card in it. A
// custom format can declare arbitrarily many or arbitrarily large packs, so formats beyond these
// sizes are trimmed before generating a sample. Formats within them are used unchanged, so a
// given seed keeps producing the same pack.
const MAX_SAMPLE_FORMAT_PACKS = 100;
const MAX_SAMPLE_PACK_SLOTS = 30;

const samplePackFormat = (cube: any): DraftFormat => {
  const formatId = cube.defaultFormat === undefined ? -1 : cube.defaultFormat;
  const format = getDraftFormat({ id: formatId, packs: 1, players: 1 }, cube);
  const packs = Array.isArray(format.packs) ? format.packs : [];
  const oversized =
    packs.length > MAX_SAMPLE_FORMAT_PACKS ||
    packs.some((pack) => Array.isArray(pack?.slots) && pack.slots.length > MAX_SAMPLE_PACK_SLOTS);
  if (!oversized) {
    return format;
  }
  return {
    ...format,
    packs: packs.slice(0, MAX_SAMPLE_FORMAT_PACKS).map((pack) => ({
      ...pack,
      slots: Array.isArray(pack?.slots) ? pack.slots.slice(0, MAX_SAMPLE_PACK_SLOTS) : [],
    })),
  };
};

export interface P1P1PackScore {
  botPickIndex: number | null;
  botWeights: number[];
  maxBotWeight: number;
}

/**
 * Rates each pack as a first pick (empty pool) in a single batched ML call. Weights line up with
 * the given oracle ids; an id the model doesn't return a rating for scores 0.
 */
async function scoreP1P1Packs(packs: string[][]): Promise<P1P1PackScore[]> {
  const batchResults = await batchDraft(packs.map((pack) => ({ pack, pool: [] as string[] })));

  return packs.map((oracleIds, i) => {
    const predictions = batchResults[i] || [];
    const ratings = new Map(predictions.map((prediction) => [prediction.oracle, prediction.rating]));
    const botWeights = oracleIds.map((oracleId) => ratings.get(oracleId) ?? 0);

    const topPick = predictions[0];
    const botPickIndex = topPick ? oracleIds.indexOf(topPick.oracle) : -1;

    return {
      botPickIndex: botPickIndex >= 0 ? botPickIndex : null,
      botWeights,
      maxBotWeight: Math.max(...(botWeights.length > 0 ? botWeights : [0])),
    };
  });
}

async function generateBalancedPack(
  cube: any,
  cards: any,
  seedPrefix: string,
  candidateCount: number = 10,
  deterministicSeed: number | null = null,
): Promise<BalancedPackResult> {
  // Use deterministicSeed if provided (for routes), otherwise use Date.now() (for daily P1P1)
  const baseSeed = deterministicSeed || Date.now();
  const packCandidates: BalancedPackCandidate[] = [];

  // Generate all candidate packs first
  const candidates: { packResult: any; oracleIds: string[] }[] = [];
  for (let i = 0; i < candidateCount; i++) {
    const seed = `${seedPrefix}-${baseSeed}-${i}`;
    const format = samplePackFormat(cube);

    // Build board cards map for multi-board support (custom draft formats may reference non-mainboard boards)
    const boardCards: Record<string, any[]> = {};
    for (const [boardKey, boardList] of Object.entries(cards)) {
      if (boardKey !== 'id' && Array.isArray(boardList)) {
        boardCards[boardKey] = [...boardList];
      }
    }

    const draft = createDraft(cube, format, boardCards, 1, { username: 'Anonymous' } as any, seed);
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

    const oracleIds = packResult.pack.map((card: any) => card.details?.oracle_id).filter(Boolean);
    candidates.push({ packResult, oracleIds });
  }

  const scores = await scoreP1P1Packs(candidates.map((c) => c.oracleIds));

  for (let i = 0; i < candidates.length; i++) {
    const { packResult } = candidates[i]!;
    const { botPickIndex, botWeights, maxBotWeight } = scores[i]!;

    packCandidates.push({
      packResult,
      botResult: { botPickIndex, botWeights },
      maxBotWeight,
      seed: seedPrefix,
    });
  }

  // Select the pack with the lowest maximum bot weight
  const selectedCandidate = packCandidates.reduce((best, current) =>
    current.maxBotWeight < best.maxBotWeight ? current : best,
  );

  // Return full result with all candidate information for testing/debugging
  return {
    ...selectedCandidate.packResult,
    packResult: selectedCandidate.packResult,
    botResult: selectedCandidate.botResult,
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

async function generatePack(cube: any, cards: any, seed?: string): Promise<GeneratePackResult> {
  if (!seed) {
    seed = Date.now().toString();
  }
  const format = samplePackFormat(cube);

  // Build board cards map for multi-board support (custom draft formats may reference non-mainboard boards)
  const boardCards: Record<string, any[]> = {};
  for (const [boardKey, boardList] of Object.entries(cards)) {
    if (boardKey !== 'id' && Array.isArray(boardList)) {
      boardCards[boardKey] = boardList;
    }
  }

  const draft = createDraft(cube, format, boardCards, 1, { username: 'Anonymous' } as any, seed);
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

/**
 * Reverse-applies a single changelog to the cube cards, undoing the changes.
 * This mutates the cards object in place.
 */
function reverseApplyChangelog(cards: CubeCards, changelog: Changes): void {
  for (const [boardName, value] of Object.entries(changelog)) {
    if (boardName === 'version' || !value || typeof value !== 'object') continue;
    const boardChanges = value as BoardChanges;
    const board = cards[boardName] || [];

    // Undo adds: remove cards that were added (respecting duplicate counts)
    if (boardChanges.adds && boardChanges.adds.length > 0) {
      const addedCardCounts = new Map<string, number>();
      for (const c of boardChanges.adds) {
        addedCardCounts.set(c.cardID, (addedCardCounts.get(c.cardID) || 0) + 1);
      }
      const removedCounts = new Map<string, number>();
      cards[boardName] = board.filter((c) => {
        const toRemove = addedCardCounts.get(c.cardID) || 0;
        const alreadyRemoved = removedCounts.get(c.cardID) || 0;
        if (alreadyRemoved < toRemove) {
          removedCounts.set(c.cardID, alreadyRemoved + 1);
          return false; // Remove this copy
        }
        return true; // Keep this copy
      });
    }

    // Undo removes: re-add cards that were removed
    if (boardChanges.removes && boardChanges.removes.length > 0) {
      for (const remove of boardChanges.removes) {
        const card = { ...remove.oldCard };
        if (!card.details) {
          card.details = cardFromId(card.cardID);
        }
        (cards[boardName] || []).push(card);
      }
    }

    // Undo swaps: swap back to old card
    if (boardChanges.swaps && boardChanges.swaps.length > 0) {
      const currentBoard = cards[boardName] || [];
      for (const swap of boardChanges.swaps) {
        const idx = currentBoard.findIndex((c) => c.cardID === swap.card.cardID);
        if (idx !== -1) {
          const oldCard = { ...swap.oldCard };
          if (!oldCard.details) {
            oldCard.details = cardFromId(oldCard.cardID);
          }
          currentBoard[idx] = oldCard;
        }
      }
    }

    // Undo edits: revert to old card
    if (boardChanges.edits && boardChanges.edits.length > 0) {
      const currentBoard = cards[boardName] || [];
      for (const edit of boardChanges.edits) {
        const idx = currentBoard.findIndex((c) => c.cardID === edit.newCard.cardID);
        if (idx !== -1) {
          const oldCard = { ...edit.oldCard };
          if (!oldCard.details) {
            oldCard.details = cardFromId(oldCard.cardID);
          }
          currentBoard[idx] = oldCard;
        }
      }
    }
  }

  // Reindex all boards
  for (const [boardName, list] of Object.entries(cards)) {
    if (boardName !== 'id' && Array.isArray(list)) {
      for (let i = 0; i < list.length; i++) {
        const card = list[i];
        if (card) {
          card.index = i;
          card.board = boardName;
        }
      }
    }
  }
}

/**
 * Reconstructs the cube cards as they were at a specific changelog point in time.
 * Takes the current cards and reverse-applies all changelogs that happened after the target.
 *
 * @param cubeId - The cube ID
 * @param targetDate - The date of the target changelog
 * @param currentCards - The current cube cards
 * @param changelogDao - The changelog DAO instance
 * @returns The reconstructed cube cards at the point in time
 */
async function reconstructCubeAtChangelog(
  cubeId: string,
  targetDate: number,
  currentCards: CubeCards,
  changelogDao: {
    queryByCubeWithData: (
      cubeId: string,
      lastKey?: any,
      limit?: number,
    ) => Promise<{ items: Array<{ date: number; changelog: Changes }>; lastKey?: any }>;
  },
): Promise<CubeCards> {
  // Deep clone the current cards so we don't mutate the original
  const cards: CubeCards = JSON.parse(JSON.stringify(currentCards));

  // Re-add details after clone (details have functions that don't survive JSON serialization)
  for (const [boardName, list] of Object.entries(cards)) {
    if (boardName !== 'id' && Array.isArray(list)) {
      for (const card of list) {
        card.details = cardFromId(card.cardID);
      }
    }
  }

  // Fetch all changelogs newer than the target (they come newest-first)
  let lastKey: any = undefined;
  let hasMore = true;

  while (hasMore) {
    const result = await changelogDao.queryByCubeWithData(cubeId, lastKey, 100);

    for (const item of result.items) {
      // Only reverse-apply changelogs that happened AFTER the target
      if (item.date > targetDate) {
        reverseApplyChangelog(cards, item.changelog);
      }
    }

    // If we've reached changelogs at or before our target date, we can stop
    const oldestInBatch = result.items[result.items.length - 1];
    if (!oldestInBatch || oldestInBatch.date <= targetDate) {
      hasMore = false;
    } else {
      lastKey = result.lastKey;
      hasMore = !!lastKey;
    }
  }

  return cards;
}

const methods = {
  cardsAreEquivalent,
  sanitize,
  generatePack,
  generateBalancedPack,
  scoreP1P1Packs,
  getCubeId,
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
  reconstructCubeAtChangelog,
};

export default methods;
export {
  abbreviate,
  addCardHtml,
  buildTagColors,
  cachePromise,
  cardsAreEquivalent,
  compareCubes,
  CSVtoCards,
  cubeCardTags,
  generateBalancedPack,
  scoreP1P1Packs,
  generatePack,
  getCubeId,
  getCubeTypes,
  isCubeEditable,
  isCubeListed,
  isCubeViewable,
  reconstructCubeAtChangelog,
  removeCardHtml,
  replaceCardHtml,
  sanitize,
};
