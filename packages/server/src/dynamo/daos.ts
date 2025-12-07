import { ArticleDynamoDao } from './dao/ArticleDynamoDao';
import { BlogDynamoDao } from './dao/BlogDynamoDao';
import { CardHistoryDynamoDao } from './dao/CardHistoryDynamoDao';
import { ChangelogDynamoDao } from './dao/ChangelogDynamoDao';
import { CommentDynamoDao } from './dao/CommentDynamoDao';
import { EpisodeDynamoDao } from './dao/EpisodeDynamoDao';
import { PodcastDynamoDao } from './dao/PodcastDynamoDao';
import { VideoDynamoDao } from './dao/VideoDynamoDao';
import documentClient from './documentClient';

const tableName = process.env.DYNAMO_TABLE;

if (!tableName) {
  throw new Error('DYNAMO_TABLE must be a defined environment variable');
}

// We haven't migrated the data yet, so enable dual writes - these are deployed to prod, so we can start migration
export const cardHistoryDao: CardHistoryDynamoDao = new CardHistoryDynamoDao(documentClient, tableName, true);
export const changelogDao: ChangelogDynamoDao = new ChangelogDynamoDao(documentClient, tableName, true);
export const blogDao: BlogDynamoDao = new BlogDynamoDao(documentClient, changelogDao, tableName, true);

// We haven't migrated the data yet, so enable dual writes - these are NOT deployed to prod yet, so we can't start migration
export const articleDao: ArticleDynamoDao = new ArticleDynamoDao(documentClient, tableName, true);
export const videoDao: VideoDynamoDao = new VideoDynamoDao(documentClient, tableName, true);
export const podcastDao: PodcastDynamoDao = new PodcastDynamoDao(documentClient, tableName, true);
export const episodeDao: EpisodeDynamoDao = new EpisodeDynamoDao(documentClient, tableName, true);

// We have completed the data migration, so disable dual writes
export const commentDao: CommentDynamoDao = new CommentDynamoDao(documentClient, tableName, false);
