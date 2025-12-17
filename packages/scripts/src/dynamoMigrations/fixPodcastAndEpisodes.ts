// Load Environment Variables
import documentClient from '@server/dynamo/documentClient';
import ContentModel from '@server/dynamo/models/content';
import { ContentType, UnhydratedContent } from '@utils/datatypes/Content';
import { EpisodeDynamoDao } from 'dynamo/dao/EpisodeDynamoDao';
import { PodcastDynamoDao } from 'dynamo/dao/PodcastDynamoDao';
import { userDao } from 'dynamo/daos';

import 'dotenv/config';

interface FixStats {
  total: number;
  fixed: number;
  skipped: number;
  errors: number;
  byType: {
    podcast: number;
    episode: number;
  };
}

interface ScanResult {
  items?: UnhydratedContent[];
  lastKey?: Record<string, any>;
}

/**
 * Script to fix missing images in migrated podcasts and episodes.
 *
 * The original migration from the old CONTENT table to the new single-table design
 * missed copying the image field for podcasts and episodes.
 *
 * This script:
 * 1. Scans the old CONTENT table for podcasts and episodes
 * 2. For each item with an image, checks if the migrated record is missing it
 * 3. Updates the migrated record with the correct image (externally hosted URL)
 */
(async () => {
  const stats: FixStats = {
    total: 0,
    fixed: 0,
    skipped: 0,
    errors: 0,
    byType: {
      podcast: 0,
      episode: 0,
    },
  };

  try {
    console.log('Starting fix for podcast and episode images');
    console.log('='.repeat(80));

    const tableName = process.env.DYNAMO_TABLE;

    if (!tableName) {
      throw new Error('DYNAMO_TABLE must be a defined environment variable');
    }

    console.log(`Target table: ${tableName}`);

    // Initialize the DAOs (with dualWrite disabled since we're fixing existing records)
    const podcastDao = new PodcastDynamoDao(documentClient, userDao, tableName, false);
    const episodeDao = new EpisodeDynamoDao(documentClient, userDao, tableName, false);

    let lastKey: Record<string, any> | undefined;
    let batchNumber = 0;

    do {
      batchNumber += 1;
      console.log(`\nProcessing batch ${batchNumber}...`);

      // Scan the old content table
      const result: ScanResult = await ContentModel.scan(lastKey as any);
      lastKey = result.lastKey;

      if (result.items && result.items.length > 0) {
        console.log(`Found ${result.items.length} content entries in this batch`);

        // Count types for debugging
        const typeCounts = {
          podcasts: 0,
          episodes: 0,
          other: 0,
        };

        // Filter to only podcasts and episodes with imageName
        const podcastsWithImages: UnhydratedContent[] = [];
        const episodesWithImages: UnhydratedContent[] = [];

        for (const item of result.items) {
          // Count types
          if (item.type === ContentType.PODCAST) {
            typeCounts.podcasts += 1;
            // Log first podcast to see structure
            if (typeCounts.podcasts === 1) {
              console.log('  Sample podcast item:', JSON.stringify(item, null, 2));
            }
          } else if (item.type === ContentType.EPISODE) {
            typeCounts.episodes += 1;
            // Log first episode to see structure
            if (typeCounts.episodes === 1) {
              console.log('  Sample episode item:', JSON.stringify(item, null, 2));
            }
          } else {
            typeCounts.other += 1;
          }

          // Check for 'image' field (old table uses 'image', not 'imageName')
          const imageField = (item as any).image;
          if (imageField) {
            if (item.type === ContentType.PODCAST) {
              podcastsWithImages.push(item);
            } else if (item.type === ContentType.EPISODE) {
              episodesWithImages.push(item);
            }
          }
        }

        console.log(
          `  Type breakdown: ${typeCounts.podcasts} podcasts, ${typeCounts.episodes} episodes, ${typeCounts.other} other`,
        );

        console.log(`Items with images: ${podcastsWithImages.length} podcasts, ${episodesWithImages.length} episodes`);

        try {
          const batchStats = {
            fixed: 0,
            skipped: 0,
            errors: 0,
            byType: {
              podcast: 0,
              episode: 0,
            },
          };

          // Fix podcasts in parallel
          if (podcastsWithImages.length > 0) {
            const podcastPromises = podcastsWithImages.map(async (oldItem) => {
              try {
                const oldImage = (oldItem as any).image;
                const migratedPodcast = await podcastDao.getById(oldItem.id);

                if (migratedPodcast) {
                  if (!migratedPodcast.image || migratedPodcast.image !== oldImage) {
                    migratedPodcast.image = oldImage;
                    await podcastDao.update(migratedPodcast);
                    return { status: 'fixed', type: 'podcast' };
                  } else {
                    return { status: 'skipped' };
                  }
                } else {
                  return { status: 'skipped' };
                }
              } catch (error) {
                return { status: 'error', error };
              }
            });

            const podcastResults = await Promise.all(podcastPromises);

            for (const result of podcastResults) {
              if (result.status === 'fixed') {
                batchStats.fixed += 1;
                batchStats.byType.podcast += 1;
              } else if (result.status === 'skipped') {
                batchStats.skipped += 1;
              } else if (result.status === 'error') {
                batchStats.errors += 1;
              }
            }
          }

          // Fix episodes in parallel
          if (episodesWithImages.length > 0) {
            const episodePromises = episodesWithImages.map(async (oldItem) => {
              try {
                const oldImage = (oldItem as any).image;
                const migratedEpisode = await episodeDao.getById(oldItem.id);

                if (migratedEpisode) {
                  if (!migratedEpisode.image || migratedEpisode.image !== oldImage) {
                    migratedEpisode.image = oldImage;
                    await episodeDao.update(migratedEpisode);
                    return { status: 'fixed', type: 'episode' };
                  } else {
                    return { status: 'skipped' };
                  }
                } else {
                  return { status: 'skipped' };
                }
              } catch (error) {
                return { status: 'error', error };
              }
            });

            const episodeResults = await Promise.all(episodePromises);

            for (const result of episodeResults) {
              if (result.status === 'fixed') {
                batchStats.fixed += 1;
                batchStats.byType.episode += 1;
              } else if (result.status === 'skipped') {
                batchStats.skipped += 1;
              } else if (result.status === 'error') {
                batchStats.errors += 1;
              }
            }
          }

          stats.total += podcastsWithImages.length + episodesWithImages.length;
          stats.fixed += batchStats.fixed;
          stats.skipped += batchStats.skipped;
          stats.errors += batchStats.errors;
          stats.byType.podcast += batchStats.byType.podcast;
          stats.byType.episode += batchStats.byType.episode;

          console.log(
            `  Batch results: ${batchStats.fixed} fixed (${batchStats.byType.podcast} podcasts, ${batchStats.byType.episode} episodes), ${batchStats.skipped} skipped, ${batchStats.errors} errors`,
          );
        } catch (error) {
          console.error(`Error processing batch:`, error);
          stats.errors += result.items.length;

          if (stats.errors > 100) {
            console.error('Too many errors, stopping fix');
            throw new Error('Fix failed with too many errors');
          }
        }
      }

      console.log(
        `Batch ${batchNumber} complete. Stats: ${stats.fixed} fixed, ${stats.skipped} skipped, ${stats.errors} errors`,
      );

      // Add a small delay between batches to avoid throttling
      if (lastKey) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    } while (lastKey);

    console.log('\n' + '='.repeat(80));
    console.log('Fix complete!');
    console.log(`Total items with images processed: ${stats.total}`);
    console.log(`Successfully fixed: ${stats.fixed}`);
    console.log(`  Podcasts: ${stats.byType.podcast}`);
    console.log(`  Episodes: ${stats.byType.episode}`);
    console.log(`Skipped (already correct): ${stats.skipped}`);
    console.log(`Errors: ${stats.errors}`);
    console.log('='.repeat(80));

    process.exit(0);
  } catch (err) {
    console.error('\n' + '='.repeat(80));
    console.error('Fix failed with error:');
    console.error(err);
    console.error('='.repeat(80));

    process.exit(1);
  }
})();
