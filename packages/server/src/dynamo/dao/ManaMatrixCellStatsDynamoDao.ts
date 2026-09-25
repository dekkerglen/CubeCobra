import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { ManaMatrixCellStats } from '@utils/datatypes/ManaMatrix';

import { BaseDynamoDao } from './BaseDynamoDao';

/**
 * UnhydratedManaMatrixCellStats is the same as ManaMatrixCellStats since there are no relationships to hydrate.
 */
export interface UnhydratedManaMatrixCellStats extends ManaMatrixCellStats {}

export class ManaMatrixCellStatsDynamoDao extends BaseDynamoDao<ManaMatrixCellStats, UnhydratedManaMatrixCellStats> {
  constructor(dynamoClient: DynamoDBDocumentClient, tableName: string) {
    super(dynamoClient, tableName);
  }

  protected itemType(): string {
    return 'MANAMATRIX_CELL_STATS';
  }

  /**
   * One item per puzzle cell: keyed by date + grid position (9 items per day).
   */
  protected partitionKey(item: ManaMatrixCellStats): string {
    return this.typedKey(this.cellKey(item.date, item.row, item.col));
  }

  private cellKey(date: string, row: number, col: number): string {
    return `${date}#${row}${col}`;
  }

  protected dehydrateItem(item: ManaMatrixCellStats): UnhydratedManaMatrixCellStats {
    return {
      date: item.date,
      row: item.row,
      col: item.col,
      totalAnswers: item.totalAnswers,
      answerCounts: item.answerCounts,
      dateCreated: item.dateCreated,
      dateLastUpdated: item.dateLastUpdated,
    };
  }

  protected hydrateItem(item: UnhydratedManaMatrixCellStats): ManaMatrixCellStats {
    return item;
  }

  protected async hydrateItems(items: UnhydratedManaMatrixCellStats[]): Promise<ManaMatrixCellStats[]> {
    return items.map((item) => this.hydrateItem(item));
  }

  /**
   * Creates the 9 zeroed cell-stat items for a puzzle date. Called at rotation
   * so recordAnswer can always assume the items exist.
   */
  public async createForPuzzle(date: string): Promise<void> {
    const now = Date.now();
    const items: ManaMatrixCellStats[] = [];
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 3; col++) {
        items.push({
          date,
          row,
          col,
          totalAnswers: 0,
          answerCounts: {},
          dateCreated: now,
          dateLastUpdated: now,
        });
      }
    }
    await this.batchPut(items);
  }

  /**
   * Gets all 9 cell-stat items for a puzzle date, as a 3x3 grid (undefined for
   * cells that don't exist, e.g. puzzles created before this feature).
   */
  public async getForPuzzle(date: string): Promise<(ManaMatrixCellStats | undefined)[][]> {
    const grid: (ManaMatrixCellStats | undefined)[][] = [];
    for (let row = 0; row < 3; row++) {
      const cells = await Promise.all(
        [0, 1, 2].map((col) =>
          this.get({
            PK: this.typedKey(this.cellKey(date, row, col)),
            SK: this.itemType(),
          }),
        ),
      );
      grid.push(cells);
    }
    return grid;
  }

  /**
   * Counts one correct answer for a cell. Uses optimistic-locking read-modify-write
   * so concurrent submissions don't lose increments.
   *
   * @returns true if the cell-stat item existed and was updated.
   */
  public async recordAnswer(date: string, row: number, col: number, normalizedName: string): Promise<boolean> {
    return this.patchRaw(
      {
        PK: this.typedKey(this.cellKey(date, row, col)),
        SK: this.itemType(),
      },
      (item) => {
        item.totalAnswers += 1;
        item.answerCounts[normalizedName] = (item.answerCounts[normalizedName] ?? 0) + 1;
        item.dateLastUpdated = Date.now();
      },
    );
  }
}
