import { csrfFetch } from 'utils/CSRF';
import { arrayIsSubset, arrayShuffle } from 'utils/Util';

let draft = null;

function init(newDraft) {
  draft = newDraft;
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
  let picks = draft.seats[0].pickorder.length;
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

const fetchLands = {
  'Arid Mesa': ['W', 'R'],
  'Bloodstained Mire': ['B', 'R'],
  'Flooded Strand': ['W', 'U'],
  'Marsh Flats': ['W', 'B'],
  'Misty Rainforest': ['U', 'G'],
  'Polluted Delta': ['U', 'B'],
  'Scalding Tarn': ['U', 'R'],
  'Verdant Catacombs': ['B', 'G'],
  'Windswept Heath': ['W', 'G'],
  'Wooded Foothills': ['R', 'G'],
};

function botRating(botColors, card) {
  let rating = draft.ratings[card.details.name];
  const colors = fetchLands[card.details.name] || card.colors || card.details.color_identity;
  const colorless = colors.length === 0;
  const subset = arrayIsSubset(colors, botColors) && !colorless;
  const overlap = botColors.some((c) => colors.includes(c));
  const typeLine = card.type_line || card.details.type;
  const isLand = typeLine.indexOf('Land') > -1;
  const isFetch = !!fetchLands[card.details.name];

  if (isLand) {
    if (subset || (overlap && isFetch)) {
      // For an average-ish Elo of 1300, this boosts by 260 points.
      rating *= 1.2;
    } else if (overlap) {
      rating *= 1.1;
    }
  } else if (subset || colorless) {
    rating *= 1.15;
  } else if (overlap) {
    rating *= 1.05;
  }

  return rating;
}

function getSortFn(bot) {
  return (a, b) => {
    if (bot) {
      return botRating(bot, b) - botRating(bot, a);
    }
    return draft.ratings[b.details.name] - draft.ratings[a.details.name];
  };
}

async function buildDeck(cards, bot) {
  const nonlands = cards.filter((card) => !card.type_line.toLowerCase().includes('land'));
  const lands = cards.filter((card) => card.type_line.toLowerCase().includes('land'));
  const sortFn = getSortFn(bot);

  nonlands.sort(sortFn);
  lands.sort(sortFn);

  const main = nonlands.slice(0, 23).concat(lands.slice(0, 17));
  const side = nonlands.slice(23).concat(lands.slice(17));

  const deck = [];
  const sideboard = [];
  for (let i = 0; i < 16; i += 1) {
    deck.push([]);
    if (i < 8) {
      sideboard.push([]);
    }
  }

  for (const card of main) {
    let index = Math.min(card.cmc, 7);
    if (!card.type_line.toLowerCase().includes('creature')) {
      index += 8;
    }
    deck[index].push(card);
  }
  for (const card of side) {
    sideboard[Math.min(card.cmc, 7)].push(card);
  }

  return {
    deck,
    sideboard,
  };
}

function botPicks() {
  // make bots take one pick out of active packs
  for (let botIndex = 1; botIndex < draft.seats.length; botIndex++) {
    const packFrom = draft.seats[botIndex].packbacklog[0];
    const botColors = draft.seats[botIndex].bot;
    const ratedPicks = [];
    const unratedPicks = [];
    for (let cardIndex = 0; cardIndex < packFrom.length; cardIndex++) {
      if (draft.ratings && draft.ratings[packFrom[cardIndex].details.name]) {
        ratedPicks.push(cardIndex);
      } else {
        unratedPicks.push(cardIndex);
      }
    }

    ratedPicks.sort((x, y) => {
      return botRating(botColors, packFrom[y]) - botRating(botColors, packFrom[x]);
    });
    arrayShuffle(unratedPicks);

    const pickOrder = ratedPicks.concat(unratedPicks);
    draft.seats[botIndex].pickorder.push(draft.seats[botIndex].packbacklog[0].splice(pickOrder[0], 1)[0]);
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
        draft.seats[i].packbacklog.push(draft.unopenedPacks[i].splice(0, 1)[0]);
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
}

async function pick(cardIndex) {
  const card = draft.seats[0].packbacklog[0].splice(cardIndex, 1)[0];
  const packFrom = draft.seats[0].packbacklog[0];
  draft.seats[0].pickorder.push(card);
  passPack();
  await csrfFetch(`/cube/api/draftpickcard/${draft.cube}`, {
    method: 'POST',
    body: JSON.stringify({
      draft_id: draft._id,
      pick: card.details.name,
      pack: packFrom.map((c) => c.details.name),
    }),
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

async function finish() {
  // build bot decks
  const decksPromise = draft.seats.map((seat) => buildDeck(seat.pickorder, seat.bot));
  const decks = await Promise.all(decksPromise);

  for (let i = 0; i < draft.seats.length; i++) {
    if (draft.seats[i].bot) {
      draft.seats[i].drafted = decks[i].deck;
      draft.seats[i].sideboard = decks[i].sideboard;

      draft.seats[i].name = `Bot ${i + 1}: ${draft.seats[i].bot[0]}, ${draft.seats[i].bot[1]}`;
      draft.seats[
        i
      ].description = `This deck was drafted by a bot with color preference for ${draft.seats[i].bot[0]} and ${draft.seats[i].bot[1]}.`;
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

export default { init, id, cube, pack, packPickNumber, arrangePicks, pick, finish };
