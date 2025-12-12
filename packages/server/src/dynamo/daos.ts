import { ArticleDynamoDao } from './dao/ArticleDynamoDao';
import { BlogDynamoDao } from './dao/BlogDynamoDao';
import { CardHistoryDynamoDao } from './dao/CardHistoryDynamoDao';
import { ChangelogDynamoDao } from './dao/ChangelogDynamoDao';
import { CommentDynamoDao } from './dao/CommentDynamoDao';
import { CubeDynamoDao } from './dao/CubeDynamoDao';
import { DailyP1P1DynamoDao } from './dao/DailyP1P1DynamoDao';
import { DraftDynamoDao } from './dao/DraftDynamoDao';
import { EpisodeDynamoDao } from './dao/EpisodeDynamoDao';
import { FeaturedQueueDynamoDao } from './dao/FeaturedQueueDynamoDao';
import { PodcastDynamoDao } from './dao/PodcastDynamoDao';
import { VideoDynamoDao } from './dao/VideoDynamoDao';
import documentClient from './documentClient';

const tableName = process.env.DYNAMO_TABLE;

if (!tableName) {
  throw new Error('DYNAMO_TABLE must be a defined environment variable');
}

// We have completed the data migration, so disable dual writes
export const commentDao: CommentDynamoDao = new CommentDynamoDao(documentClient, tableName, false);
export const changelogDao: ChangelogDynamoDao = new ChangelogDynamoDao(documentClient, tableName, false);
export const articleDao: ArticleDynamoDao = new ArticleDynamoDao(documentClient, tableName, false);
export const videoDao: VideoDynamoDao = new VideoDynamoDao(documentClient, tableName, false);
export const podcastDao: PodcastDynamoDao = new PodcastDynamoDao(documentClient, tableName, false);
export const episodeDao: EpisodeDynamoDao = new EpisodeDynamoDao(documentClient, tableName, false);
export const cubeDao: CubeDynamoDao = new CubeDynamoDao(documentClient, tableName, false); // need to run the fix index script after deploying changes
export const blogDao: BlogDynamoDao = new BlogDynamoDao(documentClient, changelogDao, cubeDao, tableName, false);

// We haven't migrated the data yet, so enable dual writes - these are deployed to prod, so we can start migration
export const cardHistoryDao: CardHistoryDynamoDao = new CardHistoryDynamoDao(documentClient, tableName, true); // in progress
export const dailyP1P1Dao: DailyP1P1DynamoDao = new DailyP1P1DynamoDao(documentClient, tableName, true);

// We haven't migrated the data yet, so enable dual writes - these are NOT deployed to prod yet, so we can't start migration
export const draftDao: DraftDynamoDao = new DraftDynamoDao(documentClient, cubeDao, tableName, true);
export const featuredQueueDao: FeaturedQueueDynamoDao = new FeaturedQueueDynamoDao(documentClient, tableName, true);
