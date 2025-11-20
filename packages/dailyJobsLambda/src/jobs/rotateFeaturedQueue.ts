import { rotateFeatured } from '@server/serverutils/featuredQueue';
import User from '@server/dynamo/models/user';
import util from '@server/serverutils/util';

export const rotateQueue = async () => {
  const rotate = await rotateFeatured();

  if (rotate.success === 'false') {
    console.error('Featured cube rotation check failed:', rotate);
    return;
  }

  const olds = await User.batchGet(rotate.removed.map((f) => f.ownerID));
  const news = await User.batchGet(rotate.added.map((f) => f.ownerID));
  const notifications = [];
  for (const old of olds) {
    notifications.push(
      util.addNotification(old, null, '/user/account?nav=patreon', 'Your cube is no longer featured.'),
    );
  }
  for (const newO of news) {
    notifications.push(util.addNotification(newO, null, '/user/account?nav=patreon', 'Your cube has been featured!'));
  }
  await Promise.all(notifications);

  console.log('Featured cube rotation check finished successfully');
};
