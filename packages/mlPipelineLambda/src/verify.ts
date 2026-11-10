// Requests per verify call. The recommender's load balancer spreads them over its instances, so
// a version reported by every response is, in practice, the version every instance serves.
export const VERIFY_REQUESTS = 20;

const REQUEST_TIMEOUT_MS = 3000;

/** Whether a GET /version response shows the recommender serving `version`. */
export const isServingVersion = (status: number, body: unknown, version: string): boolean => {
  if (status !== 200 || typeof body !== 'object' || body === null) return false;
  const { modelVersion, ok } = body as { modelVersion?: unknown; ok?: unknown };
  return modelVersion === version && ok === true;
};

// Null when the response shows `version`, otherwise what it showed instead.
const check = async (url: string, version: string): Promise<string | null> => {
  try {
    const response = await fetch(`${url}/version`, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
    const text = await response.text();
    let body: unknown = null;
    try {
      body = JSON.parse(text);
    } catch {
      // Not JSON (a load balancer error page, or the app still starting).
    }
    return isServingVersion(response.status, body, version) ? null : `HTTP ${response.status}: ${text.slice(0, 200)}`;
  } catch (error) {
    // Unreachable or timed out (an instance starting up or busy reloading): not ready yet.
    return error instanceof Error ? error.message : String(error);
  }
};

/** True when all VERIFY_REQUESTS requests report `version`; stops at the first that doesn't. */
export const servesVersion = async (url: string, version: string): Promise<boolean> => {
  for (let request = 1; request <= VERIFY_REQUESTS; request += 1) {
    const problem = await check(url, version);
    if (problem) {
      console.log(`Request ${request}/${VERIFY_REQUESTS} to ${url} did not report ${version}: ${problem}`);
      return false;
    }
  }
  return true;
};
