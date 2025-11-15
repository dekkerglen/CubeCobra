const fq = require('../../util/featuredQueue');
const FeaturedQueue = require('@server/dynamo/models/featuredQueue');
const util = require('../../util/util');
const User = require('@server/dynamo/models/user');

(async () => {
  try {
    console.log('Checking rotation of featured cubes');

    const rotate = await fq.rotateFeatured();
    for (const message of rotate.messages) {
      console.warn(message);
    }

    if (rotate.success === 'false') {
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
