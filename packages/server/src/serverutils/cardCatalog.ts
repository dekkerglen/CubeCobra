// import missing types from @utils/datatypes/Catalog
import { normalizeName, reasonableCard } from '@utils/cardutil';
import { Catalog } from '@utils/datatypes/CardCatalog';
import json from 'big-json';
import fs from 'fs';

const catalog: Catalog = {
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
  printedCardListWithExtras: [], // card filters, including tokens/extras
  reasonable_names: [],
  reasonable_full_names: [],
  comboOracleToIndex: {}, // Combo-specific mapping saved with comboTree
  setdict: {}, // Set metadata keyed by set code, backs the Explore -> Sets page
};

// names/full_names back the card-name autocomplete (served via /tool/api/cardnames
// query endpoint); imagedict/cardimages back image lookups (imageutil +
// /tool/api/cardimagedata). All are kept in memory so nothing ships to the client.
export const fileToAttribute: Record<string, keyof Catalog> = {
  'carddict.json': '_carddict',
  'names.json': 'cardnames',
  'full_names.json': 'full_names',
  'nameToId.json': 'nameToId',
  'oracleToId.json': 'oracleToId',
  'imagedict.json': 'imagedict',
  'cardimages.json': 'cardimages',
  'english.json': 'english',
  'indexToOracle.json': 'indexToOracle',
  'metadatadict.json': 'metadatadict',
  'comboTree.json': 'comboTree',
  'comboOracleToIndex.json': 'comboOracleToIndex',
  'setdict.json': 'setdict',
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

  // The autocomplete endpoint needs full_names as a sorted string array. If the
  // loaded file isn't one (older builds wrote a different shape, or it's absent
  // in local dev), rebuild it from the in-memory card dict — no dependency on
  // the card-update job having re-run.
  if (!Array.isArray(catalog.full_names) || catalog.full_names.length === 0) {
    catalog.full_names = Array.from(
      new Set(Object.values(catalog._carddict).map((card) => normalizeName(card.full_name))),
    ).sort();
  }

  catalog.printedCardList = Object.values(catalog._carddict).filter((card) => !card.digital && !card.isToken);
  // Same population minus the token exclusion, so set browsing and empty-result
  // fallbacks can surface token-only sets (e.g. memorabilia/Jumpstart front cards).
  catalog.printedCardListWithExtras = Object.values(catalog._carddict).filter((card) => !card.digital);

  // CubeCobra synthetic cards that should always appear in autocomplete
  const ALWAYS_ALLOW_IDS = new Set(['custom-card', 'voucher']);

  // Build filtered name arrays for autocomplete — include only names with at
  // least one "reasonable" printing (excludes tokens, digital, art series, promos, etc.)
  catalog.reasonable_names = catalog.cardnames.filter((name) => {
    const ids = catalog.nameToId[name];
    if (!ids) return false;
    return ids.some((id) => {
      if (ALWAYS_ALLOW_IDS.has(id)) return true;
      const card = catalog._carddict[id];
      return card && reasonableCard(card);
    });
  });

  catalog.reasonable_full_names = catalog.full_names.filter((fullName) => {
    const image = catalog.imagedict[fullName];
    if (!image || !image.id) return false;
    if (ALWAYS_ALLOW_IDS.has(image.id)) return true;
    const card = catalog._carddict[image.id];
    return card && reasonableCard(card);
  });

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
