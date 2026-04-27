/** Shared limits used across all draft-simulator routes. */
export const MAX_SEATS = 16;
/** Max total seats accepted in a single saved simulation payload. */
export const MAX_TOTAL_SEATS = 100_000;
/** Max numDrafts accepted by the setup endpoint. Caps CPU/memory of pack generation
 *  and the response payload (roughly numDrafts × numSeats × 45 oracle IDs). */
export const MAX_SETUP_DRAFTS = 1000;
export const MAX_HISTORY = 5;
