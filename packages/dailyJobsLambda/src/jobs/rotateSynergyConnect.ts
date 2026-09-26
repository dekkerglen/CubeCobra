/**
 * Rotates the daily Synergy Connect puzzle by calling the server's rotate
 * endpoint. Generation runs on the server because it needs the memory-resident
 * card catalog and synergy metadata. The endpoint is idempotent, so a retried
 * lambda invocation is harmless.
 */
export const rotateSynergyConnect = async () => {
  try {
    const apiKey = process.env.MANAMATRIX_API_KEY;
    if (!apiKey) {
      console.error('Synergy Connect rotation skipped: MANAMATRIX_API_KEY is not set');
      return;
    }

    const apiBaseUrl = process.env.API_BASE_URL || 'https://cubecobra.com';
    const url = `${apiBaseUrl}/tool/api/synergyconnect/rotate`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ apiKey }),
    });

    // An unknown path renders the HTML error page with a 200, so a successful
    // status alone doesn't mean we reached the endpoint — require JSON before
    // parsing, and surface a snippet when it's something else.
    const contentType = response.headers.get('content-type') || '';
    if (!response.ok || !contentType.includes('application/json')) {
      const body = (await response.text()).slice(0, 200);
      console.error(
        `Synergy Connect rotation failed: POST ${url} returned ${response.status} (${contentType || 'no content-type'}): ${body}`,
      );
      return;
    }

    const result = await response.json();
    if (!result?.success) {
      console.error(`Synergy Connect rotation failed: ${JSON.stringify(result)}`);
      return;
    }

    console.log(
      `Synergy Connect rotation completed successfully for ${result.puzzle?.date}${result.alreadyExisted ? ' (already existed)' : ''}.`,
    );
  } catch (error) {
    console.error('Synergy Connect rotation error:', error);
  }
};
