import similarity from 'compute-cosine-similarity';

import { COLOR_COMBINATIONS, cardColorIdentity, cardDevotion, cardType, COLOR_INCLUSION_MAP } from 'utils/Card';
import { csrfFetch } from 'utils/CSRF';
import {
  getRating,
  botRatingAndCombination,
  considerInCombination,
  getPickSynergy,
  isPlayableLand,
  scaleSimilarity,
  SYNERGY_SCALE,
} from 'utils/draftbots';
import { arrayShuffle, fromEntries } from 'utils/Util';

let draft = null;

export const createSeen = () => ({
  values: fromEntries(COLOR_COMBINATIONS.map((comb) => [comb.join(''), 0])),
  synergies: fromEntries(COLOR_COMBINATIONS.map((comb) => [comb.join(''), 0])),
  cards: fromEntries(COLOR_COMBINATIONS.map((comb) => [comb.join(''), []])),
});

// This function tracks the total goodness of the cards we've seen or picked in this color.
export const addSeen = (seen, cards, synergies) => {
  for (const card of cards) {
    const rating = 10 ** ((card?.rating ?? 1200) / 400 - 4);
    const colors = cardColorIdentity(card);
    const colorsStr = colors.join('');
    // We ignore colorless because they just reduce variance by
    // being in all color combinations.
    for (const comb of COLOR_COMBINATIONS) {
      const combStr = comb.join('');
      if (COLOR_INCLUSION_MAP[combStr][colorsStr]) {
        for (const { index } of seen.cards[combStr]) {
          const similarityValue = similarity(synergies[card.index], synergies[index]);
          seen.synergies[combStr] += -Math.log(1 - scaleSimilarity(similarityValue)) / SYNERGY_SCALE;
        }
        seen.cards[combStr].push(card);
        if (colors.length > 0) {
          seen.values[combStr] += rating;
        }
      }
    }
  }
};

function init(newDraft) {
  draft = newDraft;
  for (const seat of draft.seats) {
    seat.seen = createSeen();
    addSeen(seat.seen, seat.packbacklog[0].slice(), draft.synergies);
    seat.picked = createSeen();
  }
}

function id() {
  return draft._id;
}

function cube() {
  return draft.cube;
}

function pack() {
  return draft.seats[0].packbacklog[0] || [];
}

function packPickNumber() {
  let picks = draft.seats[draft.seats.length - 1].pickorder.length;
  let packnum = 0;

  while (draft.initial_state[0][packnum] && picks >= draft.initial_state[0][packnum].length) {
    picks -= draft.initial_state[0][packnum].length;
    packnum += 1;
  }

  return [packnum + 1, picks + 1];
}

function arrangePicks(picks) {
  if (!Array.isArray(picks) || picks.length !== 16) {
    throw new Error('Picks must be an array of length 16.');
  }

  draft.seats[0].drafted = [...picks];
}

const botRating = (card, picked, seen, synergies, initialState, inPack = 1, packNum = 1) =>
  botRatingAndCombination(card, picked, seen, synergies, initialState, inPack, packNum)[0];
const botColors = (card, picked, seen, synergies, initialState, inPack = 1, packNum = 1) =>
  botRatingAndCombination(card, picked, seen, synergies, initialState, inPack, packNum)[1];

function getSortFn(bot) {
  return (a, b) => {
    if (bot) {
      return getRating(bot, b) - getRating(bot, a);
    }
    return b.rating - a.rating;
  };
}

export const calculateBasicCounts = (main, colors) => {
  // add up colors
  const symbols = {
    W: 0,
    U: 0,
    B: 0,
    R: 0,
    G: 0,
  };

  for (const card of main) {
    for (const symbol of ['W', 'U', 'B', 'R', 'G']) {
      symbols[symbol] += cardDevotion(card, symbol) ?? 0;
    }
  }
  const colorWeights = Object.values(symbols);
  const totalColor = colorWeights.reduce((a, b) => {
    return a + b;
  }, 0);
  const result = {};

  const landDict = {
    W: 'Plains',
    U: 'Island',
    B: 'Swamp',
    R: 'Mountain',
    G: 'Forest',
  };
  const desiredLength = Math.floor((40 * main.filter((c) => !cardType(c).toLowerCase().includes('land')).length) / 23);
  const toAdd = desiredLength - main.length;
  let added = 0;
  for (const [symbol, weight] of Object.entries(symbols)) {
    const amount = Math.floor((weight / totalColor) * toAdd);
    result[landDict[symbol]] = amount;
    added += amount;
  }
  for (let i = main.length + added; i < desiredLength; i++) {
    result[landDict[colors[i % colors.length]]] += 1;
  }
  return result;
};

export async function buildDeck(cards, picked, synergies, initialState, basics) {
  let nonlands = cards.filter((card) => !card.details.type.toLowerCase().includes('land'));
  const lands = cards.filter((card) => card.details.type.toLowerCase().includes('land'));

  const colors = botColors(null, picked, null, null, synergies, initialState, 1, initialState[0].length);
  const sortFn = getSortFn(colors);
  const inColor = nonlands.filter((item) => considerInCombination(colors, item));
  const outOfColor = nonlands.filter((item) => !considerInCombination(colors, item));

  lands.sort(sortFn);
  inColor.sort(sortFn);

  const playableLands = lands.filter((land) => isPlayableLand(colors, land));
  const unplayableLands = lands.filter((land) => !isPlayableLand(colors, land));

  console.log(inColor.length / nonlands.length, inColor.length);

  nonlands = inColor;
  let side = outOfColor;
  if (nonlands.length < 23) {
    outOfColor.sort(sortFn);
    nonlands.push(...outOfColor.splice(0, 23 - nonlands.length));
    side = [...outOfColor];
  }

  // add highest synergy card, then add cards based on a combo of elo and synergy
  const chosen = [];
  const played = createSeen();

  const size = Math.min(23, nonlands.length);
  for (let i = 0; i < size; i++) {
    // add in new synergy data
    const scores = [];
    scores.push(nonlands.map((card) => getPickSynergy(colors, card, played, synergies)));

    let best = 0;

    for (let j = 1; j < nonlands.length; j++) {
      if (scores[j] > scores[best]) {
        best = j;
      }
    }
    const current = nonlands.splice(best, 1)[0];
    addSeen(played, [current], synergies);
    chosen.push(current);
  }

  const main = chosen.concat(playableLands.slice(0, 17));
  side.push(...playableLands.slice(17));
  side.push(...unplayableLands);
  side.push(...nonlands);

  if (basics) {
    const basicsToAdd = calculateBasicCounts(main, colors);
    for (const [basic, count] of Object.entries(basicsToAdd)) {
      for (let i = 0; i < count; i++) {
        main.push(basics[[basic]]);
      }
    }
  }
  const deck = [];
  const sideboard = [];
  for (let i = 0; i < 16; i += 1) {
    deck.push([]);
    if (i < 8) {
      sideboard.push([]);
    }
  }

  for (const card of main) {
    let index = Math.min(card.cmc ?? 0, 7);
    if (!card.details.type.toLowerCase().includes('creature') && !card.details.type.toLowerCase().includes('basic')) {
      index += 8;
    }
    deck[index].push(card);
  }

  // sort the basic land col
  deck[0].sort((a, b) => a.details.name.localeCompare(b.details.name));

  for (const card of side) {
    sideboard[Math.min(card.cmc ?? 0, 7)].push(card);
  }

  return {
    deck,
    sideboard,
    colors,
  };
}

function botPicks() {
  // make bots take one pick out of active packs
  for (let botIndex = 0; botIndex < draft.seats.length; botIndex++) {
    const {
      seen,
      picked,
      packbacklog: [packFrom],
      bot,
    } = draft.seats[botIndex];
    if (packFrom.length > 0 && bot) {
      const { initial_state, synergies } = draft;
      let ratedPicks = [];
      const unratedPicks = [];
      const inPack = packFrom.length;
      const [packNum] = packPickNumber();
      for (let cardIndex = 0; cardIndex < packFrom.length; cardIndex++) {
        if (packFrom[cardIndex].rating) {
          ratedPicks.push(cardIndex);
        } else {
          unratedPicks.push(cardIndex);
        }
      }
      ratedPicks = ratedPicks
        .map((cardIndex) => [
          botRating(packFrom[cardIndex], picked, seen, synergies, initial_state, inPack, packNum),
          cardIndex,
        ])
        .sort(([a], [b]) => b - a)
        .map(([, cardIndex]) => cardIndex);
      arrayShuffle(unratedPicks);

      const pickOrder = ratedPicks.concat(unratedPicks);
      const pickedCard = draft.seats[botIndex].packbacklog[0].splice(pickOrder[0], 1)[0];
      draft.seats[botIndex].pickorder.push(pickedCard);
      addSeen(picked, [pickedCard], draft.synergies);
    }
  }
}

function passPack() {
  botPicks();
  // check if pack is done
  if (draft.seats.every((seat) => seat.packbacklog[0].length === 0)) {
    // splice the first pack out
    for (const seat of draft.seats) {
      seat.packbacklog.splice(0, 1);
    }

    if (draft.unopenedPacks[0].length > 0) {
      // give new pack
      for (let i = 0; i < draft.seats.length; i++) {
        draft.seats[i].packbacklog.push(draft.unopenedPacks[i].shift());
      }
    }
  } else if (draft.unopenedPacks[0].length % 2 === 0) {
    // pass left
    for (let i = 0; i < draft.seats.length; i++) {
      draft.seats[(i + 1) % draft.seats.length].packbacklog.push(draft.seats[i].packbacklog.splice(0, 1)[0]);
    }
  } else {
    // pass right
    for (let i = draft.seats.length - 1; i >= 0; i--) {
      const packFrom = draft.seats[i].packbacklog.splice(0, 1)[0];
      if (i === 0) {
        draft.seats[draft.seats.length - 1].packbacklog.push(packFrom);
      } else {
        draft.seats[i - 1].packbacklog.push(packFrom);
      }
    }
  }
  for (const seat of draft.seats) {
    if (seat.packbacklog && seat.packbacklog.length > 0) {
      addSeen(seat.seen, seat.packbacklog[0], draft.synergies);
    }
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function pick(cardIndex) {
  await sleep(0);
  const card = draft.seats[0].packbacklog[0].splice(cardIndex, 1)[0];
  const packFrom = draft.seats[0].packbacklog[0];
  draft.seats[0].pickorder.push(card);
  passPack();
  const [packNum] = packPickNumber();
  csrfFetch(`/cube/api/draftpickcard/${draft.cube}`, {
    method: 'POST',
    body: JSON.stringify({
      draft_id: draft._id,
      pick: card.details.name,
      pack: packFrom.map((c) => c.details.name),
      packNum,
    }),
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

async function finish() {
  // build bot decks
  const decksPromise = draft.seats.map((seat) => {
    return seat.bot && buildDeck(seat.pickorder, seat.picked, draft.synergies, draft.initial_state, draft.basics);
  });
  const decks = await Promise.all(decksPromise);

  let botIndex = 1;
  for (let i = 0; i < draft.seats.length; i++) {
    if (draft.seats[i].bot) {
      const { deck, sideboard, colors } = decks[i];
      draft.seats[i].drafted = deck;
      draft.seats[i].sideboard = sideboard;
      draft.seats[i].name = `Bot ${botIndex}: ${colors.length > 0 ? colors.join(', ') : 'C'}`;
      draft.seats[i].description = `This deck was drafted by a bot with color preference for ${colors.join('')}.`;
      botIndex += 1;
    } else {
      const picked = fromEntries(COLOR_COMBINATIONS.map((comb) => [comb.join(''), 0]));
      picked.cards = [];
      addSeen(picked, draft.seats[i].pickorder, draft.synergies);
      const colors = botColors(
        null,
        picked,
        null,
        null,
        draft.synergies,
        draft.initial_state,
        1,
        draft.initial_state[0].length,
      );
      draft.seats[i].name = `${draft.seats[i].name}: ${colors.join(', ')}`;
    }
  }

  for (const seat of draft.seats) {
    for (const category of [seat.drafted, seat.sideboard, seat.packbacklog]) {
      for (const card of category) {
        delete card.details;
      }
    }
    for (const card of seat.pickorder) {
      delete card.details;
    }
    delete seat.seen;
    delete seat.picked;
  }

  for (const category of [draft.initial_state, draft.unopenedPacks]) {
    for (const seat of category) {
      for (const col of seat) {
        for (const card of col) {
          delete card.details;
        }
      }
    }
  }

  // save draft. if we fail, we fail
  await csrfFetch(`/cube/api/draftpick/${draft.cube}`, {
    method: 'POST',
    body: JSON.stringify(draft),
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

async function allBotsDraft() {
  for (const seat of draft.seats) {
    seat.bot = [];
  }
  while (draft.seats[0].packbacklog.length > 0 && draft.seats[0].packbacklog[0].length > 0) {
    passPack();
  }
  await finish();
}

export default {
  addSeen,
  allBotsDraft,
  arrangePicks,
  botColors,
  buildDeck,
  calculateBasicCounts,
  cube,
  finish,
  id,
  init,
  pack,
  packPickNumber,
  pick,
};
