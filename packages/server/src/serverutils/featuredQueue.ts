import { canBeFeatured } from '@utils/featuredQueueUtil';
import { cubeDao } from 'dynamo/daos';
import { FeaturedQueue } from 'dynamo/models/featuredQueue';
import Patron from 'dynamo/models/patron';

interface RotateResult {
  success: string;
  messages: string[];
  removed: any[];
  added: any[];
}

export async function rotateFeatured(): Promise<RotateResult> {
  // Step 1: Fetch entire queue
  const cubes: any[] = [];
  let lastKey: Record<string, any> | null = null;

  do {
    const result = await FeaturedQueue.querySortedByDate(lastKey || undefined);
    cubes.push(...(result.items || []));
    lastKey = result.lastKey || null;
  } while (lastKey);

  if (cubes.length < 4) {
    return {
      success: 'false',
      messages: [`Not enough cubes in queue to rotate (need 4, have ${cubes.length})`],
      removed: [],
      added: [],
    };
  }

  // Step 2: Check patron status for all cubes and remove ineligible ones
  const uniqueOwners = [...new Set(cubes.map((c) => c.owner))];
  const patronData = await Promise.all(uniqueOwners.map((ownerId) => Patron.getById(ownerId)));
  const patronMap: Record<string, any> = {};
  uniqueOwners.forEach((ownerId, index) => {
    patronMap[ownerId] = patronData[index];
  });

  const removedCubes: any[] = [];
  const cleanupOperations: Promise<any>[] = [];

  for (const cube of cubes) {
    const patron = patronMap[cube.owner];
    if (!canBeFeatured(patron)) {
      removedCubes.push(cube);
      cleanupOperations.push(FeaturedQueue.delete(cube.cube));
    }
  }

  await Promise.all(cleanupOperations);

  // Filter out removed cubes
  const cleanQueue = cubes.filter((cube) => !removedCubes.includes(cube));

  if (cleanQueue.length < 4) {
    return {
      success: 'false',
      messages: [`Not enough cubes in queue after patron check (need 4, have ${cleanQueue.length})`],
      removed: removedCubes,
      added: [],
    };
  }

  // Step 3: Rotate - move first 2 cubes to the back
  const now = Date.now().valueOf();

  // Take first 2 cubes (currently featured)
  const currentlyFeatured = cleanQueue.slice(0, 2);

  // The next 2 cubes will become featured
  const newFeatured = cleanQueue.slice(2, 4);

  // Move currently featured to back of queue with new date
  const rotateOperations = currentlyFeatured.map((item) => {
    item.date = now;
    return FeaturedQueue.put(item);
  });

  await Promise.all(rotateOperations);

  return {
    success: 'true',
    messages: removedCubes.length > 0 ? [`Removed ${removedCubes.length} cubes due to patron status`] : [],
    removed: removedCubes,
    added: newFeatured,
  };
}

export async function getFeaturedCubes() {
  // The first 2 items in the queue are always the featured cubes
  const queueResult = await FeaturedQueue.querySortedByDate(undefined, 2);
  if (!queueResult.items || queueResult.items.length === 0) {
    return [];
  }

  const cubeIds = queueResult.items.map((item) => item.cube);
  const cubes = await cubeDao.batchGet(cubeIds);
  return cubes;
}

export async function isInFeaturedQueue(cube: any) {
  if (!cube) {
    return false;
  }
  return FeaturedQueue.getByCube(cube.id);
}

export async function getFeaturedQueueForUser(userid: string) {
  const cubes: any[] = [];
  let lastKey: Record<string, any> | null = null;

  do {
    const result = await FeaturedQueue.queryWithOwnerFilter(userid, lastKey || undefined);
    cubes.push(...(result.items || []));
    lastKey = result.lastKey || null;
  } while (lastKey);

  return cubes;
}

export async function doesUserHaveFeaturedCube(userid: string) {
  const cubes = await getFeaturedQueueForUser(userid);
  return cubes.length > 0;
}

export async function replaceForUser(userid: string, cubeid: string) {
  // Use the owner-filtered query instead of fetching entire queue
  const cubes = await getFeaturedQueueForUser(userid);

  if (cubes.length === 0) {
    throw new Error('Cannot replace cube that is not in queue');
  }

  const item = cubes[0]; // User should only have one cube in queue

  // Check if cube is currently featured (in first 2 positions)
  const queueResult = await FeaturedQueue.querySortedByDate(undefined, 2);
  const isFeatured = queueResult.items?.some((queueItem) => queueItem.cube === item.cube);

  if (isFeatured) {
    throw new Error('Cannot replace cube that is currently featured');
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

export async function addNewCubeToQueue(userid: string, cubeid: string) {
  await FeaturedQueue.put({
    cube: cubeid,
    date: Date.now().valueOf(),
    owner: userid,
    featuredOn: null,
  });
}

export async function removeCubeFromQueue(ownerid: string) {
  const cubes = await getFeaturedQueueForUser(ownerid);

  if (cubes.length === 0) {
    throw new Error('Cannot remove cube that is not in queue');
  }

  const cubeid = cubes[0].cube;

  await FeaturedQueue.delete(cubeid);
}

export { canBeFeatured };
