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
    const carddictPath = path.join(rootDir, 'private', 'carddict.json');

    if (readFileSync) {
      try {
        catalog.oracleToId = JSON.parse(readFileSync(oracleToIdPath, 'utf8'));
        console.log('Loaded oracleToId mapping');
      } catch (_err) {
        console.warn('Could not load oracleToId.json, oracle lookups may fail');
      }

      try {
        catalog._carddict = JSON.parse(readFileSync(carddictPath, 'utf8'));
        console.log('Loaded card dictionary');
      } catch (_err) {
        console.warn('Could not load carddict.json, card lookups may fail');
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

export function getReasonableCardByOracle(oracleId: string): any {
  const ids = catalog.oracleToId[oracleId];
  if (!ids || ids.length === 0) {
    return { cubeCount: 0, isToken: false };
  }

  // Return first reasonable card
  for (const id of ids) {
    const card = catalog._carddict[id];
    if (card && !card.isToken && !card.digital) {
      return card;
    }
  }

  return catalog._carddict[ids[0] || ''] || { cubeCount: 0, isToken: false };
}

export function isOracleBasic(oracleId: string): boolean {
  const ids = catalog.oracleToId[oracleId];
  if (!ids || ids.length === 0) {
    return false;
  }
  const card = catalog._carddict[ids[0] || ''];
  return card?.type?.includes('Basic') || false;
}

// Stub for ML - returns oracle if not found
export function getOracleForMl(oracleId: string, _printingPreference: any): string {
  return oracleId;
}

export default catalog;
