import { DynamoDBDocumentClient, QueryCommandInput } from '@aws-sdk/lib-dynamodb';
import HostedImage, { UnhydratedHostedImage } from '@utils/datatypes/HostedImage';
import { v4 as uuidv4 } from 'uuid';

import { BaseDynamoDao } from './BaseDynamoDao';

/**
 * DAO for user-uploaded hosted images (Lotus Cobra perk). Single-table design.
 *
 * KEYS:
 * - PK = HOSTED_IMAGE#{id}, SK = HOSTED_IMAGE
 * - GSI1: query by owner, sorted by creation date (GSI1PK = HOSTED_IMAGE#OWNER#{owner})
 *
 * The stored `url` is always a relative path (e.g. /userimages/{owner}/{id}.webp); callers apply
 * cdnUrl() when handing the URL to a browser. Hydration is otherwise an identity transform.
 */
export class HostedImageDynamoDao extends BaseDynamoDao<HostedImage, UnhydratedHostedImage> {
  constructor(dynamoClient: DynamoDBDocumentClient, tableName: string) {
    super(dynamoClient, tableName);
  }

  protected itemType(): string {
    return 'HOSTED_IMAGE';
  }

  protected partitionKey(item: HostedImage): string {
    return this.typedKey(item.id);
  }

  protected GSIKeys(item: HostedImage): {
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
      GSI1PK: item.owner ? `${this.itemType()}#OWNER#${item.owner}` : undefined,
      GSI1SK: `DATE#${item.dateCreated}`,
      GSI2PK: undefined,
      GSI2SK: undefined,
      GSI3PK: undefined,
      GSI3SK: undefined,
      GSI4PK: undefined,
      GSI4SK: undefined,
    };
  }

  protected dehydrateItem(item: HostedImage): UnhydratedHostedImage {
    return {
      id: item.id,
      owner: item.owner,
      key: item.key,
      url: item.url,
      name: item.name,
      bytes: item.bytes,
      width: item.width,
      height: item.height,
      usage: item.usage,
      dateCreated: item.dateCreated,
      dateLastUpdated: item.dateLastUpdated,
    };
  }

  protected hydrateItem(item: UnhydratedHostedImage): HostedImage {
    return { ...item };
  }

  protected async hydrateItems(items: UnhydratedHostedImage[]): Promise<HostedImage[]> {
    return items.map((item) => this.hydrateItem(item));
  }

  public async getById(id: string): Promise<HostedImage | undefined> {
    return this.get({
      PK: this.typedKey(id),
      SK: this.itemType(),
    });
  }

  /**
   * Queries a user's hosted images, newest first, with pagination.
   */
  public async queryByOwner(
    ownerId: string,
    lastKey?: Record<string, any>,
  ): Promise<{
    items: HostedImage[];
    lastKey?: Record<string, any>;
  }> {
    const params: QueryCommandInput = {
      TableName: this.tableName,
      IndexName: 'GSI1',
      KeyConditionExpression: 'GSI1PK = :pk',
      ExpressionAttributeValues: {
        ':pk': `${this.itemType()}#OWNER#${ownerId}`,
      },
      ScanIndexForward: false,
      ExclusiveStartKey: lastKey,
    };

    return this.query(params);
  }

  /**
   * Returns the total image count and stored bytes for a user, for quota enforcement.
   */
  public async getUsageForOwner(ownerId: string): Promise<{ count: number; bytes: number }> {
    let count = 0;
    let bytes = 0;
    let lastKey: Record<string, any> | undefined;

    do {
      const result = await this.queryByOwner(ownerId, lastKey);
      for (const image of result.items) {
        count += 1;
        bytes += image.bytes || 0;
      }
      lastKey = result.lastKey;
    } while (lastKey);

    return { count, bytes };
  }

  /**
   * Creates a new hosted image record with a generated id and timestamps.
   */
  public async createImage(
    partial: Omit<UnhydratedHostedImage, 'id' | 'dateCreated' | 'dateLastUpdated'> & { id?: string },
  ): Promise<HostedImage> {
    const now = Date.now();
    const image: HostedImage = {
      id: partial.id || uuidv4(),
      owner: partial.owner,
      key: partial.key,
      url: partial.url,
      name: partial.name,
      bytes: partial.bytes,
      width: partial.width,
      height: partial.height,
      usage: partial.usage,
      dateCreated: now,
      dateLastUpdated: now,
    };

    await this.put(image);
    return image;
  }
}
