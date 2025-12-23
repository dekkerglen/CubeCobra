import { DynamoDBDocumentClient, QueryCommandInput } from '@aws-sdk/lib-dynamodb';
import Comment, { UnhydratedComment } from '@utils/datatypes/Comment';
import { CubeImage } from '@utils/datatypes/Cube';
import User from '@utils/datatypes/User';
import { getImageData } from 'serverutils/imageutil';
import { v4 as uuidv4 } from 'uuid';

import { BaseDynamoDao } from './BaseDynamoDao';
import { UserDynamoDao } from './UserDynamoDao';

export class CommentDynamoDao extends BaseDynamoDao<Comment, UnhydratedComment> {
  private readonly userDao: UserDynamoDao;

  constructor(dynamoClient: DynamoDBDocumentClient, userDao: UserDynamoDao, tableName: string) {
    super(dynamoClient, tableName);
    this.userDao = userDao;
  }

  protected itemType(): string {
    return 'COMMENT';
  }

  /**
   * Gets the partition key for a comment.
   */
  protected partitionKey(item: Comment): string {
    return this.typedKey(item.id);
  }

  /**
   * Gets the GSI keys for the comment.
   * GSI1: Query by parent and date
   * GSI2: Query by owner and date
   */
  protected GSIKeys(item: Comment): {
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
      GSI1PK: item.parent ? `${this.itemType()}#PARENT#${item.parent}` : undefined,
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
   * Dehydrates a Comment to UnhydratedComment for storage.
   */
  protected dehydrateItem(item: Comment): UnhydratedComment {
    return {
      id: item.id,
      parent: item.parent,
      type: item.type,
      owner: item.owner ? item.owner.id : undefined,
      body: item.body,
      date: item.date,
      dateCreated: item.dateCreated,
      dateLastUpdated: item.dateLastUpdated,
    };
  }

  /**
   * Hydrates a single UnhydratedComment to Comment.
   */
  protected async hydrateItem(item: UnhydratedComment): Promise<Comment> {
    if (!item.owner || item.owner === 'null' || item.owner === '404') {
      return this.createHydratedCommentWithoutOwner(item);
    }

    const owner = await this.userDao.getById(item.owner);
    if (!owner) {
      return this.createHydratedCommentWithoutOwner(item);
    }

    return this.createHydratedComment(item, owner, getImageData(owner.imageName));
  }

  /**
   * Hydrates multiple UnhydratedComments to Comments (optimized batch operation).
   */
  protected async hydrateItems(items: UnhydratedComment[]): Promise<Comment[]> {
    if (items.length === 0) {
      return [];
    }

    const ownerIds = items
      .filter((item) => item.owner && item.owner !== 'null' && item.owner !== '404')
      .map((item) => item.owner) as string[];

    const owners = ownerIds.length > 0 ? await this.userDao.batchGet(ownerIds) : [];

    return items.map((item) => {
      if (!item.owner || item.owner === 'null' || item.owner === '404') {
        return this.createHydratedCommentWithoutOwner(item);
      }

      const owner = owners.find((o: User) => o.id === item.owner);
      if (!owner) {
        return this.createHydratedCommentWithoutOwner(item);
      }

      return this.createHydratedComment(item, owner, getImageData(owner.imageName));
    });
  }

  /**
   * Helper method to create a hydrated comment.
   */
  private createHydratedComment(document: UnhydratedComment, owner: User, image: CubeImage): Comment {
    return {
      id: document.id!,
      parent: document.parent,
      date: document.date,
      type: document.type,
      body: document.body,
      owner: owner,
      image: image,
      dateCreated: document.dateCreated,
      dateLastUpdated: document.dateLastUpdated,
    };
  }

  /**
   * Helper method to create a hydrated comment with anonymous user.
   */
  private createHydratedCommentWithoutOwner(item: UnhydratedComment): Comment {
    return this.createHydratedComment(item, this.getAnonymousUser(), getImageData('Ambush Viper'));
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
   * Gets a comment by ID.
   */
  public async getById(id: string): Promise<Comment | undefined> {
    return this.get({
      PK: this.typedKey(id),
      SK: this.itemType(),
    });
  }

  /**
   * Queries comments by parent, ordered by date descending, with pagination.
   */
  public async queryByParent(
    parent: string,
    lastKey?: Record<string, any>,
    limit: number = 10,
  ): Promise<{
    items: Comment[];
    lastKey?: Record<string, any>;
  }> {
    const params: QueryCommandInput = {
      TableName: this.tableName,
      IndexName: 'GSI1',
      KeyConditionExpression: 'GSI1PK = :parent',
      ExpressionAttributeValues: {
        ':parent': `${this.itemType()}#PARENT#${parent}`,
      },
      ScanIndexForward: false,
      Limit: limit,
      ExclusiveStartKey: lastKey,
    };

    return this.query(params);
  }

  /**
   * Queries comments by owner, ordered by date descending, with pagination.
   */
  public async queryByOwner(
    owner: string,
    lastKey?: Record<string, any>,
  ): Promise<{
    items: Comment[];
    lastKey?: Record<string, any>;
  }> {
    const params: QueryCommandInput = {
      TableName: this.tableName,
      IndexName: 'GSI2',
      KeyConditionExpression: 'GSI2PK = :owner',
      ExpressionAttributeValues: {
        ':owner': `${this.itemType()}#OWNER#${owner}`,
      },
      ScanIndexForward: false,
      ExclusiveStartKey: lastKey,
    };

    return this.query(params);
  }

  /**
   * Puts a comment.
   */
  public async put(item: Comment): Promise<void> {
    await super.put(item);
  }

  /**
   * Updates a comment.
   */
  public async update(item: Comment): Promise<void> {
    await super.update(item);
  }

  /**
   * Deletes a comment.
   */
  public async delete(item: Comment): Promise<void> {
    await super.delete(item);
  }

  /**
   * Creates a new comment with generated ID if not provided.
   */
  public async createComment(comment: Omit<Comment, 'id'>): Promise<Comment> {
    const id = uuidv4();
    const date = comment.date || Date.now();

    const newComment: Comment = {
      id,
      parent: comment.parent!,
      type: comment.type!,
      owner: comment.owner!,
      body: comment.body!,
      date,
      image: comment.image,
      dateCreated: comment.dateCreated || date,
      dateLastUpdated: comment.dateLastUpdated || date,
    };

    await this.put(newComment);
    return newComment;
  }
}
