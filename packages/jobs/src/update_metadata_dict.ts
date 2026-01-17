require('module-alias/register');
import dotenv from 'dotenv';
import path from 'path';

import 'module-alias/register';
// Configure dotenv with explicit path to jobs package .env
dotenv.config({ path: path.resolve(process.cwd(), 'packages', 'jobs', '.env') });

const { DefaultElo } = require('@utils/datatypes/Card');
import { initializeCardDb } from '@server/serverutils/cardCatalog';
import carddb, { cardFromId } from '@server/serverutils/carddb';
import { CardMetadata, Related } from '@utils/datatypes/CardCatalog';
const { encode, oracleInData } = require('@server/serverutils/ml');
import { initializeMl } from '@server/serverutils/ml';
import { downloadJson, listFiles, uploadJson } from './utils/s3';
const correlationLimit = 36;
// import { HierarchicalNSW } from 'hnswlib-node';

const dotProduct = (a: number[], b: number[]) => {
  return a.reduce((acc, val, index) => {
    const bVal = b[index];
    return acc + val * (bVal !== undefined ? bVal : 0);
  }, 0);
};

const cosineSimilarity = (a: number[], magA: number, b: number[], magB: number) => {
  return dotProduct(a, b) / (magA * magB);
};

type CubeDict = Record<string, string[]>;

interface CubeHistory {
  cubes: Record<string, number[]>;
  indexToOracleMap: Record<number, string>;
}

(async () => {
  console.log('Loading card database');
  const privateDir = path.join(__dirname, '..', '..', 'server', 'private');
  await initializeCardDb(privateDir);

  console.log('Initializing ML models');
  const rootDir = path.join(__dirname, '..', '..', 'server');
  await initializeMl(rootDir);

  // load most recent cube history
  const cubeHistoryFiles = await listFiles('cubes_history/');
  cubeHistoryFiles.sort();
  const cubeHistoryData: CubeHistory | null = await downloadJson(cubeHistoryFiles[cubeHistoryFiles.length - 1]);

  if (!cubeHistoryData) {
    throw new Error('No cube history found in S3');
  }

  const cubeHistory: CubeDict = {};

  for (const [cubeId, cube] of Object.entries(cubeHistoryData.cubes)) {
    cubeHistory[cubeId] = cube
      .map((index) => cubeHistoryData.indexToOracleMap[index])
      .filter((oracle): oracle is string => oracle !== undefined);
  }

  // load most recent global history
  const draftHistoryFiles = await listFiles('global_draft_history/');
  draftHistoryFiles.sort();
  const draftHistory = await downloadJson(draftHistoryFiles[draftHistoryFiles.length - 1]);

  if (!draftHistory) {
    throw new Error('No draft history found in S3');
  }

  console.log('Loaded cube and draft history, calculating correlations');

  const oracleToIndex = Object.fromEntries(Object.keys(carddb.oracleToId).map((key, index) => [key, index]));
  const indexToOracle = Object.keys(carddb.oracleToId);
  const oracleToType = Object.fromEntries(
    Object.keys(carddb.oracleToId).map((oracle) => {
      const oracleIds = carddb.oracleToId[oracle];
      if (oracleIds && oracleIds[0]) {
        return [oracle, cardFromId(oracleIds[0]).type];
      }
      return [oracle, ''];
    }),
  );

  const isOracleCreature = Object.fromEntries(
    Object.entries(oracleToType).map(([oracle, type]) => [oracle, type.includes('Creature')]),
  );
  const isOracleSpell = Object.fromEntries(
    Object.entries(oracleToType).map(([oracle, type]) => [
      oracle,
      type.includes('Instant') || type.includes('Sorcery'),
    ]),
  );
  const isOracleOther = Object.fromEntries(
    Object.entries(oracleToType).map(([oracle, type]) => [
      oracle,
      !type.includes('Instant') && !type.includes('Sorcery') && !type.includes('Creature'),
    ]),
  );
  const isOracleBasicLand = Object.fromEntries(
    Object.entries(oracleToType).map(([oracle, type]) => [oracle, type.includes('Basic Land')]),
  );
  const isOracleLand = Object.fromEntries(
    Object.entries(oracleToType).map(([oracle, type]) => [oracle, type.includes('Land')]),
  );

  const oracleCount = indexToOracle.length;

  // allocate space for the correlations
  const cubedWith = new Int32Array(oracleCount * oracleCount);
  const draftedWith = new Int32Array(oracleCount * oracleCount);
  const synergyWith = new Float32Array(oracleCount * oracleCount);

  const cubeCount = new Int32Array(oracleCount);

  const incrementCorrelation = (matrix: Int32Array, oracleId1: string, oracleId2: string) => {
    if (oracleId1 === oracleId2) {
      return;
    }

    const index1Lookup = oracleToIndex[oracleId1];
    const index2Lookup = oracleToIndex[oracleId2];

    if (index1Lookup !== undefined && index2Lookup !== undefined) {
      const index1 = index1Lookup * oracleCount + index2Lookup;
      const index2 = index2Lookup * oracleCount + index1Lookup;

      const current1 = matrix[index1];
      const current2 = matrix[index2];

      if (current1 !== undefined) {
        matrix[index1] = current1 + 1;
      }
      if (current2 !== undefined) {
        matrix[index2] = current2 + 1;
      }
    }
  };

  console.log('Calculating encodings');
  const encodings = [];
  const magnitudes = [];
  for (let i = 0; i < oracleCount; i += 1) {
    const encoding = encode([indexToOracle[i]]);
    encodings.push(encoding);
    magnitudes.push(Math.sqrt(encoding.reduce((acc: number, val: number) => acc + val * val, 0)));

    if (i % 100 === 0) {
      console.log(`Processed ${Math.min(i, oracleCount)} / ${oracleCount} oracles`);
    }
  }
  console.log(`Processed ${oracleCount} / ${oracleCount} oracles`);

  console.log('Calculating synergy');
  for (let i = 0; i < oracleCount; i += 1) {
    for (let j = i + 1; j < oracleCount; j += 1) {
      const index1 = i * oracleCount + j;
      const index2 = j * oracleCount + i;

      const encoding1 = encodings[i];
      const encoding2 = encodings[j];
      const magnitude1 = magnitudes[i];
      const magnitude2 = magnitudes[j];

      if (encoding1 && encoding2 && magnitude1 !== undefined && magnitude2 !== undefined) {
        const value = cosineSimilarity(encoding1, magnitude1, encoding2, magnitude2);
        synergyWith[index1] = value;
        synergyWith[index2] = value;
      }
    }

    if (i % 100 === 0) {
      console.log(`Processed ${Math.min(i, oracleCount)} / ${oracleCount} oracle pairs`);
    }
  }
  console.log(`Processed ${oracleCount} / ${oracleCount} oracle pairs`);

  // calculate draftedwith

  const draftLogFiles = await listFiles('all_drafts/');

  let processed = 0;

  for (const draftLog of draftLogFiles) {
    const drafts = await downloadJson(draftLog);

    if (!drafts) continue;

    for (const draft of drafts) {
      for (let i = 0; i < draft.length; i += 1) {
        for (let j = i + 1; j < draft.length; j += 1) {
          incrementCorrelation(draftedWith, draft[i], draft[j]);
        }
      }
    }

    processed += 1;
    if (processed % 100 === 0) {
      console.log(`Processed ${Math.min(processed, draftLogFiles.length)} / ${draftLogFiles.length} draftlog batches`);
    }
  }
  console.log(`Processed ${draftLogFiles.length} / ${draftLogFiles.length} draftlog batches`);

  // calculate cubedwith
  processed = 0;
  for (const cube of Object.keys(cubeHistory)) {
    const cubeData = cubeHistory[cube];
    if (cubeData) {
      const oracles = [...new Set(cubeData.map((cardId) => cardFromId(cardId).oracle_id))];

      for (let i = 0; i < oracles.length; i += 1) {
        const oracle = oracles[i];
        if (oracle) {
          const oracleIndex = oracleToIndex[oracle];
          if (oracleIndex !== undefined) {
            const currentCount = cubeCount[oracleIndex];
            if (currentCount !== undefined) {
              cubeCount[oracleIndex] = currentCount + 1;
            }
          }
          for (let j = i + 1; j < oracles.length; j += 1) {
            const oracle2 = oracles[j];
            if (oracle2) {
              incrementCorrelation(cubedWith, oracle, oracle2);
            }
          }
        }
      }
    }

    processed += 1;
    if (processed % 1000 === 0) {
      console.log(
        `Processed ${Math.min(processed, Object.keys(cubeHistory).length)} / ${Object.keys(cubeHistory).length} cubes`,
      );
    }
  }
  console.log(`Processed ${Object.keys(cubeHistory).length} / ${Object.keys(cubeHistory).length} cubes`);

  const metadatadict: Record<string, CardMetadata> = {};
  // const normalizedDeckWith = new Float32Array(oracleCount * oracleCount);
  // // const deckedWithDistances = new Float32Array(oracleCount * oracleCount);

  // for (let i = 0; i < oracleCount; i += 1) {
  //   // normalize the draftedWith matrix
  //   const row = draftedWith.slice(i * oracleCount, (i + 1) * oracleCount);
  //   const magnitude = Math.sqrt(row.reduce((acc, val) => acc + val * val, 0));

  //   for (let j = 0; j < oracleCount; j += 1) {
  //     normalizedDeckWith[i * oracleCount + j] = draftedWith[i * oracleCount + j] / magnitude;
  //   }

  //   if (i % 100 === 0) {
  //     console.log(`Normalized ${Math.min(i, oracleCount)} / ${oracleCount} deckedWith rows`);
  //   }
  // }

  const oracleSubsetCount = Math.floor(oracleCount / 10);
  const cardPopularities: { count: number; oracle: string }[] = [];
  for (let i = 0; i < oracleCount; i += 1) {
    const count = cubeCount[i];
    const oracle = indexToOracle[i];
    if (count !== undefined && oracle !== undefined) {
      cardPopularities.push({ count, oracle });
    }
  }

  const idToOracleSubset = cardPopularities
    // we want to only match up cards with spells to avoid a card just getting matched up to
    //  a popular land that shares the same color
    .filter((item) => oracleInData(item.oracle) && !isOracleLand[item.oracle])
    .sort((a, b) => b.count - a.count)
    .slice(0, oracleSubsetCount)
    .map((item) => oracleToIndex[item.oracle]);

  const deckedWithPopular = new Int32Array(oracleSubsetCount * oracleSubsetCount);

  for (let i = 0; i < oracleSubsetCount; i += 1) {
    for (let j = i + 1; j < oracleSubsetCount; j += 1) {
      const subsetId1 = idToOracleSubset[i];
      const subsetId2 = idToOracleSubset[j];

      if (subsetId1 !== undefined && subsetId2 !== undefined) {
        const oracle1 = indexToOracle[subsetId1];
        const oracle2 = indexToOracle[subsetId2];

        if (oracle1 && oracle2) {
          const oracle1Index = oracleToIndex[oracle1];
          const oracle2Index = oracleToIndex[oracle2];

          if (oracle1Index !== undefined && oracle2Index !== undefined) {
            // get the index of the oracle in the draftedWith matrix
            const value = draftedWith[oracle1Index * oracleCount + oracle2Index];
            const numValue = value !== undefined ? value : 0;
            deckedWithPopular[i * oracleSubsetCount + j] = numValue;
            deckedWithPopular[j * oracleSubsetCount + i] = numValue;
          }
        }
      }
    }
  }

  const deckedWithDistances = new Float32Array(oracleSubsetCount * oracleSubsetCount);
  // normalize the deckedWithDistances matrix
  for (let i = 0; i < oracleSubsetCount; i += 1) {
    // normalize
    const row = deckedWithPopular.slice(i * oracleSubsetCount, (i + 1) * oracleSubsetCount);
    const magnitude = Math.sqrt(row.reduce((acc, val) => acc + val * val, 0));

    for (let j = 0; j < oracleSubsetCount; j += 1) {
      const popularValue = deckedWithPopular[i * oracleSubsetCount + j];
      if (popularValue !== undefined && magnitude > 0) {
        deckedWithDistances[i * oracleSubsetCount + j] = popularValue / magnitude;
      } else {
        deckedWithDistances[i * oracleSubsetCount + j] = 0;
      }
    }
  }

  processed = 0;

  for (const oracle of indexToOracle) {
    // Skip if oracle doesn't exist in our lookup tables
    const oracleIndex = oracleToIndex[oracle];
    if (oracleIndex === undefined) continue;

    let mostSimilarIndex = oracleIndex;

    if (!oracleInData(oracle)) {
      // construct an array of correlations from deckedWith, only using the subset of oracles in the data
      const vector: number[] = [];

      for (let i = 0; i < oracleSubsetCount; i += 1) {
        const oracleSubsetId = idToOracleSubset[i];
        if (oracleSubsetId !== undefined) {
          const oracle2 = indexToOracle[oracleSubsetId];
          const oracle2Index = oracle2 ? oracleToIndex[oracle2] : undefined;
          if (oracle2Index !== undefined) {
            const value = draftedWith[oracleIndex * oracleCount + oracle2Index];
            vector.push(value !== undefined ? value : 0);
          } else {
            vector.push(0); // Default to 0 if oracle lookup fails
          }
        } else {
          vector.push(0);
        }
      }

      // normalize the vector
      const magnitude = Math.sqrt(vector.reduce((acc, val) => acc + val * val, 0));
      if (magnitude > 0) {
        for (let i = 0; i < vector.length; i += 1) {
          const currentValue = vector[i];
          if (currentValue !== undefined) {
            vector[i] = currentValue / magnitude;
          }
        }
      }

      // find most similar vector in deckedWithDistances
      let maxSimilarity = dotProduct(vector, [...deckedWithDistances.slice(0, oracleSubsetCount)]);
      let mostSimilar = 0;

      for (let i = 1; i < oracleSubsetCount; i += 1) {
        const similarity = dotProduct(vector, [
          ...deckedWithDistances.slice(i * oracleSubsetCount, (i + 1) * oracleSubsetCount),
        ]);
        if (similarity > maxSimilarity) {
          maxSimilarity = similarity;
          mostSimilar = i;
        }
      }

      // most similar is an oracle subset, need to convert to oracle id, then to oracle index
      const mostSimilarSubsetId = idToOracleSubset[mostSimilar];
      if (mostSimilarSubsetId !== undefined) {
        const mostSimilarOracle = indexToOracle[mostSimilarSubsetId];
        if (mostSimilarOracle) {
          console.log(`Most similar to ${oracle} is ${mostSimilarOracle}`);
          const mostSimilarOracleIndex = oracleToIndex[mostSimilarOracle];
          if (mostSimilarOracleIndex !== undefined) {
            mostSimilarIndex = mostSimilarOracleIndex;
          }
        }
      }
    }

    metadatadict[oracle] = {
      elo: DefaultElo,
      picks: 0,
      cubes: cubeCount[oracleIndex] || 0,
      popularity: (100 * (cubeCount[oracleIndex] || 0)) / Object.keys(cubeHistory).length,
      mostSimilar: mostSimilarIndex,
      cubedWith: {
        top: [],
        creatures: [],
        spells: [],
        other: [],
      },
      draftedWith: {
        top: [],
        creatures: [],
        spells: [],
        other: [],
      },
      synergistic: {
        top: [],
        creatures: [],
        spells: [],
        other: [],
      },
    };

    if (draftHistory.eloByOracleId[oracle]) {
      metadatadict[oracle]!.elo = draftHistory.eloByOracleId[oracle];
    }
    if (draftHistory.picksByOracleId[oracle]) {
      metadatadict[oracle]!.picks = draftHistory.picksByOracleId[oracle];
    }

    const sourceMatrices: [Related, Int32Array | Float32Array][] = [
      [metadatadict[oracle]!.draftedWith, draftedWith],
      [metadatadict[oracle]!.cubedWith, cubedWith],
      [metadatadict[oracle]!.synergistic, synergyWith],
    ];

    for (const [targetDict, sourceMatrix] of sourceMatrices) {
      const oracleIndex = oracleToIndex[oracle];
      if (oracleIndex === undefined) continue;

      const cards = [...sourceMatrix.slice(oracleIndex * oracleCount, (oracleIndex + 1) * oracleCount)]
        .map((count, index) => ({
          count,
          oracle: indexToOracle[index],
          type: oracleToType[index],
        }))
        .filter((item) => item.count > 0 && item.oracle && !isOracleBasicLand[item.oracle])
        .sort((a, b) => b.count - a.count);

      targetDict.top = cards
        .slice(0, correlationLimit)
        .map((item) => (item.oracle ? oracleToIndex[item.oracle] : undefined))
        .filter((idx): idx is number => idx !== undefined);
      targetDict.creatures = cards
        .filter((item) => item.oracle && isOracleCreature[item.oracle])
        .slice(0, correlationLimit)
        .map((item) => (item.oracle ? oracleToIndex[item.oracle] : undefined))
        .filter((idx): idx is number => idx !== undefined);
      targetDict.spells = cards
        .filter((item) => item.oracle && isOracleSpell[item.oracle])
        .slice(0, correlationLimit)
        .map((item) => (item.oracle ? oracleToIndex[item.oracle] : undefined))
        .filter((idx): idx is number => idx !== undefined);
      targetDict.other = cards
        .filter((item) => item.oracle && isOracleOther[item.oracle])
        .slice(0, correlationLimit)
        .map((item) => (item.oracle ? oracleToIndex[item.oracle] : undefined))
        .filter((idx): idx is number => idx !== undefined);
    }

    processed += 1;
    if (processed % 100 === 0) {
      console.log('Processed oracle', oracle, processed, '/', oracleCount);
    }
  }

  console.log('Finished all oracles, Writing metadatadict.json');

  await uploadJson('metadatadict.json', metadatadict);
  await uploadJson('indexToOracle.json', indexToOracle);

  console.log('Complete');

  process.exit();
})();
