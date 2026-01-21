import { DynamoDBDocumentClient, QueryCommandInput } from '@aws-sdk/lib-dynamodb';
import { CardUpdateTask, CardUpdateTaskStatus, NewCardUpdateTask } from '@utils/datatypes/CardUpdateTask';
import { v4 as uuidv4 } from 'uuid';

import { BaseDynamoDao } from './BaseDynamoDao';

export class CardUpdateTaskDynamoDao extends BaseDynamoDao<CardUpdateTask, CardUpdateTask> {
  constructor(dynamoClient: DynamoDBDocumentClient, tableName: string) {
    super(dynamoClient, tableName);
  }

  protected itemType(): string {
    return 'CARD_UPDATE_TASK';
  }

  /**
   * Gets the partition key for a card update task.
   */
  protected partitionKey(item: CardUpdateTask): string {
    return this.typedKey(item.id);
  }

  /**
   * Gets the GSI keys for the card update task.
   * GSI1: List all tasks in timestamp order (static PK)
   * GSI2: Query by checksum (find tasks with specific checksum)
   */
  protected GSIKeys(item: CardUpdateTask): {
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
      GSI1PK: `${this.itemType()}#ALL`,
      GSI1SK: `TIMESTAMP#${item.timestamp}`,
      GSI2PK: `${this.itemType()}#CHECKSUM#${item.checksum}`,
      GSI2SK: `TIMESTAMP#${item.timestamp}`,
      GSI3PK: undefined,
      GSI3SK: undefined,
      GSI4PK: undefined,
      GSI4SK: undefined,
    };
  }

  /**
   * Dehydrates a CardUpdateTask (no-op since CardUpdateTask is already flat).
   */
  protected dehydrateItem(item: CardUpdateTask): CardUpdateTask {
    return {
      id: item.id,
      status: item.status,
      timestamp: item.timestamp,
      checksum: item.checksum,
      scryfallUpdatedAt: item.scryfallUpdatedAt,
      scryfallFileSize: item.scryfallFileSize,
      cardsAdded: item.cardsAdded,
      cardsRemoved: item.cardsRemoved,
      totalCards: item.totalCards,
      step: item.step,
      completedSteps: item.completedSteps || [],
      taskArn: item.taskArn,
      errorMessage: item.errorMessage,
      startedAt: item.startedAt,
      completedAt: item.completedAt,
      dateCreated: item.dateCreated,
      dateLastUpdated: item.dateLastUpdated,
    };
  }

  /**
   * Hydrates a single CardUpdateTask (no-op since no external references).
   */
  protected async hydrateItem(item: CardUpdateTask): Promise<CardUpdateTask> {
    return item;
  }

  /**
   * Hydrates multiple CardUpdateTasks (no-op since no external references).
   */
  protected async hydrateItems(items: CardUpdateTask[]): Promise<CardUpdateTask[]> {
    return items;
  }

  /**
   * Gets a card update task by ID.
   */
  public async getById(id: string): Promise<CardUpdateTask | undefined> {
    return this.get({
      PK: this.typedKey(id),
      SK: this.itemType(),
    });
  }

  /**
   * Creates a new card update task.
   */
  public async create(newTask: NewCardUpdateTask): Promise<CardUpdateTask> {
    const now = Date.now();
    const task: CardUpdateTask = {
      id: uuidv4(),
      status: newTask.status,
      timestamp: now,
      checksum: newTask.checksum,
      scryfallUpdatedAt: newTask.scryfallUpdatedAt,
      scryfallFileSize: newTask.scryfallFileSize,
      cardsAdded: newTask.cardsAdded,
      cardsRemoved: newTask.cardsRemoved,
      totalCards: newTask.totalCards,
      step: newTask.step,
      completedSteps: [],
      errorMessage: newTask.errorMessage,
      startedAt: newTask.status === CardUpdateTaskStatus.IN_PROGRESS ? now : undefined,
      dateCreated: now,
      dateLastUpdated: now,
    };

    await this.put(task);
    return task;
  }

  /**
   * Marks a task as started.
   */
  public async markAsStarted(id: string): Promise<CardUpdateTask | undefined> {
    const task = await this.getById(id);
    if (!task) return undefined;

    task.status = CardUpdateTaskStatus.IN_PROGRESS;
    task.startedAt = Date.now();
    task.dateLastUpdated = Date.now();
    await this.update(task);
    return task;
  }

  /**
   * Marks a task as completed.
   */
  public async markAsCompleted(id: string): Promise<CardUpdateTask | undefined> {
    const task = await this.getById(id);
    if (!task) return undefined;

    task.status = CardUpdateTaskStatus.COMPLETED;
    task.completedAt = Date.now();
    task.dateLastUpdated = Date.now();
    await this.update(task);
    return task;
  }

  /**
   * Marks a task as failed with an error message.
   */
  public async markAsFailed(id: string, errorMessage: string): Promise<CardUpdateTask | undefined> {
    const task = await this.getById(id);
    if (!task) return undefined;

    task.status = CardUpdateTaskStatus.FAILED;
    task.errorMessage = errorMessage;
    task.completedAt = Date.now();
    task.dateLastUpdated = Date.now();
    await this.update(task);
    return task;
  }

  /**
   * Lists all tasks ordered by timestamp descending, with pagination.
   */
  public async listAll(
    limit: number = 50,
    lastKey?: Record<string, any>,
  ): Promise<{
    items: CardUpdateTask[];
    lastKey?: Record<string, any>;
  }> {
    const input: QueryCommandInput = {
      TableName: this.tableName,
      IndexName: 'GSI1',
      KeyConditionExpression: 'GSI1PK = :pk',
      ExpressionAttributeValues: {
        ':pk': `${this.itemType()}#ALL`,
      },
      ScanIndexForward: false, // Descending order by timestamp
      Limit: limit,
      ExclusiveStartKey: lastKey,
    };

    return this.query(input);
  }

  /**
   * Queries tasks by checksum, ordered by timestamp descending.
   */
  public async getByChecksum(
    checksum: string,
    limit: number = 50,
    lastKey?: Record<string, any>,
  ): Promise<{
    items: CardUpdateTask[];
    lastKey?: Record<string, any>;
  }> {
    const input: QueryCommandInput = {
      TableName: this.tableName,
      IndexName: 'GSI2',
      KeyConditionExpression: 'GSI2PK = :pk',
      ExpressionAttributeValues: {
        ':pk': `${this.itemType()}#CHECKSUM#${checksum}`,
      },
      ScanIndexForward: false, // Descending order by timestamp
      Limit: limit,
      ExclusiveStartKey: lastKey,
    };

    return this.query(input);
  }

  /**
   * Gets the most recent task (by timestamp).
   */
  public async getMostRecent(): Promise<CardUpdateTask | undefined> {
    const result = await this.listAll(1);
    return result.items.length > 0 ? result.items[0] : undefined;
  }

  /**
   * Updates the step of a task.
   */
  public async updateStep(id: string, step: string): Promise<CardUpdateTask | undefined> {
    const task = await this.getById(id);
    if (!task) return undefined;
    // Move current step to completed steps if it exists
    if (task.step && !task.completedSteps.includes(task.step)) {
      task.completedSteps.push(task.step);
    }

    task.step = step;
    task.dateLastUpdated = Date.now();
    await this.update(task);
    return task;
  }
}
