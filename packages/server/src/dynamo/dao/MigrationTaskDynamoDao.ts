import { DynamoDBDocumentClient, QueryCommandInput } from '@aws-sdk/lib-dynamodb';
import { MigrationTask, MigrationTaskStatus, NewMigrationTask } from '@utils/datatypes/MigrationTask';
import { v4 as uuidv4 } from 'uuid';

import { BaseDynamoDao } from './BaseDynamoDao';

export class MigrationTaskDynamoDao extends BaseDynamoDao<MigrationTask, MigrationTask> {
  constructor(dynamoClient: DynamoDBDocumentClient, tableName: string) {
    super(dynamoClient, tableName);
  }

  protected itemType(): string {
    return 'MIGRATION_TASK';
  }

  /**
   * Gets the partition key for a migration task.
   */
  protected partitionKey(item: MigrationTask): string {
    return this.typedKey(item.id);
  }

  /**
   * Gets the GSI keys for the migration task.
   * GSI1: List all tasks in timestamp order (static PK)
   * GSI2: Query by last migration date (find tasks by migration date)
   */
  protected GSIKeys(item: MigrationTask): {
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
      GSI2PK: `${this.itemType()}#MIGRATION_DATE#${item.lastMigrationDate}`,
      GSI2SK: `TIMESTAMP#${item.timestamp}`,
      GSI3PK: undefined,
      GSI3SK: undefined,
      GSI4PK: undefined,
      GSI4SK: undefined,
    };
  }

  /**
   * Dehydrates a MigrationTask (no-op since MigrationTask is already flat).
   */
  protected dehydrateItem(item: MigrationTask): MigrationTask {
    return {
      id: item.id,
      status: item.status,
      timestamp: item.timestamp,
      lastMigrationDate: item.lastMigrationDate,
      migrationsProcessed: item.migrationsProcessed,
      cubesAffected: item.cubesAffected,
      cardsDeleted: item.cardsDeleted,
      cardsMerged: item.cardsMerged,
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
   * Hydrates a single MigrationTask (no-op since no external references).
   */
  protected async hydrateItem(item: MigrationTask): Promise<MigrationTask> {
    return item;
  }

  /**
   * Hydrates multiple MigrationTasks (no-op since no external references).
   */
  protected async hydrateItems(items: MigrationTask[]): Promise<MigrationTask[]> {
    return items;
  }

  /**
   * Gets a migration task by ID.
   */
  public async getById(id: string): Promise<MigrationTask | undefined> {
    return this.get({
      PK: this.typedKey(id),
      SK: this.itemType(),
    });
  }

  /**
   * Creates a new migration task.
   */
  public async create(newTask: NewMigrationTask): Promise<MigrationTask> {
    const now = Date.now();
    const task: MigrationTask = {
      id: uuidv4(),
      status: newTask.status,
      timestamp: now,
      lastMigrationDate: newTask.lastMigrationDate,
      migrationsProcessed: newTask.migrationsProcessed,
      cubesAffected: newTask.cubesAffected,
      cardsDeleted: newTask.cardsDeleted,
      cardsMerged: newTask.cardsMerged,
      step: newTask.step,
      completedSteps: [],
      stepTimestamps: { [newTask.step]: now },
      errorMessage: newTask.errorMessage,
      startedAt: newTask.status === MigrationTaskStatus.IN_PROGRESS ? now : undefined,
      dateCreated: now,
      dateLastUpdated: now,
    };

    await this.put(task);
    return task;
  }

  /**
   * Marks a task as started.
   */
  public async markAsStarted(id: string): Promise<MigrationTask | undefined> {
    const task = await this.getById(id);
    if (!task) return undefined;

    task.status = MigrationTaskStatus.IN_PROGRESS;
    task.startedAt = Date.now();
    task.dateLastUpdated = Date.now();
    await this.update(task);
    return task;
  }

  /**
   * Marks a task as completed.
   */
  public async markAsCompleted(id: string): Promise<MigrationTask | undefined> {
    const task = await this.getById(id);
    if (!task) return undefined;

    // Move current step to completed steps if it exists and isn't already there
    if (task.step && !task.completedSteps.includes(task.step)) {
      task.completedSteps.push(task.step);
    }

    task.status = MigrationTaskStatus.COMPLETED;
    task.completedAt = Date.now();
    task.dateLastUpdated = Date.now();
    await this.update(task);
    return task;
  }

  /**
   * Marks a task as failed with an error message.
   */
  public async markAsFailed(id: string, errorMessage: string): Promise<MigrationTask | undefined> {
    const task = await this.getById(id);
    if (!task) return undefined;

    task.status = MigrationTaskStatus.FAILED;
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
    items: MigrationTask[];
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
   * Gets the most recent task (by timestamp).
   */
  public async getMostRecent(): Promise<MigrationTask | undefined> {
    const result = await this.listAll(1);
    return result.items.length > 0 ? result.items[0] : undefined;
  }

  /**
   * Gets the most recent successful task (by timestamp).
   */
  public async getMostRecentSuccessful(): Promise<MigrationTask | undefined> {
    const result = await this.listAll(50);
    return result.items.find((task) => task.status === MigrationTaskStatus.COMPLETED);
  }

  /**
   * Updates the step of a task.
   */
  public async updateStep(id: string, step: string): Promise<MigrationTask | undefined> {
    const task = await this.getById(id);
    if (!task) return undefined;

    // Move current step to completed steps if it exists
    if (task.step && !task.completedSteps.includes(task.step)) {
      task.completedSteps.push(task.step);
    }

    const now = Date.now();
    task.step = step;
    task.stepTimestamps = task.stepTimestamps || {};
    task.stepTimestamps[step] = now;
    task.dateLastUpdated = now;
    await this.update(task);
    return task;
  }
}
