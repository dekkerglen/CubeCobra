import { DynamoDBDocumentClient, QueryCommandInput } from '@aws-sdk/lib-dynamodb';
import { NewNotice, Notice, NoticeStatus, UnhydratedNotice } from '@utils/datatypes/Notice';
import User from '@utils/datatypes/User';
import { v4 as uuidv4 } from 'uuid';

import NoticeModel from '../models/notice';
import UserModel from '../models/user';
import { BaseDynamoDao } from './BaseDynamoDao';

export class NoticeDynamoDao extends BaseDynamoDao<Notice, UnhydratedNotice> {
  private readonly dualWriteEnabled: boolean;

  constructor(dynamoClient: DynamoDBDocumentClient, tableName: string, dualWriteEnabled: boolean = false) {
    super(dynamoClient, tableName);
    this.dualWriteEnabled = dualWriteEnabled;
  }

  protected itemType(): string {
    return 'NOTICE';
  }

  /**
   * Gets the partition key for a notice.
   */
  protected partitionKey(item: Notice): string {
    return this.typedKey(item.id);
  }

  /**
   * Gets the GSI keys for the notice.
   * GSI1: Query by status and date
   */
  protected GSIKeys(item: Notice): {
    GSI1PK: string | undefined;
    GSI1SK: string | undefined;
    GSI2PK: string | undefined;
    GSI2SK: string | undefined;
    GSI3PK: string | undefined;
    GSI3SK: string | undefined;
    GSI4PK: string | undefined;
    GSI4SK: string | undefined;
  } {
    return {
      GSI1PK: `${this.itemType()}#STATUS#${item.status}`,
      GSI1SK: `DATE#${item.date}`,
      GSI2PK: undefined,
      GSI2SK: undefined,
      GSI3PK: undefined,
      GSI3SK: undefined,
      GSI4PK: undefined,
      GSI4SK: undefined,
    };
  }

  /**
   * Dehydrates a Notice to UnhydratedNotice for storage.
   */
  protected dehydrateItem(item: Notice): UnhydratedNotice {
    return {
      id: item.id,
      date: item.date,
      user: item.user?.id || null,
      body: item.body,
      type: item.type,
      subject: item.subject,
      status: item.status,
      dateCreated: item.dateCreated,
      dateLastUpdated: item.dateLastUpdated,
    };
  }

  /**
   * Hydrates a single UnhydratedNotice to Notice.
   */
  protected async hydrateItem(item: UnhydratedNotice): Promise<Notice> {
    if (!item.user) {
      return this.createHydratedNoticeWithoutUser(item);
    }

    const user = await UserModel.getById(item.user);
    if (!user) {
      return this.createHydratedNoticeWithoutUser(item);
    }

    return this.createHydratedNotice(item, user);
  }

  /**
   * Hydrates multiple UnhydratedNotices to Notices (optimized batch operation).
   */
  protected async hydrateItems(items: UnhydratedNotice[]): Promise<Notice[]> {
    if (items.length === 0) {
      return [];
    }

    const userIds = items.filter((item) => item.user).map((item) => item.user) as string[];

    const users = userIds.length > 0 ? await UserModel.batchGet(userIds) : [];

    return items
      .map((item) => {
        if (!item.user) {
          return this.createHydratedNoticeWithoutUser(item);
        }

        const user = users.find((u: User) => u.id === item.user);
        if (!user) {
          return this.createHydratedNoticeWithoutUser(item);
        }

        return this.createHydratedNotice(item, user);
      })
      .filter((n) => n !== null) as Notice[];
  }

  /**
   * Helper method to create a hydrated notice.
   */
  private createHydratedNotice(document: UnhydratedNotice, user: User): Notice {
    const now = Date.now();
    return {
      id: document.id!,
      date: document.date,
      user: user,
      body: document.body,
      type: document.type,
      subject: document.subject,
      status: document.status,
      dateCreated: document.dateCreated || now,
      dateLastUpdated: document.dateLastUpdated || now,
    };
  }

  /**
   * Helper method to create a hydrated notice with anonymous user.
   */
  private createHydratedNoticeWithoutUser(item: UnhydratedNotice): Notice {
    return this.createHydratedNotice(item, this.getAnonymousUser());
  }

  /**
   * Gets the anonymous user.
   */
  private getAnonymousUser(): User {
    return {
      id: '404',
      username: 'Anonymous',
    } as User;
  }

  /**
   * Gets a notice by ID.
   */
  public async getById(id: string): Promise<Notice | undefined> {
    if (this.dualWriteEnabled) {
      return NoticeModel.getById(id);
    }

    return this.get({
      PK: this.typedKey(id),
      SK: this.itemType(),
    });
  }

  /**
   * Queries notices by status, ordered by date descending, with pagination.
   */
  public async getByStatus(
    status: NoticeStatus,
    lastKey?: Record<string, any>,
  ): Promise<{
    items: Notice[];
    lastKey?: Record<string, any>;
  }> {
    if (this.dualWriteEnabled) {
      const result = await NoticeModel.getByStatus(status, lastKey);
      return {
        items: result.items || [],
        lastKey: result.lastKey,
      };
    }

    const params: QueryCommandInput = {
      TableName: this.tableName,
      IndexName: 'GSI1',
      KeyConditionExpression: 'GSI1PK = :status',
      ExpressionAttributeValues: {
        ':status': `${this.itemType()}#STATUS#${status}`,
      },
      ScanIndexForward: false, // Descending order by date
      ExclusiveStartKey: lastKey,
    };

    return this.query(params);
  }

  /**
   * Overrides put to support dual writes.
   * Accepts both NewNotice and Notice types.
   */
  public async put(item: Notice | NewNotice): Promise<void> {
    // Determine the status - NewNotice doesn't have status, defaults to ACTIVE
    const status = 'status' in item ? item.status : NoticeStatus.ACTIVE;

    // Generate ID if not provided
    const id = item.id || uuidv4();

    // Extract user ID
    let userId: string | null = null;
    if (item.user) {
      userId = typeof item.user === 'string' ? item.user : item.user.id;
    }

    const now = Date.now();

    // Create the notice object
    const notice: Notice = {
      id: id,
      date: item.date,
      body: item.body,
      user: userId && typeof item.user !== 'string' ? (item.user as User) : ({ id: userId } as User), // Hydrate minimal user for consistency
      status: status,
      type: item.type,
      subject: item.subject,
      dateCreated: 'dateCreated' in item ? (item.dateCreated as number) : now,
      dateLastUpdated: 'dateLastUpdated' in item ? (item.dateLastUpdated as number) : now,
    };

    if (this.dualWriteEnabled) {
      // Write to both old and new paths
      await Promise.all([NoticeModel.put(item), super.put(notice)]);
    } else {
      await super.put(notice);
    }
  }

  /**
   * Overrides update to support dual writes.
   */
  public async update(item: Notice): Promise<void> {
    if (this.dualWriteEnabled) {
      // Check if item exists in new table first
      const existsInNewTable = await this.get({
        PK: this.partitionKey(item),
        SK: this.itemType(),
      });

      // Write to both old and new paths
      await Promise.all([
        NoticeModel.put(item), // Old model doesn't have separate update
        existsInNewTable ? super.update(item) : super.put(item),
      ]);
    } else {
      await super.update(item);
    }
  }

  /**
   * Overrides delete to support dual writes.
   */
  public async delete(item: Notice): Promise<void> {
    if (this.dualWriteEnabled) {
      // Delete from both old and new paths
      // Old model doesn't have a delete method, so we only delete from new table
      await super.delete(item);
    } else {
      await super.delete(item);
    }
  }

  /**
   * Batch puts multiple notices.
   * Overrides batchPut to handle the old model's signature that uses UnhydratedNotice[].
   */
  public async batchPut(items: Notice[]): Promise<void> {
    if (this.dualWriteEnabled) {
      // Convert Notice[] to UnhydratedNotice[] for the old model
      const unhydratedItems = this.dehydrateItems(items);
      await Promise.all([NoticeModel.batchPut(unhydratedItems), super.batchPut(items)]);
    } else {
      await super.batchPut(items);
    }
  }

  /**
   * Creates a new notice with generated ID if not provided.
   */
  public async createNotice(document: NewNotice): Promise<Notice> {
    const id = document.id || uuidv4();

    const userId = typeof document.user === 'string' ? document.user : null;

    const user = userId ? await UserModel.getById(userId) : this.getAnonymousUser();

    const now = Date.now();

    const newNotice: Notice = {
      id,
      date: document.date,
      body: document.body,
      user: user || this.getAnonymousUser(),
      status: NoticeStatus.ACTIVE,
      type: document.type,
      subject: document.subject,
      dateCreated: now,
      dateLastUpdated: now,
    };

    await this.put(newNotice);
    return newNotice;
  }
}
