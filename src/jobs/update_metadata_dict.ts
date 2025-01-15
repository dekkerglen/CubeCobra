require('module-alias/register');
/* eslint-disable no-console */
require('dotenv').config();

const fs = require('fs');
import carddb, { cardFromId, initializeCardDb } from '../util/carddb';
const { encode } = require('../util/ml');

const correlationLimit = 36;

const cosineSimilarity = (a: number[], magA: number, b: number[], magB: number) => {
  const dotProduct = a.reduce((acc, val, index) => acc + val * b[index], 0);
  return dotProduct / (magA * magB);
};

type CubeDict = Record<string, string[]>;

interface CubeHistory {
  cubes: Record<string, number[]>;
  indexToOracleMap: Record<number, string>;
}

type OracleId = number;

interface Related {
  top: OracleId[];
  creatures: OracleId[];
  spells: OracleId[];
  other: OracleId[];
}

interface Metadata {
  cubedWith: Related;
  draftedWith: Related;
  synergistic: Related;
  elo: number;
  picks: number;
  cubes: number;
  popularity: number;
}

(async () => {
  console.log('Loading card database');
  await initializeCardDb();

  // load most recent cube history
  const cubeHistoryFiles = fs.readdirSync('./temp/cubes_history').sort();
  const cubeHistoryData: CubeHistory = JSON.parse(
    fs.readFileSync(`./temp/cubes_history/${cubeHistoryFiles[cubeHistoryFiles.length - 1]}`),
  );
  const cubeHistory: CubeDict = {};

  for (const [cubeId, cube] of Object.entries(cubeHistoryData.cubes)) {
    cubeHistory[cubeId] = cube.map((index) => cubeHistoryData.indexToOracleMap[index]);
  }

  // load most recent global history
  const draftHistoryFiles = fs.readdirSync('./temp/global_draft_history').sort();
  const draftHistory = JSON.parse(
    fs.readFileSync(`./temp/global_draft_history/${draftHistoryFiles[draftHistoryFiles.length - 1]}`),
  );

  console.log('Loaded cube and draft history, calculating correlations');

  const oracleToIndex = Object.fromEntries(Object.keys(carddb.oracleToId).map((key, index) => [key, index]));
  const indexToOracle = Object.keys(carddb.oracleToId);
  const oracleToType = Object.fromEntries(
    Object.keys(carddb.oracleToId).map((oracle) => [oracle, cardFromId(carddb.oracleToId[oracle][0]).type]),
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

    const index1 = oracleToIndex[oracleId1] * oracleCount + oracleToIndex[oracleId2];
    const index2 = oracleToIndex[oracleId2] * oracleCount + oracleToIndex[oracleId1];

    matrix[index1] += 1;
    matrix[index2] += 1;
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

      const value = cosineSimilarity(encodings[i], magnitudes[i], encodings[j], magnitudes[j]);

      synergyWith[index1] = value;
      synergyWith[index2] = value;
    }
    console.log(`Processed ${Math.min(i, oracleCount)} / ${oracleCount} oracle pairs`);
  }
  console.log(`Processed ${oracleCount} / ${oracleCount} oracle pairs`);

  // calculate draftedwith

  const draftLogFiles = fs.readdirSync('./temp/all_drafts');

  let processed = 0;

  for (const draftLog of draftLogFiles) {
    const drafts = JSON.parse(fs.readFileSync(`./temp/all_drafts/${draftLog}`));

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
    const oracles = [...new Set(cubeHistory[cube].map((cardId) => cardFromId(cardId).oracle_id))];

    for (let i = 0; i < oracles.length; i += 1) {
      cubeCount[oracleToIndex[oracles[i]]] += 1;
      for (let j = i + 1; j < oracles.length; j += 1) {
        incrementCorrelation(cubedWith, oracles[i], oracles[j]);
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

  const metadatadict: Record<string, Metadata> = {};

  processed = 0;

  for (const oracle of indexToOracle) {
    metadatadict[oracle] = {
      elo: 1200,
      picks: 0,
      cubes: cubeCount[oracleToIndex[oracle]],
      popularity: (100 * cubeCount[oracleToIndex[oracle]]) / Object.keys(cubeHistory).length,
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
      metadatadict[oracle].elo = draftHistory.eloByOracleId[oracle];
    }
    if (draftHistory.picksByOracleId[oracle]) {
      metadatadict[oracle].picks = draftHistory.picksByOracleId[oracle];
    }

    const sourceMatrices: [Related, Int32Array | Float32Array][] = [
      [metadatadict[oracle].draftedWith, draftedWith],
      [metadatadict[oracle].cubedWith, cubedWith],
      [metadatadict[oracle].synergistic, synergyWith],
    ];

    for (const [targetDict, sourceMatrix] of sourceMatrices) {
      const cards = [
        ...sourceMatrix.slice(oracleToIndex[oracle] * oracleCount, (oracleToIndex[oracle] + 1) * oracleCount),
      ]
        .map((count, index) => ({
          count,
          oracle: indexToOracle[index],
          type: oracleToType[index],
        }))
        .filter((item) => item.count > 0 && !isOracleBasicLand[item.oracle])
        .sort((a, b) => b.count - a.count);

      targetDict.top = cards.slice(0, correlationLimit).map((item) => oracleToIndex[item.oracle]);
      targetDict.creatures = cards
        .filter((item) => isOracleCreature[item.oracle])
        .slice(0, correlationLimit)
        .map((item) => oracleToIndex[item.oracle]);
      targetDict.spells = cards
        .filter((item) => isOracleSpell[item.oracle])
        .slice(0, correlationLimit)
        .map((item) => oracleToIndex[item.oracle]);
      targetDict.other = cards
        .filter((item) => isOracleOther[item.oracle])
        .slice(0, correlationLimit)
        .map((item) => oracleToIndex[item.oracle]);
    }

    processed += 1;
    if (processed % 100 === 0) {
      console.log('Processed oracle', oracle, processed, '/', oracleCount);
    }
  }

  console.log('Finished all oracles, Writing metadatadict.json');

  await fs.promises.writeFile(`./temp/metadatadict.json`, JSON.stringify(metadatadict));
  await fs.promises.writeFile(`./temp/indexToOracle.json`, JSON.stringify(indexToOracle));

  console.log('Complete');

  process.exit();
})();
