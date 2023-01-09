/* eslint-disable no-await-in-loop */
const FeaturedQueue = require('../dynamo/models/featuredQueue');
const Cube = require('../dynamo/models/cube');
const Patron = require('../dynamo/models/patron');

function canBeFeatured(patron) {
  return patron && patron.status === Patron.STATUSES.Active && patron.level > 1;
}

async function rotateFeatured(queue) {
  if (queue.length < 4) {
    throw new Error(`Not enough cubes in queue to rotate (need 4, have ${queue.length})`);
  }

  const [old1, old2, new1, new2] = queue.slice(0, 4);

  // re-queue cubes only if owners are still eligible
  const owner1 = await Patron.getById(old1.ownerID);
  const owner2 = await Patron.getById(old2.ownerID);

  for (const [owner, cube] of [
    [owner1, old1],
    [owner2, old2],
  ]) {
    if (canBeFeatured(owner)) {
      cube.date = Date.now().valueOf();
      await FeaturedQueue.put(cube);
    } else {
      await FeaturedQueue.delete(cube.cube);
    }
  }

  for (const cube of [new1, new2]) {
    cube.featuredOn = Date.now().valueOf();
    await FeaturedQueue.put(cube);
  }

  const messages = [];

  const cube1 = await Cube.getById(old1.cube);
  const cube2 = await Cube.getById(old2.cube);
  cube1.featured = false;
  cube2.featured = false;
  await Cube.update(cube1);
  await Cube.update(cube2);

  const cube3 = await Cube.getById(new1.cube);
  const cube4 = await Cube.getById(new2.cube);
  cube3.featured = true;
  cube4.featured = true;
  await Cube.update(cube3);
  await Cube.update(cube4);

  return { success: 'true', messages, removed: [old1, old2], added: [new1, new2] };
}

async function isInFeaturedQueue(cube) {
  if (!cube) return false;
  return FeaturedQueue.getById(cube.id);
}

module.exports = {
  rotateFeatured,
  canBeFeatured,
  isInFeaturedQueue,
};
