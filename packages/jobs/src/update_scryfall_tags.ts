import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

import 'module-alias/register';

// Configure dotenv – try both repo-root and package-local cwd
dotenv.config({ path: path.resolve(process.cwd(), 'packages', 'jobs', '.env') });
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

import { TagDict } from '@utils/datatypes/CardCatalog';

import { uploadJson } from './utils/s3';

const ORACLE_TAGS_URL = 'https://api.scryfall.com/private/tags/oracle';
const ILLUSTRATION_TAGS_URL = 'https://api.scryfall.com/private/tags/illustration';

interface ScryfallTag {
  object: string;
  id: string;
  label: string;
  type: string;
  description: string | null;
  oracle_ids?: string[];
  illustration_ids?: string[];
}

interface ScryfallTagResponse {
  data: ScryfallTag[];
}

async function fetchWithRetry(url: string, maxRetries = 3): Promise<Response> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'CubeCobra/1.0',
          Accept: 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status} ${response.statusText}`);
      }

      return response;
    } catch (error) {
      console.warn(`Fetch attempt ${attempt}/${maxRetries} failed for ${url}: ${error}`);
      if (attempt === maxRetries) throw error;
      // Exponential backoff: 2s, 4s, 8s...
      await new Promise((resolve) => setTimeout(resolve, 2000 * Math.pow(2, attempt - 1)));
    }
  }
  throw new Error(`Failed to fetch ${url} after ${maxRetries} attempts`);
}

/**
 * Fetches Scryfall oracle tags and builds a compressed tag dictionary
 * keyed by oracle index.
 */
async function fetchAndProcessOracleTags(
  oracleToIndex: Record<string, number>,
): Promise<{ tagDict: TagDict; tagNames: string[] }> {
  console.log(`Fetching tags from ${ORACLE_TAGS_URL}`);
  const response = await fetchWithRetry(ORACLE_TAGS_URL);
  const { data: tags }: ScryfallTagResponse = await response.json();
  console.log(`Received ${tags.length} oracle tags`);

  const tagNames: string[] = [];
  const tagDict: TagDict = {};

  for (let tagIndex = 0; tagIndex < tags.length; tagIndex++) {
    const tag = tags[tagIndex];
    if (!tag) continue;

    tagNames.push(tag.label);

    if (!Array.isArray(tag.oracle_ids)) continue;

    for (const oracleId of tag.oracle_ids) {
      const compressedIndex = oracleToIndex[oracleId];
      if (compressedIndex === undefined) continue;

      if (!tagDict[compressedIndex]) {
        tagDict[compressedIndex] = [];
      }
      tagDict[compressedIndex]!.push(tagIndex);
    }
  }

  const cardCount = Object.keys(tagDict).length;
  console.log(`Processed ${tagNames.length} oracle tags across ${cardCount} oracle cards`);

  return { tagDict, tagNames };
}

/**
 * Fetches Scryfall illustration tags and builds a compressed tag dictionary
 * keyed by scryfall index (since illustration tags are per-printing, not per-oracle).
 *
 * Also builds and returns the indexToScryfallId array used to create
 * the scryfallIdToIndex mapping on the server side.
 */
async function fetchAndProcessIllustrationTags(
  illustrationIdToScryfallIds: Record<string, string[]>,
): Promise<{ tagDict: TagDict; tagNames: string[]; indexToScryfallId: string[] }> {
  console.log(`Fetching tags from ${ILLUSTRATION_TAGS_URL}`);
  const response = await fetchWithRetry(ILLUSTRATION_TAGS_URL);
  const { data: tags }: ScryfallTagResponse = await response.json();
  console.log(`Received ${tags.length} illustration tags`);

  // Collect all unique scryfall IDs referenced by illustration tags,
  // then build a compressed index for them.
  const scryfallIdSet = new Set<string>();
  for (const tag of tags) {
    if (!Array.isArray(tag.illustration_ids)) continue;
    for (const illustrationId of tag.illustration_ids) {
      const scryfallIds = illustrationIdToScryfallIds[illustrationId];
      if (scryfallIds) {
        for (const sid of scryfallIds) {
          scryfallIdSet.add(sid);
        }
      }
    }
  }

  const indexToScryfallId = Array.from(scryfallIdSet);
  const scryfallIdToIndex: Record<string, number> = Object.fromEntries(
    indexToScryfallId.map((sid, index) => [sid, index]),
  );

  console.log(`Built scryfall index for ${indexToScryfallId.length} printings`);

  const tagNames: string[] = [];
  const tagDict: TagDict = {};

  for (let tagIndex = 0; tagIndex < tags.length; tagIndex++) {
    const tag = tags[tagIndex];
    if (!tag) continue;

    tagNames.push(tag.label);

    if (!Array.isArray(tag.illustration_ids)) continue;

    for (const illustrationId of tag.illustration_ids) {
      const scryfallIds = illustrationIdToScryfallIds[illustrationId];
      if (!scryfallIds) continue;

      for (const scryfallId of scryfallIds) {
        const compressedIndex = scryfallIdToIndex[scryfallId];
        if (compressedIndex === undefined) continue;

        if (!tagDict[compressedIndex]) {
          tagDict[compressedIndex] = [];
        }
        tagDict[compressedIndex]!.push(tagIndex);
      }
    }
  }

  const cardCount = Object.keys(tagDict).length;
  console.log(`Processed ${tagNames.length} illustration tags across ${cardCount} printings`);

  return { tagDict, tagNames, indexToScryfallId };
}

/**
 * Fetches oracle and illustration tags from Scryfall, builds compressed
 * tag dictionaries, and uploads them to S3.
 *
 * Oracle tags are keyed by oracle index (shared across all printings of a card).
 * Illustration tags are keyed by scryfall index (unique per printing/art).
 *
 * Can be called as a standalone script or imported and invoked by another job.
 */
interface TagUpdateResult {
  oracleTagDict: TagDict;
  oracleTagNames: string[];
  illustrationTagDict: TagDict;
  illustrationTagNames: string[];
  indexToScryfallId: string[];
}

export const updateScryfallTags = async (
  oracleToIndex: Record<string, number>,
  illustrationIdToScryfallIds: Record<string, string[]>,
): Promise<TagUpdateResult> => {
  console.log('Fetching Scryfall oracle and illustration tags...');

  const [oracleTags, illustrationResult] = await Promise.all([
    fetchAndProcessOracleTags(oracleToIndex),
    fetchAndProcessIllustrationTags(illustrationIdToScryfallIds),
  ]);

  console.log('Uploading tag files to S3...');

  await Promise.all([
    uploadJson('cards/oracleTagDict.json', oracleTags.tagDict),
    uploadJson('cards/oracleTagNames.json', oracleTags.tagNames),
    uploadJson('cards/illustrationTagDict.json', illustrationResult.tagDict),
    uploadJson('cards/illustrationTagNames.json', illustrationResult.tagNames),
    uploadJson('cards/indexToScryfallId.json', illustrationResult.indexToScryfallId),
  ]);

  console.log('Scryfall tag update complete!');

  return {
    oracleTagDict: oracleTags.tagDict,
    oracleTagNames: oracleTags.tagNames,
    illustrationTagDict: illustrationResult.tagDict,
    illustrationTagNames: illustrationResult.tagNames,
    indexToScryfallId: illustrationResult.indexToScryfallId,
  };
};

// Standalone entry point: load required mappings from local server/private/ and run.
// In production, updateScryfallTags() is called directly from update_metadata_dict
// with oracleToIndex already in memory — this path is only for local dev/testing.
// Reading from the local filesystem ensures tag dicts use the exact same index
// mappings the server will load, regardless of which S3 bucket they came from.
if (require.main === module) {
  (async () => {
    try {
      console.log('Running Scryfall tag update as standalone script...');

      const serverPrivate = path.resolve(__dirname, '..', '..', 'server', 'private');
      console.log(`Reading index mappings from ${serverPrivate}`);

      const indexToOraclePath = path.join(serverPrivate, 'indexToOracle.json');
      if (!fs.existsSync(indexToOraclePath)) {
        throw new Error(`${indexToOraclePath} not found. Run 'npm run download-data-files' first.`);
      }
      const indexToOracle: string[] = JSON.parse(fs.readFileSync(indexToOraclePath, 'utf-8'));
      const oracleToIndex: Record<string, number> = Object.fromEntries(
        indexToOracle.map((oracleId, index) => [oracleId, index]),
      );
      console.log(`Loaded ${indexToOracle.length} oracle IDs from local files`);

      const illustrationPath = path.join(serverPrivate, 'illustrationIdToScryfallIds.json');
      if (!fs.existsSync(illustrationPath)) {
        throw new Error(`${illustrationPath} not found. Run 'npm run download-data-files' first.`);
      }
      const illustrationIdToScryfallIds: Record<string, string[]> = JSON.parse(
        fs.readFileSync(illustrationPath, 'utf-8'),
      );
      console.log(
        `Loaded ${Object.keys(illustrationIdToScryfallIds).length} illustration ID mappings from local files`,
      );

      const result = await updateScryfallTags(oracleToIndex, illustrationIdToScryfallIds);

      // Write tag files directly to server/private/ so the local server
      // picks them up immediately without needing to re-download from S3.
      console.log(`Writing tag files to ${serverPrivate} for local dev...`);
      const filesToWrite: Record<string, unknown> = {
        'oracleTagDict.json': result.oracleTagDict,
        'oracleTagNames.json': result.oracleTagNames,
        'illustrationTagDict.json': result.illustrationTagDict,
        'illustrationTagNames.json': result.illustrationTagNames,
        'indexToScryfallId.json': result.indexToScryfallId,
      };
      for (const [file, data] of Object.entries(filesToWrite)) {
        fs.writeFileSync(path.join(serverPrivate, file), JSON.stringify(data));
        console.log(`  Wrote ${file}`);
      }

      process.exit(0);
    } catch (error) {
      console.error('Fatal error:', error);
      process.exit(1);
    }
  })();
}
