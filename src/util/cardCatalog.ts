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

interface Catalog {
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
}

const catalog: Catalog = {
  cardtree: {},
  imagedict: {},
  cardimages: {},
  cardnames: [],
  full_names: [],
  nameToId: {},
  oracleToId: {},
  english: {},
  _carddict: {},
  indexToOracle: [],
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

  // eslint-disable-next-line no-console
  console.info('Finished loading carddb.');
}

export default catalog;
