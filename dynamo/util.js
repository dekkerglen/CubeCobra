// Load Environment Variables
require('dotenv').config();

const uuid = require('uuid/v4');
const client = require('./client');
const documentClient = require('./documentClient');

const tableName = (name) => `${process.env.DYNAMO_PREFIX}_${name}`;

module.exports = function createClient(config) {
  return {
    createTable: async () => {
      const KeySchema = [
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

      const params = {
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
            Value: process.env.DYNAMO_PREFIX,
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
    get: async (id) => {
      try {
        return documentClient
          .get({
            TableName: tableName(config.name),
            Key: {
              [config.partitionKey]: id,
            },
          })
          .promise();
      } catch (error) {
        throw new Error(`Error getting item from table ${config.name} with id ${id}: ${error.message}`);
      }
    },
    scan: async (params) => {
      try {
        return documentClient
          .scan({
            TableName: tableName(config.name),
            ...params,
          })
          .promise();
      } catch (error) {
        throw new Error(`Error scanning table ${config.name}: ${error.message}`);
      }
    },
    getByKey: async (key) => {
      try {
        return documentClient
          .get({
            TableName: tableName(config.name),
            Key: {
              ...key,
            },
          })
          .promise();
      } catch (error) {
        throw new Error(`Error getting item from table ${config.name} with key ${key}: ${error.message}`);
      }
    },
    put: async (Item) => {
      try {
        if (!Item[config.partitionKey]) {
          Item = {
            [config.partitionKey]: uuid(),
            ...Item,
          };
        }
        await documentClient.put({ TableName: tableName(config.name), Item }).promise();
        return Item[config.partitionKey];
      } catch (error) {
        throw new Error(`Error putting item into table ${config.name}: ${error.message}`);
      }
    },
    query: async (params) => {
      try {
        return documentClient
          .query({ TableName: tableName(config.name), Limit: params.Limit || 36, ...params })
          .promise();
      } catch (error) {
        throw new Error(`Error querying table ${config.name}: ${error.message}`);
      }
    },
    delete: async (key) => {
      try {
        documentClient
          .delete({
            TableName: tableName(config.name),
            Key: key,
          })
          .promise();
      } catch (error) {
        throw new Error(`Error deleting item from table ${config.name} with key ${key}: ${error.message}`);
      }
    },
    batchGet: async (ids) => {
      try {
        if (ids.length === 0) {
          return [];
        }
        const results = [];
        for (let i = 0; i < ids.length; i += 25) {
          const params = {
            RequestItems: {
              [tableName(config.name)]: {
                Keys: ids.slice(i, i + 25).map((id) => ({
                  [config.partitionKey]: id,
                })),
              },
            },
          };
          // eslint-disable-next-line no-await-in-loop
          const result = await documentClient.batchGet(params).promise();
          results.push(...result.Responses[tableName(config.name)]);
        }
        return results;
      } catch (error) {
        throw new Error(`Error batch getting items from table ${config.name}: ${error.message}`);
      }
    },
    batchPut: async (documents) => {
      try {
        const batches = [];
        for (let i = 0; i < documents.length; i += 25) {
          const batch = documents.slice(i, i + 25).map((document) => ({
            PutRequest: {
              Item: document,
            },
          }));
          const params = {
            RequestItems: {
              [tableName(config.name)]: batch,
            },
          };
          batches.push(params);
        }
        await Promise.all(batches.map((params) => documentClient.batchWrite(params).promise()));
      } catch (error) {
        throw new Error(`Error batch putting items into table ${config.name}: ${error.message}`);
      }
    },
    batchDelete: async (keys) => {
      try {
        const batches = [];
        for (let i = 0; i < keys.length; i += 25) {
          const batch = keys.slice(i, i + 25).map((key) => ({
            DeleteRequest: {
              Key: {
                ...key,
              },
            },
          }));
          const params = {
            RequestItems: {
              [tableName(config.name)]: batch,
            },
          };
          batches.push(params);
        }
        await Promise.all(batches.map((params) => documentClient.batchWrite(params).promise()));
      } catch (error) {
        throw new Error(`Error batch deleting items from table ${config.name}: ${error.message}`);
      }
    },
    update: async (params) => {
      try {
        return documentClient
          .update({
            TableName: tableName(config.name),
            ...params,
          })
          .promise();
      } catch (error) {
        throw new Error(`Error updating item in table ${config.name}: ${error.message}`);
      }
    },
  };
};
