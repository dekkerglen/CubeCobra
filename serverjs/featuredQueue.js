const FeaturedCubes = require('../models/featuredCubes');
const Cube = require('../dynamo/models/cube');
const Patron = require('../models/patron');

const TRY_COUNT = 5;
// the return value of fn must be awaitable
async function updateFeatured(fn) {
  let replaced = null;
  let ret;
  let i;
  for (i = 0; !replaced && i < TRY_COUNT; i++) {
    // eslint-disable-next-line no-await-in-loop
    const featured = await FeaturedCubes.findOne({ singleton: true }).lean();
    const stamp = featured.timestamp;
    try {
      // eslint-disable-next-line no-await-in-loop
      ret = await fn(featured);
    } catch (e) {
      return { ok: false, message: e.message };
    }
    featured.timestamp = (stamp + 1) % 100000000; // arbitrary constant to avoid overflowing safe integer range
    // eslint-disable-next-line no-await-in-loop
    replaced = await FeaturedCubes.findOneAndReplace({ singleton: true, timestamp: stamp }, featured);
  }
  return i < TRY_COUNT ? { ok: true, return: ret } : { ok: false, message: 'Timeout exceeded. Please try again.' };
}

function canBeFeatured(patron) {
  return patron && patron.active && ['Coiling Oracle', 'Lotus Cobra'].includes(patron.level);
}

async function rotateFeatured() {
  const update = await updateFeatured(async (featured) => {
    if (featured.queue.length < 4) {
      throw new Error(`Not enough cubes in queue to rotate (need 4, have ${featured.queue.length})`);
    }
    const old1 = featured.queue.shift();
    const old2 = featured.queue.shift();
    const [new1, new2] = featured.queue;
    // re-queue cubes only if owners are still eligible
    const owner1 = await Patron.findOne({ user: old1.ownerID }).lean();
    const owner2 = await Patron.findOne({ user: old2.ownerID }).lean();
    if (canBeFeatured(owner1)) featured.queue.push(old1);
    if (canBeFeatured(owner2)) featured.queue.push(old2);
    featured.lastRotation = new Date();
    return [old1, old2, new1, new2];
  });

  if (!update.ok) {
    return { success: 'false', messages: [update.message] };
  }

  const [old1, old2, new1, new2] = update.return;
  const messages = [];

  const cube1 = await Cube.getById(old1.cubeID);
  const cube2 = await Cube.getById(old2.cubeID);
  cube1.featured = false;
  cube2.featured = false;
  await Cube.update(cube1);
  await Cube.update(cube2);

  const cube3 = await Cube.getById(new1.cubeID);
  const cube4 = await Cube.getById(new2.cubeID);
  cube3.featured = true;
  cube4.featured = true;
  await Cube.update(cube3);
  await Cube.update(cube4);

  return { success: 'true', messages, removed: [old1, old2], added: [new1, new2] };
}

async function isInFeaturedQueue(cube) {
  if (!cube) return false;
  const featured = await FeaturedCubes.getSingleton();
  return featured.queue.some((f) => cube.If === f.cubeID);
}

module.exports = {
  updateFeatured,
  rotateFeatured,
  canBeFeatured,
  isInFeaturedQueue,
};
