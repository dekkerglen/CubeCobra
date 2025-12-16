import { DynamoDBDocumentClient, QueryCommandInput } from '@aws-sdk/lib-dynamodb';
import Notification, { NewNotification, NotificationStatus } from '@utils/datatypes/Notification';
import { v4 as uuidv4 } from 'uuid';

import NotificationModel from '../models/notification';
import { BaseDynamoDao } from './BaseDynamoDao';

export class NotificationDynamoDao extends BaseDynamoDao<Notification, Notification> {
  private readonly dualWriteEnabled: boolean;

  constructor(dynamoClient: DynamoDBDocumentClient, tableName: string, dualWriteEnabled: boolean = false) {
    super(dynamoClient, tableName);
    this.dualWriteEnabled = dualWriteEnabled;
  }

  protected itemType(): string {
    return 'NOTIFICATION';
  }

  /**
   * Gets the partition key for a notification.
   */
  protected partitionKey(item: Notification): string {
    return this.typedKey(item.id);
  }

  /**
   * Gets the GSI keys for the notification.
   * GSI1: Query by 'to' user and date (all notifications for a user)
   * GSI2: Query by 'to' user and status and date (filtered notifications by status)
   */
  protected GSIKeys(item: Notification): {
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
      GSI1PK: `${this.itemType()}#TO#${item.to}`,
      GSI1SK: `DATE#${item.date}`,
      GSI2PK: `${this.itemType()}#TO#${item.to}#STATUS#${item.status}`,
      GSI2SK: `DATE#${item.date}`,
      GSI3PK: undefined,
      GSI3SK: undefined,
      GSI4PK: undefined,
      GSI4SK: undefined,
    };
  }

  /**
   * Dehydrates a Notification (no-op since Notification is already flat).
   */
  protected dehydrateItem(item: Notification): Notification {
    return {
      id: item.id,
      date: item.date,
      to: item.to,
      from: item.from,
      fromUsername: item.fromUsername,
      url: item.url,
      body: item.body,
      status: item.status,
      toStatusComp: item.toStatusComp,
      dateCreated: item.dateCreated,
      dateLastUpdated: item.dateLastUpdated,
    };
  }

  /**
   * Hydrates a single Notification (no-op since no external references).
   */
  protected async hydrateItem(item: Notification): Promise<Notification> {
    return item;
  }

  /**
   * Hydrates multiple Notifications (no-op since no external references).
   */
  protected async hydrateItems(items: Notification[]): Promise<Notification[]> {
    return items;
  }

  /**
   * Gets a notification by ID.
   */
  public async getById(id: string): Promise<Notification | undefined> {
    if (this.dualWriteEnabled) {
      return NotificationModel.getById(id);
    }

    return this.get({
      PK: this.typedKey(id),
      SK: this.itemType(),
    });
  }

  /**
   * Queries notifications by 'to' user, ordered by date descending, with pagination.
   */
  public async getByTo(
    to: string,
    lastKey?: Record<string, any>,
  ): Promise<{
    items: Notification[];
    lastKey?: Record<string, any>;
  }> {
    if (this.dualWriteEnabled) {
      const result = await NotificationModel.getByTo(to, lastKey);
      return {
        items: result.items || [],
        lastKey: result.lastKey,
      };
    }

    const params: QueryCommandInput = {
      TableName: this.tableName,
      IndexName: 'GSI1',
      KeyConditionExpression: 'GSI1PK = :to',
      ExpressionAttributeValues: {
        ':to': `${this.itemType()}#TO#${to}`,
      },
      ScanIndexForward: false, // Descending order by date
      Limit: 99,
      ExclusiveStartKey: lastKey,
    };

    return this.query(params);
  }

  /**
   * Queries notifications by 'to' user and status, ordered by date descending, with pagination.
   */
  public async getByToAndStatus(
    to: string,
    status: NotificationStatus,
    lastKey?: Record<string, any>,
  ): Promise<{
    items: Notification[];
    lastKey?: Record<string, any>;
  }> {
    if (this.dualWriteEnabled) {
      const result = await NotificationModel.getByToAndStatus(to, status, lastKey);
      return {
        items: result.items || [],
        lastKey: result.lastKey,
      };
    }

    const params: QueryCommandInput = {
      TableName: this.tableName,
      IndexName: 'GSI2',
      KeyConditionExpression: 'GSI2PK = :toStatus',
      ExpressionAttributeValues: {
        ':toStatus': `${this.itemType()}#TO#${to}#STATUS#${status}`,
      },
      ScanIndexForward: false, // Descending order by date
      Limit: 99,
      ExclusiveStartKey: lastKey,
    };

    return this.query(params);
  }

  /**
   * Overrides put to support dual writes.
   * Accepts both NewNotification and Notification types.
   */
  public async put(item: Notification | NewNotification): Promise<void> {
    // Determine the status - NewNotification doesn't have status, defaults to UNREAD
    const status = Object.prototype.hasOwnProperty.call(item, 'status')
      ? (item as Notification).status
      : NotificationStatus.UNREAD;

    // Generate ID if not provided
    const id =
      Object.prototype.hasOwnProperty.call(item, 'id') && (item as Notification).id
        ? (item as Notification).id
        : uuidv4();

    const now = Date.now();

    // Create the notification object
    const notification: Notification = {
      id: id,
      date: item.date,
      to: item.to,
      from: item.from,
      fromUsername: item.fromUsername,
      url: item.url,
      body: item.body,
      status: status,
      toStatusComp: `${item.to}:${status}`,
      dateCreated: Object.prototype.hasOwnProperty.call(item, 'dateCreated')
        ? ((item as Notification).dateCreated as number)
        : now,
      dateLastUpdated: Object.prototype.hasOwnProperty.call(item, 'dateLastUpdated')
        ? ((item as Notification).dateLastUpdated as number)
        : now,
    };

    if (this.dualWriteEnabled) {
      // Write to both old and new paths
      await Promise.all([NotificationModel.put(item as NewNotification), super.put(notification)]);
    } else {
      await super.put(notification);
    }
  }

  /**
   * Overrides update to support dual writes.
   */
  public async update(item: Notification): Promise<void> {
    // Ensure toStatusComp is set correctly
    item.toStatusComp = `${item.to}:${item.status}`;

    if (this.dualWriteEnabled) {
      // Check if item exists in new table first
      const existsInNewTable = await this.get({
        PK: this.partitionKey(item),
        SK: this.itemType(),
      });

      // Write to both old and new paths
      await Promise.all([NotificationModel.update(item), existsInNewTable ? super.update(item) : super.put(item)]);
    } else {
      await super.update(item);
    }
  }

  /**
   * Batch puts multiple notifications.
   */
  public async batchPut(items: Notification[]): Promise<void> {
    // Ensure toStatusComp is set correctly for all items
    const normalizedItems = items.map((item) => ({
      ...item,
      toStatusComp: `${item.to}:${item.status}`,
    }));

    if (this.dualWriteEnabled) {
      await Promise.all([NotificationModel.batchPut(normalizedItems), super.batchPut(normalizedItems)]);
    } else {
      await super.batchPut(normalizedItems);
    }
  }

  /**
   * Creates a new notification with generated ID if not provided.
   */
  public async createNotification(document: NewNotification): Promise<Notification> {
    const id = uuidv4();
    const now = Date.now();

    const newNotification: Notification = {
      id,
      date: document.date,
      to: document.to,
      from: document.from,
      fromUsername: document.fromUsername,
      url: document.url,
      body: document.body,
      status: NotificationStatus.UNREAD,
      toStatusComp: `${document.to}:${NotificationStatus.UNREAD}`,
      dateCreated: now,
      dateLastUpdated: now,
    };

    await this.put(newNotification);
    return newNotification;
  }
}
