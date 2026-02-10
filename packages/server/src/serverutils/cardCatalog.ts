// import missing types from @utils/datatypes/Catalog
import { Catalog } from '@utils/datatypes/CardCatalog';
import json from 'big-json';
import fs from 'fs';

const catalog: Catalog = {
  cardtree: {},
  imagedict: {},
  cardimages: {},
  cardnames: [],
  comboTree: {},
  full_names: [],
  nameToId: {},
  oracleToId: {},
  english: {},
  _carddict: {},
  indexToOracle: [],
  oracleToIndex: {},
  metadatadict: {},
  printedCardList: [], // for card filters
  comboOracleToIndex: {}, // Combo-specific mapping saved with comboTree
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
  'comboOracleToIndex.json': 'comboOracleToIndex',
};

async function loadJSONFile(filename: string, attribute: keyof Catalog) {
  return new Promise<void>((resolve, reject) => {
    // Check if file exists before trying to load it
    if (!fs.existsSync(filename)) {
      console.info(`File ${filename} not found, using default value for ${attribute}`);
      resolve();
      return;
    }

    try {
      const fileStart = Date.now();
      const readStream = fs.createReadStream(filename);
      const parseStream = json.createParseStream();

      parseStream.on('data', (parsed) => {
        catalog[attribute] = parsed;
      });

      readStream.pipe(parseStream);

      readStream.on('end', () => {
        const fileDuration = ((Date.now() - fileStart) / 1000).toFixed(2);

        console.info(`Loaded ${filename} into ${attribute} in ${fileDuration}s`);
        resolve();
      });

      readStream.on('error', (e) => {
        console.warn(`Error loading ${filename}, using default value for ${attribute}:`, e.message);
        resolve();
      });
    } catch (e) {
      reject(e);
    }
  });
}

export async function loadAllFiles(basePath: string = 'private') {
  await Promise.all(
    Object.entries(fileToAttribute).map(([filename, attribute]) => loadJSONFile(`${basePath}/${filename}`, attribute)),
  );
}

export async function initializeCardDb(basePath: string = 'private') {
  console.info('Loading carddb...');
  await loadAllFiles(basePath);

  catalog.printedCardList = Object.values(catalog._carddict).filter((card) => !card.digital && !card.isToken);
  catalog.oracleToIndex = Object.fromEntries(
    catalog.indexToOracle.map((oracleId: string, index: number) => [oracleId, index]),
  );

  // If comboOracleToIndex wasn't loaded (file doesn't exist yet), fall back to oracleToIndex
  // This maintains backward compatibility until the metadata task runs and generates the file
  if (Object.keys(catalog.comboOracleToIndex).length === 0) {
    console.info('comboOracleToIndex not found, falling back to oracleToIndex for combo lookups');
    catalog.comboOracleToIndex = catalog.oracleToIndex;
  }

  console.info('Finished loading carddb.');
}

export default catalog;
