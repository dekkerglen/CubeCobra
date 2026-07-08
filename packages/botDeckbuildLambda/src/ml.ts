/**
 * Minimal recommender client. The lambda runs in the VPC and calls the internal ML ALB
 * directly (ML_SERVICE_URL) — the same endpoints serverutils/ml.ts uses. Bounded retry so a
 * single transient blip mid-build doesn't fail (and SQS-retry) the whole batch.
 */
const ML_SERVICE_URL = (process.env.ML_SERVICE_URL || 'http://localhost:5002').replace(/\/+$/, '');
const ML_TIMEOUT_MS = 10_000;
const ML_MAX_ATTEMPTS = 3;
const ML_RETRY_BASE_MS = 150;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function mlRequestOnce<T>(endpoint: string, body: unknown): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ML_TIMEOUT_MS);
  try {
    const res = await fetch(`${ML_SERVICE_URL}/${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`ML ${endpoint} returned ${res.status}`);
    const data = (await res.json()) as { success?: boolean; message?: string } & T;
    if (!data.success) throw new Error(data.message || `ML ${endpoint} request failed`);
    return data;
  } finally {
    clearTimeout(timer);
  }
}

async function mlRequest<T>(endpoint: string, body: unknown): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 1; attempt <= ML_MAX_ATTEMPTS; attempt += 1) {
    try {
      return await mlRequestOnce<T>(endpoint, body);
    } catch (err) {
      lastErr = err;
      if (attempt < ML_MAX_ATTEMPTS) {
        await sleep(ML_RETRY_BASE_MS * 2 ** (attempt - 1));
      }
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}

type Ranked = { oracle: string; rating: number }[];

export const batchBuild = async (inputs: string[][]): Promise<Ranked[]> =>
  (await mlRequest<{ results: Ranked[] }>('batchbuild', { inputs })).results;

export const batchDraft = async (inputs: { pack: string[]; pool: string[] }[]): Promise<Ranked[]> =>
  (await mlRequest<{ results: Ranked[] }>('batchdraft', { inputs })).results;

export const encode = async (oracles: string[]): Promise<number[]> =>
  (await mlRequest<{ encoding: number[] }>('encode', { oracles })).encoding;

// One batched call that encodes every deck's oracle list at once — used for archetype naming
// so a batch of drafts doesn't fan out to one /encode call per bot seat.
export const batchEncode = async (inputs: string[][]): Promise<number[][]> =>
  (await mlRequest<{ results: number[][] }>('batchencode', { inputs })).results;
