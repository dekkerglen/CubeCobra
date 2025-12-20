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
import { FeedDynamoDao } from './dao/FeedDynamoDao';
import { NoticeDynamoDao } from './dao/NoticeDynamoDao';
import { NotificationDynamoDao } from './dao/NotificationDynamoDao';
import { P1P1PackDynamoDao } from './dao/P1P1PackDynamoDao';
import { PackageDynamoDao } from './dao/PackageDynamoDao';
import { PasswordResetDynamoDao } from './dao/PasswordResetDynamoDao';
import { PatronDynamoDao } from './dao/PatronDynamoDao';
import { PodcastDynamoDao } from './dao/PodcastDynamoDao';
import { RecordDynamoDao } from './dao/RecordDynamoDao';
import { UserDynamoDao } from './dao/UserDynamoDao';
import { VideoDynamoDao } from './dao/VideoDynamoDao';
import documentClient from './documentClient';

const tableName = process.env.DYNAMO_TABLE;

if (!tableName) {
  throw new Error('DYNAMO_TABLE must be a defined environment variable');
}

// We have completed the data migration, so disable dual writes
export const userDao: UserDynamoDao = new UserDynamoDao(documentClient, tableName, false);
export const recordDao: RecordDynamoDao = new RecordDynamoDao(documentClient, tableName, false);
export const patronDao: PatronDynamoDao = new PatronDynamoDao(documentClient, tableName, false);
export const passwordResetDao: PasswordResetDynamoDao = new PasswordResetDynamoDao(documentClient, tableName, false);
export const commentDao: CommentDynamoDao = new CommentDynamoDao(documentClient, userDao, tableName, false);
export const changelogDao: ChangelogDynamoDao = new ChangelogDynamoDao(documentClient, tableName, false);
export const articleDao: ArticleDynamoDao = new ArticleDynamoDao(documentClient, userDao, tableName, false);
export const videoDao: VideoDynamoDao = new VideoDynamoDao(documentClient, userDao, tableName, false);
export const podcastDao: PodcastDynamoDao = new PodcastDynamoDao(documentClient, userDao, tableName, false);
export const episodeDao: EpisodeDynamoDao = new EpisodeDynamoDao(documentClient, userDao, tableName, false);
export const cubeDao: CubeDynamoDao = new CubeDynamoDao(documentClient, userDao, tableName, false);
export const blogDao: BlogDynamoDao = new BlogDynamoDao(
  documentClient,
  changelogDao,
  cubeDao,
  userDao,
  tableName,
  false,
);
export const cardHistoryDao: CardHistoryDynamoDao = new CardHistoryDynamoDao(documentClient, tableName, false);
export const dailyP1P1Dao: DailyP1P1DynamoDao = new DailyP1P1DynamoDao(documentClient, tableName, false);
export const featuredQueueDao: FeaturedQueueDynamoDao = new FeaturedQueueDynamoDao(documentClient, tableName, false);
export const packageDao: PackageDynamoDao = new PackageDynamoDao(documentClient, userDao, tableName, false);
export const draftDao: DraftDynamoDao = new DraftDynamoDao(documentClient, cubeDao, userDao, tableName, false);
export const noticeDao: NoticeDynamoDao = new NoticeDynamoDao(documentClient, userDao, tableName, false);
export const p1p1PackDao: P1P1PackDynamoDao = new P1P1PackDynamoDao(documentClient, tableName, false);
export const notificationDao: NotificationDynamoDao = new NotificationDynamoDao(documentClient, tableName, false);
export const feedDao: FeedDynamoDao = new FeedDynamoDao(documentClient, blogDao, tableName, false);
