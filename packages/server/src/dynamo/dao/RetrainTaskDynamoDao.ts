import { DynamoDBDocumentClient, QueryCommandInput } from '@aws-sdk/lib-dynamodb';
import {
  NewRetrainTask,
  PromotionTarget,
  RetrainGate,
  RetrainTask,
  RetrainTaskStatus,
} from '@utils/datatypes/RetrainTask';

import { BaseDynamoDao } from './BaseDynamoDao';

// Records of ML retraining state machine runs. Written by the ML pipeline lambda as the run
// moves through its stages; read and acted on (approve, reject, acknowledge) by the admin page.
export class RetrainTaskDynamoDao extends BaseDynamoDao<RetrainTask, RetrainTask> {
  constructor(dynamoClient: DynamoDBDocumentClient, tableName: string) {
    super(dynamoClient, tableName);
  }

  protected itemType(): string {
    return 'RETRAIN_TASK';
  }

  protected partitionKey(item: RetrainTask): string {
    return this.typedKey(item.id);
  }

  /**
   * GSI1: all runs in timestamp order (static PK)
   * GSI2: runs by status, newest first
   */
  protected GSIKeys(item: RetrainTask): {
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
      GSI2PK: `${this.itemType()}#STATUS#${item.status}`,
      GSI2SK: `TIMESTAMP#${item.timestamp}`,
      GSI3PK: undefined,
      GSI3SK: undefined,
      GSI4PK: undefined,
      GSI4SK: undefined,
    };
  }

  protected dehydrateItem(item: RetrainTask): RetrainTask {
    return {
      id: item.id,
      mode: item.mode,
      status: item.status,
      timestamp: item.timestamp,
      step: item.step,
      completedSteps: item.completedSteps || [],
      stepTimestamps: item.stepTimestamps || {},
      executionArn: item.executionArn,
      version: item.version,
      previousVersion: item.previousVersion,
      exportedAt: item.exportedAt,
      gate: item.gate,
      promotedTo: item.promotedTo || [],
      taskToken: item.taskToken,
      decidedBy: item.decidedBy,
      errorMessage: item.errorMessage,
      acknowledged: item.acknowledged,
      completedAt: item.completedAt,
      dateCreated: item.dateCreated,
      dateLastUpdated: item.dateLastUpdated,
    };
  }

  protected async hydrateItem(item: RetrainTask): Promise<RetrainTask> {
    return item;
  }

  protected async hydrateItems(items: RetrainTask[]): Promise<RetrainTask[]> {
    return items;
  }

  public async getById(id: string): Promise<RetrainTask | undefined> {
    return this.get({
      PK: this.typedKey(id),
      SK: this.itemType(),
    });
  }

  public async create(newTask: NewRetrainTask): Promise<RetrainTask> {
    const now = Date.now();
    const step = 'Starting';
    const task: RetrainTask = {
      id: newTask.id,
      mode: newTask.mode,
      status: RetrainTaskStatus.IN_PROGRESS,
      timestamp: now,
      step,
      completedSteps: [],
      stepTimestamps: { [step]: now },
      executionArn: newTask.executionArn,
      version: newTask.version,
      exportedAt: newTask.exportedAt,
      promotedTo: [],
      dateCreated: now,
      dateLastUpdated: now,
    };

    await this.put(task);
    return task;
  }

  private async modify(id: string, change: (task: RetrainTask) => void): Promise<RetrainTask | undefined> {
    const task = await this.getById(id);
    if (!task) return undefined;
    change(task);
    task.dateLastUpdated = Date.now();
    await this.update(task);
    return task;
  }

  public async updateStep(id: string, step: string): Promise<RetrainTask | undefined> {
    return this.modify(id, (task) => {
      if (task.step && task.step !== step && !task.completedSteps.includes(task.step)) {
        task.completedSteps.push(task.step);
      }
      task.step = step;
      task.stepTimestamps = { ...(task.stepTimestamps || {}), [step]: Date.now() };
    });
  }

  public async setGate(id: string, gate: RetrainGate): Promise<RetrainTask | undefined> {
    return this.modify(id, (task) => {
      task.gate = gate;
    });
  }

  public async awaitApproval(id: string, taskToken: string): Promise<RetrainTask | undefined> {
    return this.modify(id, (task) => {
      task.status = RetrainTaskStatus.AWAITING_APPROVAL;
      task.taskToken = taskToken;
    });
  }

  /** Clears the token and records who decided; the caller resumes or stops the execution. */
  public async recordDecision(id: string, approved: boolean, userId: string): Promise<RetrainTask | undefined> {
    return this.modify(id, (task) => {
      task.status = approved ? RetrainTaskStatus.IN_PROGRESS : RetrainTaskStatus.REJECTED;
      task.taskToken = undefined;
      task.decidedBy = userId;
      if (!approved) task.completedAt = Date.now();
    });
  }

  public async recordPromotion(
    id: string,
    target: PromotionTarget,
    previousVersion: string | undefined,
  ): Promise<RetrainTask | undefined> {
    return this.modify(id, (task) => {
      if (!task.promotedTo.includes(target)) task.promotedTo.push(target);
      if (target === 'production') task.previousVersion = previousVersion;
    });
  }

  public async markAsCompleted(id: string): Promise<RetrainTask | undefined> {
    return this.modify(id, (task) => {
      if (task.step && !task.completedSteps.includes(task.step)) task.completedSteps.push(task.step);
      task.status = RetrainTaskStatus.COMPLETED;
      task.taskToken = undefined;
      task.completedAt = Date.now();
    });
  }

  /** A rejected run stays REJECTED; anything else that ends early is FAILED. */
  public async markAsFailed(id: string, errorMessage: string): Promise<RetrainTask | undefined> {
    return this.modify(id, (task) => {
      if (task.status === RetrainTaskStatus.REJECTED) return;
      task.status = RetrainTaskStatus.FAILED;
      task.errorMessage = errorMessage;
      task.taskToken = undefined;
      task.completedAt = Date.now();
    });
  }

  public async acknowledge(id: string): Promise<RetrainTask | undefined> {
    return this.modify(id, (task) => {
      task.acknowledged = true;
    });
  }

  public async listAll(
    limit: number = 50,
    lastKey?: Record<string, any>,
  ): Promise<{ items: RetrainTask[]; lastKey?: Record<string, any> }> {
    const input: QueryCommandInput = {
      TableName: this.tableName,
      IndexName: 'GSI1',
      KeyConditionExpression: 'GSI1PK = :pk',
      ExpressionAttributeValues: { ':pk': `${this.itemType()}#ALL` },
      ScanIndexForward: false,
      Limit: limit,
      ExclusiveStartKey: lastKey,
    };
    return this.query(input);
  }

  public async listByStatus(status: RetrainTaskStatus, limit: number = 20): Promise<RetrainTask[]> {
    const input: QueryCommandInput = {
      TableName: this.tableName,
      IndexName: 'GSI2',
      KeyConditionExpression: 'GSI2PK = :pk',
      ExpressionAttributeValues: { ':pk': `${this.itemType()}#STATUS#${status}` },
      ScanIndexForward: false,
      Limit: limit,
    };
    return (await this.query(input)).items;
  }

  /** Runs an admin should look at: awaiting approval, or failed and not yet dismissed. */
  public async listNeedingAttention(): Promise<RetrainTask[]> {
    const [awaiting, failed] = await Promise.all([
      this.listByStatus(RetrainTaskStatus.AWAITING_APPROVAL),
      this.listByStatus(RetrainTaskStatus.FAILED),
    ]);
    return [...awaiting, ...failed.filter((task) => !task.acknowledged)];
  }
}
