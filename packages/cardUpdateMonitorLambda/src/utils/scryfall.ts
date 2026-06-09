// Scryfall's API requires every request to send a descriptive User-Agent and
// an Accept header. Requests without them are rejected with HTTP 400.
// See https://scryfall.com/docs/api#headers
export const SCRYFALL_HEADERS = {
  Accept: 'application/json',
  'User-Agent': 'CubeCobra-cardUpdateMonitorLambda/5.0.0 (+https://cubecobra.com)',
};
