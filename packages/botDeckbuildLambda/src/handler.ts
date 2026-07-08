import { CubeDynamoDao } from '@server/dynamo/dao/CubeDynamoDao';
import { DraftDynamoDao } from '@server/dynamo/dao/DraftDynamoDao';
import { UserDynamoDao } from '@server/dynamo/dao/UserDynamoDao';
import documentClient from '@server/dynamo/documentClient';
import { getBucketName, getObject } from '@server/dynamo/s3client';
import {
  type DeckbuildEntry,
  type DeckbuildJob,
  deckbuildJobKey,
  type DeckbuildJobSeat,
  type OracleFactsMap,
  runBatchDeckbuild,
} from '@utils/drafting/deckbuildCore';

import { assembleSeat, assessColors } from './assemble';
import { classifyDecks } from './classify';
import { batchBuild, batchDraft } from './ml';

/**
 * SQS-triggered lambda that builds bot (AI opponent) decks off the request path.
 *
 * The server writes a self-contained "deckbuild job" to S3 (pool cards + oracle facts, no
 * carddb) and enqueues the draft id. This lambda reads every job in the SQS batch, runs the
 * carddb-free core once across ALL seats at once (so the batched ML calls cover the whole
 * batch, not one draft at a time), names the decks, and writes back only the bot seats via
 * the shared DraftDynamoDao. It runs in the VPC to reach the recommender directly, with
 * reserved concurrency 1 to bound ML load — and never loads the ~100 MB card database.
 */
const TABLE = process.env.DYNAMO_TABLE as string;
const userDao = new UserDynamoDao(documentClient, TABLE);
const cubeDao = new CubeDynamoDao(documentClient, userDao, TABLE);
const draftDao = new DraftDynamoDao(documentClient, cubeDao, userDao, TABLE);

const readJob = (draftId: string): Promise<DeckbuildJob | null> => getObject(getBucketName(), deckbuildJobKey(draftId));

interface BuiltBotSeat {
  seatIndex: number;
  mainboard: number[][][];
  sideboard: number[][][];
  name: string;
}

interface SQSRecord {
  messageId: string;
  body: string;
  attributes?: { ApproximateReceiveCount?: string };
}
interface SQSEvent {
  Records?: SQSRecord[];
}
interface SQSBatchResponse {
  batchItemFailures: { itemIdentifier: string }[];
}

// Matches the SQS redrive maxReceiveCount in the CDK construct.
const MAX_RECEIVE_COUNT = 3;

const receiveCount = (record?: SQSRecord): number =>
  parseInt(record?.attributes?.ApproximateReceiveCount ?? '1', 10) || 1;

const extractDraftId = (record: SQSRecord): string | undefined => {
  const body = JSON.parse(record.body);
  // SNS -> SQS (without raw delivery) wraps our payload; with raw delivery the body IS it.
  const payload = typeof body?.Message === 'string' ? JSON.parse(body.Message) : body;
  return payload?.draftId;
};

interface SeatRef {
  messageId: string;
  draftId: string;
  job: DeckbuildJob;
  seat: DeckbuildJobSeat;
}

export const handler = async (event: SQSEvent): Promise<SQSBatchResponse> => {
  const records = event?.Records ?? [];
  const failures = new Set<string>();
  const recordById = new Map(records.map((r) => [r.messageId, r]));

  // Record a failed draft: on the final delivery before the DLQ, mark it terminally failed so
  // the client stops polling; otherwise return it for SQS retry.
  const recordFailure = async (messageId: string, draftId: string | undefined): Promise<void> => {
    if (draftId && receiveCount(recordById.get(messageId)) >= MAX_RECEIVE_COUNT) {
      try {
        await draftDao.markBotDecksFailed(draftId);
      } catch (err) {
        console.error('bot-deckbuild: failed to mark draft failed', { draftId, err });
        failures.add(messageId); // couldn't mark it — let it retry / DLQ
      }
    } else {
      failures.add(messageId);
    }
  };

  // 1. Load every job in the batch (claim-check fetch from S3).
  const loaded = await Promise.all(
    records.map(async (record) => {
      try {
        const draftId = extractDraftId(record);
        if (!draftId) {
          console.warn('bot-deckbuild: message missing draftId, skipping', { messageId: record.messageId });
          return { record, draftId: undefined, job: null as DeckbuildJob | null };
        }
        return { record, draftId, job: await readJob(draftId) };
      } catch (err) {
        console.error('bot-deckbuild: failed to read job', { messageId: record.messageId, err });
        return { record, draftId: undefined, job: null as DeckbuildJob | null };
      }
    }),
  );

  // 2. Flatten every bot seat across every job into one batched build.
  const entries: DeckbuildEntry[] = [];
  const refs: SeatRef[] = [];
  const facts: OracleFactsMap = {};
  for (const { record, draftId, job } of loaded) {
    if (!draftId) continue; // malformed message — nothing to retry
    if (!job) {
      // Job missing (not yet written / expired) — retry, or terminally fail on the last attempt.
      await recordFailure(record.messageId, draftId);
      continue;
    }
    Object.assign(facts, job.facts);
    const basicsOracles = job.basics.map((b) => b.oracle);
    for (const seat of job.seats) {
      entries.push({
        poolOracles: seat.pool.map((c) => c.oracle),
        basicsOracles,
        maxSpells: job.maxSpells,
        maxLands: job.maxLands,
      });
      refs.push({ messageId: record.messageId, draftId, job, seat });
    }
  }

  if (entries.length === 0) {
    return { batchItemFailures: [...failures].map((id) => ({ itemIdentifier: id })) };
  }

  // 3. One batched build across the whole batch.
  let results: { mainboard: string[]; sideboard: string[] }[];
  try {
    results = await runBatchDeckbuild(entries, facts, { batchBuild, batchDraft });
  } catch (err) {
    // ML build failed for the batch — retry every draft that had seats in it (or terminally
    // fail them on the last attempt). Dedup to one call per draft.
    console.error('bot-deckbuild: batched build failed', err);
    const byMessage = new Map<string, string>();
    for (const ref of refs) byMessage.set(ref.messageId, ref.draftId);
    for (const [messageId, draftId] of byMessage) await recordFailure(messageId, draftId);
    return { batchItemFailures: [...failures].map((id) => ({ itemIdentifier: id })) };
  }

  // 4. Assemble every seat (sync), then name them with a single batched /encode call rather
  //    than one call per seat.
  const assembled = results.map((result, i) => {
    const ref = refs[i]!;
    const { mainboard, sideboard, mainboardCards } = assembleSeat(ref.seat, ref.job.basics, result);
    return {
      ref,
      mainboard,
      sideboard,
      colors: assessColors(mainboardCards, facts),
      oracleIds: [...new Set(mainboardCards.map((c) => c.oracle))],
    };
  });

  // Best-effort archetype naming; falls back to colours only if the encode call fails.
  const archetypes = await classifyDecks(assembled.map((a) => a.oracleIds));

  const byDraft = new Map<string, { messageId: string; botSeats: BuiltBotSeat[] }>();
  assembled.forEach((a, i) => {
    const archetype = archetypes[i];
    const name = archetype ? `${a.colors} ${archetype}` : a.colors;
    if (!byDraft.has(a.ref.draftId)) byDraft.set(a.ref.draftId, { messageId: a.ref.messageId, botSeats: [] });
    byDraft.get(a.ref.draftId)!.botSeats.push({
      seatIndex: a.ref.seat.seatIndex,
      mainboard: a.mainboard,
      sideboard: a.sideboard,
      name,
    });
  });

  // 5. Write back per draft — only bot seats, preserving player edits.
  await Promise.all(
    [...byDraft.entries()].map(async ([draftId, { messageId, botSeats }]) => {
      try {
        await draftDao.applyBuiltBotDecks(draftId, botSeats);
      } catch (err) {
        console.error('bot-deckbuild: write-back failed', { draftId, err });
        await recordFailure(messageId, draftId);
      }
    }),
  );

  return { batchItemFailures: [...failures].map((id) => ({ itemIdentifier: id })) };
};
