// Load Environment Variables
require('dotenv').config();

const uuid = require('uuid/v4');
const client = require('./client');
const documentClient = require('./documentClient');

const tableName = (name) => `${process.env.DYNAMO_PREFIX}_${name}`;

const doWithRetries = async (promise, retries = 3) => {
  let result;
  for (let i = 0; i < retries; i++) {
    try {
      // eslint-disable-next-line no-await-in-loop
      result = await promise();
      break;
    } catch (e) {
      // exponential backoff and jitter
      const delay = Math.floor(Math.random() * 2 ** i) + 1;
      // eslint-disable-next-line no-await-in-loop
      await new Promise((resolve) => setTimeout(resolve, delay * 100));
    }
  }
  return result;
};

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
      return doWithRetries(
        documentClient
          .get({
            TableName: tableName(config.name),
            Key: {
              [config.partitionKey]: id,
            },
          })
          .promise(),
      );
    },
    getByKey: async (key) => {
      return doWithRetries(
        documentClient
          .get({
            TableName: tableName(config.name),
            Key: {
              ...key,
            },
          })
          .promise(),
      );
    },
    put: async (Item) => {
      if (!Item[config.partitionKey]) {
        Item = {
          [config.partitionKey]: uuid(),
          ...Item,
        };
      }
      await doWithRetries(documentClient.put({ TableName: tableName(config.name), Item }).promise());
      return Item[config.partitionKey];
    },
    query: async (params) => {
      return doWithRetries(documentClient.query({ TableName: tableName(config.name), Limit: 36, ...params })).promise();
    },
    delete: async (key) => {
      return doWithRetries(
        documentClient
          .delete({
            TableName: tableName(config.name),
            Key: key,
          })
          .promise(),
      );
    },
    batchGet: async (ids) => {
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
        const result = await doWithRetries(documentClient.batchGet(params).promise());
        results.push(...result.Responses[tableName(config.name)]);
      }
      return results;
    },
    batchPut: async (documents) => {
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
      await doWithRetries(Promise.all(batches.map((params) => documentClient.batchWrite(params).promise())));
    },
    batchDelete: async (keys) => {
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
      await doWithRetries(Promise.all(batches.map((params) => documentClient.batchWrite(params).promise())));
    },
  };
};
