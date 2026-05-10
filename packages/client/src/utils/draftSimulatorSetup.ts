// TODO(otags): when otag/atag support is restored in @utils/cardutil, re-add:
//   import { cardOracleTags, configureTagData, getTagData, isManaFixingLand } from '@utils/cardutil';
// and restore ensureClientTagData() + the TagApiResponse interface + the tagDataPromise cache +
// the oracleTags: cardOracleTags(card) line in buildCardMeta() +
// calls to ensureClientTagData(request) in prefetchClientSimulationResources and buildClientSimulationSetup.
import { isManaFixingLand } from '@utils/cardutil';
import type Card from '@utils/datatypes/Card';
import type Cube from '@utils/datatypes/Cube';
import type { CubeCards } from '@utils/datatypes/Cube';
import { boardNameToKey } from '@utils/datatypes/Cube';
import type {
  BasicLandInfo,
  CardMeta,
  SimulationSetupResponse,
} from '@utils/datatypes/SimulationReport';
import { createDraft, getDraftFormat } from '@utils/drafting/createdraft';

type ExtendedRequestInit = RequestInit & { timeout?: number };

interface CubeWithCards extends Cube {
  cards: CubeCards;
}

interface MlSubstitutionResponse {
  remapping?: Record<string, string>;
  success?: boolean;
}

let mlOracleRemappingPromise: Promise<Record<string, string>> | null = null;
const cubeFetchPromises = new Map<string, Promise<CubeWithCards>>();

export class ClientSimulationSetupError extends Error {
  fatal: boolean;

  constructor(message: string, fatal = false) {
    super(message);
    this.name = 'ClientSimulationSetupError';
    this.fatal = fatal;
  }
}

function normalizeBoardCards(cubeCards: CubeCards): Record<string, Card[]> {
  const boardCards: Record<string, Card[]> = {};
  for (const [key, cards] of Object.entries(cubeCards)) {
    if (Array.isArray(cards)) boardCards[key] = cards;
  }
  return boardCards;
}

function getBasicsFromCubeCards(cubeCards: CubeCards, basicsBoard?: string, legacyBasics?: string[]): string[] {
  if (basicsBoard) {
    const boardKey = boardNameToKey(basicsBoard);
    if (cubeCards[boardKey]) {
      return cubeCards[boardKey].map((card) => card.cardID);
    }
  }
  return legacyBasics ?? [];
}

function buildBasicLandInfo(cubeCards: CubeCards, basicsBoard?: string, legacyBasics?: string[]): BasicLandInfo[] {
  const byCardId = new Map<string, Card>();
  for (const cards of Object.values(cubeCards)) {
    if (!Array.isArray(cards)) continue;
    for (const card of cards) {
      if (!byCardId.has(card.cardID)) byCardId.set(card.cardID, card);
    }
  }

  return getBasicsFromCubeCards(cubeCards, basicsBoard, legacyBasics)
    .map((cardId) => byCardId.get(cardId))
    .filter((card): card is Card => !!card?.details?.oracle_id)
    .map((card) => ({
      oracleId: card.details!.oracle_id,
      name: card.details!.name ?? card.details!.oracle_id,
      imageUrl: card.imgUrl || card.details!.image_normal || card.details!.image_small || '',
      colorIdentity: card.details!.color_identity ?? [],
      producedMana: card.details!.produced_mana ?? [],
      type: card.details!.type ?? '',
    }));
}

function buildCardMeta(cards: Card[]): Record<string, CardMeta> {
  const cardMeta: Record<string, CardMeta> = {};

  for (const card of cards) {
    const details = card.details;
    const oracleId = details?.oracle_id;
    if (!details || !oracleId) continue;

    if (!cardMeta[oracleId]) {
      cardMeta[oracleId] = {
        name: details.name ?? oracleId,
        imageUrl: card.imgUrl || details.image_normal || details.image_small || '',
        colorIdentity: details.color_identity ?? [],
        elo: details.elo ?? 1200,
        cmc: details.cmc ?? 0,
        type: details.type ?? '',
        producedMana: details.produced_mana ?? [],
        parsedCost: details.parsed_cost ?? [],
        tags: card.tags && card.tags.length > 0 ? [...card.tags] : undefined,

        isManaFixingLand: isManaFixingLand(details) || undefined,
      };
    } else if (card.tags && card.tags.length > 0) {
      const existing = new Set(cardMeta[oracleId].tags ?? []);
      for (const tag of card.tags) existing.add(tag);
      cardMeta[oracleId].tags = [...existing];
    }
  }

  return cardMeta;
}

async function fetchMlOracleRemapping(
  request: (input: RequestInfo, init?: ExtendedRequestInit) => Promise<Response>,
): Promise<Record<string, string>> {
  if (!mlOracleRemappingPromise) {
    mlOracleRemappingPromise = (async () => {
      const response = await request('/tool/api/mlsubstitutions');
      if (!response.ok) {
        throw new ClientSimulationSetupError(`Failed to load ML substitutions: ${response.status}`);
      }
      const data = (await response.json()) as MlSubstitutionResponse;
      return data.remapping ?? {};
    })().catch((err) => {
      mlOracleRemappingPromise = null;
      throw err;
    });
  }

  return mlOracleRemappingPromise;
}

export async function fetchCubeForClientSimulation(
  request: (input: RequestInfo, init?: ExtendedRequestInit) => Promise<Response>,
  cubeId: string,
): Promise<CubeWithCards> {
  const existing = cubeFetchPromises.get(cubeId);
  if (existing) return existing;

  const fetchPromise = (async () => {
    const response = await request(`/cube/api/cubeJSON/${encodeURIComponent(cubeId)}`);
    if (!response.ok) {
      throw new ClientSimulationSetupError(`Failed to load cube data: ${response.status}`);
    }
    return (await response.json()) as CubeWithCards;
  })().catch((err) => {
    cubeFetchPromises.delete(cubeId);
    throw err;
  });

  cubeFetchPromises.set(cubeId, fetchPromise);
  return fetchPromise;
}

export async function prefetchClientSimulationResources(
  request: (input: RequestInfo, init?: ExtendedRequestInit) => Promise<Response>,
  cubeId: string,
): Promise<void> {
  try {
    await Promise.all([fetchCubeForClientSimulation(request, cubeId), fetchMlOracleRemapping(request)]);
  } catch (err) {
    console.warn('Draft simulator setup prefetch failed:', err);
  }
}

export async function buildClientSimulationSetup(
  request: (input: RequestInfo, init?: ExtendedRequestInit) => Promise<Response>,
  cube: Cube,
  cubeCards: CubeCards,
  numDrafts: number,
  numSeats: number,
  formatId: number,
): Promise<SimulationSetupResponse> {
  const boardCards = normalizeBoardCards(cubeCards);
  const resolvedFormatId = formatId ?? (cube.defaultFormat === undefined ? -1 : cube.defaultFormat);
  const format = getDraftFormat({ id: resolvedFormatId, packs: 3, players: numSeats, cards: 15 }, cube);

  const initialPacks: string[][][][] = [];
  let packSteps: { action: string; amount?: number | null }[][] | null = null;
  const cardMeta: Record<string, CardMeta> = {};

  for (let i = 0; i < numDrafts; i++) {
    let draft;
    try {
      draft = createDraft(cube, format, boardCards, numSeats, undefined, `draftsim-client-${i}-${Date.now()}`);
    } catch (err) {
      const message =
        err instanceof Error && err.message
          ? err.message
          : 'Not enough cards in cube to run a draft with these settings';
      throw new ClientSimulationSetupError(message, true);
    }

    const { InitialState, cards } = draft;
    if (!InitialState || InitialState.length === 0) {
      throw new ClientSimulationSetupError('Failed to generate draft packs', true);
    }

    const numPacks = InitialState[0]?.length ?? 0;
    if (packSteps === null) {
      packSteps = Array.from({ length: numPacks }, (_, p) =>
        (InitialState[0]?.[p]?.steps ?? []).map((s) => ({ action: s.action, amount: s.amount ?? null })),
      );
    }

    const draftPacks: string[][][] = Array.from({ length: numSeats }, (_, seatIndex) =>
      Array.from({ length: numPacks }, (_, packIndex) =>
        (InitialState[seatIndex]?.[packIndex]?.cards ?? [])
          .map((idx) => cards[idx]?.details?.oracle_id)
          .filter((oracleId): oracleId is string => !!oracleId),
      ),
    );
    initialPacks.push(draftPacks);

    Object.assign(cardMeta, buildCardMeta(cards));
  }

  const mlRemapping = await fetchMlOracleRemapping(request);
  for (const oracleId of Object.keys(cardMeta)) {
    const mlOracleId = mlRemapping[oracleId];
    if (mlOracleId && mlOracleId !== oracleId) {
      cardMeta[oracleId].mlOracleId = mlOracleId;
    }
  }

  return {
    cubeId: cube.id,
    cubeName: cube.name,
    initialPacks,
    packSteps: packSteps ?? [],
    cardMeta,
    numSeats,
    basics: buildBasicLandInfo(cubeCards, cube.basicsBoard || 'Basics', cube.basics),
  };
}
