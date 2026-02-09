import { DynamoDBDocumentClient, QueryCommandInput } from '@aws-sdk/lib-dynamodb';
import { CardMetadataTask, CardMetadataTaskStatus, NewCardMetadataTask } from '@utils/datatypes/CardMetadataTask';
import { v4 as uuidv4 } from 'uuid';

import { BaseDynamoDao } from './BaseDynamoDao';

export class CardMetadataTaskDynamoDao extends BaseDynamoDao<CardMetadataTask, CardMetadataTask> {
  constructor(dynamoClient: DynamoDBDocumentClient, tableName: string) {
    super(dynamoClient, tableName);
  }

  protected itemType(): string {
    return 'CARD_METADATA_TASK';
  }

  /**
   * Gets the partition key for a card metadata task.
   */
  protected partitionKey(item: CardMetadataTask): string {
    return this.typedKey(item.id);
  }

  /**
   * Gets the GSI keys for the card metadata task.
   * GSI1: List all tasks in timestamp order (static PK)
   */
  protected GSIKeys(item: CardMetadataTask): {
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
      GSI2PK: undefined,
      GSI2SK: undefined,
      GSI3PK: undefined,
      GSI3SK: undefined,
      GSI4PK: undefined,
      GSI4SK: undefined,
    };
  }

  /**
   * Dehydrates a CardMetadataTask (no-op since CardMetadataTask is already flat).
   */
  protected dehydrateItem(item: CardMetadataTask): CardMetadataTask {
    return {
      id: item.id,
      status: item.status,
      timestamp: item.timestamp,
      step: item.step,
      completedSteps: item.completedSteps || [],
      stepTimestamps: item.stepTimestamps || {},
      taskArn: item.taskArn,
      errorMessage: item.errorMessage,
      startedAt: item.startedAt,
      completedAt: item.completedAt,
      dateCreated: item.dateCreated,
      dateLastUpdated: item.dateLastUpdated,
    };
  }

  /**
   * Hydrates a single CardMetadataTask (no-op since no external references).
   */
  protected async hydrateItem(item: CardMetadataTask): Promise<CardMetadataTask> {
    return item;
  }

  /**
   * Hydrates multiple CardMetadataTasks (no-op since no external references).
   */
  protected async hydrateItems(items: CardMetadataTask[]): Promise<CardMetadataTask[]> {
    return items;
  }

  /**
   * Gets a card metadata task by ID.
   */
  public async getById(id: string): Promise<CardMetadataTask | undefined> {
    return this.get({
      PK: this.typedKey(id),
      SK: this.itemType(),
    });
  }

  /**
   * Creates a new card metadata task.
   */
  public async create(newTask: NewCardMetadataTask): Promise<CardMetadataTask> {
    const now = Date.now();
    const task: CardMetadataTask = {
      id: uuidv4(),
      status: newTask.status,
      timestamp: now,
      step: newTask.step,
      completedSteps: [],
      stepTimestamps: { [newTask.step]: now },
      errorMessage: newTask.errorMessage,
      startedAt: newTask.status === CardMetadataTaskStatus.IN_PROGRESS ? now : undefined,
      dateCreated: now,
      dateLastUpdated: now,
    };

    await this.put(task);
    return task;
  }

  /**
   * Marks a task as started.
   */
  public async markAsStarted(id: string): Promise<CardMetadataTask | undefined> {
    const task = await this.getById(id);
    if (!task) return undefined;

    task.status = CardMetadataTaskStatus.IN_PROGRESS;
    task.startedAt = Date.now();
    task.dateLastUpdated = Date.now();
    await this.update(task);
    return task;
  }

  /**
   * Marks a task as completed.
   */
  public async markAsCompleted(id: string): Promise<CardMetadataTask | undefined> {
    const task = await this.getById(id);
    if (!task) return undefined;

    // Move current step to completed steps if it exists and isn't already there
    if (task.step && !task.completedSteps.includes(task.step)) {
      task.completedSteps.push(task.step);
    }

    task.status = CardMetadataTaskStatus.COMPLETED;
    task.completedAt = Date.now();
    task.dateLastUpdated = Date.now();
    await this.update(task);
    return task;
  }

  /**
   * Marks a task as failed.
   */
  public async markAsFailed(id: string, errorMessage: string): Promise<CardMetadataTask | undefined> {
    const task = await this.getById(id);
    if (!task) return undefined;

    task.status = CardMetadataTaskStatus.FAILED;
    task.errorMessage = errorMessage;
    task.completedAt = Date.now();
    task.dateLastUpdated = Date.now();
    await this.update(task);
    return task;
  }

  /**
   * Updates the step of a task.
   */
  public async updateStep(id: string, step: string): Promise<CardMetadataTask | undefined> {
    const task = await this.getById(id);
    if (!task) return undefined;

    // If this is a new step, add old step to completed steps
    if (task.step && task.step !== step && !task.completedSteps.includes(task.step)) {
      task.completedSteps.push(task.step);
    }

    task.step = step;
    task.stepTimestamps[step] = Date.now();
    task.dateLastUpdated = Date.now();
    await this.update(task);
    return task;
  }

  /**
   * Gets the most recent task.
   */
  public async getMostRecent(): Promise<CardMetadataTask | undefined> {
    const input: QueryCommandInput = {
      TableName: this.tableName,
      IndexName: 'GSI1',
      KeyConditionExpression: 'GSI1PK = :pk',
      ExpressionAttributeValues: {
        ':pk': `${this.itemType()}#ALL`,
      },
      ScanIndexForward: false, // descending order
      Limit: 1,
    };

    const result = await this.query(input);
    return result.items.length > 0 ? result.items[0] : undefined;
  }

  /**
   * Gets the most recent successful task.
   */
  public async getMostRecentSuccessful(): Promise<CardMetadataTask | undefined> {
    const input: QueryCommandInput = {
      TableName: this.tableName,
      IndexName: 'GSI1',
      KeyConditionExpression: 'GSI1PK = :pk',
      ExpressionAttributeValues: {
        ':pk': `${this.itemType()}#ALL`,
      },
      ScanIndexForward: false, // descending order
      Limit: 50, // Look at last 50 tasks to find the most recent successful one
    };

    const result = await this.query(input);
    return result.items.find((task) => task.status === CardMetadataTaskStatus.COMPLETED);
  }

  /**
   * Lists all tasks, ordered by timestamp.
   */
  public async listAll(limit?: number): Promise<{ items: CardMetadataTask[]; lastKey?: any }> {
    const input: QueryCommandInput = {
      TableName: this.tableName,
      IndexName: 'GSI1',
      KeyConditionExpression: 'GSI1PK = :pk',
      ExpressionAttributeValues: {
        ':pk': `${this.itemType()}#ALL`,
      },
      ScanIndexForward: false, // descending order
      Limit: limit,
    };

    return this.query(input);
  }
}
