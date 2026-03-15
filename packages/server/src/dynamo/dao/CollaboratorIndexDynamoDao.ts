import {
  BatchWriteCommand,
  DeleteCommand,
  DynamoDBDocumentClient,
  PutCommand,
  QueryCommand,
} from '@aws-sdk/lib-dynamodb';

const ITEM_TYPE = 'COLLABORATOR';
const BATCH_SIZE = 25;

/**
 * Index DAO for cube collaborators.
 *
 * Stores lightweight hash rows — no nested item field, just PK + SK:
 *   PK: COLLABORATOR#<userId>
 *   SK: CUBE#<cubeId>
 *
 * This allows efficient lookup of all cubes a user collaborates on,
 * and batch deletion when a cube is removed.
 */
export class CollaboratorIndexDynamoDao {
  constructor(
    private readonly dynamoClient: DynamoDBDocumentClient,
    private readonly tableName: string,
  ) {}

  private pk(userId: string): string {
    return `${ITEM_TYPE}#${userId}`;
  }

  private sk(cubeId: string): string {
    return `CUBE#${cubeId}`;
  }

  /** Record that userId is a collaborator on cubeId. */
  public async add(userId: string, cubeId: string): Promise<void> {
    await this.dynamoClient.send(
      new PutCommand({
        TableName: this.tableName,
        Item: {
          PK: this.pk(userId),
          SK: this.sk(cubeId),
        },
      }),
    );
  }

  /** Remove userId as a collaborator on cubeId. */
  public async remove(userId: string, cubeId: string): Promise<void> {
    await this.dynamoClient.send(
      new DeleteCommand({
        TableName: this.tableName,
        Key: {
          PK: this.pk(userId),
          SK: this.sk(cubeId),
        },
      }),
    );
  }

  /** Return all cube IDs that userId collaborates on. */
  public async getCubeIdsForUser(userId: string): Promise<string[]> {
    const result = await this.dynamoClient.send(
      new QueryCommand({
        TableName: this.tableName,
        KeyConditionExpression: 'PK = :pk',
        ExpressionAttributeValues: {
          ':pk': this.pk(userId),
        },
      }),
    );

    if (!result.Items) return [];
    return result.Items.map((item) => (item.SK as string).slice('CUBE#'.length));
  }

  /** Remove all collaborator index rows for a cube (called on cube deletion). */
  public async removeAllForCube(cubeId: string, collaboratorIds: string[]): Promise<void> {
    if (collaboratorIds.length === 0) return;

    for (let i = 0; i < collaboratorIds.length; i += BATCH_SIZE) {
      const batch = collaboratorIds.slice(i, i + BATCH_SIZE);
      await this.dynamoClient.send(
        new BatchWriteCommand({
          RequestItems: {
            [this.tableName]: batch.map((userId) => ({
              DeleteRequest: {
                Key: {
                  PK: this.pk(userId),
                  SK: this.sk(cubeId),
                },
              },
            })),
          },
        }),
      );
    }
  }
}
