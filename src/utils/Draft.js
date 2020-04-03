import { csrfFetch } from 'utils/CSRF';
import { arrayIsSubset, arrayShuffle } from 'utils/Util';
import { COLOR_COMBINATIONS, inclusiveCount } from 'utils/Card';

let draft = null;

function init(newDraft) {
  draft = newDraft;
  for (const seat of draft.seats) {
    seat.seen = seat.packbacklog[0].slice();
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
  'Prismatic Vista': ['W', 'U', 'B', 'R', 'G'],
  'Fabled Passage': ['W', 'U', 'B', 'R', 'G'],
};

function botCardRating(botColors, card) {
  let { rating } = card;
  const colors = fetchLands[card.details.name] ?? card.colors ?? card.details.color_identity;
  const colorless = colors.length === 0;
  const subset = arrayIsSubset(colors, botColors) && !colorless;
  const contains = arrayIsSubset(botColors, colors);
  const overlap = botColors.some((c) => colors.includes(c));
  const typeLine = card.type_line || card.details.type;
  const isLand = typeLine.indexOf('Land') > -1;
  const isFetch = !!fetchLands[card.details.name];

  // If you add x to a rating you roughly increase the estimated value
  // of picking it by a factor of (100 * 10**(x/400)) - 100 percent
  if (isLand) {
    if ((subset || contains) && isFetch) {
      rating += 191; // Increase value of picking by roughly 200%
    } else if (subset || contains) {
      switch (colors.length) {
        case 1:
          rating += 102; // Increase value of picking by roughly 90%
          break;
        case 2:
          rating += 159; // Increase value of picking by roughly 150%
          break;
        default:
          rating += 213; // Increase value of picking by roughly 240%
          break;
      }
    } else if (overlap && isFetch) {
      rating += 141; // Increase value of picking by roughly 125%
    } else if (overlap || colorless) {
      rating += 58; // Increase value of picking by roughly 40%
    }
  } else if (colorless) {
    rating += 141; // Increase value of picking by roughly 125%
  } else if (subset) {
    rating += 120; // Increase value of picking by roughly 100%
  } else if (contains) {
    rating += 82; // Increase value of picking by roughly 50%
  } else if (overlap) {
    rating += 32; // Increase value of picking by roughly 20%
  }

  return rating;
}

const toValue = (elo) => 10 ** (elo / 400);
const considerInCombination = (combination) => (card) =>
  arrayIsSubset(card.colors ?? card.details.color_identity ?? [], combination);

const COLOR_SCALING_FACTOR = [1, 1, 0.75, 0.45, 0.3, 0.2];
const botRatingAndCombination = (seen, card, pool, overallPool) => {
  let bestRating = -1;
  let bestCombination = [];
  for (const combination of COLOR_COMBINATIONS) {
    const poolRating =
      pool.filter(considerInCombination(combination)).reduce((w, poolCard) => w + toValue(poolCard.rating ?? 0), 0) +
      (card && considerInCombination(combination)(card) ? toValue(card.rating ?? 0) : 0);
    let seenCount = 1;
    let overallCount = 1;
    if (seen) {
      seenCount = inclusiveCount(combination, seen);
      overallCount = inclusiveCount(combination, overallPool) || 1;
    }
    const openness = seenCount / overallCount;
    const rating = poolRating * seenCount * openness * COLOR_SCALING_FACTOR[combination.length];
    if (rating > bestRating) {
      bestRating = rating;
      bestCombination = combination;
    }
  }
  return [bestRating, bestCombination];
};

const botColors = (...args) => botRatingAndCombination(...args)[1];
const botRating = (...args) => botRatingAndCombination(...args)[0];

function getSortFn(bot) {
  return (a, b) => {
    if (bot) {
      return botCardRating(bot, b) - botCardRating(bot, a);
    }
    return b.rating - a.rating;
  };
}

async function buildDeck(cards) {
  const nonlands = cards.filter((card) => !card.details.type.toLowerCase().includes('land'));
  const lands = cards.filter((card) => card.details.type.toLowerCase().includes('land'));
  const colors = botColors(null, null, cards, null);
  const sortFn = getSortFn(colors);

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
    let index = Math.min(card.cmc ?? 0, 7);
    if (!card.details.type.toLowerCase().includes('creature')) {
      index += 8;
    }
    deck[index].push(card);
  }
  for (const card of side) {
    sideboard[Math.min(card.cmc ?? 0, 7)].push(card);
  }

  return {
    deck,
    sideboard,
  };
}

function botPicks() {
  const overallPool = draft.initial_state.flat(3);
  // make bots take one pick out of active packs
  for (let botIndex = 1; botIndex < draft.seats.length; botIndex++) {
    const packFrom = draft.seats[botIndex].packbacklog[0];
    const { seen, pickorder } = draft.seats[botIndex];
    const ratedPicks = [];
    const unratedPicks = [];
    for (let cardIndex = 0; cardIndex < packFrom.length; cardIndex++) {
      if (packFrom[cardIndex].rating) {
        ratedPicks.push(cardIndex);
      } else {
        unratedPicks.push(cardIndex);
      }
    }

    ratedPicks.sort((x, y) => {
      return (
        botRating(seen, packFrom[y], pickorder, overallPool) - botRating(seen, packFrom[x], pickorder, overallPool)
      );
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
      seat.seen.push(...seat.packbacklog[0]);
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

  const cards = draft.initial_state.flat(3);
  for (let i = 0; i < draft.seats.length; i++) {
    if (draft.seats[i].bot) {
      draft.seats[i].drafted = decks[i].deck;
      draft.seats[i].sideboard = decks[i].sideboard;
      const colors = botColors(null, null, draft.seats[i].pickorder, cards);
      draft.seats[i].name = `Bot ${i + 1}: ${colors.join(', ')}`;
      draft.seats[i].description = `This deck was drafted by a bot with color preference for ${colors.join('')}.`;
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

export default { init, id, cube, pack, packPickNumber, arrangePicks, botRating, pick, finish };
