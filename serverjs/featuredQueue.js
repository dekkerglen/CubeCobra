const FeaturedQueue = require('../dynamo/models/featuredQueue');
const Cube = require('../dynamo/models/cube');
const Patron = require('../dynamo/models/patron');

function canBeFeatured(patron) {
  return patron && patron.status === Patron.STATUSES.ACTIVE && patron.level > 1;
}

async function rotateFeatured(queue) {
  if (queue.length < 4) {
    throw new Error(`Not enough cubes in queue to rotate (need 4, have ${queue.length})`);
  }

  const [old1, old2, new1, new2] = queue.slice(0, 4);

  // re-queue cubes only if owners are still eligible
  const owner1 = await Patron.getById(old1.owner);
  const owner2 = await Patron.getById(old2.owner);

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
  if (!cube) {
    return false;
  }
  return FeaturedQueue.getById(cube.id);
}

async function getFeaturedQueueForUser(userid) {
  const cubes = [];
  let lastKey = null;

  do {
    const result = await FeaturedQueue.queryWithOwnerFilter(userid, lastKey);
    cubes.push(...result.items);
    lastKey = result.lastKey;
  } while (lastKey);

  return cubes;
}

async function doesUserHaveFeaturedCube(userid) {
  const cubes = await getFeaturedQueueForUser(userid);
  return cubes.length > 0;
}

async function replaceForUser(userid, cubeid) {
  const cubes = [];
  let lastKey = null;

  do {
    const result = await FeaturedQueue.querySortedByDate(lastKey);
    cubes.push(...result.items);
    lastKey = result.lastKey;
  } while (lastKey);

  // get index of cube with matching userid
  const index = cubes.findIndex((cube) => cube.owner === userid);
  const item = cubes[index];

  if (index < 2) {
    throw new Error('Cannot replace cube that is currenlty featured');
  }

  if (index === -1) {
    throw new Error('Cannot replace cube that is not in queue');
  }

  // remove cube from queue
  await FeaturedQueue.delete(item.cube);

  // add new cube to queue
  await FeaturedQueue.put({
    cube: cubeid,
    date: item.date,
    owner: userid,
    featuredOn: null,
  });
}

async function addNewCubeToQueue(userid, cubeid) {
  await FeaturedQueue.put({
    cube: cubeid,
    date: Date.now().valueOf(),
    owner: userid,
    featuredOn: null,
  });
}

async function removeCubeFromQueue(ownerid) {
  const cubes = await getFeaturedQueueForUser(ownerid);

  if (cubes.length === 0) {
    throw new Error('Cannot remove cube that is not in queue');
  }

  const cubeid = cubes[0].cube;

  await FeaturedQueue.delete(cubeid);
}

module.exports = {
  rotateFeatured,
  canBeFeatured,
  isInFeaturedQueue,
  doesUserHaveFeaturedCube,
  replaceForUser,
  addNewCubeToQueue,
  removeCubeFromQueue,
};
