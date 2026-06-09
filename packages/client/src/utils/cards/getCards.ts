import { CardDetails } from '@utils/datatypes/Card';

interface GetCardsResponse {
  success: 'true' | 'false';
  cards: (CardDetails | null)[];
}

// Batch counterpart to getCard: resolve a whole list of card names in ONE request
// (POST /cube/api/getcardsforcube) instead of a request per card. Returns a
// parallel array — null for any name that couldn't be resolved.
export const getCards = async (
  csrfFetch: (input: RequestInfo, init?: RequestInit) => Promise<Response>,
  defaultPrinting: string,
  names: string[],
): Promise<(CardDetails | null)[]> => {
  if (names.length === 0) {
    return [];
  }

  const response = await csrfFetch(`/cube/api/getcardsforcube`, {
    method: 'POST',
    body: JSON.stringify({ names, defaultPrinting }),
    headers: { 'Content-Type': 'application/json' },
  });

  if (!response.ok) {
    console.error(`Couldn't get cards: ${response.status}.`);
    return names.map(() => null);
  }

  const json: GetCardsResponse = await response.json();
  if (json.success !== 'true' || !Array.isArray(json.cards)) {
    return names.map(() => null);
  }
  return json.cards;
};
