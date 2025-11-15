// Shared validation utilities

// UUID v4 regex pattern, PLUS allowing extra "2" at end for backsides of cards.
// See convertId in update_cards.ts. Relevant to card IDs, not Oracle ids.
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}2?$/i;

export const isValidUUID = (uuid: string): boolean => {
  return UUID_REGEX.test(uuid);
};

export const validateUUID = (uuid: string, fieldName = 'UUID'): void => {
  if (!isValidUUID(uuid)) {
    throw new Error(`Invalid ${fieldName} format`);
  }
};
