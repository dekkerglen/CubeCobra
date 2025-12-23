import { BaseObject } from '@utils/datatypes/BaseObject';

export interface DynamoItem<T extends BaseObject> {
  PK: string;
  SK: string;

  GSI1PK?: string;
  GSI1SK?: string;

  GSI2PK?: string;
  GSI2SK?: string;

  GSI3PK?: string;
  GSI3SK?: string;

  GSI4PK?: string;
  GSI4SK?: string;

  // Used for optimistic locking
  DynamoVersion: number;

  // all attributes of T
  item: T;
}
