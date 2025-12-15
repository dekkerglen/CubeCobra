import { DynamoDBDocumentClient, QueryCommandInput } from '@aws-sdk/lib-dynamodb';
import BlogPost, { UnhydratedBlogPost } from '@utils/datatypes/BlogPost';
import { Changes } from '@utils/datatypes/Card';
import CubeType from '@utils/datatypes/Cube';
import UserType from '@utils/datatypes/User';
import { v4 as uuidv4 } from 'uuid';

import BlogModel from '../models/blog';
import { BaseDynamoDao } from './BaseDynamoDao';
import { ChangelogDynamoDao } from './ChangelogDynamoDao';
import { CubeDynamoDao } from './CubeDynamoDao';
import { UserDynamoDao } from './UserDynamoDao';

export class BlogDynamoDao extends BaseDynamoDao<BlogPost, UnhydratedBlogPost> {
  private readonly dualWriteEnabled: boolean;
  private readonly changelogDao: ChangelogDynamoDao;
  private readonly cubeDao: CubeDynamoDao;
  private readonly userDao: UserDynamoDao;

  constructor(
    dynamoClient: DynamoDBDocumentClient,
    changelogDao: ChangelogDynamoDao,
    cubeDao: CubeDynamoDao,
    userDao: UserDynamoDao,
    tableName: string,
    dualWriteEnabled: boolean = false,
  ) {
    super(dynamoClient, tableName);
    this.dualWriteEnabled = dualWriteEnabled;
    this.changelogDao = changelogDao;
    this.cubeDao = cubeDao;
    this.userDao = userDao;
  }

  protected itemType(): string {
    return 'BLOG';
  }

  /**
   * Gets the partition key for a blog post.
   */
  protected partitionKey(item: BlogPost): string {
    return this.typedKey(item.id);
  }

  /**
   * Gets the GSI keys for the blog post.
   * GSI1: Query by cube and date
   * GSI2: Query by owner and date
   */
  protected GSIKeys(item: BlogPost): {
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
      GSI1PK: item.cube ? `${this.itemType()}#CUBE#${item.cube}` : undefined,
      GSI1SK: item.date ? `DATE#${item.date}` : undefined,
      GSI2PK: item.owner?.id ? `${this.itemType()}#OWNER#${item.owner.id}` : undefined,
      GSI2SK: item.date ? `DATE#${item.date}` : undefined,
      GSI3PK: undefined,
      GSI3SK: undefined,
      GSI4PK: undefined,
      GSI4SK: undefined,
    };
  }

  /**
   * Dehydrates a BlogPost to UnhydratedBlogPost for storage.
   */
  protected dehydrateItem(item: BlogPost): UnhydratedBlogPost {
    return {
      id: item.id,
      body: item.body,
      owner: item.owner ? item.owner.id : '',
      date: item.date,
      dateCreated: item.dateCreated,
      dateLastUpdated: item.dateLastUpdated,
      cube: item.cube,
      title: item.title,
      changelist: item.changelist, // Preserve the changelog ID reference
    };
  }

  /**
   * Hydrates a single UnhydratedBlogPost to BlogPost.
   */
  protected async hydrateItem(item: UnhydratedBlogPost): Promise<BlogPost> {
    let cubeName = 'Unknown';

    const owner = await this.userDao.getById(item.owner);

    if (item.cube && item.cube !== 'DEVBLOG') {
      const cube = await this.cubeDao.getById(item.cube);
      if (cube) {
        cubeName = cube.name;
      }
    }

    if (!item.changelist) {
      return this.createHydratedBlog(item, owner!, cubeName);
    }

    const changelog = await this.changelogDao.getChangelog(item.cube, item.changelist);

    return this.createHydratedBlog(item, owner!, cubeName, changelog);
  }

  /**
   * Hydrates multiple UnhydratedBlogPosts to BlogPosts (optimized batch operation).
   */
  protected async hydrateItems(items: UnhydratedBlogPost[]): Promise<BlogPost[]> {
    if (items.length === 0) {
      return [];
    }

    const ownerIds = items.filter((item) => item.owner).map((item) => item.owner);
    const cubeIds = items.filter((item) => item.cube && item.cube !== 'DEVBLOG').map((item) => item.cube);

    const [owners, cubes] = await Promise.all([
      ownerIds.length > 0 ? this.userDao.batchGet(ownerIds) : Promise.resolve([]),
      cubeIds.length > 0 ? this.cubeDao.batchGet(cubeIds) : Promise.resolve([]),
    ]);

    const changelistKeys = items
      .filter((item) => item.changelist)
      .map((item) => ({ cube: item.cube, id: item.changelist! }));

    const changelists = changelistKeys.length > 0 ? await this.changelogDao.batchGet(changelistKeys) : [];

    // Create a map for efficient changelog lookup
    // Key is changelist ID, value is the changelog data
    const changelogMap = new Map<string, Changes>();
    changelistKeys.forEach((key, index) => {
      if (changelists[index]) {
        changelogMap.set(key.id, changelists[index]);
      }
    });

    return items.map((item) => {
      const owner = owners.find((o: UserType) => o.id === item.owner);
      let cubeName = 'Unknown';

      if (item.cube && item.cube !== 'DEVBLOG') {
        const cube = cubes.find((c: CubeType) => c.id === item.cube);
        if (cube) {
          cubeName = cube.name;
        }
      }

      let changelog: Changes | undefined;
      if (item.changelist) {
        changelog = changelogMap.get(item.changelist);
      }

      return this.createHydratedBlog(item, owner!, cubeName, changelog);
    });
  }

  /**
   * Helper method to create a hydrated blog post.
   */
  private createHydratedBlog(
    document: UnhydratedBlogPost,
    owner: UserType,
    cubeName: string,
    changelog?: Partial<Changes>,
  ): BlogPost {
    return {
      id: document.id!,
      body: document.body || '',
      date: document.date!, // Legacy field
      dateCreated: document.dateCreated,
      dateLastUpdated: document.dateLastUpdated,
      cube: document.cube,
      title: document.title,
      owner: owner,
      cubeName: cubeName,
      changelist: document.changelist, // Preserve the changelog ID
      Changelog: changelog,
    };
  }

  /**
   * Gets a blog post by ID.
   */
  public async getById(id: string): Promise<BlogPost | undefined> {
    if (this.dualWriteEnabled) {
      return BlogModel.getById(id);
    }

    return this.get({
      PK: this.typedKey(id),
      SK: this.itemType(),
    });
  }

  /**
   * Queries blog posts by cube, ordered by date descending, with pagination.
   */
  public async queryByCube(
    cube: string,
    lastKey?: Record<string, any>,
    limit: number = 36,
  ): Promise<{
    items: BlogPost[];
    lastKey?: Record<string, any>;
  }> {
    if (this.dualWriteEnabled) {
      const result = await BlogModel.getByCube(cube, limit, lastKey);
      return {
        items: result.items || [],
        lastKey: result.lastKey,
      };
    }

    const params: QueryCommandInput = {
      TableName: this.tableName,
      IndexName: 'GSI1',
      KeyConditionExpression: 'GSI1PK = :cube',
      ExpressionAttributeValues: {
        ':cube': `${this.itemType()}#CUBE#${cube}`,
      },
      ScanIndexForward: false,
      Limit: limit,
      ExclusiveStartKey: lastKey,
    };

    return this.query(params);
  }

  /**
   * Queries blog posts by owner, ordered by date descending, with pagination.
   */
  public async queryByOwner(
    owner: string,
    lastKey?: Record<string, any>,
    limit: number = 36,
  ): Promise<{
    items: BlogPost[];
    lastKey?: Record<string, any>;
  }> {
    if (this.dualWriteEnabled) {
      const result = await BlogModel.getByOwner(owner, limit, lastKey);
      return {
        items: result.items || [],
        lastKey: result.lastKey,
      };
    }

    const params: QueryCommandInput = {
      TableName: this.tableName,
      IndexName: 'GSI2',
      KeyConditionExpression: 'GSI2PK = :owner',
      ExpressionAttributeValues: {
        ':owner': `${this.itemType()}#OWNER#${owner}`,
      },
      ScanIndexForward: false,
      Limit: limit,
      ExclusiveStartKey: lastKey,
    };

    return this.query(params);
  }

  /**
   * Alias for queryByCube with different parameter order for backward compatibility.
   * @param cube - Cube ID
   * @param limit - Maximum number of results
   * @param lastKey - Pagination key
   */
  public async getByCube(
    cube: string,
    limit: number = 36,
    lastKey?: Record<string, any>,
  ): Promise<{
    items: BlogPost[];
    lastKey?: Record<string, any>;
  }> {
    return this.queryByCube(cube, lastKey, limit);
  }

  /**
   * Creates a new blog post with an auto-generated ID and date.
   */
  public async createBlog(
    item: Omit<UnhydratedBlogPost, 'id' | 'date' | 'dateCreated' | 'dateLastUpdated'>,
  ): Promise<string> {
    const id = uuidv4();
    const date = Date.now();

    const unhydratedItem: UnhydratedBlogPost = {
      ...item,
      id,
      date,
      dateCreated: date,
      dateLastUpdated: date,
    };

    if (this.dualWriteEnabled) {
      // Write to both old and new paths
      await BlogModel.put(unhydratedItem);
    }

    // Hydrate and write to new table
    const hydratedItem = await this.hydrateItem(unhydratedItem);
    await super.put(hydratedItem);

    return id;
  }

  /**
   * Overrides put to support dual writes.
   */
  public async put(item: BlogPost): Promise<void> {
    if (this.dualWriteEnabled) {
      // Write to both old and new paths
      await Promise.all([BlogModel.put(this.dehydrateItem(item)), super.put(item)]);
    } else {
      await super.put(item);
    }
  }

  /**
   * Overrides update to support dual writes.
   */
  public async update(item: BlogPost): Promise<void> {
    if (this.dualWriteEnabled) {
      // Check if item exists in new table first
      const existsInNewTable = await this.get({
        PK: this.partitionKey(item),
        SK: this.itemType(),
      });

      // Write to both old and new paths
      // If item doesn't exist in new table yet, use put instead of update
      await Promise.all([
        BlogModel.put(this.dehydrateItem(item)), // Old model doesn't have separate update
        existsInNewTable ? super.update(item) : super.put(item),
      ]);
    } else {
      await super.update(item);
    }
  }

  /**
   * Overrides delete to support dual writes.
   */
  public async delete(item: BlogPost): Promise<void> {
    if (this.dualWriteEnabled) {
      // Delete from both old and new paths
      await Promise.all([BlogModel.delete(item.id), super.delete(item)]);
    } else {
      await super.delete(item);
    }
  }

  /**
   * Batch put blog posts.
   */
  public async batchPut(items: BlogPost[]): Promise<void> {
    if (this.dualWriteEnabled) {
      await Promise.all([BlogModel.batchPut(items.map((item) => this.dehydrateItem(item))), super.batchPut(items)]);
    } else {
      await super.batchPut(items);
    }
  }
}
