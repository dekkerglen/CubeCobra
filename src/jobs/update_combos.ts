require('module-alias/register');
/* eslint-disable no-console */
require('dotenv').config();

import fs from 'fs';
import https from 'https';
import path from 'path';

import { Combo, ComboTree } from '../util/cardCatalog';

const loadMetadata = async () => {
  if (fs.existsSync('./temp') && fs.existsSync('./temp/metadatadict.json')) {
    const indexToOracle = JSON.parse(fs.readFileSync('./temp/indexToOracle.json', 'utf8'));

    return {
      indexToOracle,
    };
  }

  console.log("Couldn't find metadatadict.json");
  return {
    indexToOracle: [],
  };
};

const fetchWithRetries = async (url: string, retries = 3, delay = 1000): Promise<any> => {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await new Promise<any>((resolve, reject) => {
        https
          .get(url, (response) => {
            if (response.statusCode !== 200) {
              reject(new Error(`Failed to fetch data: ${response.statusCode}`));
              return;
            }

            let rawData = '';
            response.on('data', (chunk) => {
              rawData += chunk;
            });

            response.on('end', () => {
              try {
                const parsedData = JSON.parse(rawData);
                resolve(parsedData);
              } catch (err) {
                reject(err);
              }
            });
          })
          .on('error', (err) => {
            reject(err);
          });
      });
    } catch (error) {
      if (error instanceof Error) {
        console.error(`Attempt ${attempt} failed: ${error.message}`);
      } else {
        console.error(`Attempt ${attempt} failed with an unknown error:`, error);
      }
      if (attempt < retries) {
        const backoff = delay * Math.pow(2, attempt - 1); // Exponential backoff
        console.log(`Retrying in ${backoff}ms...`);
        await new Promise((resolve) => setTimeout(resolve, backoff));
      } else {
        if (error instanceof Error) {
          throw new Error(`Failed to fetch data after ${retries} attempts: ${error.message}`);
        } else {
          throw new Error(`Failed to fetch data after ${retries} attempts: Unknown error`);
        }
      }
    }
  }
};

const fetchAllPages = async (initialUrl: string): Promise<Record<string, Combo>> => {
  let url = initialUrl;
  const dataById: Record<string, any> = {};

  while (url) {
    console.log(`Fetching data from: ${url}`);
    const data = await fetchWithRetries(url);
    if (!data || !data.results) {
      console.error('No results found in the response');
      break;
    }
    for (const variant of data.results) {
      const id = variant.id;
      dataById[id] = variant;
    }
    url = data.next; // Get the next URL from the response
  }

  return dataById;
};

(async () => {
  console.log('Initializing card database...');

  const { indexToOracle } = await loadMetadata();

  const oracleToIndex: Record<string, number> = {};
  indexToOracle.forEach((oracleId: string, index: number) => {
    oracleToIndex[oracleId] = index;
  });

  console.log('Downloading all combos data');
  const initialUrl = 'https://backend.commanderspellbook.com/variants?format=json';
  const privateDir = path.resolve(__dirname, '..', '..', 'private');
  const dataByIdPath = path.join(privateDir, 'comboDict.json');
  const comboTreePath = path.join(privateDir, 'comboTree.json');

  try {
    // Ensure the /private directory exists
    if (!fs.existsSync(privateDir)) {
      fs.mkdirSync(privateDir, { recursive: true });
    }

    // Fetch all paginated data
    const dataById = await fetchAllPages(initialUrl);

    console.log('Saving comboDict.json...');
    fs.writeFileSync(dataByIdPath, JSON.stringify(dataById));

    console.log('Building combo tree...');
    const comboTree: ComboTree = {};
    let processed = 0;
    const total = Object.values(dataById).length;

    for (const id in dataById) {
      processed += 1;
      if (processed % 100 === 0) {
        console.log(`Processed ${processed} of ${total}`);
      }
      const variant = dataById[id];
      const uses = variant.uses.map((use: any) => oracleToIndex[use.card.oracleId]);

      let currentNode = comboTree;
      for (const index of uses) {
        if (!currentNode.c) {
          currentNode.c = {};
        }
        if (!currentNode.c[index]) {
          currentNode.c[index] = {};
        }
        currentNode = currentNode.c[index] as ComboTree;
      }
      if (!currentNode['$']) {
        currentNode['$'] = [];
      }
      currentNode['$'].push(id);
    }

    console.log('Saving comboTree.json...');
    fs.writeFileSync(comboTreePath, JSON.stringify(comboTree));

    console.log('All combo data saved successfully');
  } catch (error) {
    console.error('Error downloading combo data:', error);
    process.exit(1);
  }

  console.log('Complete');
  process.exit();
})();
