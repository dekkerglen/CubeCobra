import { readFileSync } from 'fs';
import path from 'path';

interface CardCatalog {
  oracleToId: Record<string, string[]>;
  _carddict: Record<string, any>;
  oracleToIndex: Record<string, number>;
}

const catalog: CardCatalog = {
  oracleToId: {},
  _carddict: {},
  oracleToIndex: {},
};

let initialized = false;

export function initializeCardCatalog(rootDir: string = '.') {
  if (initialized) {
    return;
  }

  try {
    // Load minimal card data needed for ML
    const oracleToIdPath = path.join(rootDir, 'private', 'oracleToId.json');

    if (readFileSync) {
      try {
        catalog.oracleToId = JSON.parse(readFileSync(oracleToIdPath, 'utf8'));
        console.log('Loaded oracleToId mapping');
      } catch {
        console.warn('Could not load oracleToId.json, oracle lookups may fail');
      }
    }

    // Build reverse index
    for (const [oracle] of Object.entries(catalog.oracleToId)) {
      catalog.oracleToIndex[oracle] = catalog.oracleToIndex[oracle] || 0;
    }

    initialized = true;
  } catch (err) {
    console.error('Error initializing card catalog:', err);
  }
}

export function getAllOracleIds(): string[] {
  return Object.keys(catalog.oracleToId);
}

export function getReasonableCardByOracle(_oracleId: string): any {
  // This function is no longer used - filtering moved to server
  return null;
}

export function isOracleBasic(_oracleId: string): boolean {
  // This function is no longer used - filtering moved to server
  return false;
}

// Stub for ML - returns oracle if not found
export function getOracleForMl(oracleId: string): string {
  return oracleId;
}

export default catalog;
