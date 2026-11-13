// Retraining stage 5: scores the run's converted TF.js bundle against the model the site serves
// now, on the same test-split examples, and writes ml/runs/<runId>/eval.json (GateReport). Exits 0
// whether or not the candidate passes; the pipeline lambda reads `passed`. Also writes
// ml/runs/<runId>/archetypes.json (ArchetypeReport): how many of the same test decks would change
// archetype.
//
// Both models are scored only on examples whose cards are all in BOTH vocabularies, so new cards
// the live model has never seen don't count against it. The candidate must also reproduce the
// Keras reference outputs packaged with it (parity.json) before it can pass.
import dotenv from 'dotenv';
import path from 'path';

import 'module-alias/register';
dotenv.config({ path: path.join(__dirname, '..', '..', '..', '.env') });

import { GateMetrics, GateReport, PARITY_FILE, runPrefix } from '@utils/ml/modelBundle';
import fs from 'fs';
import os from 'os';

import { archetypeReport } from './archetypeShift';
import { GATE_SAMPLE, GATE_TOLERANCE, mlLiveBucket, mlRunId, mlRunsBucket, PARITY_TOLERANCE } from './config';
import { CubeCase, cubeRecall, deckAccuracy, mean, pickRank, splitCube } from './gateMetrics';
import { decodeRows, encodeRows, loadModel, LoadedModel, remapCards } from './modelFiles';
import { downloadPrefix, downloadServedModel, listKeys, readJson, writeJson } from './s3';
import { CleanDeck, CleanPick } from './trainingData';

interface Parity {
  inputs: number[][];
  encoder: number[][];
  decoders: Record<string, { indices: number[]; outputs: number[][] }>;
}

const METRICS: (keyof GateMetrics)[] = ['cubeRecall', 'deckAccuracy', 'pickTop1', 'pickTop3'];

// Relative above 1 so large logits aren't held to an absolute bound meant for probabilities.
const scaledDiff = (a: number, b: number) => Math.abs(a - b) / Math.max(1, Math.abs(b));

const checkParity = (model: LoadedModel, parity: Parity): { passed: boolean; maxAbsDiff: number } => {
  let maxAbsDiff = 0;
  encodeRows(model, parity.inputs).forEach((row, i) => {
    parity.encoder[i]!.forEach((expected, j) => {
      maxAbsDiff = Math.max(maxAbsDiff, scaledDiff(row[j]!, expected));
    });
  });
  const decoders = {
    cube_decoder: model.cubeDecoder,
    deck_build_decoder: model.deckDecoder,
    draft_decoder: model.draftDecoder,
  };
  for (const [name, decoder] of Object.entries(decoders)) {
    const reference = parity.decoders[name];
    if (!reference) throw new Error(`${PARITY_FILE} has no reference outputs for ${name}`);
    decodeRows(model, decoder, parity.inputs).forEach((row, i) => {
      reference.indices.forEach((card, j) => {
        maxAbsDiff = Math.max(maxAbsDiff, scaledDiff(row[card]!, reference.outputs[i]![j]!));
      });
    });
  }
  return { passed: maxAbsDiff <= PARITY_TOLERANCE, maxAbsDiff };
};

/** Reads test shards in order until `limit` records pass `accept`. */
const sampleShards = async <T, U>(
  bucket: string,
  prefix: string,
  limit: number,
  accept: (record: T) => U | null,
): Promise<U[]> => {
  const keys = (await listKeys(bucket, prefix)).sort();
  const out: U[] = [];
  for (const key of keys) {
    for (const record of (await readJson<T[]>(bucket, key)) || []) {
      const accepted = accept(record);
      if (accepted !== null) out.push(accepted);
      if (out.length >= limit) return out;
    }
  }
  return out;
};

// Cases in one model's vocabulary. The live model gets the candidate's cases remapped card by card,
// so both are asked exactly the same questions (the same cube cards hidden, the same packs).
interface Cases {
  cubes: CubeCase[];
  decks: CleanDeck[];
  picks: CleanPick[];
}

const score = (model: LoadedModel, cases: Cases): GateMetrics => {
  const cubeScores = decodeRows(
    model,
    model.cubeDecoder,
    cases.cubes.map((c) => c.visible),
  );
  const pools = cases.decks.map((deck) => [...deck.mainboard, ...deck.sideboard]);
  const deckScores = decodeRows(model, model.deckDecoder, pools);
  const pickLogits = decodeRows(
    model,
    model.draftDecoder,
    cases.picks.map((pick) => pick.pool),
  );
  const ranks = cases.picks.map((pick, i) => pickRank(pickLogits[i]!, pick.pack, pick.pick));
  return {
    cubeRecall: mean(cases.cubes.map((c, i) => cubeRecall(cubeScores[i]!, c))),
    deckAccuracy: mean(cases.decks.map((deck, i) => deckAccuracy(deckScores[i]!, pools[i]!, deck.mainboard))),
    pickTop1: mean(ranks.map((rank) => (rank < 1 ? 1 : 0))),
    pickTop3: mean(ranks.map((rank) => (rank < 3 ? 1 : 0))),
  };
};

(async () => {
  const runId = mlRunId();
  const runsBucket = mlRunsBucket();
  const prefix = runPrefix(runId);
  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), `ml-eval-${runId}-`));

  const candidateDir = path.join(workDir, 'candidate');
  if ((await downloadPrefix(runsBucket, `${prefix}bundle/`, candidateDir)) === 0) {
    throw new Error(`No bundle at s3://${runsBucket}/${prefix}bundle/`);
  }
  const candidate = await loadModel(candidateDir, runId);

  const liveDir = path.join(workDir, 'live');
  const liveVersion = await downloadServedModel(mlLiveBucket(), liveDir);
  const live = liveVersion ? await loadModel(liveDir, liveVersion) : null;
  console.log(`Candidate ${runId} (${candidate.numCards} cards) vs live ${liveVersion ?? 'none'}`);

  const parity = JSON.parse(fs.readFileSync(path.join(candidateDir, PARITY_FILE), 'utf8')) as Parity;
  const parityResult = checkParity(candidate, parity);
  console.log(`Parity: max scaled difference ${parityResult.maxAbsDiff}`);

  // Only examples whose cards the live model also knows.
  const inLive = (cards: number[]) => (live ? remapCards(cards, candidate, live) !== null : true);
  const toLive = (cards: number[]) => (live ? remapCards(cards, candidate, live)! : cards);

  const cubes = await sampleShards<number[], number[]>(
    runsBucket,
    `${prefix}data/test/cubes/`,
    GATE_SAMPLE.cubes,
    (cube) => (cube.length >= 10 && inLive(cube) ? cube : null),
  );
  const decks = await sampleShards<CleanDeck, CleanDeck>(
    runsBucket,
    `${prefix}data/test/decks/`,
    GATE_SAMPLE.decks,
    (deck) => (inLive([...deck.mainboard, ...deck.sideboard]) ? deck : null),
  );
  const picks = await sampleShards<CleanPick, CleanPick>(
    runsBucket,
    `${prefix}data/test/picks/`,
    GATE_SAMPLE.picks,
    (pick) => (inLive([...pick.pool, ...pick.pack]) ? pick : null),
  );
  console.log(`Scoring ${cubes.length} cubes, ${decks.length} decks, ${picks.length} picks`);

  const cases: Cases = { cubes: cubes.map(splitCube), decks, picks };
  const candidateMetrics = score(candidate, cases);
  const liveMetrics = live
    ? score(live, {
        cubes: cases.cubes.map(({ visible, hidden }) => ({ visible: toLive(visible), hidden: toLive(hidden) })),
        decks: decks.map((deck) => ({ mainboard: toLive(deck.mainboard), sideboard: toLive(deck.sideboard) })),
        picks: picks.map((pick) => ({
          pool: toLive(pick.pool),
          pack: toLive(pick.pack),
          pick: toLive([pick.pick])[0]!,
        })),
      })
    : null;

  const reasons: string[] = [];
  if (!parityResult.passed) {
    reasons.push(`TF.js output differs from Keras by ${parityResult.maxAbsDiff.toExponential(2)}`);
  }
  if (cubes.length === 0 || decks.length === 0 || picks.length === 0) {
    reasons.push('Not enough test examples to score');
  }
  if (liveMetrics) {
    for (const metric of METRICS) {
      if (candidateMetrics[metric] < liveMetrics[metric] - GATE_TOLERANCE) {
        reasons.push(
          `${metric} ${candidateMetrics[metric].toFixed(4)} is below live ${liveMetrics[metric].toFixed(4)}`,
        );
      }
    }
  }

  const report: GateReport = {
    passed: reasons.length === 0,
    reasons,
    tolerance: GATE_TOLERANCE,
    candidateVersion: runId,
    liveVersion,
    candidate: candidateMetrics,
    live: liveMetrics,
    counts: { cubes: cubes.length, decks: decks.length, picks: picks.length },
    parity: parityResult,
    evaluatedAt: Date.now(),
  };
  console.log(JSON.stringify(report, null, 2));
  await writeJson(runsBucket, `${prefix}eval.json`, report);

  const deckOracleIds = decks.map((deck) => deck.mainboard.map((card) => candidate.indexToOracle[card]!));
  const archetypes = archetypeReport(candidateDir, liveDir, deckOracleIds);
  console.log(JSON.stringify(archetypes, null, 2));
  await writeJson(runsBucket, `${prefix}archetypes.json`, archetypes);
  fs.rmSync(workDir, { recursive: true, force: true });
  process.exit(0);
})().catch((error) => {
  console.error('Evaluating the model failed:', error);
  process.exit(1);
});
