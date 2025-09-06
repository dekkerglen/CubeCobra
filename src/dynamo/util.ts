// Load Environment Variables
import dotenv from 'dotenv';
dotenv.config();

import {
  CreateTableCommandInput,
  CreateTableCommandOutput,
  KeySchemaElement,
  ScalarAttributeType,
} from '@aws-sdk/client-dynamodb';
import {
  BatchWriteCommandInput,
  GetCommandOutput,
  NativeAttributeValue,
  QueryCommandInput,
  QueryCommandOutput,
  ScanCommandInput,
  ScanCommandOutput,
  UpdateCommandInput,
  UpdateCommandOutput,
} from '@aws-sdk/lib-dynamodb';
import { v4 as uuidv4 } from 'uuid';

import client from './client';
import documentClient from './documentClient';

const tableName = (name: string): string => `${process.env.DYNAMO_PREFIX}_${name}`;

interface IndexConfig {
  name: string;
  partitionKey: string;
  sortKey?: string;
}

interface ClientConfig {
  name: string;
  partitionKey: string;
  attributes: Record<string, ScalarAttributeType>;
  indexes?: Array<IndexConfig>;
  sortKey?: string;
}

export type QueryInputType = Omit<QueryCommandInput, 'TableName'>;

interface ClientInterface {
  createTable: () => Promise<CreateTableCommandOutput>;
  get: (id: string) => Promise<GetCommandOutput>;
  scan: (params: Omit<ScanCommandInput, 'TableName'>) => Promise<ScanCommandOutput>;
  query: (params: QueryInputType) => Promise<QueryCommandOutput>;
  put: (Item: Record<string, NativeAttributeValue>) => Promise<string | NativeAttributeValue>;
  update: (params: Omit<UpdateCommandInput, 'TableName'>) => Promise<UpdateCommandOutput>;
  delete: (key: Record<string, NativeAttributeValue>) => Promise<void>;
  batchGet: (ids: string[]) => Promise<any[]>;
  batchPut: (documents: Record<string, NativeAttributeValue>[]) => Promise<void>;
  batchDelete: (keys: Record<string, NativeAttributeValue>[]) => Promise<void>;
}

const createClient = (config: ClientConfig): ClientInterface => {
  return {
    createTable: async (): Promise<CreateTableCommandOutput> => {
      const KeySchema: KeySchemaElement[] = [
        {
          AttributeName: config.partitionKey,
          KeyType: 'HASH',
        },
      ];

      if (config.sortKey) {
        KeySchema.push({
          AttributeName: config.sortKey,
          KeyType: 'RANGE',
        });
      }

      const params: CreateTableCommandInput = {
        TableName: tableName(config.name),
        AttributeDefinitions: Object.entries(config.attributes).map(([key, value]) => ({
          AttributeName: key,
          AttributeType: value,
        })),
        KeySchema,
        BillingMode: 'PAY_PER_REQUEST',
        Tags: [
          {
            Key: 'environment',
            Value: process.env.DYNAMO_PREFIX || '',
          },
        ],
      };

      if (config.indexes && config.indexes.length > 0) {
        params.GlobalSecondaryIndexes = config.indexes.map((index) => {
          if (index.sortKey) {
            return {
              IndexName: index.name,
              KeySchema: [
                {
                  AttributeName: index.partitionKey,
                  KeyType: 'HASH',
                },
                {
                  AttributeName: index.sortKey,
                  KeyType: 'RANGE',
                },
              ],
              Projection: {
                ProjectionType: 'ALL',
              },
            };
          }
          return {
            IndexName: index.name,
            KeySchema: [
              {
                AttributeName: index.partitionKey,
                KeyType: 'HASH',
              },
            ],
            Projection: {
              ProjectionType: 'ALL',
            },
          };
        });
      }

      return client.createTable(params);
    },
    get: async (id: string): Promise<GetCommandOutput> => {
      if (!id) {
        throw new Error(`Error getting item from table ${config.name} with, id is null`);
      }

      try {
        const result = await documentClient.get({
          TableName: tableName(config.name),
          Key: {
            [config.partitionKey]: id,
          },
        });

        return result;
      } catch (error: any) {
        throw new Error(
          `Error getting item from table ${config.name} with key ${JSON.stringify({[config.partitionKey]: id})}: ${error.message}`,
        );
      }
    },
    scan: async (params: Omit<ScanCommandInput, 'TableName'>): Promise<ScanCommandOutput> => {
      try {
        return await documentClient.scan({
          TableName: tableName(config.name),
          ...params,
          ExclusiveStartKey: params.ExclusiveStartKey || undefined,
        });
      } catch (error: any) {
        throw new Error(`Error scanning table ${config.name}: ${error.message}`);
      }
    },
    put: async (Item: Record<string, NativeAttributeValue>): Promise<string> => {
      try {
        if (!Item[config.partitionKey]) {
          Item = {
            ...Item,
            //Append the id AFTER the existing properties. If Item has id but it is falsey, then prepending won't replace the value
            [config.partitionKey]: uuidv4(),
          };
        }

        await documentClient.put({ TableName: tableName(config.name), Item });
        return Item[config.partitionKey];
      } catch (error: any) {
        throw new Error(`Error putting item into table ${config.name}: ${error.message}`);
      }
    },
    update: async (params: Omit<UpdateCommandInput, 'TableName'>): Promise<UpdateCommandOutput> => {
      try {
        return await documentClient.update({
          ...params,
          TableName: tableName(config.name),
        });
      } catch (error: any) {
        throw new Error(`Error updating item in table ${config.name}: ${error.message}`);
      }
    },
    query: async (params: Omit<QueryCommandInput, 'TableName'>): Promise<QueryCommandOutput> => {
      try {
        return await documentClient.query({
          TableName: tableName(config.name),
          Limit: params.Limit || 36,
          ...params,
          //With V3 does not like null
          ExclusiveStartKey: params.ExclusiveStartKey || undefined,
        });
      } catch (error: any) {
        throw new Error(`Error querying table ${config.name}: ${error.message}. Query: ${JSON.stringify(params)}`);
      }
    },
    delete: async (key: Record<string, NativeAttributeValue>): Promise<void> => {
      try {
        await documentClient.delete({
          TableName: tableName(config.name),
          Key: key,
        });
      } catch (error: any) {
        throw new Error(`Error deleting item from table ${config.name} with key ${key}: ${error.message}`);
      }
    },
    batchGet: async (ids: string[]): Promise<any[]> => {
      try {
        if (ids.length === 0) {
          return [];
        }

        const singletonIds = [...new Set(ids)];
        const results: any[] = [];

        const chunkSize = 25;
        for (let i = 0; i < singletonIds.length; i += chunkSize) {
          const chunk = singletonIds.slice(i, i + chunkSize);

          const params = {
            RequestItems: {
              [tableName(config.name)]: {
                Keys: chunk.map((id) => ({
                  [config.partitionKey]: id,
                })),
              },
            },
          };

          const result = await documentClient.batchGet(params);
          if (result.Responses) {
            results.push(...result.Responses[tableName(config.name)]);
          }
        }
        return [...results];
      } catch (error: any) {
        throw new Error(`Error batch getting items from table ${config.name}: ${error.message}`);
      }
    },
    batchPut: async (documents: Record<string, NativeAttributeValue>[]): Promise<void> => {
      try {
        const batches = [];
        for (let i = 0; i < documents.length; i += 25) {
          const batch = documents.slice(i, i + 25).map((document) => ({
            PutRequest: {
              Item: document,
            },
          }));
          const params: BatchWriteCommandInput = {
            RequestItems: {
              [tableName(config.name)]: batch,
            },
          };
          batches.push(params);
        }

        await Promise.all(batches.map((params) => documentClient.batchWrite(params)));
      } catch (error: any) {
        throw new Error(`Error batch putting items into table ${config.name}: ${error.message}`);
      }
    },
    batchDelete: async (keys: Record<string, NativeAttributeValue>[]): Promise<void> => {
      try {
        const batches: BatchWriteCommandInput[] = [];
        for (let i = 0; i < keys.length; i += 25) {
          const batch = keys.slice(i, i + 25).map((key) => ({
            DeleteRequest: {
              Key: {
                ...key,
              },
            },
          }));
          const params: BatchWriteCommandInput = {
            RequestItems: {
              [tableName(config.name)]: batch,
            },
          };
          batches.push(params);
        }
        await Promise.all(batches.map((params) => documentClient.batchWrite(params)));
      } catch (error: any) {
        throw new Error(`Error batch deleting items from table ${config.name}: ${error.message}`);
      }
    },
  };
};
module.exports = createClient;
export default createClient;
