import json from 'big-json';
import fs from 'fs';

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
}

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
  comboDict: Record<string, Combo>;
  oracleToIndex: Record<string, number>;
}

const catalog: Catalog = {
  cardtree: {},
  imagedict: {},
  cardimages: {},
  cardnames: [],
  comboTree: {},
  comboDict: {},
  full_names: [],
  nameToId: {},
  oracleToId: {},
  english: {},
  _carddict: {},
  indexToOracle: [],
  oracleToIndex: {},
  metadatadict: {},
  printedCardList: [], // for card filters
};

export const fileToAttribute: Record<string, keyof Catalog> = {
  'carddict.json': '_carddict',
  'cardtree.json': 'cardtree',
  'names.json': 'cardnames',
  'nameToId.json': 'nameToId',
  'oracleToId.json': 'oracleToId',
  'full_names.json': 'full_names',
  'imagedict.json': 'imagedict',
  'cardimages.json': 'cardimages',
  'english.json': 'english',
  'indexToOracle.json': 'indexToOracle',
  'metadatadict.json': 'metadatadict',
  'comboTree.json': 'comboTree',
  'comboDict.json': 'comboDict',
};

async function loadJSONFile(filename: string, attribute: keyof Catalog) {
  return new Promise<void>((resolve, reject) => {
    try {
      const readStream = fs.createReadStream(filename);
      const parseStream = json.createParseStream();

      parseStream.on('data', (parsed) => {
        catalog[attribute] = parsed;
      });

      readStream.pipe(parseStream);

      readStream.on('end', () => {
        // eslint-disable-next-line no-console
        console.info(`Loaded ${filename} into ${attribute}`);
        resolve();
      });
    } catch (e) {
      reject(e);
    }
  });
}

export async function loadAllFiles() {
  await Promise.all(
    Object.entries(fileToAttribute).map(([filename, attribute]) => loadJSONFile(`private/${filename}`, attribute)),
  );
}

export async function initializeCardDb() {
  // eslint-disable-next-line no-console
  console.info('Loading carddb...');
  await loadAllFiles();

  catalog.printedCardList = Object.values(catalog._carddict).filter((card) => !card.digital && !card.isToken);
  catalog.oracleToIndex = Object.fromEntries(
    catalog.indexToOracle.map((oracleId: string, index: number) => [oracleId, index]),
  );

  // eslint-disable-next-line no-console
  console.info('Finished loading carddb.');
}

export default catalog;
