import { CommentDynamoDao } from './dao/CommentDynamoDao';
import documentClient from './documentClient';

const tableName = process.env.DYNAMO_TABLE;

if (!tableName) {
  throw new Error('DYNAMO_TABLE must be a defined environment variable');
}

export const commentDao: CommentDynamoDao = new CommentDynamoDao(documentClient, tableName, true);
