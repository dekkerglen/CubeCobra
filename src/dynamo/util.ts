// Load Environment Variables
import dotenv from 'dotenv';
dotenv.config();

import { DocumentClient } from 'aws-sdk2-types/lib/dynamodb/document_client';
import { v4 as uuidv4 } from 'uuid';

import { batchGet, batchInvalidate, batchPut, get, invalidate, put } from './cache';
import client from './client';
import documentClient from './documentClient';

const tableName = (name: string): string => `${process.env.DYNAMO_PREFIX}_${name}`;

interface IndexConfig {
  name: string;
  partitionKey: string;
  sortKey: string;
}

interface ClientConfig {
  name: string;
  partitionKey: string;
  attributes: Record<string, string>;
  indexes: Array<IndexConfig>;
  sortKey?: string;
}

interface ClientInterface {
  createTable: () => Promise<DocumentClient.CreateTableOutput>;
  get: (id: string) => Promise<DocumentClient.GetItemOutput>;
  scan: (params: Omit<DocumentClient.ScanInput, 'TableName'>) => Promise<DocumentClient.ScanOutput>;
  query: (params: Omit<DocumentClient.QueryInput, 'TableName'>) => Promise<DocumentClient.QueryOutput>;
  put: (params: Omit<DocumentClient.PutItemInput, 'TableName'>) => Promise<DocumentClient.PutItemOutput>;
  delete: (key: DocumentClient.Key) => Promise<void>;
  batchGet: (ids: string[]) => Promise<any[]>;
  batchPut: (documents: DocumentClient.AttributeMap[], skipCache: boolean) => Promise<void>;
  batchDelete: (keys: DocumentClient.Key[]) => Promise<void>;
  //TODO: is Request<DocumentClient.BatchGetItemOutput, AWSError> ??
}

module.exports = function createClient(config: ClientConfig): ClientInterface {
  return {
    createTable: async (): Promise<DocumentClient.CreateTableOutput> => {
      const KeySchema: DocumentClient.KeySchema = [
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

      const params: DocumentClient.CreateTableInput = {
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

      return client.createTable(params).promise();
    },
    get: async (id: string): Promise<DocumentClient.GetItemOutput> => {
      if (!id) {
        throw new Error(`Error getting item from table ${config.name} with, id is null`);
      }

      const item = get(`${config.name}:${id}`);

      if (item) {
        return { Item: item };
      }

      try {
        const result = await documentClient
          .get({
            TableName: tableName(config.name),
            Key: {
              [config.partitionKey]: id,
            },
          })
          .promise();

        if (result.Item) {
          put(`${config.name}:${id}`, result.Item);
        }

        return result;
      } catch (error: any) {
        throw new Error(`Error getting item from table ${config.name} with id ${id}: ${error.message}`);
      }
    },
    scan: async (params: Omit<DocumentClient.ScanInput, 'TableName'>): Promise<DocumentClient.ScanOutput> => {
      try {
        return await documentClient
          .scan({
            TableName: tableName(config.name),
            ...params,
          })
          .promise();
      } catch (error: any) {
        throw new Error(`Error scanning table ${config.name}: ${error.message}`);
      }
    },
    /*getByKey: async (key: string) => {
      try {
        return await documentClient
          .get({
            TableName: tableName(config.name),
            Key: {
              ...key,
            },
          })
          .promise();
      } catch (error: any) {
        throw new Error(`Error getting item from table ${config.name} with key ${key}: ${error.message}`);
      }
    },*/
    put: async (
      Item: DocumentClient.PutItemInputAttributeMap,
      skipCache: boolean = false,
    ): Promise<DocumentClient.PutItemOutput> => {
      try {
        if (!Item[config.partitionKey]) {
          Item = {
            [config.partitionKey]: uuidv4(),
            ...Item,
          };
        }

        if (!skipCache) {
          await invalidate(`${config.name}:${Item[config.partitionKey]}`);
          put(`${config.name}:${Item[config.partitionKey]}`, Item);
        }

        await documentClient.put({ TableName: tableName(config.name), Item }).promise();
        return Item[config.partitionKey];
      } catch (error: any) {
        throw new Error(`Error putting item into table ${config.name}: ${error.message}`);
      }
    },
    query: async (params: Omit<DocumentClient.QueryInput, 'TableName'>): Promise<DocumentClient.QueryOutput> => {
      try {
        return await documentClient
          .query({ TableName: tableName(config.name), Limit: params.Limit || 36, ...params })
          .promise();
      } catch (error: any) {
        throw new Error(`Error querying table ${config.name}: ${error.message}. Query: ${JSON.stringify(params)}`);
      }
    },
    delete: async (key: DocumentClient.Key): Promise<void> => {
      try {
        await documentClient
          .delete({
            TableName: tableName(config.name),
            Key: key,
          })
          .promise();
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

        const cacheHits = batchGet(singletonIds.map((id) => `${config.name}:${id}`));
        const cacheMisses = cacheHits.map((hit, index) => (hit ? null : singletonIds[index])).filter((id) => id);

        const results: any[] = [];
        for (let i = 0; i < cacheMisses.length; i += 25) {
          const params: DocumentClient.BatchGetItemInput = {
            RequestItems: {
              [tableName(config.name)]: {
                Keys: cacheMisses.slice(i, i + 25).map((id) => ({
                  [config.partitionKey]: id,
                })),
              },
            },
          };

          const result: DocumentClient.BatchGetItemOutput = await documentClient.batchGet(params).promise();
          if (result.Responses) {
            results.push(...result.Responses[tableName(config.name)]);
          }
        }
        return [...cacheHits.filter((hit) => hit), ...results];
      } catch (error: any) {
        throw new Error(`Error batch getting items from table ${config.name}: ${error.message}`);
      }
    },
    batchPut: async (documents: DocumentClient.AttributeMap[], skipCache: boolean = false): Promise<void> => {
      try {
        if (!skipCache) {
          batchPut(
            Object.fromEntries(
              documents.map((document) => [`${config.name}:${document[config.partitionKey]}`, document]),
            ),
          );

          await batchInvalidate(documents.map((document) => `${config.name}:${document[config.partitionKey]}`));
        }

        const batches = [];
        for (let i = 0; i < documents.length; i += 25) {
          const batch = documents.slice(i, i + 25).map((document) => ({
            PutRequest: {
              Item: document,
            },
          }));
          const params: DocumentClient.BatchWriteItemInput = {
            RequestItems: {
              [tableName(config.name)]: batch,
            },
          };
          batches.push(params);
        }

        await Promise.all(batches.map((params) => documentClient.batchWrite(params).promise()));
      } catch (error: any) {
        throw new Error(`Error batch putting items into table ${config.name}: ${error.message}`);
      }
    },
    batchDelete: async (keys: DocumentClient.Key[]): Promise<void> => {
      try {
        const batches: DocumentClient.BatchWriteItemInput[] = [];
        for (let i = 0; i < keys.length; i += 25) {
          const batch: DocumentClient.WriteRequests = keys.slice(i, i + 25).map((key) => ({
            DeleteRequest: {
              Key: {
                ...key,
              },
            },
          }));
          const params: DocumentClient.BatchWriteItemInput = {
            RequestItems: {
              [tableName(config.name)]: batch,
            },
          };
          batches.push(params);
        }
        await Promise.all(batches.map((params) => documentClient.batchWrite(params).promise()));
      } catch (error: any) {
        throw new Error(`Error batch deleting items from table ${config.name}: ${error.message}`);
      }
    },
  };
};
