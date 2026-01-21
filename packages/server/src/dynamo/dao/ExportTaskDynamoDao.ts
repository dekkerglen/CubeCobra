import { DynamoDBDocumentClient, QueryCommandInput } from '@aws-sdk/lib-dynamodb';
import { ExportTask, ExportTaskStatus, NewExportTask } from '@utils/datatypes/ExportTask';
import { v4 as uuidv4 } from 'uuid';

import { BaseDynamoDao } from './BaseDynamoDao';

export class ExportTaskDynamoDao extends BaseDynamoDao<ExportTask, ExportTask> {
  constructor(dynamoClient: DynamoDBDocumentClient, tableName: string) {
    super(dynamoClient, tableName);
  }

  protected itemType(): string {
    return 'EXPORT_TASK';
  }

  /**
   * Gets the partition key for an export task.
   */
  protected partitionKey(item: ExportTask): string {
    return this.typedKey(item.id);
  }

  /**
   * Gets the GSI keys for the export task.
   * GSI1: List all tasks in timestamp order (static PK)
   * GSI2: Query by export type (find tasks with specific type)
   */
  protected GSIKeys(item: ExportTask): {
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
      GSI2PK: `${this.itemType()}#TYPE#${item.exportType}`,
      GSI2SK: `TIMESTAMP#${item.timestamp}`,
      GSI3PK: undefined,
      GSI3SK: undefined,
      GSI4PK: undefined,
      GSI4SK: undefined,
    };
  }

  /**
   * Dehydrates an ExportTask (no-op since ExportTask is already flat).
   */
  protected dehydrateItem(item: ExportTask): ExportTask {
    return {
      id: item.id,
      status: item.status,
      timestamp: item.timestamp,
      exportType: item.exportType,
      fileSize: item.fileSize,
      totalRecords: item.totalRecords,
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
   * Hydrates a single ExportTask (no-op since no external references).
   */
  protected async hydrateItem(item: ExportTask): Promise<ExportTask> {
    return item;
  }

  /**
   * Hydrates multiple ExportTasks (no-op since no external references).
   */
  protected async hydrateItems(items: ExportTask[]): Promise<ExportTask[]> {
    return items;
  }

  /**
   * Gets an export task by ID.
   */
  public async getById(id: string): Promise<ExportTask | undefined> {
    return this.get({
      PK: this.typedKey(id),
      SK: this.itemType(),
    });
  }

  /**
   * Creates a new export task.
   */
  public async create(newTask: NewExportTask): Promise<ExportTask> {
    const now = Date.now();
    const task: ExportTask = {
      id: uuidv4(),
      status: newTask.status,
      timestamp: now,
      exportType: newTask.exportType,
      fileSize: newTask.fileSize,
      totalRecords: newTask.totalRecords,
      step: newTask.step,
      completedSteps: [],
      errorMessage: newTask.errorMessage,
      startedAt: newTask.status === ExportTaskStatus.IN_PROGRESS ? now : undefined,
      dateCreated: now,
      dateLastUpdated: now,
    };

    await this.put(task);
    return task;
  }

  /**
   * Marks a task as started.
   */
  public async markAsStarted(id: string): Promise<ExportTask | undefined> {
    const task = await this.getById(id);
    if (!task) return undefined;

    task.status = ExportTaskStatus.IN_PROGRESS;
    task.startedAt = Date.now();
    task.dateLastUpdated = Date.now();
    await this.update(task);
    return task;
  }

  /**
   * Marks a task as completed.
   */
  public async markAsCompleted(id: string): Promise<ExportTask | undefined> {
    const task = await this.getById(id);
    if (!task) return undefined;

    task.status = ExportTaskStatus.COMPLETED;
    task.completedAt = Date.now();
    task.dateLastUpdated = Date.now();
    await this.update(task);
    return task;
  }

  /**
   * Marks a task as failed with an error message.
   */
  public async markAsFailed(id: string, errorMessage: string): Promise<ExportTask | undefined> {
    const task = await this.getById(id);
    if (!task) return undefined;

    task.status = ExportTaskStatus.FAILED;
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
    items: ExportTask[];
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
   * Queries tasks by export type, ordered by timestamp descending.
   */
  public async getByExportType(
    exportType: string,
    limit: number = 50,
    lastKey?: Record<string, any>,
  ): Promise<{
    items: ExportTask[];
    lastKey?: Record<string, any>;
  }> {
    const input: QueryCommandInput = {
      TableName: this.tableName,
      IndexName: 'GSI2',
      KeyConditionExpression: 'GSI2PK = :pk',
      ExpressionAttributeValues: {
        ':pk': `${this.itemType()}#TYPE#${exportType}`,
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
  public async getMostRecent(): Promise<ExportTask | undefined> {
    const result = await this.listAll(1);
    return result.items.length > 0 ? result.items[0] : undefined;
  }

  /**
   * Gets the most recent successful task (by timestamp).
   */
  public async getMostRecentSuccessful(): Promise<ExportTask | undefined> {
    const result = await this.listAll(50);
    return result.items.find((task) => task.status === ExportTaskStatus.COMPLETED);
  }

  /**
   * Updates the step of a task.
   */
  public async updateStep(id: string, step: string): Promise<ExportTask | undefined> {
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
