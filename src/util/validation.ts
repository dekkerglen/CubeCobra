// Shared validation utilities

// UUID v4 regex pattern
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const isValidUUID = (uuid: string): boolean => {
  return UUID_REGEX.test(uuid);
};

export const validateUUID = (uuid: string, fieldName = 'UUID'): void => {
  if (!isValidUUID(uuid)) {
    throw new Error(`Invalid ${fieldName} format`);
  }
};
