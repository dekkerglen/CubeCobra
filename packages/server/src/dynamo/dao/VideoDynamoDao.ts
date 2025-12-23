import { DynamoDBDocumentClient, QueryCommandInput } from '@aws-sdk/lib-dynamodb';
import { ContentStatus, ContentType, UnhydratedContent } from '@utils/datatypes/Content';
import { CubeImage } from '@utils/datatypes/Cube';
import User from '@utils/datatypes/User';
import Video from '@utils/datatypes/Video';
import { getImageData } from 'serverutils/imageutil';
import { v4 as uuidv4 } from 'uuid';

import { getBucketName, getObject, putObject } from '../s3client';
import { BaseDynamoDao } from './BaseDynamoDao';
import { UserDynamoDao } from './UserDynamoDao';

export class VideoDynamoDao extends BaseDynamoDao<Video, UnhydratedContent> {
  private readonly userDao: UserDynamoDao;

  constructor(dynamoClient: DynamoDBDocumentClient, userDao: UserDynamoDao, tableName: string) {
    super(dynamoClient, tableName);
    this.userDao = userDao;
  }

  protected itemType(): string {
    return 'VIDEO';
  }

  /**
   * Gets the partition key for a video.
   */
  protected partitionKey(item: Video): string {
    return this.typedKey(item.id);
  }

  /**
   * Gets the GSI keys for the video.
   * GSI1: Query by status with date sorting
   * GSI2: Query by owner with date sorting
   */
  protected GSIKeys(item: Video): {
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
   * Dehydrates a Video to UnhydratedContent for storage.
   */
  protected dehydrateItem(item: Video): UnhydratedContent {
    const ownerId = typeof item.owner === 'string' ? item.owner : item.owner?.id;

    return {
      id: item.id,
      type: ContentType.VIDEO,
      typeStatusComp: '', // Legacy field, no longer used
      typeOwnerComp: '', // Legacy field, no longer used
      date: item.date,
      status: item.status,
      owner: ownerId!,
      title: item.title,
      short: item.short,
      url: item.url,
      username: item.username,
      imageName: item.imageName,
      dateCreated: item.dateCreated,
      dateLastUpdated: item.dateLastUpdated,
      // body is handled separately via S3
    };
  }

  /**
   * Hydrates a single UnhydratedContent to Video.
   */
  protected async hydrateItem(item: UnhydratedContent): Promise<Video> {
    const owner = item.owner ? await this.userDao.getById(item.owner) : undefined;
    const image: CubeImage | undefined = item.imageName ? getImageData(item.imageName) : undefined;

    // Load body from S3
    const itemWithBody = await this.addBody(item);

    return {
      ...itemWithBody,
      type: ContentType.VIDEO,
      owner: owner!,
      image: image,
      url: item.url!,
    } as Video;
  }

  /**
   * Hydrates multiple UnhydratedContents to Videos (optimized batch operation).
   */
  protected async hydrateItems(items: UnhydratedContent[]): Promise<Video[]> {
    if (items.length === 0) {
      return [];
    }

    const ownerIds = items.map((item) => item.owner).filter(Boolean) as string[];
    const owners = ownerIds.length > 0 ? await this.userDao.batchGet(ownerIds) : [];

    return items.map((item) => {
      const owner = owners.find((o: User) => o.id === item.owner);
      const image: CubeImage | undefined = item.imageName ? getImageData(item.imageName) : undefined;

      // Note: body is not loaded during batch hydration for performance
      return {
        ...item,
        type: ContentType.VIDEO,
        owner: owner!,
        image: image,
        url: item.url!,
      } as Video;
    });
  }

  /**
   * Adds body content from S3 to the video.
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
   * Gets a video by ID.
   */
  public async getById(id: string): Promise<Video | undefined> {
    return this.get({
      PK: this.typedKey(id),
      SK: this.itemType(),
    });
  }

  /**
   * Queries videos by status, ordered by date descending, with pagination.
   */
  public async queryByStatus(
    status: ContentStatus,
    lastKey?: Record<string, any>,
    limit?: number,
  ): Promise<{
    items: Video[];
    lastKey?: Record<string, any>;
  }> {
    const params: QueryCommandInput = {
      TableName: this.tableName,
      IndexName: 'GSI1',
      KeyConditionExpression: 'GSI1PK = :pk',
      ExpressionAttributeValues: {
        ':pk': `${this.itemType()}#STATUS#${status}`,
      },
      ScanIndexForward: false,
      ExclusiveStartKey: lastKey,
      Limit: limit,
    };

    return this.query(params);
  }

  /**
   * Queries videos by owner, ordered by date descending, with pagination.
   */
  public async queryByOwner(
    ownerId: string,
    lastKey?: Record<string, any>,
  ): Promise<{
    items: Video[];
    lastKey?: Record<string, any>;
  }> {
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
  public async put(item: Video): Promise<void> {
    // Generate ID if not present
    if (!item.id) {
      item.id = uuidv4();
    }

    // Store body to S3
    if (item.body) {
      await this.putBody(item.id, item.body);
    }

    await super.put(item);
  }

  /**
   * Overrides update to handle S3 body storage and support dual writes.
   */
  public async update(item: Video): Promise<void> {
    // Store body to S3
    if (item.body) {
      await this.putBody(item.id, item.body);
    }

    await super.update(item);
  }

  /**
   * Overrides delete to support dual writes.
   */
  public async delete(item: Video): Promise<void> {
    await super.delete(item);
  }

  /**
   * Batch put videos.
   */
  public async batchPut(items: Video[]): Promise<void> {
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

    await super.batchPut(items);
  }

  /**
   * Creates a new video with generated ID and proper defaults.
   */
  public async createVideo(
    partial: Omit<
      UnhydratedContent,
      'id' | 'type' | 'typeStatusComp' | 'typeOwnerComp' | 'date' | 'dateCreated' | 'dateLastUpdated'
    > &
      Partial<Pick<UnhydratedContent, 'status'>> & { url: string },
  ): Promise<string> {
    const id = uuidv4();
    const date = Date.now();

    const video: Video = {
      id,
      type: ContentType.VIDEO,
      typeStatusComp: '', // Legacy field, no longer used
      typeOwnerComp: '', // Legacy field, no longer used
      date,
      status: partial.status || ContentStatus.DRAFT,
      owner: { id: partial.owner } as any,
      title: partial.title,
      short: partial.short,
      imageName: partial.imageName,
      body: partial.body,
      url: partial.url,
      username: partial.username,
      dateCreated: date,
      dateLastUpdated: date,
    };

    await this.put(video);
    return id;
  }
}
