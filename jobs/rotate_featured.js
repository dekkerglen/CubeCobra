const fq = require('../serverjs/featuredQueue');
const FeaturedQueue = require('../dynamo/models/featuredQueue');
const util = require('../serverjs/util');
const User = require('../dynamo/models/user');

const MS_PER_DAY = 1000 * 3600 * 24;
const DAYS_BETWEEN_ROTATIONS = 7;

(async () => {
  try {
    console.log('Checking rotation of featured cubes');

    const queue = await FeaturedQueue.querySortedByDate();

    const { items } = queue;

    const rotate = await fq.rotateFeatured(items);
    for (const message of rotate.messages) {
      console.warn(message);
    }

    if (rotate.status === 'false') {
      console.error('featured cube rotation failed!');
      return;
    }

    console.log('Sending notifications to featured cube owners');
    const olds = await User.batchGet(rotate.removed.map((f) => `${f.ownerID}`));
    const news = await User.batchGet(rotate.added.map((f) => `${f.ownerID}`));
    const admin = await User.getById('5d1125b00e0713602c55d967'); // this is admin magic number
    const notifications = [];
    for (const old of olds) {
      notifications.push(
        util.addNotification(old, admin, '/user/account?nav=patreon', 'Your cube is no longer featured.'),
      );
    }
    for (const newO of news) {
      notifications.push(
        util.addNotification(newO, admin, '/user/account?nav=patreon', 'Your cube has been featured!'),
      );
    }
    await Promise.all(notifications);
    console.log('All notifications sent');

    console.log('featured cube rotation check finished successfully');
  } catch (err) {
    console.error(err);
  }
  process.exit();
})();
