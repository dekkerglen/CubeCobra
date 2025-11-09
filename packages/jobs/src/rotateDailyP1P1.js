/* eslint-disable no-console */
const { generateBalancedPack } = require('../../server/src/util/cubefn');
const { ensureModelsReady } = require('../../server/src/util/ml');
const { initializeCardDb } = require('../../server/src/util/cardCatalog');
const Cube = require('../../server/src/dynamo/models/cube');
const p1p1PackModel = require('../../server/src/dynamo/models/p1p1Pack');
const dailyP1P1Model = require('../../server/src/dynamo/models/dailyP1P1');
const FeaturedQueue = require('../../server/src/dynamo/models/featuredQueue');
const User = require('../../server/src/dynamo/models/user');
const util = require('../../server/src/util/util');

async function rotateDailyP1P1() {
  try {
    console.log('Starting daily P1P1 rotation...');

    // Initialize card database and ML models when calling this with rotate-daily-p1p1 script
    
    const privateDir = path.join(__dirname, '..', '..', 'server', 'private');
    await initializeCardDb(privateDir);
    await ensureModelsReady();

    // Idempotency check: If there's already an active daily P1P1 from today, don't create another
    const currentDailyP1P1 = await dailyP1P1Model.getCurrentDailyP1P1();
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
    const queueResult = await FeaturedQueue.querySortedByDate(null, 999);
    if (!queueResult.items || queueResult.items.length === 0) {
      console.log('No featured cubes in queue, skipping rotation');
      return { success: false, error: 'No featured cubes in queue' };
    }

    // Select a random cube from the featured queue
    const randomIndex = Math.floor(Math.random() * queueResult.items.length);
    const selectedQueueItem = queueResult.items[randomIndex];

    console.log('Selected cube from featured queue:', selectedQueueItem.cube);

    // Get the cube
    const cube = await Cube.getById(selectedQueueItem.cube);
    if (!cube) {
      console.error('Selected cube not found:', selectedQueueItem.cube);
      return { success: false, error: 'Selected cube not found' };
    }

    console.log('Found cube:', cube.name);

    // Get cube cards
    const cards = await Cube.getCards(cube.id);

    // Generate optimal pack with configurable candidate count (default: 10)
    const candidateCount = 10;
    const seedPrefix = 'p1p1-of-the-day';

    console.log(`Generating ${candidateCount} pack candidates...`);

    const result = await generateBalancedPack(cube, cards, seedPrefix, candidateCount);

    // Log candidate details for debugging
    result.allCandidates.forEach((candidate, i) => {
      console.log(`Pack ${i + 1}: max bot weight = ${candidate.maxBotWeight.toFixed(3)}`);
    });

    console.log(`Selected pack with lowest max bot weight: ${result.maxBotWeight.toFixed(3)}`);

    const packResult = result.packResult;
    const botResult = result.botResult;

    console.log('Generated pack with', packResult.pack.length, 'cards');

    // Create S3 data for the pack
    const s3Data = {
      botPick: botResult.botPickIndex ?? undefined,
      botWeights: botResult.botWeights.length > 0 ? botResult.botWeights : undefined,
      cards: packResult.pack,
      createdByUsername: 'CubeCobra',
      seed: result.seed,
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
    const dailyP1P1 = await dailyP1P1Model.setActiveDailyP1P1(pack.id, cube.id);

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
    return { success: false, error: error.message };
  }
}

// Execute the function when run directly as a script
if (require.main === module) {
  (async () => {
    try {
      await rotateDailyP1P1();
      console.log('Daily P1P1 rotation completed successfully');
    } catch (error) {
      console.error('Daily P1P1 rotation failed:', error);
      process.exit(1);
    }
    process.exit(0);
  })();
}

module.exports = rotateDailyP1P1;
