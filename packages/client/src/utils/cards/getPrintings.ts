import { CardDetails, PrintingPreference } from '@utils/datatypes/Card';

interface GetPrintingsResponse {
  success: 'true' | 'false';
  printings: Record<string, CardDetails>;
}

// Resolve a list of card ids to the printing a printing preference picks for each, in ONE
// request (POST /cube/api/getprintings). The result only holds ids that would move, keyed by
// the id sent; null when the request fails.
export const getPrintings = async (
  csrfFetch: (input: RequestInfo, init?: RequestInit) => Promise<Response>,
  printing: PrintingPreference,
  ids: string[],
): Promise<Record<string, CardDetails> | null> => {
  if (ids.length === 0) {
    return {};
  }

  const response = await csrfFetch(`/cube/api/getprintings`, {
    method: 'POST',
    body: JSON.stringify({ ids, printing }),
    headers: { 'Content-Type': 'application/json' },
  });

  if (!response.ok) {
    console.error(`Couldn't get printings: ${response.status}.`);
    return null;
  }

  const json: GetPrintingsResponse = await response.json();
  if (json.success !== 'true' || typeof json.printings !== 'object' || json.printings === null) {
    return null;
  }
  return json.printings;
};
