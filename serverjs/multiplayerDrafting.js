const uuid = require('uuid');
const { cardType } = require('../dist/utils/Card');
const carddb = require('./carddb');
const { draftbotPick, deckbuild } = require('./draftbots');

const Draft = require('../dynamo/models/draft');
const User = require('../dynamo/models/user');
const Cube = require('../dynamo/models/cube');
const cloudwatch = require('./cloudwatch');
const util = require('./util');

const {
  hget,
  hmget,
  hmset,
  lpush,
  rpush,
  hgetall,
  lrange,
  expire,
  rpoplpush,
  rpop,
  hincrby,
  del,
  hset,
  set,
  get,
} = require('./redis');

const { setupPicks, getCardCol, getStepList } = require('../dist/drafting/draftutil');

// returns a reference to a draft's metadata hash
const lobbyRef = (draftId) => `lobby:${draftId}`;

// returns a reference to a draft's metadata hash
const lobbyPlayersRef = (draftId) => `lobbylist:${draftId}`;

// returns a reference to a draft's metadata hash
const lobbyOrderRef = (draftId) => `lobbyorder:${draftId}`;

// returns a reference to a draft's metadata hash
const draftRef = (draftId) => `draft:${draftId}`;

const draftCardsRef = (draftId) => `draftcards:${draftId}`;

// returns a reference to a draft's metadata hash
const draftBotSeatsRef = (draftId) => `draft:${draftId}:botseats`;

// returns a reference to a seat's pack queue
const seatRef = (draftId, seat) => `draft:${draftId}:seat:${seat}`;

const stepsQueueRef = (draftId, seat) => `draft:${draftId}:steps:${seat}`;

// returns a reference to a draft's seating order
const seatsRef = (draftId) => `draft:${draftId}:seats`;

// returns a reference to a draft's current player list
const draftPlayersRef = (draftId) => `draft:${draftId}:players`;

// returns the reference to the initial contents of a pack
const packRef = (draftId, seat, pack) => `draft:${draftId}:pack:${seat}-${pack}`;

// returns the reference to the cards picked from a pack
const pickedRef = (draftId, seat, pack) => `draft:${draftId}:picked:${seat}-${pack}`;

// returns the reference to the cards picked by a user
const userPicksRef = (draftId, seat) => `draft:${draftId}:userpicks:${seat}`;

// returns the reference to the cards trashed by a user
const userTrashRef = (draftId, seat) => `draft:${draftId}:usertrash:${seat}`;

// converts a reference to a pack to a reference of the cards picked from that pack
const packToPicked = (ref) => ref.replace('pack', 'picked');

const nonIntersect = (list1, list2) => list1.filter((x) => !list2.includes(x));

const getPlayerPicks = async (draftId, seat) => lrange(userPicksRef(draftId, seat), 0, -1);
const getPlayerTrash = async (draftId, seat) => lrange(userTrashRef(draftId, seat), 0, -1);

const obtainLock = async (draftId, random, timeout = 10000) => {
  await set(`draft:${draftId}:lock`, random, 'NX', 'PX', timeout);
  const value = await get(`draft:${draftId}:lock`);
  if (value === random) {
    return true;
  }
  return false;
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const releaseLock = async (draftId, random) => {
  const value = await get(`draft:${draftId}:lock`);
  if (value === random) {
    await del(`draft:${draftId}:lock`);
  }
};

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
  if (packReference === undefined) {
    return [];
  }

  const cards = await lrange(packReference, 0, -1);
  const picked = await lrange(packToPicked(packReference), 0, -1);
  return nonIntersect(cards, picked);
};

const getPlayerPackReference = async (draftId, seat) => {
  // get reference to pack and to the cards picked from it
  const packs = await lrange(seatRef(draftId, seat), -1, -1);
  if (packs.length <= 0) {
    return undefined;
  }

  return packs[packs.length - 1];
};

const getPlayerPack = async (draftId, seat) => {
  const ref = await getPlayerPackReference(draftId, seat);
  if (ref === undefined) {
    return [];
  }
  return getCurrentPackCards(ref);
};

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

const getCurrentPackStep = async (draftId, seat) => {
  const [next] = await lrange(stepsQueueRef(draftId, seat), -1, -1);
  return next;
};

const getCurrentPackStepQueue = async (draftId, seat) => {
  const items = await lrange(stepsQueueRef(draftId, seat), 0, -1);
  return items.reverse();
};

const currentPackStepIsPadding = async (draftId, seat) => {
  const step = await getCurrentPackStep(draftId, seat);
  return step === 'pass' || step === 'endpack';
};

const getPassAmount = async (draftId, seat) => {
  const steps = await lrange(stepsQueueRef(draftId, seat), 0, -1);
  let foundStep = false;
  let passes = 0;

  for (let i = steps.length - 1; i >= 0; i--) {
    if (steps[i] === 'pass') {
      foundStep = true;
      passes += 1;
    } else if (foundStep) {
      return passes;
    }
  }

  return 0;
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

const getDraftBotsSeats = async (draftId) => {
  const indexes = await lrange(draftBotSeatsRef(draftId), 0, -1);
  return indexes.map((i) => parseInt(i, 10));
};

// if all human seats have nothing to pick from, but the draft is not over
const packNeedsBotPicks = async (draftId) => {
  if (await isPackDone(draftId)) {
    return false;
  }

  const { seats } = await getDraftMetaData(draftId);
  const bots = await getDraftBotsSeats(draftId);

  for (let i = 0; i < seats; i++) {
    if (bots.includes(i)) {
      const packReference = await getPlayerPackReference(draftId, i);

      if (packReference) {
        const packCards = await getCurrentPackCards(packReference);
        if (packCards.length > 0) {
          return true;
        }
      }
    }
  }

  return false;
};

const cleanUp = async (draftId) => {
  // get draft metadata
  const { seats, totalPacks } = await getDraftMetaData(draftId);

  // delete all references
  for (let i = 0; i < seats; i++) {
    await del(seatRef(draftId, i));
    await del(userPicksRef(draftId, i));
    await del(userTrashRef(draftId, i));
    for (let j = 0; j < totalPacks; j++) {
      await del(packRef(draftId, i));
      await del(pickedRef(draftId, i));
    }
  }
};

const buildBotDeck = (picks, draft) => {
  const { mainboard } = deckbuild(
    picks.map((index) => draft.cards[index].details),
    draft.basics.map((index) => draft.cards[index].details),
  );

  const pool = picks.slice();

  const newMainboard = [];

  for (const oracle of mainboard) {
    const poolIndex = pool.findIndex((cardindex) => draft.cards[cardindex].details.oracle_id === oracle);
    if (poolIndex === -1) {
      // try basics
      const basicsIndex = draft.basics.findIndex((cardindex) => draft.cards[cardindex].details.oracle_id === oracle);
      if (basicsIndex !== -1) {
        newMainboard.push(draft.basics[basicsIndex]);
      }
    } else {
      newMainboard.push(pool[poolIndex]);
      pool.splice(poolIndex, 1);
    }
  }

  // format mainboard
  const formattedMainboard = [[], []];
  const formattedSideboard = [[]];
  for (let i = 0; i < 8; i++) {
    formattedMainboard[0].push([]);
    formattedMainboard[1].push([]);
    formattedSideboard[0].push([]);
  }

  for (const index of newMainboard) {
    const card = draft.cards[index];
    const row = card.details.type.includes('Creature') || card.details.type.includes('Basic') ? 0 : 1;
    const column = Math.max(0, Math.min(card.details.cmc, 7));

    formattedMainboard[row][column].push(index);
  }

  for (const index of pool) {
    if (!draft.basics.includes(index)) {
      const card = draft.cards[index];
      const column = Math.max(0, Math.min(card.details.cmc, 7));

      formattedSideboard[0][column].push(index);
    }
  }

  return {
    mainboard: formattedMainboard,
    sideboard: formattedSideboard,
  };
};

const finishDraft = async (draftId) => {
  // ensure this is only called once
  const lock = await obtainLock(`finishdraft:${draftId}`, uuid.v4(), 30000);

  if (!lock) {
    return;
  }

  const draft = await Draft.getById(draftId);
  const cube = await Cube.getById(draft.cube);
  const draftOwner = draft.seats[0].owner;

  const { seats } = await getDraftMetaData(draftId);
  // set user picks to the actual picks
  for (let i = 0; i < seats; i++) {
    const picks = await getPlayerPicks(draftId, i);
    const trash = await getPlayerTrash(draftId, i);

    draft.seats[i].pickorder = picks.map((p) => parseInt(p, 10));
    draft.seats[i].trashorder = trash.map((p) => parseInt(p, 10));

    if (draft.seats[i].owner) {
      const mainboard = setupPicks(2, 8);
      const sideboard = setupPicks(1, 8);

      for (const cardIndex of picks) {
        const col = getCardCol(draft, cardIndex);
        const row = cardType(draft.cards[cardIndex]).toLowerCase().includes('creature') ? 0 : 1;
        mainboard[row][col].push(parseInt(cardIndex, 10));
      }

      draft.seats[i].sideboard = sideboard;
      draft.seats[i].mainboard = mainboard;
    } else {
      // bot build
      const result = buildBotDeck(picks, draft);

      draft.seats[i].sideboard = result.sideboard;
      draft.seats[i].mainboard = result.mainboard;
    }
  }

  draft.complete = true;
  await Draft.put(draft);
  await hset(draftRef(draftId), 'finished', true);
  await cleanUp(draftId);

  if (cube.owner.id !== draftOwner.id && !cube.disableAlerts) {
    await util.addNotification(
      cube.owner,
      draftOwner,
      `/cube/deck/${draft.id}`,
      `${draftOwner.username} drafted your cube: ${cube.name}`,
    );
  }
};

const createLobby = async (draft, hostUser) => {
  const lobbylist = lobbyPlayersRef(draft.id);
  const lobbyorder = lobbyOrderRef(draft.id);
  const lobby = lobbyRef(draft.id);

  await hmset(lobby, ['seats', `${draft.seats.length}`, 'host', `${hostUser.id}`]);
  await hmset(lobbyorder, [`${hostUser.id}`, '0']);
  await rpush(lobbylist, `${hostUser.id}`);
};

const getLobbySeatOrder = async (draftId) => hgetall(lobbyOrderRef(draftId));
const getLobbyPlayers = async (draftId) => lrange(lobbyPlayersRef(draftId), 0, -1);
const getLobbyMetadata = async (draftId) => hgetall(lobbyRef(draftId));
const updateLobbySeatOrder = (draftid, order) => hmset(lobbyOrderRef(draftid), Object.entries(order).flat());

const addPlayerToLobby = async (userId, draftId) => {
  await rpush(lobbyPlayersRef(draftId), userId);

  const seatOrder = await getLobbySeatOrder(draftId);
  if (!seatOrder[userId]) {
    let i = 0;
    while (
      Object.entries(seatOrder)
        .map(([, val]) => val)
        .includes(`${i}`)
    ) {
      i += 1;
    }
    await hset(lobbyOrderRef(draftId), `${userId}`, `${i}`);
  }
};

const setup = async (draft) => {
  // check if the draft is already setup
  const initialized = await hget(draftRef(draft.id), 'initialized');

  if (!initialized) {
    // setup the draft metadata
    await hmset(draftRef(draft.id), [
      'seats',
      draft.seats.length,
      'currentPack',
      0,
      'totalPacks',
      draft.InitialState[0].length,
      'initialized',
      true,
      'finished',
      false,
      'state',
      'drafting',
    ]);

    // push all the oracle ids to redis
    await rpush(
      draftCardsRef(draft.id),
      draft.cards.map((card) => card.cardID),
    );
    await expire(draftCardsRef(draft.id), 60 * 60 * 24 * 2); // expire in 2 days

    // create a list of steps for each seat
    const stepList = getStepList(draft.InitialState);
    for (let i = 0; i < draft.seats.length; i++) {
      for (const step of stepList) {
        await lpush(stepsQueueRef(draft.id, i), step.action);
      }
    }

    // create a pack contents for each pack
    for (let i = 0; i < draft.InitialState.length; i++) {
      for (let j = 0; j < draft.InitialState[i].length; j++) {
        const pack = packRef(draft.id, i, j);
        await rpush(pack, draft.InitialState[i][j].cards);
        await expire(pack, 60 * 60 * 24 * 2); // 2 days
      }
    }

    const seats = await getLobbySeatOrder(draft.id);
    const playerSeats = Object.entries(seats).map(([, val]) => val);

    // save which seats are bot seats
    for (let i = 0; i < draft.seats.length; i++) {
      if (!playerSeats.includes(`${i}`)) {
        await lpush(draftBotSeatsRef(draft.id), i);
      }
    }

    // open the first pack
    await openPack(draft.id);
  }
};

const makePick = async (draftId, seat, pick, nextSeat) => {
  // get reference to pack and to the cards picked from it
  const packReference = await getPlayerPackReference(draftId, seat);
  if (!packReference) {
    return; // no pack to pick from
  }

  const packCards = await getCurrentPackCards(packReference);
  if (packCards.length <= pick) {
    // pack is empty, we fail
    return;
  }

  const picked = packToPicked(packReference);
  const step = await rpop(stepsQueueRef(draftId, seat));

  // pick this card if the step is pick
  if (step === 'pick' || step === 'pickrandom') {
    await lpush(userPicksRef(draftId, seat), packCards[pick]);
    await expire(userPicksRef(draftId, seat), 60 * 60 * 24 * 2); // 2 days
  } else if (step === 'trash' || step === 'trashrandom') {
    await lpush(userTrashRef(draftId, seat), packCards[pick]);
    await expire(userTrashRef(draftId, seat), 60 * 60 * 24 * 2); // 2 days
  }
  // push the card into the picked mask
  await lpush(picked, packCards[pick]);
  await expire(picked, 60 * 60 * 24 * 2); // 2 days

  // look if the next action is a pass
  const next = await getCurrentPackStep(draftId, seat);
  if (next === 'pass' || next === 'endpack') {
    // rotate the pack to the next seat
    await rpoplpush(seatRef(draftId, seat), seatRef(draftId, nextSeat));
  }

  while (await currentPackStepIsPadding(draftId, seat)) {
    await rpop(stepsQueueRef(draftId, seat));
  }
};

const getDraftPick = async (draftId, seat) => {
  const packReference = await getPlayerPackReference(draftId, seat);
  const cardsInPack = await getCurrentPackCards(packReference);

  if (cardsInPack.length === 0) {
    return 0;
  }

  // const fullPack = await lrange(packReference, 0, -1);

  // get draft metadata
  // const { currentPack, totalPacks } = await getDraftMetaData(draftId);

  const cardOracleIds = (await lrange(draftCardsRef(draftId), 0, -1)).map(
    (scryfallId) => carddb.cardFromId(scryfallId).oracle_id,
  ); // all the oracle ids
  const picked = await getPlayerPicks(draftId, seat); // the cards picked by the user

  const drafterState = {
    cardsInPack: cardsInPack.map((card) => cardOracleIds[card]),
    picked: picked.map((card) => cardOracleIds[card]),
    // pickNum: strToInt(fullPack.length - cardsInPack.length), // 0-Indexed pick number from this pack (so this will be the 5th card they've picked since opening the first pack of the draft).
    // numPicks: strToInt(fullPack.length), // How many cards were in the pack when it was opened.
    // packNum: strToInt(currentPack) - 1, // 0-Indexed pack number
    // numPacks: strToInt(totalPacks), // How many packs will this player open
  };

  let choice = 0;
  try {
    choice = await draftbotPick(drafterState);
  } catch (e) {
    cloudwatch.error(e.message, e.stack);
  }

  return Math.max(0, choice);
};

const tryBotPicks = async (draftId) => {
  const { currentPack, seats, totalPacks } = await getDraftMetaData(draftId);
  const finished = await hget(draftRef(draftId), 'finished');
  let picks = 0;
  if (finished === 'true') {
    return { result: 'done', picks };
  }

  const passDirection = currentPack % 2 === 0 ? 1 : -1;

  if (await packNeedsBotPicks(draftId)) {
    // make bot picks
    const botSeats = await getDraftBotsSeats(draftId);
    if (passDirection === 1) {
      botSeats.reverse();
    }
    for (const seat of botSeats) {
      const packReference = await getPlayerPackReference(draftId, seat);

      if (packReference !== null) {
        const passAmount = await getPassAmount(draftId, seat);
        const next = (seat + seats + passDirection * passAmount) % seats;

        await makePick(draftId, seat, await getDraftPick(draftId, seat), next);
        picks += 1;
      }
    }
  }

  if (await isPackDone(draftId)) {
    if (currentPack < totalPacks) {
      await openPack(draftId);
      return { result: 'inProgress', picks };
    }
    // draft is done
    await finishDraft(draftId);
    return { result: 'done', picks };
  }
  return { result: 'inProgress', picks };
};

const dumpDraft = async (draftId) => {
  // this should return the entire state of the draft in redis
  const draft = await Draft.getById(draftId);

  const metadata = await getDraftMetaData(draftId);
  const bots = await getDraftBotsSeats(draftId);
  const seats = await getLobbySeatOrder(draft.id);

  const order = Object.fromEntries(Object.entries(seats).map(([s, i]) => [parseInt(i, 10), s]));

  const seatState = [];
  for (let i = 0; i < metadata.seats; i++) {
    if (order[i]) {
      const user = await User.getById(order[i]);
      seatState.push({
        seat: i,
        picks: await getPlayerPicks(draftId, i),
        trash: await getPlayerTrash(draftId, i),
        packQueue: await lrange(seatRef(draftId, i), 0, -1),
        bot: bots.includes(i),
        user: {
          id: user.id,
          username: user.username,
        },
      });
    } else {
      // current picks
      seatState.push({
        seat: i,
        picks: await getPlayerPicks(draftId, i),
        trash: await getPlayerTrash(draftId, i),
        packQueue: await lrange(seatRef(draftId, i), 0, -1),
        bot: bots.includes(i),
      });
    }
  }

  const packs = {};
  for (let i = 0; i < metadata.totalPacks; i++) {
    for (let j = 0; j < metadata.seats; j++) {
      const ref = packRef(draftId, i, j);

      packs[ref] = {
        pack: await lrange(ref, 0, -1),
        picked: await lrange(pickedRef(draftId, i, j), 0, -1),
      };
    }
  }

  return {
    draft,
    metadata,
    seatState,
    packs,
    seats,
  };
};

module.exports = {
  setup,
  getDraftMetaData,
  openPack,
  getPlayerPack,
  getPlayerPicks,
  getDraftBotsSeats,
  makePick,
  getPassAmount,
  isPackDone,
  seatRef,
  seatsRef,
  draftRef,
  getCurrentPackCards,
  draftPlayersRef,
  createLobby,
  getLobbyPlayers,
  getLobbySeatOrder,
  getLobbyMetadata,
  addPlayerToLobby,
  lobbyPlayersRef,
  lobbyOrderRef,
  updateLobbySeatOrder,
  packNeedsBotPicks,
  getCurrentPackStep,
  getCurrentPackStepQueue,
  tryBotPicks,
  dumpDraft,
};
