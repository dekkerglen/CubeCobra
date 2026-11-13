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
 * day after the deploy). Each day's backfilled counters are overwritten, not added to, so running
 * it again is safe; counters it does not rebuild are left alone.
 *
 * Usage (from packages/scripts):
 *   npm run backfill-site-activity -- --before=YYYY-MM-DD [--dry-run] [--sources=users,cubes,...]
 *     [--from=2018-01-01] [--concurrency=64]
 */
import { createHash } from 'crypto';

import { QueryCommand, QueryCommandInput } from '@aws-sdk/lib-dynamodb';
import documentClient from '@server/dynamo/documentClient';
import { SiteActivityMetric } from '@utils/datatypes/SiteActivity';
import { SiteActivityCounts, SiteActivityDynamoDao } from 'dynamo/dao/SiteActivityDynamoDao';
import { USER_ENUMERATION_SHARDS } from 'dynamo/dao/UserDynamoDao';

import 'dotenv/config';

const SOURCES = ['users', 'cubes', 'drafts', 'changelogs', 'packages'] as const;
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
}

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
  const before = arg('before');
  if (!before || !/^\d{4}-\d{2}-\d{2}$/.test(before)) {
    throw new Error('--before=YYYY-MM-DD is required: the first full day of live counting (the day after the deploy)');
  }
  const from = arg('from') ?? '2018-01-01';
  const concurrency = Number(arg('concurrency') ?? 64);
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
  const run = limiter(concurrency);

  console.log(
    `Backfill site activity | table: ${tableName} | before ${before} | sources: ${sources.join(', ')}${
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

  const tally = new Tally();
  const likes = new TimestampCollector();
  const follows = new TimestampCollector();
  const progress = { users: 0, cubes: 0 };
  const ticker = setInterval(() => console.log(`  ...users ${progress.users}, cubes ${progress.cubes}`), 30_000);

  const walkUsers = async () => {
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
  };

  const walkCubes = async () => {
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
  };

  let draftsWithoutComplete = 0;
  const walkDrafts = async () => {
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
                  draftsWithoutComplete += 1;
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
  };

  const walkChangelogs = async () => {
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
  };

  const walkPackages = async () => {
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
  };

  const walks: Record<Source, () => Promise<void>> = {
    users: walkUsers,
    cubes: walkCubes,
    drafts: walkDrafts,
    changelogs: walkChangelogs,
    packages: walkPackages,
  };
  try {
    await Promise.all(
      sources.map(async (source) => {
        const started = Date.now();
        await walks[source]();
        console.log(`[${source}] done in ${Math.round((Date.now() - started) / 1000)}s`);
      }),
    );
  } finally {
    clearInterval(ticker);
  }

  const dropped = {
    cubeLikes: sources.includes('cubes') ? likes.flush(tally, 'cubeLikes') : [],
    userFollows: sources.includes('users') ? follows.flush(tally, 'userFollows') : [],
  };

  // Report, per metric: what will be written, what falls on or after the cutoff (live counting
  // owns those days), and what could not be dated.
  const byDay = new Map<string, SiteActivityCounts>();
  console.log('\nmetric                 written     >= cutoff   undated    first day');
  for (const [metric, days] of [...tally.days].sort(([a], [b]) => a.localeCompare(b))) {
    let written = 0;
    let after = 0;
    let first = '';
    for (const [day, count] of days) {
      if (day >= before) {
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
      `${metric.padEnd(22)} ${String(written).padStart(10)} ${String(after).padStart(11)} ${String(
        tally.skipped.get(metric) ?? 0,
      ).padStart(9)}    ${first}`,
    );
  }
  for (const [metric, list] of Object.entries(dropped)) {
    for (const { ms, rows } of list) {
      console.log(`Dropped ${rows} ${metric} sharing one timestamp (${new Date(ms).toISOString()}), likely migrated`);
    }
  }
  if (draftsWithoutComplete > 0) {
    console.log(
      `Skipped ${draftsWithoutComplete} draft rows with no complete flag (deck rebuilds, some legacy drafts)`,
    );
  }

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
