require('dotenv').config();

const fs = require('fs');
const carddb = require('../serverjs/carddb');
const { encode } = require('../serverjs/ml');

const correlationLimit = 36;

const cosineSimilarity = (a, magA, b, magB) => {
  const dotProduct = a.reduce((acc, val, index) => acc + val * b[index], 0);
  return dotProduct / (magA * magB);
};

(async () => {
  console.log('Loading card database');
  await carddb.initializeCardDb();

  // load most recent cube history
  const cubeHistoryFiles = fs.readdirSync('./temp/cubes_history').sort();
  const cubeHistoryData = JSON.parse(
    fs.readFileSync(`./temp/cubes_history/${cubeHistoryFiles[cubeHistoryFiles.length - 1]}`),
  );
  const cubeHistory = {};

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
    Object.keys(carddb.oracleToId).map((oracle) => [oracle, carddb.cardFromId(carddb.oracleToId[oracle][0]).type]),
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

  const incrementCorrelation = (matrix, oracleId1, oracleId2) => {
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
    magnitudes.push(Math.sqrt(encoding.reduce((acc, val) => acc + val * val, 0)));

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
    const oracles = [...new Set(cubeHistory[cube].map((cardId) => carddb.cardFromId(cardId).oracle_id))];

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

  /*
  {
    cubedWith: {
      top: [OracleId],
      creatures: [OracleId],
      spells: [OracleId],
      other: [OracleId],
    },
    draftedWith: {
      top: [OracleId],
      creatures: [OracleId],
      spells: [OracleId],
      other: [OracleId],
    },
    synegistic: {
      top: [OracleId],
      creatures: [OracleId],
      spells: [OracleId],
      other: [OracleId],
    },
    elo: Number,
    picks: Number,
    cubes: Number,
  };
  */
  const metadatadict = {};

  processed = 0;

  for (const oracle of indexToOracle) {
    metadatadict[oracle] = {
      elo: 1200,
      picks: 0,
      cubes: cubeCount[oracleToIndex[oracle]],
      popularity: (100 * cubeCount[oracleToIndex[oracle]]) / Object.keys(cubeHistory).length,
      cubedWith: {},
      draftedWith: {},
      synergistic: {},
    };

    if (draftHistory.eloByOracleId[oracle]) {
      metadatadict[oracle].elo = draftHistory.eloByOracleId[oracle];
    }
    if (draftHistory.picksByOracleId[oracle]) {
      metadatadict[oracle].picks = draftHistory.picksByOracleId[oracle];
    }

    for (const [targetDict, sourceMatrix] of [
      [metadatadict[oracle].draftedWith, draftedWith],
      [metadatadict[oracle].cubedWith, cubedWith],
      [metadatadict[oracle].synergistic, synergyWith],
    ]) {
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
