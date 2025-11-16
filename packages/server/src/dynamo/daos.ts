import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

import client from './client';
import { CommentDynamoDao } from './dao/CommentDynamoDao';

const documentClient = DynamoDBDocumentClient.from(client);

const tableName = process.env.DYNAMO_TABLE;

if (!tableName) {
  throw new Error('DYNAMO_TABLE must be a defined environment variable');
}

export const commentDao: CommentDynamoDao = new CommentDynamoDao(documentClient, tableName, true);
