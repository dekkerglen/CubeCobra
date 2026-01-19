import dotenv from 'dotenv';
import https from 'https';
import path from 'path';

import 'module-alias/register';

// Configure dotenv with explicit path to jobs package .env
dotenv.config({ path: path.resolve(process.cwd(), 'packages', 'jobs', '.env') });

import { Combo, ComboTree } from '@utils/datatypes/CardCatalog';

import { downloadJson, uploadJson } from './utils/s3';

const loadMetadata = async () => {
  const indexToOracle = await downloadJson('indexToOracle.json');

  if (indexToOracle) {
    return {
      indexToOracle,
    };
  }

  console.log("Couldn't find indexToOracle.json in S3 (that is OK)");
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

const fetchAllPages = async (
  initialUrl: string,
  cacheKey: string,
  useS3Cache?: boolean,
): Promise<Record<string, Combo>> => {
  // For update jobs, always fetch fresh data - skip S3 cache check
  // The cache is only useful for non-update operations

  // Download and process pages
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

  // Save to S3 cache if enabled
  if (useS3Cache) {
    await uploadJson(cacheKey, dataById);
  }

  return dataById;
};

// Use S3 for caching if DATA_BUCKET is set
const useS3Cache = !!process.env.DATA_BUCKET;

(async () => {
  console.log('Initializing card database...');

  const { indexToOracle } = await loadMetadata();

  const oracleToIndex: Record<string, number> = {};
  indexToOracle.forEach((oracleId: string, index: number) => {
    oracleToIndex[oracleId] = index;
  });

  console.log('Downloading all combos data');
  const initialUrl = 'https://backend.commanderspellbook.com/variants?format=json';

  try {
    // Fetch all paginated data
    const dataById = await fetchAllPages(initialUrl, 'cache/comboDict.json', useS3Cache);

    console.log('Retrieved combo data from cache or API');

    console.log('Building combo tree...');
    const comboTree: ComboTree = {};
    let processed = 0;
    const total = Object.values(dataById).length;

    for (const id in dataById) {
      processed += 1;
      if (processed % 1000 === 0) {
        console.log(`Processed ${processed} of ${total}`);
      }
      const variant = dataById[id];

      if (!variant || !variant.uses) {
        continue; // Skip if variant is undefined or has no uses
      }

      const uses = variant.uses
        .map((use: any) => oracleToIndex[use.card.oracleId])
        .filter((index): index is number => index !== undefined); // Filter out undefined values

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

    console.log('Saving combo data to S3...');
    const saveStart = Date.now();
    await uploadJson('combos/comboDict.json', dataById);
    await uploadJson('combos/comboTree.json', comboTree);
    const saveDuration = (Date.now() - saveStart) / 1000;
    console.log(`Saved combo data to S3. Duration: ${saveDuration.toFixed(2)}s`);

    console.log('All combo data saved successfully');
  } catch (error) {
    console.error('Error downloading combo data:', error);
    process.exit(1);
  }

  console.log('Complete');
  process.exit();
})();
