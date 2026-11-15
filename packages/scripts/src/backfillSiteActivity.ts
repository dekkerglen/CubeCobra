/**
 * Backfill the admin Site Activity counters from data that records when things happened.
 *
 * Why: the counters only start when they are deployed. Most metrics have no history at all, but
 * several can be rebuilt, imperfectly, from creation dates that are already stored.
 *
 * What it can rebuild, and from what:
 *   users       signups (pre-migration users from the timestamp in their Mongo ObjectId id,
 *               the rest from dateCreated), comments (by owner, plus deleted comments), userFollows
 *   cubes       cubesCreated (ObjectId timestamp or dateCreated), and per cube: recordsCreated,
 *               tournamentsFinished (finishedAt), p1p1PacksCreated (not the daily rotation's),
 *               blogPosts (hand-written only: automatic posts carry a changelist), cubeLikes
 *   drafts      draftsStarted, gridDraftsStarted, housmanDraftsStarted, sealedPoolsOpened, and
 *               draftsFinished (complete drafts plus Draftmancer drafts, dated by when they started)
 *   changelogs  cubeEdits
 *   packages    packagesCreated
 *
 * Nothing else has a stored date (active users, email verifications, Smart Search, upvotes,
 * votes, packages added to cubes, decks added to records, tournaments started).
 *
 * Known gaps: anything deleted is gone; records, packs, blogs and likes of deleted cubes are
 * missed; draft rows with no `complete` flag are skipped, since deck rebuilds look like that (as do
 * some legacy drafts); likes and follows copied over by the migration all share that run's
 * timestamp, so any timestamp shared by BULK_TIMESTAMP_THRESHOLD or more rows is dropped.
 *
 * Writes: only days before --before, which should be the first full day of live counting (the
 * day after the deploy), and only days that had ended when their source was read. Each day's
 * backfilled counters are overwritten, not added to, so running it again is safe; counters it
 * does not rebuild are left alone.
 *
 * Load: this reads production, so sources run one at a time with at most --concurrency queries in
 * flight, and throttled queries wait and retry rather than failing the run.
 *
 * Resuming: each source's counts are saved under .migration-checkpoints/ when it finishes, and a
 * later run (dry or not) reuses them instead of reading again. --fresh reads everything again.
 *
 * Usage (from packages/scripts):
 *   npm run backfill-site-activity -- --before=YYYY-MM-DD [--dry-run] [--fresh]
 *     [--sources=changelogs,packages,drafts,cubes,users] [--from=2018-01-01] [--concurrency=16]
 */
import { createHash } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

import { QueryCommand, QueryCommandInput } from '@aws-sdk/lib-dynamodb';
import documentClient from '@server/dynamo/documentClient';
import { SiteActivityMetric } from '@utils/datatypes/SiteActivity';
import { SiteActivityCounts, SiteActivityDynamoDao } from 'dynamo/dao/SiteActivityDynamoDao';
import { USER_ENUMERATION_SHARDS } from 'dynamo/dao/UserDynamoDao';

import 'dotenv/config';

/** Quickest first, so a later failure costs the least. */
const SOURCES = ['changelogs', 'packages', 'drafts', 'cubes', 'users'] as const;
type Source = (typeof SOURCES)[number];

/** Cube metadata rows are enumerated on GSI3 under CUBE#{0..9} (see CubeDynamoDao.GSIKeys). */
const CUBE_ENUMERATION_SHARDS = 10;

/** Real likes or follows never share an exact millisecond this often; migration copies do. */
const BULK_TIMESTAMP_THRESHOLD = 20;

/** Earlier timestamps are treated as missing rather than as events in 1970. */
const EARLIEST_PLAUSIBLE = Date.UTC(2015, 0, 1);

const DAY_MS = 24 * 60 * 60 * 1000;

const utcDay = (ms: number): string => new Date(ms).toISOString().slice(0, 10);

/** A Mongo ObjectId's first four bytes are its creation time in seconds. */
const objectIdTime = (id: string): number | undefined =>
  /^[0-9a-f]{24}$/i.test(id) ? parseInt(id.slice(0, 8), 16) * 1000 : undefined;

const arg = (name: string): string | undefined => {
  const prefix = `--${name}=`;
  return process.argv
    .slice(2)
    .find((a) => a.startsWith(prefix))
    ?.slice(prefix.length);
};

const RETRYABLE = new Set([
  'ThrottlingException',
  'ProvisionedThroughputExceededException',
  'RequestLimitExceeded',
  'InternalServerError',
  'ServiceUnavailable',
]);

const isRetryable = (err: any): boolean => RETRYABLE.has(err?.name) || (err?.$metadata?.httpStatusCode ?? 0) >= 500;

/** Retries throttled and failed requests with growing, jittered waits (1s up to 30s, ~4 minutes in all). */
const MAX_ATTEMPTS = 12;
let retries = 0;
const withRetry = async <T>(fn: () => Promise<T>): Promise<T> => {
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await fn();
    } catch (err) {
      if (!isRetryable(err) || attempt >= MAX_ATTEMPTS) {
        throw err;
      }
      retries += 1;
      const delay = Math.min(30_000, 500 * 2 ** attempt) * (0.5 + Math.random() / 2);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
};

/** Caps the number of queries in flight across every walk. */
const limiter = (max: number) => {
  let active = 0;
  const waiting: (() => void)[] = [];
  return async <T>(fn: () => Promise<T>): Promise<T> => {
    if (active < max) {
      active += 1;
    } else {
      // The releasing caller hands its slot straight over, so `active` is unchanged.
      await new Promise<void>((resolve) => waiting.push(resolve));
    }
    try {
      return await fn();
    } finally {
      const next = waiting.shift();
      if (next) {
        next();
      } else {
        active -= 1;
      }
    }
  };
};

class Tally {
  readonly days = new Map<SiteActivityMetric, Map<string, number>>();
  readonly skipped = new Map<SiteActivityMetric, number>();

  /** Counts one event at `ms`, or notes it as skipped when the time is missing or implausible. */
  add(metric: SiteActivityMetric, ms: unknown, count = 1): void {
    if (typeof ms !== 'number' || !Number.isFinite(ms) || ms < EARLIEST_PLAUSIBLE || ms > Date.now()) {
      this.skipped.set(metric, (this.skipped.get(metric) ?? 0) + count);
      return;
    }
    const byDay = this.days.get(metric) ?? new Map<string, number>();
    const day = utcDay(ms);
    byDay.set(day, (byDay.get(day) ?? 0) + count);
    this.days.set(metric, byDay);
  }

  toJSON(): SavedTally {
    return {
      days: Object.fromEntries([...this.days].map(([metric, byDay]) => [metric, Object.fromEntries(byDay)])),
      skipped: Object.fromEntries(this.skipped),
    };
  }

  static fromJSON(saved: SavedTally): Tally {
    const tally = new Tally();
    for (const [metric, byDay] of Object.entries(saved.days)) {
      tally.days.set(metric as SiteActivityMetric, new Map(Object.entries(byDay)));
    }
    for (const [metric, count] of Object.entries(saved.skipped)) {
      tally.skipped.set(metric as SiteActivityMetric, count);
    }
    return tally;
  }
}

interface SavedTally {
  days: Record<string, Record<string, number>>;
  skipped: Record<string, number>;
}

/** One source's counts, as saved after it finishes. */
interface Checkpoint extends SavedTally {
  table: string;
  from: string;
  /** When the read began: days from then on were not over yet, so are never written. */
  readStartedAt: number;
  notes: string[];
}

const checkpointPath = (source: Source): string =>
  path.join(process.cwd(), '.migration-checkpoints', `site-activity-${source}.json`);

/** A source's saved counts, if they were read from the same table over the same span. */
const loadCheckpoint = (source: Source, table: string, from: string): Checkpoint | undefined => {
  try {
    const saved = JSON.parse(fs.readFileSync(checkpointPath(source), 'utf8')) as Checkpoint;
    return saved.table === table && saved.from === from ? saved : undefined;
  } catch {
    return undefined;
  }
};

const saveCheckpoint = (source: Source, checkpoint: Checkpoint): void => {
  fs.mkdirSync(path.dirname(checkpointPath(source)), { recursive: true });
  fs.writeFileSync(checkpointPath(source), JSON.stringify(checkpoint));
};

/** Collects exact timestamps first, so bulk-written ones can be dropped before counting. */
class TimestampCollector {
  readonly counts = new Map<number, number>();

  add(ms: unknown): void {
    if (typeof ms === 'number') {
      this.counts.set(ms, (this.counts.get(ms) ?? 0) + 1);
    }
  }

  /** Counts every timestamp into `tally`, except bulk ones. Returns the bulk ones dropped. */
  flush(tally: Tally, metric: SiteActivityMetric): { ms: number; rows: number }[] {
    const dropped: { ms: number; rows: number }[] = [];
    for (const [ms, rows] of this.counts) {
      if (rows >= BULK_TIMESTAMP_THRESHOLD) {
        dropped.push({ ms, rows });
      } else {
        tally.add(metric, ms, rows);
      }
    }
    return dropped;
  }
}

const main = async (): Promise<void> => {
  const dryRun = process.argv.slice(2).includes('--dry-run');
  const fresh = process.argv.slice(2).includes('--fresh');
  const before = arg('before');
  if (!before || !/^\d{4}-\d{2}-\d{2}$/.test(before)) {
    throw new Error('--before=YYYY-MM-DD is required: the first full day of live counting (the day after the deploy)');
  }
  const from = arg('from') ?? '2018-01-01';
  const concurrency = Number(arg('concurrency') ?? 16);
  const sources = (arg('sources')?.split(',') ?? [...SOURCES]) as Source[];
  const unknown = sources.filter((s) => !SOURCES.includes(s));
  if (unknown.length > 0) {
    throw new Error(`Unknown --sources: ${unknown.join(', ')} (expected ${SOURCES.join(', ')})`);
  }

  const tableName = process.env.DYNAMO_TABLE;
  if (!tableName) {
    throw new Error('DYNAMO_TABLE must be a defined environment variable');
  }
  const siteActivityDao = new SiteActivityDynamoDao(documentClient, tableName);
  const limit = limiter(concurrency);
  // The retry keeps its slot while it waits, so throttling also slows everything else down.
  const run = <T>(fn: () => Promise<T>): Promise<T> => limit(() => withRetry(fn));

  console.log(
    `Backfill site activity | table: ${tableName} | before ${before} | sources: ${sources.join(', ')} | concurrency ${concurrency}${
      dryRun ? ' | *** DRY RUN ***' : ''
    }`,
  );

  /** Pages through a query, handing each page's rows to `onItems`. */
  const queryAll = async (
    params: Omit<QueryCommandInput, 'TableName' | 'ExclusiveStartKey'>,
    onItems: (items: Record<string, any>[]) => void | Promise<void>,
  ): Promise<void> => {
    let lastKey: Record<string, any> | undefined;
    do {
      const res = await run(() =>
        documentClient.send(new QueryCommand({ ...params, TableName: tableName, ExclusiveStartKey: lastKey })),
      );
      await onItems(res.Items ?? []);
      lastKey = res.LastEvaluatedKey;
    } while (lastKey);
  };

  const progress = { users: 0, cubes: 0 };
  const ticker = setInterval(
    () => console.log(`  ...users ${progress.users}, cubes ${progress.cubes}, throttled retries ${retries}`),
    30_000,
  );

  /** Bulk-written timestamps the collector dropped, as notes for the report. */
  const droppedNotes = (metric: string, dropped: { ms: number; rows: number }[]): string[] =>
    dropped.map(
      ({ ms, rows }) =>
        `Dropped ${rows} ${metric} sharing one timestamp (${new Date(ms).toISOString()}), likely migrated`,
    );

  const walkUsers = async (tally: Tally): Promise<string[]> => {
    const follows = new TimestampCollector();
    const perUser = async (userId: string) => {
      await Promise.all([
        queryAll(
          {
            IndexName: 'GSI2',
            KeyConditionExpression: 'GSI2PK = :pk',
            ProjectionExpression: '#item.#date',
            ExpressionAttributeNames: { '#item': 'item', '#date': 'date' },
            ExpressionAttributeValues: { ':pk': `COMMENT#OWNER#${userId}` },
          },
          (items) => items.forEach((row) => tally.add('comments', row.item?.date)),
        ),
        queryAll(
          {
            IndexName: 'GSI1',
            KeyConditionExpression: 'GSI1PK = :pk',
            ProjectionExpression: 'followedAt',
            ExpressionAttributeValues: { ':pk': `FOLLOWING-BY#${userId}` },
          },
          (items) => items.forEach((row) => follows.add(row.followedAt)),
        ),
      ]);
    };

    await Promise.all(
      Array.from({ length: USER_ENUMERATION_SHARDS }, (_, shard) =>
        queryAll(
          {
            IndexName: 'GSI3',
            KeyConditionExpression: 'GSI3PK = :pk',
            ProjectionExpression: 'GSI3SK, #item.#dateCreated',
            ExpressionAttributeNames: { '#item': 'item', '#dateCreated': 'dateCreated' },
            ExpressionAttributeValues: { ':pk': `USER#SHARD#${shard}` },
          },
          async (items) => {
            for (const row of items) {
              const userId = row.GSI3SK as string;
              // The migration stamped users it copied with the batch's time; their id knows better.
              tally.add('signups', objectIdTime(userId) ?? row.item?.dateCreated);
            }
            await Promise.all(items.map((row) => perUser(row.GSI3SK as string)));
            progress.users += items.length;
          },
        ),
      ),
    );

    // Deleted comments keep their row under the placeholder owner.
    await queryAll(
      {
        IndexName: 'GSI2',
        KeyConditionExpression: 'GSI2PK = :pk',
        ProjectionExpression: '#item.#date',
        ExpressionAttributeNames: { '#item': 'item', '#date': 'date' },
        ExpressionAttributeValues: { ':pk': 'COMMENT#OWNER#404' },
      },
      (items) => items.forEach((row) => tally.add('comments', row.item?.date)),
    );
    return droppedNotes('userFollows', follows.flush(tally, 'userFollows'));
  };

  const walkCubes = async (tally: Tally): Promise<string[]> => {
    const likes = new TimestampCollector();
    const perCube = async (cubeId: string) => {
      await Promise.all([
        queryAll(
          {
            IndexName: 'GSI1',
            KeyConditionExpression: 'GSI1PK = :pk',
            ProjectionExpression: '#item.#dateCreated, #item.#date, #item.#finishedAt',
            ExpressionAttributeNames: {
              '#item': 'item',
              '#dateCreated': 'dateCreated',
              '#date': 'date',
              '#finishedAt': 'finishedAt',
            },
            ExpressionAttributeValues: { ':pk': `RECORD#CUBE#${cubeId}` },
          },
          (items) =>
            items.forEach((row) => {
              tally.add('recordsCreated', row.item?.dateCreated ?? row.item?.date);
              if (row.item?.finishedAt !== undefined) {
                tally.add('tournamentsFinished', row.item.finishedAt);
              }
            }),
        ),
        queryAll(
          {
            IndexName: 'GSI1',
            KeyConditionExpression: 'GSI1PK = :pk',
            ProjectionExpression: '#item.#date, #item.#createdBy',
            ExpressionAttributeNames: { '#item': 'item', '#date': 'date', '#createdBy': 'createdBy' },
            ExpressionAttributeValues: { ':pk': `P1P1PACK#CUBE#${cubeId}` },
          },
          (items) =>
            items.forEach((row) => {
              // The daily rotation creates its packs as CubeCobra (serverutils/rotateDailyP1P1.ts).
              if (row.item?.createdBy !== 'CubeCobra') {
                tally.add('p1p1PacksCreated', row.item?.date);
              }
            }),
        ),
        queryAll(
          {
            IndexName: 'GSI1',
            KeyConditionExpression: 'GSI1PK = :pk',
            ProjectionExpression: '#item.#date, #item.#changelist',
            ExpressionAttributeNames: { '#item': 'item', '#date': 'date', '#changelist': 'changelist' },
            ExpressionAttributeValues: { ':pk': `BLOG#CUBE#${cubeId}` },
          },
          (items) =>
            items.forEach((row) => {
              if (!row.item?.changelist) {
                tally.add('blogPosts', row.item?.date);
              }
            }),
        ),
        queryAll(
          {
            KeyConditionExpression: 'PK = :pk AND begins_with(SK, :like)',
            ProjectionExpression: 'likedAt',
            ExpressionAttributeValues: { ':pk': `HASH#CUBE#${cubeId}`, ':like': 'LIKE#' },
          },
          (items) => items.forEach((row) => likes.add(row.likedAt)),
        ),
      ]);
    };

    await Promise.all(
      Array.from({ length: CUBE_ENUMERATION_SHARDS }, (_, shard) =>
        queryAll(
          {
            IndexName: 'GSI3',
            KeyConditionExpression: 'GSI3PK = :pk',
            ProjectionExpression: 'GSI3SK, #item.#dateCreated',
            ExpressionAttributeNames: { '#item': 'item', '#dateCreated': 'dateCreated' },
            ExpressionAttributeValues: { ':pk': `CUBE#${shard}` },
          },
          async (items) => {
            for (const row of items) {
              const cubeId = row.GSI3SK as string;
              // Cubes copied by the migration have no dateCreated, but legacy ids carry the time.
              tally.add('cubesCreated', objectIdTime(cubeId) ?? row.item?.dateCreated);
            }
            await Promise.all(items.map((row) => perCube(row.GSI3SK as string)));
            progress.cubes += items.length;
          },
        ),
      ),
    );
    return droppedNotes('cubeLikes', likes.flush(tally, 'cubeLikes'));
  };

  const walkDrafts = async (tally: Tally): Promise<string[]> => {
    let withoutComplete = 0;
    const STARTED: Record<string, SiteActivityMetric> = {
      d: 'draftsStarted',
      g: 'gridDraftsStarted',
      h: 'housmanDraftsStarted',
      s: 'sealedPoolsOpened',
    };
    // One query per type per month, so the large types page in parallel.
    const months: [number, number][] = [];
    for (let start = Date.parse(`${from}T00:00:00Z`); start <= Date.now();) {
      const d = new Date(start);
      const next = Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1);
      months.push([start, next - 1]);
      start = next;
    }

    await Promise.all(
      Object.entries(STARTED).flatMap(([type, startedMetric]) =>
        months.map(([start, end]) =>
          queryAll(
            {
              IndexName: 'GSI4',
              // Millisecond timestamps are all 13 digits here, so the unpadded keys sort numerically.
              KeyConditionExpression: 'GSI4PK = :pk AND GSI4SK BETWEEN :start AND :end',
              ProjectionExpression: '#item.#date, #item.#complete, #item.#log.#session',
              ExpressionAttributeNames: {
                '#item': 'item',
                '#date': 'date',
                '#complete': 'complete',
                '#log': 'DraftmancerLog',
                '#session': 'sessionID',
              },
              ExpressionAttributeValues: {
                ':pk': `DRAFT#TYPE#${type}`,
                ':start': `DATE#${start}`,
                ':end': `DATE#${end}`,
              },
            },
            (items) =>
              items.forEach((row) => {
                const item = row.item ?? {};
                if (item.DraftmancerLog) {
                  // Published from Draftmancer already finished; never started here.
                  tally.add('draftsFinished', item.date);
                  return;
                }
                if (item.complete === undefined) {
                  // Deck rebuilds copy a draft's type but carry no complete flag.
                  withoutComplete += 1;
                  return;
                }
                tally.add(startedMetric, item.date);
                if (item.complete && type !== 's') {
                  tally.add('draftsFinished', item.date);
                }
              }),
          ),
        ),
      ),
    );
    return withoutComplete > 0
      ? [`Skipped ${withoutComplete} draft rows with no complete flag (deck rebuilds, some legacy drafts)`]
      : [];
  };

  const walkChangelogs = async (tally: Tally): Promise<string[]> => {
    // GSI2 partitions changelogs by the writer's local day, so walk one day past the end and
    // bucket by each row's own UTC time.
    const days: string[] = [];
    for (let t = Date.parse(`${from}T00:00:00Z`); t <= Date.now() + DAY_MS; t += DAY_MS) {
      days.push(utcDay(t));
    }
    await Promise.all(
      days.map((day) =>
        queryAll(
          {
            IndexName: 'GSI2',
            KeyConditionExpression: 'GSI2PK = :pk',
            ProjectionExpression: '#item.#date',
            ExpressionAttributeNames: { '#item': 'item', '#date': 'date' },
            ExpressionAttributeValues: { ':pk': `CHANGELOG#DAY#${day}` },
          },
          (items) => items.forEach((row) => tally.add('cubeEdits', row.item?.date)),
        ),
      ),
    );
    return [];
  };

  const walkPackages = async (tally: Tally): Promise<string[]> => {
    // Every package has a search row under the 'package:all' hash. Mirrors BaseDynamoDao.hash:
    // sha256 of the sorted `key:value` pairs, with ItemType added.
    const allPackages = createHash('sha256').update('ItemType:PACKAGE,type:package,value:all').digest('hex');
    await queryAll(
      {
        IndexName: 'GSI2',
        KeyConditionExpression: 'GSI2PK = :pk',
        ProjectionExpression: 'packageDate',
        ExpressionAttributeValues: { ':pk': allPackages },
      },
      (items) => items.forEach((row) => tally.add('packagesCreated', row.packageDate)),
    );
    return [];
  };

  const walks: Record<Source, (tally: Tally) => Promise<string[]>> = {
    users: walkUsers,
    cubes: walkCubes,
    drafts: walkDrafts,
    changelogs: walkChangelogs,
    packages: walkPackages,
  };

  const results: { source: Source; tally: Tally; checkpoint: Checkpoint }[] = [];
  try {
    for (const source of sources) {
      const saved = fresh ? undefined : loadCheckpoint(source, tableName, from);
      if (saved) {
        console.log(
          `[${source}] using counts saved ${new Date(saved.readStartedAt).toISOString()} (--fresh to re-read)`,
        );
        results.push({ source, tally: Tally.fromJSON(saved), checkpoint: saved });
        continue;
      }
      const tally = new Tally();
      const readStartedAt = Date.now();
      const notes = await walks[source](tally);
      const checkpoint: Checkpoint = { table: tableName, from, readStartedAt, notes, ...tally.toJSON() };
      saveCheckpoint(source, checkpoint);
      console.log(`[${source}] done in ${Math.round((Date.now() - readStartedAt) / 1000)}s, saved`);
      results.push({ source, tally, checkpoint });
    }
  } finally {
    clearInterval(ticker);
    if (retries > 0) {
      console.log(`Throttled or failed requests retried: ${retries}`);
    }
  }

  // Report, per metric: what will be written, what is left to live counting (on or after the
  // cutoff, or not over yet when it was read), and what could not be dated.
  const byDay = new Map<string, SiteActivityCounts>();
  const notes: string[] = [];
  console.log('\nmetric                 written     not written   undated    first day');
  for (const { source, tally, checkpoint } of results) {
    const readDay = utcDay(checkpoint.readStartedAt);
    const cutoff = readDay < before ? readDay : before;
    if (cutoff < before) {
      notes.push(`[${source}] read on ${readDay}, so days from ${readDay} are not written; --fresh after it ends`);
    }
    notes.push(...checkpoint.notes);
    for (const [metric, days] of [...tally.days].sort(([a], [b]) => a.localeCompare(b))) {
      let written = 0;
      let after = 0;
      let first = '';
      for (const [day, count] of days) {
        if (day >= cutoff) {
          after += count;
          continue;
        }
        written += count;
        if (!first || day < first) first = day;
        const counts = byDay.get(day) ?? {};
        counts[metric] = count;
        byDay.set(day, counts);
      }
      console.log(
        `${metric.padEnd(22)} ${String(written).padStart(10)} ${String(after).padStart(13)} ${String(
          tally.skipped.get(metric) ?? 0,
        ).padStart(9)}    ${first}`,
      );
    }
  }
  notes.forEach((note) => console.log(note));

  if (dryRun) {
    console.log(`\nDRY RUN: would write ${byDay.size} days.`);
    return;
  }

  let written = 0;
  await Promise.all(
    [...byDay].map(([day, counts]) =>
      run(async () => {
        await siteActivityDao.setCounts(day, counts);
        written += 1;
      }),
    ),
  );
  console.log(`\nWrote ${written} days.`);
};

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Backfill failed (safe to re-run):', err);
    process.exit(1);
  });
