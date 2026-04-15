type OracleIdIndex = number;

export interface Related {
  top: OracleIdIndex[];
  creatures: OracleIdIndex[];
  spells: OracleIdIndex[];
  other: OracleIdIndex[];
}
export interface CardMetadata {
  cubedWith: Related;
  draftedWith: Related;
  synergistic: Related;
  elo: number;
  popularity: number;
  cubes: number;
  picks: number;
  mostSimilar: OracleIdIndex;
}

export interface ComboTree {
  $?: string[];
  c?: Record<number, ComboTree>;
}

export interface ComboProduce {
  feature: {
    id: number;
    name: string;
    status: string;
    uncountable: boolean;
  };
  quantity: number;
}
export interface Combo {
  id: string;
  of: {
    id: number;
  }[];
  uses: {
    card: {
      id: number;
      name: string;
      spoiler: boolean;
      oracleId: string;
      typeLine: string;
    };
    quantity: number;
    zoneLocations: string[];
    exileCardState: string;
    mustBeCommander: boolean;
    libraryCardState: string;
    graveyardCardState: string;
    battlefieldCardState: string;
  }[];
  notes: string;
  prices: {
    tcgplayer: string;
    cardmarket: string;
    cardkingdom: string;
  };
  status: string;
  spoiler: boolean;
  identity: string;
  includes: {
    id: number;
  }[];
  produces: ComboProduce[];
  requires: {
    quantity: number;
    template: {
      id: number;
      name: string;
      scryfallApi: string;
      scryfallQuery: string;
    };
    zoneLocations: string[];
    exileCardState: string;
    mustBeCommander: boolean;
    libraryCardState: string;
    graveyardCardState: string;
    battlefieldCardState: string;
  }[];
  legalities: {
    brawl: boolean;
    predh: boolean;
    legacy: boolean;
    modern: boolean;
    pauper: boolean;
    pioneer: boolean;
    vintage: boolean;
    standard: boolean;
    commander: boolean;
    premodern: boolean;
    oathbreaker: boolean;
    pauperCommander: boolean;
    pauperCommanderMain: boolean;
  };
  popularity: number;
  bracketTag: string;
  description: string;
  manaNeeded: string;
  variantCount: number;
  manaValueNeeded: number;
  easyPrerequisites: string;
  notablePrerequisites: string;
  dateCreated: number;
  dateLastUpdated: number;
}

/**
 * Compressed tag dictionaries for efficient tag lookups.
 * Keys are stringified OracleIdIndex values (compressed oracle indices).
 * Values are arrays of tag name indices into the corresponding tag names array.
 *
 * To check if a card has a specific tag:
 *   1. Look up the card's compressed oracle index via oracleToIndex[oracleId]
 *   2. Look up tagDict[oracleIndex] to get the array of tag name indices
 *   3. Check if the desired tag's index is in that array
 *
 * To resolve tag names, use oracleTagNames[tagIndex] or illustrationTagNames[tagIndex].
 */
export type TagDict = Record<number, number[]>;

export interface Catalog {
  cardtree: Record<string, any>;
  imagedict: Record<string, any>;
  cardimages: Record<string, any>;
  cardnames: string[];
  full_names: string[];
  nameToId: Record<string, string[]>;
  oracleToId: Record<string, string[]>;
  english: Record<string, string>;
  _carddict: Record<string, any>;
  indexToOracle: string[];
  metadatadict: Record<string, CardMetadata>;
  printedCardList: any[];
  comboTree: ComboTree;
  oracleToIndex: Record<string, number>;
  // Combo-specific oracle index mapping - saved alongside comboTree to ensure index consistency
  comboOracleToIndex: Record<string, number>;
  // Scryfall oracle-level tags (e.g. "synergy-burn", "zombify")
  oracleTagDict: TagDict;
  oracleTagNames: string[];
  // Scryfall illustration-level tags (e.g. artwork-related classifications)
  illustrationTagDict: TagDict;
  illustrationTagNames: string[];
}
