import { DynamoDBDocumentClient, QueryCommandInput } from '@aws-sdk/lib-dynamodb';
import Article from '@utils/datatypes/Article';
import { ContentStatus, ContentType, UnhydratedContent } from '@utils/datatypes/Content';
import { CubeImage } from '@utils/datatypes/Cube';
import User from '@utils/datatypes/User';
import { getImageData } from 'serverutils/imageutil';
import { v4 as uuidv4 } from 'uuid';

import { getBucketName, getObject, putObject } from '../s3client';
import ContentModel from '../models/content';
import UserModel from '../models/user';
import { BaseDynamoDao } from './BaseDynamoDao';

export class ArticleDynamoDao extends BaseDynamoDao<Article, UnhydratedContent> {
  private readonly dualWriteEnabled: boolean;

  constructor(dynamoClient: DynamoDBDocumentClient, tableName: string, dualWriteEnabled: boolean = false) {
    super(dynamoClient, tableName);
    this.dualWriteEnabled = dualWriteEnabled;
  }

  protected itemType(): string {
    return 'ARTICLE';
  }

  /**
   * Gets the partition key for an article.
   */
  protected partitionKey(item: Article): string {
    return this.typedKey(item.id);
  }

  /**
   * Gets the GSI keys for the article.
   * GSI1: Query by status with date sorting
   * GSI2: Query by owner with date sorting
   */
  protected GSIKeys(item: Article): {
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
   * Dehydrates an Article to UnhydratedContent for storage.
   */
  protected dehydrateItem(item: Article): UnhydratedContent {
    const ownerId = typeof item.owner === 'string' ? item.owner : item.owner?.id;

    return {
      id: item.id,
      type: ContentType.ARTICLE,
      typeStatusComp: '', // Legacy field, no longer used
      typeOwnerComp: '', // Legacy field, no longer used
      date: item.date,
      status: item.status,
      owner: ownerId!,
      title: item.title,
      short: item.short,
      username: item.username,
      imageName: item.imageName,
      dateCreated: item.dateCreated,
      dateLastUpdated: item.dateLastUpdated,
      // body is handled separately via S3
    };
  }

  /**
   * Hydrates a single UnhydratedContent to Article.
   */
  protected async hydrateItem(item: UnhydratedContent): Promise<Article> {
    const owner = item.owner ? await UserModel.getById(item.owner) : undefined;
    const image: CubeImage | undefined = item.imageName ? getImageData(item.imageName) : undefined;

    // Load body from S3
    const itemWithBody = await this.addBody(item);

    return {
      ...itemWithBody,
      type: ContentType.ARTICLE,
      owner: owner!,
      image: image,
    } as Article;
  }

  /**
   * Hydrates multiple UnhydratedContents to Articles (optimized batch operation).
   */
  protected async hydrateItems(items: UnhydratedContent[]): Promise<Article[]> {
    if (items.length === 0) {
      return [];
    }

    const ownerIds = items.map((item) => item.owner).filter(Boolean) as string[];
    const owners = ownerIds.length > 0 ? await UserModel.batchGet(ownerIds) : [];

    return items.map((item) => {
      const owner = owners.find((o: User) => o.id === item.owner);
      const image: CubeImage | undefined = item.imageName ? getImageData(item.imageName) : undefined;

      // Note: body is not loaded during batch hydration for performance
      return {
        ...item,
        type: ContentType.ARTICLE,
        owner: owner!,
        image: image,
      } as Article;
    });
  }

  /**
   * Adds body content from S3 to the article.
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
   * Gets an article by ID.
   */
  public async getById(id: string): Promise<Article | undefined> {
    if (this.dualWriteEnabled) {
      return ContentModel.getById(id) as Promise<Article>;
    }

    return this.get({
      PK: this.typedKey(id),
      SK: this.itemType(),
    });
  }

  /**
   * Queries articles by status, ordered by date descending, with pagination.
   */
  public async queryByStatus(
    status: ContentStatus,
    lastKey?: Record<string, any>,
    limit?: number,
  ): Promise<{
    items: Article[];
    lastKey?: Record<string, any>;
  }> {
    if (this.dualWriteEnabled) {
      const result = await ContentModel.getByTypeAndStatus(ContentType.ARTICLE, status, lastKey);
      return {
        items: (result.items || []) as Article[],
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
      Limit: limit,
    };

    return this.query(params);
  }

  /**
   * Queries articles by owner, ordered by date descending, with pagination.
   */
  public async queryByOwner(
    ownerId: string,
    lastKey?: Record<string, any>,
  ): Promise<{
    items: Article[];
    lastKey?: Record<string, any>;
  }> {
    if (this.dualWriteEnabled) {
      const result = await ContentModel.getByTypeAndOwner(ContentType.ARTICLE, ownerId, lastKey);
      return {
        items: (result.items || []) as Article[],
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
  public async put(item: Article): Promise<void> {
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
      await Promise.all([ContentModel.put(item, ContentType.ARTICLE), super.put(item)]);
    } else {
      await super.put(item);
    }
  }

  /**
   * Overrides update to handle S3 body storage and support dual writes.
   */
  public async update(item: Article): Promise<void> {
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
  public async delete(item: Article): Promise<void> {
    if (this.dualWriteEnabled) {
      // Delete from both old and new paths
      await Promise.all([ContentModel.batchDelete([{ id: item.id }]), super.delete(item)]);
    } else {
      await super.delete(item);
    }
  }

  /**
   * Batch put articles.
   */
  public async batchPut(items: Article[]): Promise<void> {
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
   * Creates a new article with generated ID and proper defaults.
   */
  public async createArticle(
    partial: Omit<
      UnhydratedContent,
      'id' | 'type' | 'typeStatusComp' | 'typeOwnerComp' | 'date' | 'dateCreated' | 'dateLastUpdated'
    > &
      Partial<Pick<UnhydratedContent, 'status'>>,
  ): Promise<string> {
    const id = uuidv4();
    const date = Date.now();

    const article: Article = {
      id,
      type: ContentType.ARTICLE,
      typeStatusComp: '', // Legacy field, no longer used
      typeOwnerComp: '', // Legacy field, no longer used
      date,
      status: partial.status || ContentStatus.DRAFT,
      owner: { id: partial.owner } as any,
      title: partial.title,
      short: partial.short,
      imageName: partial.imageName,
      body: partial.body,
      username: partial.username,
      dateCreated: date,
      dateLastUpdated: date,
    };

    await this.put(article);
    return id;
  }
}
