import 'dotenv/config';

import { error } from './cloudwatch';

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://localhost:5002';

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
  } catch (_err) {
    console.warn('Failed to encode oracles, returning empty array');
    return [];
  }
};

export const recommend = async (
  oracles: string[],
): Promise<{ adds: { oracle: string; rating: number }[]; cuts: { oracle: string; rating: number }[] }> => {
  console.log(`[ML Service] recommend() called with ${oracles.length} oracles`);

  try {
    const response = await mlServiceRequest<{
      success: boolean;
      adds: { oracle: string; rating: number }[];
      cuts: { oracle: string; rating: number }[];
    }>('recommend', { oracles });

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
  try {
    const response = await mlServiceRequest<{
      success: boolean;
      cards: { oracle: string; rating: number }[];
    }>('build', { oracles });

    return response.cards;
  } catch (_err) {
    console.warn('Failed to build deck, returning empty array');
    return [];
  }
};

export const draft = async (pack: string[], pool: string[]): Promise<{ oracle: string; rating: number }[]> => {
  try {
    const response = await mlServiceRequest<{
      success: boolean;
      cards: { oracle: string; rating: number }[];
    }>('draft', { pack, pool });

    return response.cards;
  } catch (_err) {
    console.warn('Failed to draft, returning empty array');
    return [];
  }
};
