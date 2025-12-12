import { cubeDao, dailyP1P1Dao, featuredQueueDao } from 'dynamo/daos';
import p1p1PackModel from 'dynamo/models/p1p1Pack';
import User from 'dynamo/models/user';

import { generateBalancedPack, generatePack, GeneratePackResult } from './cubefn';
import * as util from './util';

interface RotationResult {
  success: boolean;
  message?: string;
  error?: string;
  pack?: any;
  cube?: any;
  dailyP1P1?: any;
}

// Pack generation strategy type
export type PackGenerationStrategy = (
  cube: any,
  cards: any,
  seedPrefix: string,
  candidateCount?: number,
  deterministicSeed?: number | null,
) => Promise<GeneratePackResult>;

export async function rotateDailyP1P1(generatePackFn: PackGenerationStrategy): Promise<RotationResult> {
  try {
    console.log('Starting daily P1P1 rotation...');

    // Idempotency check: If there's already an active daily P1P1 from today, don't create another
    const currentDailyP1P1 = await dailyP1P1Dao.getCurrentDailyP1P1();
    if (currentDailyP1P1) {
      // Check if it was created within the last 23 hours
      // Note: stored date has +6 hour offset, so we check against (now - 17 hours) to effectively check creation time > (now - 23 hours)
      const seventeenHoursAgo = Date.now() - 17 * 60 * 60 * 1000;
      if (currentDailyP1P1.date > seventeenHoursAgo) {
        console.log('Daily P1P1 already exists for today, skipping rotation');
        return {
          success: true,
          message: 'Daily P1P1 already exists for today',
          dailyP1P1: currentDailyP1P1,
        };
      }
    }

    // Get featured cubes queue
    const queueResult = await featuredQueueDao.querySortedByDate(undefined, 999);
    if (!queueResult.items || queueResult.items.length === 0) {
      console.log('No featured cubes in queue, skipping rotation');
      return { success: false, error: 'No featured cubes in queue' };
    }

    // Select a random cube from the featured queue
    const randomIndex = Math.floor(Math.random() * queueResult.items.length);
    const selectedQueueItem = queueResult.items[randomIndex];

    if (!selectedQueueItem) {
      console.error('No cube found at selected index in featured queue:', randomIndex);
      return { success: false, error: 'No cube found in featured queue' };
      // This should not happen as we checked items.length > 0 above
    }

    console.log('Selected cube from featured queue:', selectedQueueItem.cube);

    // Get the cube
    const cube = await cubeDao.getById(selectedQueueItem.cube);
    if (!cube) {
      console.error('Selected cube not found:', selectedQueueItem.cube);
      return { success: false, error: 'Selected cube not found' };
    }

    console.log('Found cube:', cube.name);

    // Get cube cards
    const cards = await cubeDao.getCards(cube.id);

    // Generate pack using the provided strategy
    const seedPrefix = 'p1p1-of-the-day';

    console.log('Generating pack...');

    const result = await generatePackFn(cube, cards, seedPrefix, 10, null);

    // Extract pack and seed from result (handles both GeneratePackResult and BalancedPackResult)
    const packCards = (result as any).packResult?.pack ?? result.pack;
    const packSeed = (result as any).packResult?.seed ?? result.seed;

    console.log('Generated pack with', packCards.length, 'cards');

    // Create S3 data for the pack
    const s3Data = {
      cards: packCards,
      createdByUsername: 'CubeCobra',
      seed: packSeed,
    };

    // Create P1P1 pack (owned by CubeCobra to prevent deletion)
    const pack = await p1p1PackModel.put(
      {
        cubeId: cube.id,
        createdBy: 'CubeCobra',
      },
      s3Data,
    );

    console.log('Created P1P1 pack:', pack.id);

    // Set as new daily P1P1 (this will deactivate the previous one)
    const dailyP1P1 = await dailyP1P1Dao.setActiveDailyP1P1(pack.id, cube.id);

    console.log('Successfully rotated daily P1P1:', dailyP1P1.id);

    // Send notification to cube owner
    try {
      const ownerId = typeof cube.owner === 'object' ? cube.owner.id : cube.owner;

      if (!ownerId) {
        console.log('No cube owner ID found, skipping notification');
        return {
          success: true,
          pack,
          cube,
          dailyP1P1,
        };
      }

      const cubeOwner = await User.getById(ownerId);
      const admin = await User.getById('5d1125b00e0713602c55d967');

      if (cubeOwner && admin) {
        await util.addNotification(
          cubeOwner,
          admin,
          `/tool/p1p1/${pack.id}`,
          `Your cube "${cube.name}" is featured on today's Daily Pack 1 Pick 1!`,
        );
        console.log('Notification sent to cube owner:', cubeOwner.username);
      } else {
        console.log('Could not send notification - cube owner or admin not found');
      }
    } catch (notificationError) {
      console.error('Error sending notification:', notificationError);
      // Don't fail the entire rotation if notification fails
    }

    return {
      success: true,
      pack,
      cube,
      dailyP1P1,
    };
  } catch (error) {
    console.error('Error rotating daily P1P1:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: errorMessage };
  }
}

/**
 * Rotate daily P1P1 using the balanced pack generation strategy
 * This generates multiple pack candidates and selects the most balanced one
 */
export async function rotateDailyP1P1WithBalancedPack(): Promise<RotationResult> {
  return rotateDailyP1P1(generateBalancedPack);
}

/**
 * Rotate daily P1P1 using the standard pack generation strategy
 * This generates a single pack without balance optimization
 */
export async function rotateDailyP1P1WithStandardPack(): Promise<RotationResult> {
  return rotateDailyP1P1(generatePack);
}
