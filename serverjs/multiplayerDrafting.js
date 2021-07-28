/* eslint-disable no-await-in-loop */
const { hget, hmget, hmset, lpush, rpush, lrange, expire, rpoplpush, rpop, hincrby, del } = require('./redis');

// returns a reference to a draft's metadata hash
const draftRef = (draftId) => `draft:${draftId}`;

// returns a reference to a draft's metadata hash
const draftBotSeatsRef = (draftId) => `draft:${draftId}:botseats`;

// returns a reference to a seat's pack queue
const seatRef = (draftId, seat) => `draft:${draftId}:seat:${seat}`;

// returns the reference to the initial contents of a pack
const packRef = (draftId, seat, pack) => `draft:${draftId}:pack:${seat}-${pack}`;

// returns the reference to the cards picked from a pack
const pickedRef = (draftId, seat, pack) => `draft:${draftId}:picked:${seat}-${pack}`;

// returns the reference to the cards picked by a user
const userPicksRef = (draftId, seat) => `draft:${draftId}:userpicks:${seat}`;

// converts a reference to a pack to a reference of the cards picked from that pack
const packToPicked = (ref) => ref.replace('pack', 'picked');

const nonIntersect = (list1, list2) => list1.filter((x) => !list2.includes(x));

const getDraftMetaData = async (draftId) => {
  const [seats, currentPack, totalPacks, initialized] = await hmget(
    draftRef(draftId),
    'seats',
    'currentPack',
    'totalPacks',
    'initialized',
  );
  return {
    seats: parseInt(seats, 10),
    currentPack: parseInt(currentPack, 10),
    totalPacks: parseInt(totalPacks, 10),
    initialized,
  };
};

const getCurrentPackCards = async (packReference) => {
  const cards = await lrange(packReference, 0, -1);
  const picked = await lrange(packToPicked(packReference), 0, -1);
  return nonIntersect(cards, picked);
};

const getPlayerPackReference = async (draftId, seat) => {
  // get reference to pack and to the cards picked from it
  const packs = await lrange(seatRef(draftId, seat), -1, -1);
  if (packs.length <= 0) {
    return [];
  }

  return packs[packs.length - 1];
};

const getPlayerPack = async (draftId, seat) => getCurrentPackCards(await getPlayerPackReference(draftId, seat));

const openPack = async (draftId) => {
  // get draft metadata
  const { seats, currentPack, totalPacks } = await getDraftMetaData(draftId);

  if (currentPack < totalPacks) {
    // add the contents of the pack
    for (let i = 0; i < seats; i++) {
      const seat = seatRef(draftId, i);
      await rpop(seat);
      await rpush(seat, packRef(draftId, i, currentPack));
      await expire(seat, 60 * 60 * 24 * 2); // 2 days
    }

    // increment the current pack
    await hincrby(draftRef(draftId), 'currentPack', 1);
  }
};

const setup = async (draft) => {
  // check if the draft is already setup
  const initialized = await hget(draftRef(draft.id), 'initialized');

  if (!initialized) {
    // setup the draft metadata
    await hmset(draftRef(draft._id), [
      'seats',
      draft.seats.length,
      'currentPack',
      0,
      'totalPacks',
      draft.initial_state[0].length,
      'initialized',
      true,
    ]);

    // create a pack contents for each pack
    for (let i = 0; i < draft.initial_state.length; i++) {
      for (let j = 0; j < draft.initial_state[i].length; j++) {
        const pack = packRef(draft._id, i, j);
        await rpush(pack, draft.initial_state[i][j].cards);
        await expire(pack, 60 * 60 * 24 * 2); // 2 days
      }
    }

    // save which seats are bot seats
    for (let i = 0; i < draft.seats.length; i++) {
      if (draft.seats[i].bot) {
        await lpush(draftBotSeatsRef(draft._id), i);
      }
    }

    // open the first pack
    await openPack(draft._id);
  }
};

const printDraftState = async (draftId) => {
  const { seats, currentPack, totalPacks } = await getDraftMetaData(draftId);
  // eslint-disable-next-line no-console
  console.log({ draftId, seats, currentPack, totalPacks });
  for (let i = 0; i < seats; i++) {
    const packs = await lrange(seatRef(draftId, i), 0, -1);
    // eslint-disable-next-line no-console
    console.log(`Seat ${i} has packs: ${packs.join(', ')}`);
  }
};

const makePick = async (draftId, seat, pick, nextSeat) => {
  // get reference to pack and to the cards picked from it
  const packReference = await getPlayerPackReference(draftId, seat);

  if (!packReference) {
    throw new Error(`Seat ${seat} has no pack`);
  }

  const packCards = await getCurrentPackCards(packReference);
  const picked = packToPicked(packReference);

  // push the card into the picked list
  await lpush(picked, packCards[pick]);
  await expire(picked, 60 * 60 * 24 * 2); // 2 days
  await lpush(userPicksRef(draftId, seat), packCards[pick]);
  await expire(userPicksRef(draftId, seat), 60 * 60 * 24 * 2); // 2 days

  // rotate the pack to the next seat
  await rpoplpush(seatRef(draftId, seat), seatRef(draftId, nextSeat));
};

const isPackDone = async (draftId) => {
  const { seats, currentPack } = await getDraftMetaData(draftId);

  for (let i = 0; i < seats; i++) {
    // get reference to the pack and to the cards picked from it
    const pack = packRef(draftId, i, currentPack - 1);

    const packCards = await getCurrentPackCards(pack);
    if (packCards.length > 0) {
      return false;
    }
  }

  return true;
};

const getPlayerPicks = async (draftId, seat) => {
  const userPicks = await lrange(userPicksRef(draftId, seat), 0, -1);
  return userPicks;
};

const getDraftBotsSeats = async (draftId) => {
  const indexes = await lrange(draftBotSeatsRef(draftId), 0, -1);
  return indexes.map((i) => parseInt(i, 10));
};

const cleanUp = async (draftId) => {
  // get draft metadata
  const { seats, totalPacks } = await getDraftMetaData(draftId);

  // delete all references
  for (let i = 0; i < seats; i++) {
    await del(seatRef(draftId, i));
    await del(userPicksRef(draftId, i));
    for (let j = 0; j < totalPacks; j++) {
      await del(packRef(draftId, i));
      await del(pickedRef(draftId, i));
    }
  }

  // delete metadata
  await del(draftRef(draftId));
};

module.exports = {
  setup,
  getDraftMetaData,
  openPack,
  getPlayerPack,
  getPlayerPicks,
  getDraftBotsSeats,
  makePick,
  isPackDone,
  cleanUp,
  seatRef,
  getCurrentPackCards,
  printDraftState,
};
