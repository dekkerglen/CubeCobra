import { DynamoDBDocumentClient, QueryCommandInput } from '@aws-sdk/lib-dynamodb';
import { ContentStatus, ContentType, UnhydratedContent } from '@utils/datatypes/Content';
import Podcast from '@utils/datatypes/Podcast';
import User from '@utils/datatypes/User';
import { v4 as uuidv4 } from 'uuid';

import { getBucketName, getObject, putObject } from '../s3client';
import ContentModel from '../models/content';
import UserModel from '../models/user';
import { BaseDynamoDao } from './BaseDynamoDao';

export class PodcastDynamoDao extends BaseDynamoDao<Podcast, UnhydratedContent> {
  private readonly dualWriteEnabled: boolean;

  constructor(dynamoClient: DynamoDBDocumentClient, tableName: string, dualWriteEnabled: boolean = false) {
    super(dynamoClient, tableName);
    this.dualWriteEnabled = dualWriteEnabled;
  }

  protected itemType(): string {
    return 'PODCAST';
  }

  /**
   * Gets the partition key for a podcast.
   */
  protected partitionKey(item: Podcast): string {
    return this.typedKey(item.id);
  }

  /**
   * Gets the GSI keys for the podcast.
   * GSI1: Query by status with date sorting
   * GSI2: Query by owner with date sorting
   */
  protected GSIKeys(item: Podcast): {
    GSI1PK: string | undefined;
    GSI1SK: string | undefined;
    GSI2PK: string | undefined;
    GSI2SK: string | undefined;
    GSI3PK: string | undefined;
    GSI3SK: string | undefined;
    GSI4PK: string | undefined;
    GSI4SK: string | undefined;
  } {
    const ownerId = typeof item.owner === 'string' ? item.owner : item.owner?.id;

    return {
      GSI1PK: item.status ? `${this.itemType()}#STATUS#${item.status}` : undefined,
      GSI1SK: item.date ? `DATE#${item.date}` : undefined,
      GSI2PK: ownerId ? `${this.itemType()}#OWNER#${ownerId}` : undefined,
      GSI2SK: item.date ? `DATE#${item.date}` : undefined,
      GSI3PK: undefined,
      GSI3SK: undefined,
      GSI4PK: undefined,
      GSI4SK: undefined,
    };
  }

  /**
   * Dehydrates a Podcast to UnhydratedContent for storage.
   */
  protected dehydrateItem(item: Podcast): UnhydratedContent {
    const ownerId = typeof item.owner === 'string' ? item.owner : item.owner?.id;

    return {
      id: item.id,
      type: ContentType.PODCAST,
      typeStatusComp: '', // Legacy field, no longer used
      typeOwnerComp: '', // Legacy field, no longer used
      date: item.date,
      status: item.status,
      owner: ownerId!,
      title: item.title,
      url: item.url,
      short: item.description,
      username: item.username,
      dateCreated: item.dateCreated,
      dateLastUpdated: item.dateLastUpdated,
      // body is handled separately via S3
    };
  }

  /**
   * Hydrates a single UnhydratedContent to Podcast.
   */
  protected async hydrateItem(item: UnhydratedContent): Promise<Podcast> {
    const owner = item.owner ? await UserModel.getById(item.owner) : undefined;

    // Load body from S3
    const itemWithBody = await this.addBody(item);

    return {
      ...itemWithBody,
      type: ContentType.PODCAST,
      owner: owner!,
      title: item.title!,
      url: item.url!,
      description: item.short!,
    } as Podcast;
  }

  /**
   * Hydrates multiple UnhydratedContents to Podcasts (optimized batch operation).
   */
  protected async hydrateItems(items: UnhydratedContent[]): Promise<Podcast[]> {
    if (items.length === 0) {
      return [];
    }

    const ownerIds = items.map((item) => item.owner).filter(Boolean) as string[];
    const owners = ownerIds.length > 0 ? await UserModel.batchGet(ownerIds) : [];

    return items.map((item) => {
      const owner = owners.find((o: User) => o.id === item.owner);

      // Note: body is not loaded during batch hydration for performance
      return {
        ...item,
        type: ContentType.PODCAST,
        owner: owner!,
        title: item.title!,
        url: item.url!,
        description: item.short!,
      } as Podcast;
    });
  }

  /**
   * Adds body content from S3 to the podcast.
   */
  private async addBody(content: UnhydratedContent): Promise<UnhydratedContent> {
    try {
      const document = await getObject(getBucketName(), `content/${content.id}.json`);
      return {
        ...content,
        body: document,
      };
    } catch {
      return content;
    }
  }

  /**
   * Stores body content to S3.
   */
  private async putBody(id: string, body?: string): Promise<void> {
    if (body && body.length > 0) {
      await putObject(getBucketName(), `content/${id}.json`, body);
    }
  }

  /**
   * Gets a podcast by ID.
   */
  public async getById(id: string): Promise<Podcast | undefined> {
    if (this.dualWriteEnabled) {
      return ContentModel.getById(id) as Promise<Podcast>;
    }

    return this.get({
      PK: this.typedKey(id),
      SK: this.itemType(),
    });
  }

  /**
   * Queries podcasts by status, ordered by date descending, with pagination.
   */
  public async queryByStatus(
    status: ContentStatus,
    lastKey?: Record<string, any>,
  ): Promise<{
    items: Podcast[];
    lastKey?: Record<string, any>;
  }> {
    if (this.dualWriteEnabled) {
      const result = await ContentModel.getByTypeAndStatus(ContentType.PODCAST, status, lastKey);
      return {
        items: (result.items || []) as Podcast[],
        lastKey: result.lastKey,
      };
    }

    const params: QueryCommandInput = {
      TableName: this.tableName,
      IndexName: 'GSI1',
      KeyConditionExpression: 'GSI1PK = :pk',
      ExpressionAttributeValues: {
        ':pk': `${this.itemType()}#STATUS#${status}`,
      },
      ScanIndexForward: false,
      ExclusiveStartKey: lastKey,
    };

    return this.query(params);
  }

  /**
   * Queries podcasts by owner, ordered by date descending, with pagination.
   */
  public async queryByOwner(
    ownerId: string,
    lastKey?: Record<string, any>,
  ): Promise<{
    items: Podcast[];
    lastKey?: Record<string, any>;
  }> {
    if (this.dualWriteEnabled) {
      const result = await ContentModel.getByTypeAndOwner(ContentType.PODCAST, ownerId, lastKey);
      return {
        items: (result.items || []) as Podcast[],
        lastKey: result.lastKey,
      };
    }

    const params: QueryCommandInput = {
      TableName: this.tableName,
      IndexName: 'GSI2',
      KeyConditionExpression: 'GSI2PK = :pk',
      ExpressionAttributeValues: {
        ':pk': `${this.itemType()}#OWNER#${ownerId}`,
      },
      ScanIndexForward: false,
      ExclusiveStartKey: lastKey,
    };

    return this.query(params);
  }

  /**
   * Overrides put to handle S3 body storage and support dual writes.
   */
  public async put(item: Podcast): Promise<void> {
    // Generate ID if not present
    if (!item.id) {
      item.id = uuidv4();
    }

    // Store body to S3
    if (item.body) {
      await this.putBody(item.id, item.body);
    }

    if (this.dualWriteEnabled) {
      // Write to both old and new paths
      await Promise.all([ContentModel.put(item, ContentType.PODCAST), super.put(item)]);
    } else {
      await super.put(item);
    }
  }

  /**
   * Overrides update to handle S3 body storage and support dual writes.
   */
  public async update(item: Podcast): Promise<void> {
    // Store body to S3
    if (item.body) {
      await this.putBody(item.id, item.body);
    }

    if (this.dualWriteEnabled) {
      // Write to both old and new paths
      await Promise.all([ContentModel.update(item), super.update(item)]);
    } else {
      await super.update(item);
    }
  }

  /**
   * Overrides delete to support dual writes.
   */
  public async delete(item: Podcast): Promise<void> {
    if (this.dualWriteEnabled) {
      // Delete from both old and new paths
      await Promise.all([ContentModel.batchDelete([{ id: item.id }]), super.delete(item)]);
    } else {
      await super.delete(item);
    }
  }

  /**
   * Batch put podcasts.
   */
  public async batchPut(items: Podcast[]): Promise<void> {
    // Store bodies to S3
    await Promise.all(
      items.map(async (item) => {
        if (!item.id) {
          item.id = uuidv4();
        }
        if (item.body) {
          await this.putBody(item.id, item.body);
        }
      }),
    );

    if (this.dualWriteEnabled) {
      await Promise.all([ContentModel.batchPut(items), super.batchPut(items)]);
    } else {
      await super.batchPut(items);
    }
  }

  /**
   * Creates a new podcast with generated ID and proper defaults.
   */
  public async createPodcast(
    partial: Omit<
      UnhydratedContent,
      'id' | 'type' | 'typeStatusComp' | 'typeOwnerComp' | 'date' | 'dateCreated' | 'dateLastUpdated'
    > &
      Partial<Pick<UnhydratedContent, 'status'>> & { url: string },
  ): Promise<string> {
    const id = uuidv4();
    const date = Date.now();

    const podcast: Podcast = {
      id,
      type: ContentType.PODCAST,
      typeStatusComp: '', // Legacy field, no longer used
      typeOwnerComp: '', // Legacy field, no longer used
      date,
      status: partial.status || ContentStatus.DRAFT,
      owner: { id: partial.owner } as any,
      title: partial.title || '',
      url: partial.url,
      description: partial.short || '',
      username: partial.username,
      dateCreated: date,
      dateLastUpdated: date,
    };

    await this.put(podcast);
    return id;
  }
}
