import json from 'big-json';
import fs from 'fs';

// import missing types from @utils/datatypes/Catalog
import { Catalog } from '@utils/datatypes/CardCatalog';

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
      const fileStart = Date.now();
      const readStream = fs.createReadStream(filename);
      const parseStream = json.createParseStream();

      parseStream.on('data', (parsed) => {
        catalog[attribute] = parsed;
      });

      readStream.pipe(parseStream);

      readStream.on('end', () => {
        const fileDuration = ((Date.now() - fileStart) / 1000).toFixed(2);
        // eslint-disable-next-line no-console
        console.info(`Loaded ${filename} into ${attribute} in ${fileDuration}s`);
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
