// Load Environment Variables
import documentClient from '@server/dynamo/documentClient';
import ContentModel from '@server/dynamo/models/content';
import { ContentType, UnhydratedContent } from '@utils/datatypes/Content';
import { ArticleDynamoDao } from 'dynamo/dao/ArticleDynamoDao';
import { EpisodeDynamoDao } from 'dynamo/dao/EpisodeDynamoDao';
import { PodcastDynamoDao } from 'dynamo/dao/PodcastDynamoDao';
import { VideoDynamoDao } from 'dynamo/dao/VideoDynamoDao';
import fs from 'fs';
import path from 'path';

import 'dotenv/config';

interface MigrationStats {
  total: number;
  migrated: number;
  skipped: number;
  errors: number;
  byType: {
    article: number;
    video: number;
    podcast: number;
    episode: number;
  };
}

interface ScanResult {
  items?: UnhydratedContent[];
  lastKey?: Record<string, any>;
}

interface CheckpointData {
  stats: MigrationStats;
  lastKey?: Record<string, any>;
  batchNumber: number;
  timestamp: string;
}

const CHECKPOINT_FILE = path.join(__dirname, 'content-migration-checkpoint.json');
const CHECKPOINT_INTERVAL = 1000; // Save checkpoint every 1k writes

/**
 * Load checkpoint data from file if it exists
 */
function loadCheckpoint(): CheckpointData | null {
  try {
    if (fs.existsSync(CHECKPOINT_FILE)) {
      const data = fs.readFileSync(CHECKPOINT_FILE, 'utf-8');
      const checkpoint = JSON.parse(data) as CheckpointData;
      console.log(`Loaded checkpoint from ${checkpoint.timestamp}`);
      console.log(`Resuming from batch ${checkpoint.batchNumber}`);
      console.log(
        `Previous progress: ${checkpoint.stats.total} processed (${checkpoint.stats.migrated} migrated, ${checkpoint.stats.skipped} skipped, ${checkpoint.stats.errors} errors)`,
      );
      return checkpoint;
    }
  } catch (error) {
    console.warn('Failed to load checkpoint, starting fresh:', error);
  }
  return null;
}

/**
 * Save checkpoint data to file
 */
function saveCheckpoint(data: CheckpointData): void {
  try {
    fs.writeFileSync(CHECKPOINT_FILE, JSON.stringify(data, null, 2), 'utf-8');
    console.log(`Checkpoint saved at batch ${data.batchNumber} (${data.stats.migrated} migrated so far)`);
  } catch (error) {
    console.error('Failed to save checkpoint:', error);
  }
}

/**
 * Delete checkpoint file when migration completes
 */
function deleteCheckpoint(): void {
  try {
    if (fs.existsSync(CHECKPOINT_FILE)) {
      fs.unlinkSync(CHECKPOINT_FILE);
      console.log('Checkpoint file deleted');
    }
  } catch (error) {
    console.warn('Failed to delete checkpoint file:', error);
  }
}

/**
 * Migration script to move content from old DynamoDB format to new format.
 *
 * Old format (CONTENT table):
 * - PK: id
 * - SK: (none)
 * - GSI: ByStatus (status + date)
 * - GSI: ByTypeOwnerComp (typeOwnerComp + date)
 * - GSI: ByTypeStatusComp (typeStatusComp + date)
 * - Stores UnhydratedContent with all types mixed
 *
 * New format (Single table design):
 * Each content type has its own DAO with specific item types:
 * - ARTICLE#{id}, VIDEO#{id}, PODCAST#{id}, EPISODE#{id}
 * - GSI1: {TYPE}#STATUS#{status} + DATE#{date}
 * - GSI2: {TYPE}#OWNER#{ownerId} + DATE#{date}
 * - GSI3: (Episodes only) EPISODE#PODCAST#{podcastId} + DATE#{date}
 */
(async () => {
  // Declare variables in outer scope so they're accessible in catch block
  let stats: MigrationStats = {
    total: 0,
    migrated: 0,
    skipped: 0,
    errors: 0,
    byType: {
      article: 0,
      video: 0,
      podcast: 0,
      episode: 0,
    },
  };
  let lastKey: Record<string, any> | undefined;
  let batchNumber = 0;

  try {
    console.log('Starting content migration from old format to new DynamoDB format');
    console.log('='.repeat(80));

    const tableName = process.env.DYNAMO_TABLE;

    if (!tableName) {
      throw new Error('DYNAMO_TABLE must be a defined environment variable');
    }

    console.log(`Target table: ${tableName}`);

    // Initialize the new DAOs (with dualWrite disabled since we're migrating)
    const articleDao = new ArticleDynamoDao(documentClient, tableName, false);
    const videoDao = new VideoDynamoDao(documentClient, tableName, false);
    const podcastDao = new PodcastDynamoDao(documentClient, tableName, false);
    const episodeDao = new EpisodeDynamoDao(documentClient, tableName, false);

    // Try to load checkpoint
    const checkpoint = loadCheckpoint();

    if (checkpoint) {
      stats = checkpoint.stats;
      lastKey = checkpoint.lastKey;
      batchNumber = checkpoint.batchNumber;
    }

    let migratedSinceLastCheckpoint = 0;

    do {
      batchNumber += 1;
      console.log(`\nProcessing batch ${batchNumber}...`);

      // Scan the old content table
      const result: ScanResult = await ContentModel.scan(lastKey as any);
      lastKey = result.lastKey;

      if (result.items && result.items.length > 0) {
        console.log(`Found ${result.items.length} content entries in this batch`);

        // Group by content type
        const articles: UnhydratedContent[] = [];
        const videos: UnhydratedContent[] = [];
        const podcasts: UnhydratedContent[] = [];
        const episodes: UnhydratedContent[] = [];

        for (const item of result.items) {
          switch (item.type) {
            case ContentType.ARTICLE:
              articles.push(item);
              break;
            case ContentType.VIDEO:
              videos.push(item);
              break;
            case ContentType.PODCAST:
              podcasts.push(item);
              break;
            case ContentType.EPISODE:
              episodes.push(item);
              break;
            default:
              console.warn(`Unknown content type: ${item.type} for id: ${item.id}`);
          }
        }

        console.log(
          `Batch breakdown: ${articles.length} articles, ${videos.length} videos, ${podcasts.length} podcasts, ${episodes.length} episodes`,
        );

        try {
          // Migrate articles
          if (articles.length > 0) {
            const existingChecks = await Promise.all(
              articles.map(async (item) => ({
                item,
                exists: !!(await articleDao.getById(item.id)),
              })),
            );

            const articlesToMigrate = existingChecks
              .filter((check) => !check.exists)
              .map((check) => ({
                ...check.item,
                owner: check.item.owner ? ({ id: check.item.owner } as any) : undefined,
              }));

            if (articlesToMigrate.length > 0) {
              await articleDao.batchPut(articlesToMigrate as any);
              stats.migrated += articlesToMigrate.length;
              stats.byType.article += articlesToMigrate.length;
              migratedSinceLastCheckpoint += articlesToMigrate.length;
              console.log(`  Migrated ${articlesToMigrate.length} articles`);
            }

            const skipped = articles.length - articlesToMigrate.length;
            stats.skipped += skipped;
            if (skipped > 0) {
              console.log(`  Skipped ${skipped} articles (already exist)`);
            }
          }

          // Migrate videos
          if (videos.length > 0) {
            const existingChecks = await Promise.all(
              videos.map(async (item) => ({
                item,
                exists: !!(await videoDao.getById(item.id)),
              })),
            );

            const videosToMigrate = existingChecks
              .filter((check) => !check.exists)
              .map((check) => ({
                ...check.item,
                owner: check.item.owner ? ({ id: check.item.owner } as any) : undefined,
                url: check.item.url || '',
              }));

            if (videosToMigrate.length > 0) {
              await videoDao.batchPut(videosToMigrate as any);
              stats.migrated += videosToMigrate.length;
              stats.byType.video += videosToMigrate.length;
              migratedSinceLastCheckpoint += videosToMigrate.length;
              console.log(`  Migrated ${videosToMigrate.length} videos`);
            }

            const skipped = videos.length - videosToMigrate.length;
            stats.skipped += skipped;
            if (skipped > 0) {
              console.log(`  Skipped ${skipped} videos (already exist)`);
            }
          }

          // Migrate podcasts
          if (podcasts.length > 0) {
            const existingChecks = await Promise.all(
              podcasts.map(async (item) => ({
                item,
                exists: !!(await podcastDao.getById(item.id)),
              })),
            );

            const podcastsToMigrate = existingChecks
              .filter((check) => !check.exists)
              .map((check) => ({
                ...check.item,
                owner: check.item.owner ? ({ id: check.item.owner } as any) : undefined,
                title: check.item.title || '',
                url: check.item.url || '',
                description: check.item.short || '',
              }));

            if (podcastsToMigrate.length > 0) {
              await podcastDao.batchPut(podcastsToMigrate as any);
              stats.migrated += podcastsToMigrate.length;
              stats.byType.podcast += podcastsToMigrate.length;
              migratedSinceLastCheckpoint += podcastsToMigrate.length;
              console.log(`  Migrated ${podcastsToMigrate.length} podcasts`);
            }

            const skipped = podcasts.length - podcastsToMigrate.length;
            stats.skipped += skipped;
            if (skipped > 0) {
              console.log(`  Skipped ${skipped} podcasts (already exist)`);
            }
          }

          // Migrate episodes
          if (episodes.length > 0) {
            const existingChecks = await Promise.all(
              episodes.map(async (item) => ({
                item,
                exists: !!(await episodeDao.getById(item.id)),
              })),
            );

            const episodesToMigrate = existingChecks
              .filter((check) => !check.exists)
              .map((check) => ({
                ...check.item,
                owner: check.item.owner ? ({ id: check.item.owner } as any) : undefined,
                podcast: (check.item as any).podcast || '',
                podcastName: (check.item as any).podcastName || '',
                podcastGuid: (check.item as any).podcastGuid || '',
              }));

            if (episodesToMigrate.length > 0) {
              await episodeDao.batchPut(episodesToMigrate as any);
              stats.migrated += episodesToMigrate.length;
              stats.byType.episode += episodesToMigrate.length;
              migratedSinceLastCheckpoint += episodesToMigrate.length;
              console.log(`  Migrated ${episodesToMigrate.length} episodes`);
            }

            const skipped = episodes.length - episodesToMigrate.length;
            stats.skipped += skipped;
            if (skipped > 0) {
              console.log(`  Skipped ${skipped} episodes (already exist)`);
            }
          }

          stats.total += result.items.length;

          console.log(
            `Progress: ${stats.total} processed (${stats.skipped} skipped, ${stats.migrated} migrated, ${stats.errors} errors)`,
          );
        } catch (error) {
          stats.errors += result.items.length;
          console.error(`Error migrating batch:`, error);

          if (stats.errors > 100) {
            console.error('Too many errors, stopping migration');
            throw new Error('Migration failed with too many errors');
          }
        }
      }

      console.log(
        `Batch ${batchNumber} complete. Stats: ${stats.migrated} migrated, ${stats.skipped} skipped, ${stats.errors} errors`,
      );

      // Save checkpoint every N migrated items
      if (migratedSinceLastCheckpoint >= CHECKPOINT_INTERVAL) {
        saveCheckpoint({
          stats,
          lastKey,
          batchNumber,
          timestamp: new Date().toISOString(),
        });
        migratedSinceLastCheckpoint = 0;
      }

      // Add a small delay between batches to avoid throttling
      if (lastKey) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    } while (lastKey);

    console.log('\n' + '='.repeat(80));
    console.log('Migration complete!');
    console.log(`Total content entries processed: ${stats.total}`);
    console.log(`Successfully migrated: ${stats.migrated}`);
    console.log(`  Articles: ${stats.byType.article}`);
    console.log(`  Videos: ${stats.byType.video}`);
    console.log(`  Podcasts: ${stats.byType.podcast}`);
    console.log(`  Episodes: ${stats.byType.episode}`);
    console.log(`Skipped (already exists): ${stats.skipped}`);
    console.log(`Errors: ${stats.errors}`);
    console.log('='.repeat(80));

    // Delete checkpoint file on successful completion
    deleteCheckpoint();

    process.exit(0);
  } catch (err) {
    console.error('\n' + '='.repeat(80));
    console.error('Migration failed with error:');
    console.error(err);
    console.error('='.repeat(80));

    // Save final checkpoint on error so we can resume
    try {
      saveCheckpoint({
        stats,
        lastKey,
        batchNumber,
        timestamp: new Date().toISOString(),
      });
      console.log('Checkpoint saved before exit');
    } catch (checkpointError) {
      console.error('Failed to save checkpoint on error:', checkpointError);
    }

    process.exit(1);
  }
})();
