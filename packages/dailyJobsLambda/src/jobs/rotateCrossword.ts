/**
 * Rotates the daily crossword by calling the server's rotate endpoint.
 * Generation runs on the server because it needs the memory-resident card
 * catalog and the crossword vocabulary built from it, neither of which the lambda
 * loads. The endpoint is idempotent, so a retried lambda invocation is harmless.
 *
 * Reuses MANAMATRIX_API_KEY, the key the other daily rotations already share, so
 * there is no new Parameter Store secret to provision.
 *
 * Retried because the biggest grids don't always fill. The server already
 * exhausts a ladder of theme redraws inside one request, but it is bounded by a
 * 60-second request timeout, and Sunday's 16x16 still comes back empty about
 * three times in ten. Each call is an independent set of draws, so asking again
 * turns that into roughly three in a hundred. The endpoint is idempotent, so a
 * retry after a *successful* call just returns the stored puzzle.
 */
const ROTATE_ATTEMPTS = 3;

export const rotateCrossword = async () => {
  const apiKey = process.env.MANAMATRIX_API_KEY;
  if (!apiKey) {
    console.error('Crossword rotation skipped: MANAMATRIX_API_KEY is not set');
    return;
  }

  const apiBaseUrl = process.env.API_BASE_URL || 'https://cubecobra.com';
  const url = `${apiBaseUrl}/tool/api/crossword/rotate`;

  for (let attempt = 1; attempt <= ROTATE_ATTEMPTS; attempt++) {
    const outcome = await attemptRotation(url, apiKey, attempt);
    if (outcome === 'done') {
      return;
    }
  }

  console.error(`Crossword rotation failed after ${ROTATE_ATTEMPTS} attempts; today has no puzzle.`);
};

/** 'done' when the day is settled — success, or a failure retrying can't fix. */
const attemptRotation = async (url: string, apiKey: string, attempt: number): Promise<'done' | 'retry'> => {
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ apiKey }),
    });

    // An unknown path renders the HTML error page with a 200, so a successful
    // status alone doesn't mean we reached the endpoint — require JSON before
    // parsing, and surface a snippet when it's something else (wrong
    // API_BASE_URL, server not yet deployed, downtime page, ...).
    const contentType = response.headers.get('content-type') || '';
    if (!response.ok || !contentType.includes('application/json')) {
      const body = (await response.text()).slice(0, 200);
      console.error(
        `Crossword rotation failed: POST ${url} returned ${response.status} (${contentType || 'no content-type'}): ${body}`,
      );
      // Wrong URL, bad key, server down — none of which a redraw fixes.
      return 'done';
    }

    const result = await response.json();
    if (!result?.success) {
      console.error(`Crossword rotation attempt ${attempt} failed: ${JSON.stringify(result)}`);
      return 'retry';
    }

    console.log(
      `Crossword rotation completed successfully for ${result.puzzle?.date} on attempt ${attempt}${result.alreadyExisted ? ' (already existed)' : ''}.`,
    );
    return 'done';
  } catch (error) {
    console.error(`Crossword rotation attempt ${attempt} error:`, error);
    return 'retry';
  }
};
