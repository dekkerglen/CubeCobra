/**
 * Rotates the daily ManaMatrix puzzle by calling the server's rotate endpoint.
 * Generation runs on the server because it needs the memory-resident card
 * catalog, which the lambda does not load. The endpoint is idempotent, so a
 * retried lambda invocation is harmless.
 */
export const rotateManaMatrix = async () => {
  try {
    const apiKey = process.env.MANAMATRIX_API_KEY;
    if (!apiKey) {
      console.error('ManaMatrix rotation skipped: MANAMATRIX_API_KEY is not set');
      return;
    }

    const apiBaseUrl = process.env.API_BASE_URL || 'https://cubecobra.com';
    const response = await fetch(`${apiBaseUrl}/tool/api/manamatrix/rotate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ apiKey }),
    });

    if (!response.ok) {
      const body = await response.text();
      console.error(`ManaMatrix rotation failed with status ${response.status}: ${body}`);
      return;
    }

    const result = await response.json();
    console.log(
      `ManaMatrix rotation completed successfully for ${result?.puzzle?.date}${result?.alreadyExisted ? ' (already existed)' : ''}.`,
    );
  } catch (error) {
    console.error('ManaMatrix rotation error:', error);
  }
};
