import 'dotenv/config';

import carddb, { cardFromId } from './carddb';
import { error } from './cloudwatch';

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://localhost:5002';

/**
 * Filter oracles to only include cards suitable for ML recommendations
 */
function filterOraclesForML(oracles: string[]): string[] {
  return oracles.filter((oracle) => {
    // Check if oracle exists in carddb
    const cardIds = carddb.oracleToId[oracle];
    if (!cardIds || cardIds.length === 0) {
      return false;
    }

    // Get a reasonable card for this oracle
    const firstCardId = cardIds[0];
    if (!firstCardId) {
      return false;
    }

    const card = cardFromId(firstCardId);
    if (!card) {
      return false;
    }

    // Filter out tokens, low-count cards, and basic lands
    if (card.isToken) {
      return false;
    }

    if ((card.cubeCount ?? 0) < 50) {
      return false;
    }

    if (card.type?.includes('Basic') && card.type?.includes('Land')) {
      return false;
    }

    return true;
  });
}

/**
 * Make a request to the ML recommender service
 */
async function mlServiceRequest<T>(endpoint: string, body: any): Promise<T> {
  console.log(`[ML Service] Making request to ${ML_SERVICE_URL}/${endpoint}`);
  console.log(`[ML Service] Request body:`, JSON.stringify(body).substring(0, 200));

  try {
    const response = await fetch(`${ML_SERVICE_URL}/${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    console.log(`[ML Service] Response status: ${response.status} ${response.statusText}`);

    if (!response.ok) {
      throw new Error(`ML service returned ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.message || 'ML service request failed');
    }

    console.log(`[ML Service] Request to ${endpoint} succeeded`);
    return data as T;
  } catch (err) {
    if (process.env?.NODE_ENV === 'development') {
      console.warn(`ML service request to ${endpoint} failed:`, err);
    } else {
      error(`ML service request to ${endpoint} failed`, err instanceof Error ? err.stack : String(err));
    }
    throw err;
  }
}

export const encode = async (oracles: string[]): Promise<number[]> => {
  try {
    const response = await mlServiceRequest<{ success: boolean; encoding: number[] }>('encode', { oracles });
    return response.encoding;
  } catch {
    console.warn('Failed to encode oracles, returning empty array');
    return [];
  }
};

export const recommend = async (
  oracles: string[],
): Promise<{ adds: { oracle: string; rating: number }[]; cuts: { oracle: string; rating: number }[] }> => {
  console.log(`[ML Service] recommend() called with ${oracles.length} oracles`);

  // Filter oracles on the server side before sending to ML service
  const filteredOracles = filterOraclesForML(oracles);
  console.log(`[ML Service] Filtered to ${filteredOracles.length} oracles for ML`);

  try {
    const response = await mlServiceRequest<{
      success: boolean;
      adds: { oracle: string; rating: number }[];
      cuts: { oracle: string; rating: number }[];
    }>('recommend', { oracles: filteredOracles });

    console.log(`[ML Service] recommend() returned ${response.adds.length} adds and ${response.cuts.length} cuts`);

    return {
      adds: response.adds,
      cuts: response.cuts,
    };
  } catch (err) {
    console.error(
      '[ML Service] Failed to get recommendations. Error:',
      err instanceof Error ? err.message : String(err),
    );
    return {
      adds: [],
      cuts: [],
    };
  }
};

export const build = async (oracles: string[]): Promise<{ oracle: string; rating: number }[]> => {
  // Filter oracles on the server side before sending to ML service
  const filteredOracles = filterOraclesForML(oracles);
  console.log(`[ML Service] build() filtered to ${filteredOracles.length} of ${oracles.length} oracles`);

  try {
    const response = await mlServiceRequest<{
      success: boolean;
      cards: { oracle: string; rating: number }[];
    }>('build', { oracles: filteredOracles });

    return response.cards;
  } catch {
    console.warn('Failed to build deck, returning empty array');
    return [];
  }
};

export const draft = async (pack: string[], pool: string[]): Promise<{ oracle: string; rating: number }[]> => {
  // Filter oracles on the server side before sending to ML service
  const filteredPack = filterOraclesForML(pack);
  const filteredPool = filterOraclesForML(pool);
  console.log(`[ML Service] draft() filtered pack: ${filteredPack.length}/${pack.length}, pool: ${filteredPool.length}/${pool.length}`);

  try {
    const response = await mlServiceRequest<{
      success: boolean;
      cards: { oracle: string; rating: number }[];
    }>('draft', { pack: filteredPack, pool: filteredPool });

    return response.cards;
  } catch {
    console.warn('Failed to draft, returning empty array');
    return [];
  }
};
