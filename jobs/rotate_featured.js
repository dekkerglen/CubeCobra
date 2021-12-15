const mongoose = require('mongoose');
const fq = require('../serverjs/featuredQueue');
const FeaturedCubes = require('../models/featuredCubes');
const util = require('../serverjs/util');
const User = require('../models/user');

const MS_PER_DAY = 1000 * 3600 * 24;

(async () => {
  mongoose.connect(process.env.MONGODB_URL).then(async () => {
    try {
      console.log('Checking rotation of featured cubes');
      const featured = await FeaturedCubes.getSingleton();
      console.log(featured);
      const msTimeDiff = Date.now() - featured.lastRotation.getTime();
      const daysTimeDiff = msTimeDiff / MS_PER_DAY;
      if (daysTimeDiff >= featured.daysBetweenRotations) {
        console.log(
          `Rotation period elapsed (period=${featured.daysBetweenRotations}, elapsed=${daysTimeDiff}). Rotating featured cubes.`,
        );
        const rotate = await fq.rotateFeatured();
        for (const message of rotate.messages) {
          console.warn(message);
        }

        if (rotate.status === 'false') {
          console.error('Featured cube rotation failed!');
          return;
        }

        console.log('Sending notifications to featured cube owners');
        const olds = await User.find({ _id: rotate.removed.map((f) => f.ownerID) });
        const news = await User.find({ _id: rotate.added.map((f) => f.ownerID) });
        const admin = await User.findOne({ roles: 'Admin' }).lean();
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
      }
      console.log('Featured cube rotation check finished successfully');
    } catch (err) {
      console.error(err);
    }
    process.exit();
  });
})();
