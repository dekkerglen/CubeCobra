/**
 * Rotates the daily crossword by calling the server's rotate endpoint.
 * Generation runs on the server because it needs the memory-resident card
 * catalog and the crossword vocabulary built from it, neither of which the lambda
 * loads. The endpoint is idempotent, so a retried lambda invocation is harmless.
 *
 * Reuses MANAMATRIX_API_KEY, the key the other daily rotations already share, so
 * there is no new Parameter Store secret to provision.
 */
export const rotateCrossword = async () => {
  try {
    const apiKey = process.env.MANAMATRIX_API_KEY;
    if (!apiKey) {
      console.error('Crossword rotation skipped: MANAMATRIX_API_KEY is not set');
      return;
    }

    const apiBaseUrl = process.env.API_BASE_URL || 'https://cubecobra.com';
    const url = `${apiBaseUrl}/tool/api/crossword/rotate`;
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
      return;
    }

    const result = await response.json();
    if (!result?.success) {
      console.error(`Crossword rotation failed: ${JSON.stringify(result)}`);
      return;
    }

    console.log(
      `Crossword rotation completed successfully for ${result.puzzle?.date}${result.alreadyExisted ? ' (already existed)' : ''}.`,
    );
  } catch (error) {
    console.error('Crossword rotation error:', error);
  }
};
