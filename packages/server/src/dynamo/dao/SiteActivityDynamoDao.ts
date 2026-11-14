import { DynamoDBDocumentClient, PutCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { BaseObject } from '@utils/datatypes/BaseObject';
import { SITE_ACTIVITY_COUNTERS, SiteActivityCounter, SiteActivityDay } from '@utils/datatypes/SiteActivity';

import { BaseDynamoDao, Key } from './BaseDynamoDao';

export interface StoredSiteActivityDay extends SiteActivityDay, BaseObject {}

export type SiteActivityCounts = Partial<Record<SiteActivityCounter, number>>;

/**
 * The counters are optional at rest: a day's row is created by its first event, and a counter
 * added after that row was written is missing from it until the counter's first event.
 */
export type UnhydratedSiteActivityDay = SiteActivityCounts &
  BaseObject & {
    date: string;
  };

/** One row per user holding the last UTC day they were counted active. */
const USER_ITEM_TYPE = 'SITE_ACTIVITY_USER';

const isConditionalCheckFailure = (e: unknown): boolean =>
  e instanceof Error && e.name === 'ConditionalCheckFailedException';

/**
 * Daily site activity counters, one row per UTC day.
 *
 * Every day shares one partition, sorted by date, so a range is a single query. Writes only
 * ever touch today's row, so the shared partition is no hotter than one row per day would be.
 */
export class SiteActivityDynamoDao extends BaseDynamoDao<StoredSiteActivityDay, UnhydratedSiteActivityDay> {
  constructor(dynamoClient: DynamoDBDocumentClient, tableName: string) {
    super(dynamoClient, tableName);
  }

  protected itemType(): string {
    return 'SITE_ACTIVITY';
  }

  protected partitionKey(_item: StoredSiteActivityDay): string {
    return this.itemType();
  }

  protected sortKey(item: StoredSiteActivityDay): string {
    return this.dayKey(item.date);
  }

  private dayKey(date: string): string {
    return `DATE#${date}`;
  }

  protected dehydrateItem(item: StoredSiteActivityDay): UnhydratedSiteActivityDay {
    return { ...item };
  }

  protected hydrateItem(item: UnhydratedSiteActivityDay): StoredSiteActivityDay {
    const counts = Object.fromEntries(SITE_ACTIVITY_COUNTERS.map((counter) => [counter, item[counter] ?? 0])) as Record<
      SiteActivityCounter,
      number
    >;
    return {
      ...counts,
      date: item.date,
      dateCreated: item.dateCreated,
      dateLastUpdated: item.dateLastUpdated,
    };
  }

  protected async hydrateItems(items: UnhydratedSiteActivityDay[]): Promise<StoredSiteActivityDay[]> {
    return items.map((item) => this.hydrateItem(item));
  }

  /**
   * Adds events to the current UTC day's counters, all in one write.
   *
   * In the steady state this is a single atomic ADD. Only the day's first event creates the
   * row; if two requests race to create it, the loser's put fails and its ADD goes through.
   */
  public async increment(counts: SiteActivityCounts): Promise<void> {
    const now = Date.now();
    await this.writeDay(new Date(now).toISOString().slice(0, 10), counts, 'add', now);
  }

  /**
   * Overwrites a day's counters with the given values, leaving the others alone. For the
   * backfill script, so running it again writes the same numbers rather than adding to them.
   */
  public async setCounts(date: string, counts: SiteActivityCounts): Promise<void> {
    await this.writeDay(date, counts, 'set', Date.now());
  }

  private async writeDay(date: string, counts: SiteActivityCounts, mode: 'add' | 'set', now: number): Promise<void> {
    const entries = Object.entries(counts).filter(([, value]) => typeof value === 'number' && value > 0) as [
      SiteActivityCounter,
      number,
    ][];
    if (entries.length === 0) {
      return;
    }
    const key = { PK: this.itemType(), SK: this.dayKey(date) };

    if (await this.updateDay(key, entries, mode, now)) {
      return;
    }
    if (await this.createDay(date, entries, now)) {
      return;
    }
    if (!(await this.updateDay(key, entries, mode, now))) {
      throw new Error(`Site activity row ${key.SK} was neither found nor created`);
    }
  }

  /** Writes to an existing day's counters. False if the day has no row yet. */
  private async updateDay(
    key: Key,
    entries: [SiteActivityCounter, number][],
    mode: 'add' | 'set',
    now: number,
  ): Promise<boolean> {
    const names: Record<string, string> = { '#item': 'item' };
    const values: Record<string, number> = { ':now': now };
    const parts = entries.map(([counter, value], index) => {
      names[`#c${index}`] = counter;
      values[`:v${index}`] = value;
      return mode === 'add' ? `#item.#c${index} :v${index}` : `#item.#c${index} = :v${index}`;
    });
    const updateExpression =
      mode === 'add'
        ? `ADD ${parts.join(', ')} SET #item.dateLastUpdated = :now`
        : `SET ${parts.join(', ')}, #item.dateLastUpdated = :now`;

    try {
      await this.dynamoClient.send(
        new UpdateCommand({
          TableName: this.tableName,
          Key: key,
          UpdateExpression: updateExpression,
          ConditionExpression: 'attribute_exists(PK)',
          ExpressionAttributeNames: names,
          ExpressionAttributeValues: values,
        }),
      );
      return true;
    } catch (e) {
      if (isConditionalCheckFailure(e)) {
        return false;
      }
      throw e;
    }
  }

  /** Creates the day's row holding these counts. False if another request created it first. */
  private async createDay(date: string, entries: [SiteActivityCounter, number][], now: number): Promise<boolean> {
    const day = this.hydrateItem({ date, dateCreated: now, dateLastUpdated: now, ...Object.fromEntries(entries) });
    try {
      await this.dynamoClient.send(
        new PutCommand({
          TableName: this.tableName,
          Item: this.toDynamoItem(day),
          ConditionExpression: 'attribute_not_exists(PK)',
        }),
      );
      return true;
    } catch (e) {
      if (isConditionalCheckFailure(e)) {
        return false;
      }
      throw e;
    }
  }

  /**
   * Marks a user active on `today` (UTC, YYYY-MM-DD).
   *
   * @returns The user's previous active day, null if they had never been active, or undefined
   * if they were already marked active today (so this activity must not be counted again).
   */
  public async markUserActive(userId: string, today: string): Promise<string | null | undefined> {
    const now = Date.now();
    const key = { PK: `${USER_ITEM_TYPE}#${userId}`, SK: USER_ITEM_TYPE };

    try {
      const result = await this.dynamoClient.send(
        new UpdateCommand({
          TableName: this.tableName,
          Key: key,
          UpdateExpression: 'SET #item.#last = :today, #item.dateLastUpdated = :now',
          ConditionExpression: 'attribute_exists(PK) AND #item.#last < :today',
          ExpressionAttributeNames: { '#item': 'item', '#last': 'lastActiveDay' },
          ExpressionAttributeValues: { ':today': today, ':now': now },
          ReturnValues: 'UPDATED_OLD',
        }),
      );
      return result.Attributes?.item?.lastActiveDay ?? null;
    } catch (e) {
      if (!isConditionalCheckFailure(e)) {
        throw e;
      }
    }

    // The update fails both for a user already active today and for one with no row yet; only
    // the latter can create the row. Losing a race to create it means someone else counted it.
    try {
      await this.dynamoClient.send(
        new PutCommand({
          TableName: this.tableName,
          Item: {
            ...key,
            DynamoVersion: 1,
            item: { userId, lastActiveDay: today, dateCreated: now, dateLastUpdated: now },
          },
          ConditionExpression: 'attribute_not_exists(PK)',
        }),
      );
      return null;
    } catch (e) {
      if (isConditionalCheckFailure(e)) {
        return undefined;
      }
      throw e;
    }
  }

  /**
   * The stored days between two UTC dates (YYYY-MM-DD), inclusive, ascending. Days with no
   * events have no row and are absent.
   */
  public async getRange(startDate: string, endDate: string): Promise<StoredSiteActivityDay[]> {
    const days: StoredSiteActivityDay[] = [];
    let lastKey: Record<string, any> | undefined;
    do {
      const page = await this.query(
        this.buildQueryParams(
          {
            TableName: this.tableName,
            KeyConditionExpression: 'PK = :pk AND SK BETWEEN :start AND :end',
            ExpressionAttributeValues: {
              ':pk': this.itemType(),
              ':start': this.dayKey(startDate),
              ':end': this.dayKey(endDate),
            },
          },
          lastKey,
        ),
      );
      days.push(...page.items);
      lastKey = page.lastKey;
    } while (lastKey);
    return days;
  }
}
