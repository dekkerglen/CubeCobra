import { DynamoDBDocumentClient, QueryCommandInput } from '@aws-sdk/lib-dynamodb';
import { ContentStatus, ContentType, UnhydratedContent } from '@utils/datatypes/Content';
import Episode from '@utils/datatypes/Episode';
import User from '@utils/datatypes/User';
import { v4 as uuidv4 } from 'uuid';

import { getBucketName, getObject, putObject } from '../s3client';
import { BaseDynamoDao } from './BaseDynamoDao';
import { UserDynamoDao } from './UserDynamoDao';

interface UnhydratedEpisode extends UnhydratedContent {
  podcast?: string;
  podcastName?: string;
  podcastGuid?: string;
}

export class EpisodeDynamoDao extends BaseDynamoDao<Episode, UnhydratedEpisode> {
  private readonly userDao: UserDynamoDao;

  constructor(dynamoClient: DynamoDBDocumentClient, userDao: UserDynamoDao, tableName: string) {
    super(dynamoClient, tableName);
    this.userDao = userDao;
  }

  protected itemType(): string {
    return 'EPISODE';
  }

  /**
   * Gets the partition key for an episode.
   */
  protected partitionKey(item: Episode): string {
    return this.typedKey(item.id);
  }

  /**
   * Gets the GSI keys for the episode.
   * GSI1: Query by status with date sorting
   * GSI2: Query by owner with date sorting
   * GSI3: Query by podcast and date (for getting all episodes of a podcast)
   */
  protected GSIKeys(item: Episode): {
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
      GSI3PK: item.podcast ? `${this.itemType()}#PODCAST#${item.podcast}` : undefined,
      GSI3SK: item.date ? `DATE#${item.date}` : undefined,
      GSI4PK: undefined,
      GSI4SK: undefined,
    };
  }

  /**
   * Dehydrates an Episode to UnhydratedEpisode for storage.
   */
  protected dehydrateItem(item: Episode): UnhydratedEpisode {
    const ownerId = typeof item.owner === 'string' ? item.owner : item.owner?.id;

    return {
      id: item.id,
      type: ContentType.EPISODE,
      typeStatusComp: '', // Legacy field, no longer used
      typeOwnerComp: '', // Legacy field, no longer used
      date: item.date,
      status: item.status,
      owner: ownerId!,
      title: item.title,
      short: item.short,
      url: item.url,
      username: item.username,
      podcast: item.podcast,
      podcastName: item.podcastName,
      podcastGuid: item.podcastGuid,
      image: item.image,
      imageName: item.imageName,
      dateCreated: item.dateCreated,
      dateLastUpdated: item.dateLastUpdated,
      // body is handled separately via S3
    };
  }

  /**
   * Hydrates a single UnhydratedEpisode to Episode.
   */
  protected async hydrateItem(item: UnhydratedEpisode): Promise<Episode> {
    const owner = item.owner ? await this.userDao.getById(item.owner) : undefined;

    // Load body from S3
    const itemWithBody = await this.addBody(item);

    return {
      ...itemWithBody,
      type: ContentType.EPISODE,
      owner: owner!,
      podcast: item.podcast!,
      podcastName: item.podcastName!,
      podcastGuid: item.podcastGuid!,
    } as Episode;
  }

  /**
   * Hydrates multiple UnhydratedEpisodes to Episodes (optimized batch operation).
   */
  protected async hydrateItems(items: UnhydratedEpisode[]): Promise<Episode[]> {
    if (items.length === 0) {
      return [];
    }

    const ownerIds = items.map((item) => item.owner).filter(Boolean) as string[];

    const owners = ownerIds.length > 0 ? await this.userDao.batchGet(ownerIds) : [];

    const hydrated = items.map((item) => {
      const owner = owners.find((o: User) => o.id === item.owner);

      // Note: body is not loaded during batch hydration for performance
      return {
        ...item,
        type: ContentType.EPISODE,
        owner: owner!,
        podcast: item.podcast!,
        podcastName: item.podcastName!,
        podcastGuid: item.podcastGuid!,
      } as Episode;
    });

    return hydrated;
  }

  /**
   * Adds body content from S3 to the episode.
   */
  private async addBody(content: UnhydratedEpisode): Promise<UnhydratedEpisode> {
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
   * Gets an episode by ID.
   */
  public async getById(id: string): Promise<Episode | undefined> {
    return this.get({
      PK: this.typedKey(id),
      SK: this.itemType(),
    });
  }

  /**
   * Queries episodes by status, ordered by date descending, with pagination.
   */
  public async queryByStatus(
    status: ContentStatus,
    lastKey?: Record<string, any>,
    limit?: number,
  ): Promise<{
    items: Episode[];
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
   * Queries episodes by owner, ordered by date descending, with pagination.
   */
  public async queryByOwner(
    ownerId: string,
    lastKey?: Record<string, any>,
  ): Promise<{
    items: Episode[];
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
   * Queries episodes by podcast, ordered by date descending, with pagination.
   * This is a key query for episodes since they belong to podcasts.
   */
  public async queryByPodcast(
    podcastId: string,
    lastKey?: Record<string, any>,
    status?: ContentStatus,
  ): Promise<{
    items: Episode[];
    lastKey?: Record<string, any>;
  }> {
    const params: QueryCommandInput = {
      TableName: this.tableName,
      IndexName: 'GSI3',
      KeyConditionExpression: 'GSI3PK = :pk',
      ExpressionAttributeValues: {
        ':pk': `${this.itemType()}#PODCAST#${podcastId}`,
      },
      ScanIndexForward: false,
      ExclusiveStartKey: lastKey,
    };

    // Add filter condition if status is provided
    if (status) {
      params.FilterExpression = '#status = :status';
      params.ExpressionAttributeValues = {
        ...params.ExpressionAttributeValues,
        ':status': status,
      };
      params.ExpressionAttributeNames = {
        '#status': 'status',
      };
    }

    return this.query(params);
  }

  /**
   * Queries episodes by podcast and status, ordered by date descending.
   * This combines podcast filtering with status filtering.
   */
  public async queryByPodcastAndStatus(
    podcastId: string,
    status: ContentStatus,
    lastKey?: Record<string, any>,
  ): Promise<{
    items: Episode[];
    lastKey?: Record<string, any>;
  }> {
    const gsi3pk = `EPISODE#PODCAST#${podcastId}`;
    console.log(`[EpisodeDao.queryByPodcastAndStatus] Querying GSI3 with PK: ${gsi3pk}, status filter: ${status}`);

    const params: QueryCommandInput = {
      TableName: this.tableName,
      IndexName: 'GSI3',
      KeyConditionExpression: 'GSI3PK = :pk',
      FilterExpression: 'item.#status = :status',
      ExpressionAttributeValues: {
        ':pk': gsi3pk,
        ':status': status,
      },
      ExpressionAttributeNames: {
        '#status': 'status',
      },
      ScanIndexForward: false,
      ExclusiveStartKey: lastKey,
    };

    const result = await this.query(params);
    console.log(`[EpisodeDao.queryByPodcastAndStatus] Query returned ${result.items?.length || 0} items`);
    if (result.items && result.items.length > 0 && result.items[0]) {
      console.log(
        `[EpisodeDao.queryByPodcastAndStatus] First item GSI3PK should be: ${gsi3pk}, podcast field: ${result.items[0].podcast}`,
      );
    }
    return result;
  }

  /**
   * Overrides put to handle S3 body storage and support dual writes.
   */
  public async put(item: Episode): Promise<void> {
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
  public async update(item: Episode): Promise<void> {
    // Store body to S3
    if (item.body) {
      await this.putBody(item.id, item.body);
    }

    await super.update(item);
  }

  /**
   * Overrides delete to support dual writes.
   */
  public async delete(item: Episode): Promise<void> {
    await super.delete(item);
  }

  /**
   * Batch put episodes.
   */
  public async batchPut(items: Episode[]): Promise<void> {
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
   * Creates a new episode with generated ID and proper defaults.
   */
  public async createEpisode(
    partial: Omit<
      UnhydratedEpisode,
      'id' | 'type' | 'typeStatusComp' | 'typeOwnerComp' | 'dateCreated' | 'dateLastUpdated'
    > &
      Partial<Pick<UnhydratedEpisode, 'status' | 'date'>> & {
        podcast: string;
        podcastName: string;
        podcastGuid: string;
      },
  ): Promise<string> {
    const id = uuidv4();
    const now = Date.now();
    const date = partial.date || now;

    const episode: Episode = {
      id,
      type: ContentType.EPISODE,
      typeStatusComp: '', // Legacy field, no longer used
      typeOwnerComp: '', // Legacy field, no longer used
      date,
      status: partial.status || ContentStatus.DRAFT,
      owner: { id: partial.owner } as any,
      title: partial.title,
      short: partial.short,
      image: partial.image,
      body: partial.body,
      url: partial.url,
      username: partial.username,
      podcast: partial.podcast,
      podcastName: partial.podcastName,
      podcastGuid: partial.podcastGuid,
      dateCreated: now,
      dateLastUpdated: now,
    };

    await this.put(episode);
    return id;
  }
}
