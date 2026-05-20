import 'dotenv/config';

import carddb, { cardFromId } from './carddb';
import { error } from './cloudwatch';

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://localhost:5002';
const ML_TIMEOUT_MS = 10_000; // 10 second timeout for ML service calls

/**
 * Make a request to the ML recommender service
 */
async function mlServiceRequest<T>(endpoint: string, body: any): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ML_TIMEOUT_MS);

  try {
    const response = await fetch(`${ML_SERVICE_URL}/${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`ML service returned ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.message || 'ML service request failed');
    }

    return data as T;
  } catch (err) {
    if (process.env?.NODE_ENV === 'development') {
      console.warn(`ML service request to ${endpoint} failed:`, err);
    } else {
      error(`ML service request to ${endpoint} failed`, err instanceof Error ? err.stack : String(err));
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}

export const encode = async (oracles: string[]): Promise<number[]> => {
  try {
    const response = await mlServiceRequest<{ success: boolean; encoding: number[] }>('encode', { oracles });
    return response.encoding;
  } catch {
    return [];
  }
};

// Throwing variant — see buildOrThrow. Callers that need to distinguish a
// transient ML failure from a genuine empty result (e.g. Smart Search, which
// must surface "ML unavailable" instead of silently falling back to filter
// order and looking like a buggy cube mapping) use this instead of recommend().
export const recommendOrThrow = async (
  oracles: string[],
): Promise<{ adds: { oracle: string; rating: number }[]; cuts: { oracle: string; rating: number }[] }> => {
  const response = await mlServiceRequest<{
    success: boolean;
    adds: { oracle: string; rating: number }[];
    cuts: { oracle: string; rating: number }[];
  }>('recommend', { oracles });

  // Filter the OUTPUT recommendations to remove tokens, basic lands, etc.
  const filteredAdds = response.adds.filter((item) => {
    const cardIds = carddb.oracleToId[item.oracle];
    if (!cardIds || cardIds.length === 0) return false;
    const firstCardId = cardIds[0];
    if (!firstCardId) return false;
    const card = cardFromId(firstCardId);
    if (!card || card.error) return false;
    if (card.isToken) return false;
    if (card.type?.includes('Basic') && card.type?.includes('Land')) return false;
    return true;
  });

  return {
    adds: filteredAdds,
    cuts: response.cuts,
  };
};

export const recommend = async (
  oracles: string[],
): Promise<{ adds: { oracle: string; rating: number }[]; cuts: { oracle: string; rating: number }[] }> => {
  try {
    return await recommendOrThrow(oracles);
  } catch {
    return {
      adds: [],
      cuts: [],
    };
  }
};

// Throwing variant. Callers that need to distinguish a transient ML failure
// (5xx / timeout) from a genuine empty result — e.g. the deckbuild loop, which
// retries rather than truncating the deck — use this instead of build().
export const buildOrThrow = async (oracles: string[]): Promise<{ oracle: string; rating: number }[]> => {
  const response = await mlServiceRequest<{
    success: boolean;
    cards: { oracle: string; rating: number }[];
  }>('build', { oracles });

  return response.cards;
};

export const build = async (oracles: string[]): Promise<{ oracle: string; rating: number }[]> => {
  try {
    return await buildOrThrow(oracles);
  } catch {
    return [];
  }
};

export const cubeContext = async (oracles: string[]): Promise<number[]> => {
  try {
    const response = await mlServiceRequest<{ success: boolean; embedding: number[] }>('cubecontext', { oracles });
    return response.embedding;
  } catch {
    console.warn('Failed to encode cube context, returning empty array');
    return [];
  }
};

// Throwing variant — see buildOrThrow.
export const draftOrThrow = async (
  pack: string[],
  pool: string[],
  cubeContextEmbedding?: number[],
): Promise<{ oracle: string; rating: number }[]> => {
  const body: { pack: string[]; pool: string[]; cubeContext?: number[] } = { pack, pool };
  if (cubeContextEmbedding) body.cubeContext = cubeContextEmbedding;

  const response = await mlServiceRequest<{
    success: boolean;
    cards: { oracle: string; rating: number }[];
  }>('draft', body);

  return response.cards;
};

export const draft = async (
  pack: string[],
  pool: string[],
  cubeContextEmbedding?: number[],
): Promise<{ oracle: string; rating: number }[]> => {
  try {
    return await draftOrThrow(pack, pool, cubeContextEmbedding);
  } catch {
    return [];
  }
};

// Throwing variant — see buildOrThrow.
export const batchDraftOrThrow = async (
  inputs: { pack: string[]; pool: string[]; cubeContext?: number[] }[],
): Promise<{ oracle: string; rating: number }[][]> => {
  const response = await mlServiceRequest<{
    success: boolean;
    results: { oracle: string; rating: number }[][];
  }>('batchdraft', { inputs });

  return response.results;
};

export const batchDraft = async (
  inputs: { pack: string[]; pool: string[]; cubeContext?: number[] }[],
): Promise<{ oracle: string; rating: number }[][]> => {
  try {
    return await batchDraftOrThrow(inputs);
  } catch {
    console.warn('Failed to batch draft, returning empty arrays');
    return inputs.map(() => []);
  }
};

// Throwing variant — see buildOrThrow.
export const batchBuildOrThrow = async (inputs: string[][]): Promise<{ oracle: string; rating: number }[][]> => {
  const response = await mlServiceRequest<{
    success: boolean;
    results: { oracle: string; rating: number }[][];
  }>('batchbuild', { inputs });

  return response.results;
};

export const batchBuild = async (inputs: string[][]): Promise<{ oracle: string; rating: number }[][]> => {
  try {
    return await batchBuildOrThrow(inputs);
  } catch {
    console.warn('Failed to batch build, returning empty arrays');
    return inputs.map(() => []);
  }
};
