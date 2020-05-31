import similarity from 'compute-cosine-similarity';

import { csrfFetch } from 'utils/CSRF';
import { arrayIsSubset, arrayShuffle, fromEntries } from 'utils/Util';
import { COLOR_COMBINATIONS, cardCmc } from 'utils/Card';

let draft = null;

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
  const typeLine = card.type_line ?? card.details.type;
  const isLand = typeLine.indexOf('Land') > -1;
  const isFetch = !!fetchLands[card.details.name];

  // If you add x to a rating you roughly increase the estimated value
  // of picking it by a factor of (100 * 10**(x/400)) - 100 percent
  if (isLand) {
    if ((subset || contains) && isFetch) {
      rating += 280; // Increase value of picking by roughly 400%
    } else if (subset || contains) {
      switch (colors.length) {
        case 1:
          rating += 191; // Increase value of picking by roughly 200%
          break;
        case 2:
          rating += 262; // Increase value of picking by roughly 350%
          break;
        default:
          rating += 311; // Increase value of picking by roughly 500%
          break;
      }
    } else if (overlap && isFetch) {
      rating += 241; // Increase value of picking by roughly 300%
    } else if (overlap || colorless) {
      rating += 159; // Increase value of picking by roughly 150%
    }
  } else if (colorless) {
    rating += 205; // Increase value of picking by roughly 225%
  } else if (subset) {
    rating += 191; // Increase value of picking by roughly 200%
  } else if (contains) {
    rating += 141; // Increase value of picking by roughly 125%
  } else if (overlap) {
    rating += 70; // Increase value of picking by roughly 50%
  }

  return rating;
}

const toValue = (elo) => 10 ** (elo / 400);

function addSeen(seen, cards) {
  for (const card of cards) {
    const colors = card.colors ?? card.details.colors ?? [];
    // We ignore colorless because they just reduce variance by
    // being in all color combinations.
    if (colors.length > 0) {
      for (const comb of COLOR_COMBINATIONS) {
        if (arrayIsSubset(colors, comb)) {
          seen[comb.join('')] += card.rating ? toValue(botCardRating(comb, card, card)) : 0;
        }
      }
    }
  }
  seen.cards += cards.length;
}

function init(newDraft) {
  draft = newDraft;
  for (const seat of draft.seats) {
    const { cards } = draft;
    seat.seen = fromEntries(COLOR_COMBINATIONS.map((comb) => [comb.join(''), 0]));
    seat.seen.cards = 0;
    addSeen(
      seat.seen,
      seat.packbacklog[0].map((cardIndex) => cards[cardIndex]),
    );
    seat.picked = fromEntries(COLOR_COMBINATIONS.map((comb) => [comb.join(''), 0]));
    seat.picked.cards = 0;
  }
  draft.overallPool = fromEntries(COLOR_COMBINATIONS.map((comb) => [comb.join(''), 0]));
  draft.overallPool.cards = 0;
  addSeen(
    draft.overallPool,
    draft.unopenedPacks.flat(3).map((cardIndex) => draft.cards[cardIndex]),
  );
}

function id() {
  return draft._id;
}

function cube() {
  return draft.cube;
}

function pack() {
  return (draft.seats[0].packbacklog[0] || []).map((cardIndex) => draft.cards[cardIndex]);
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
  draft.seats[0].drafted = picks.map((pile) =>
    pile.map((pileCard) => draft.cards.findIndex((card) => card.cardID === pileCard.cardID)),
  );
}

const considerInCombination = (combination) => (card) =>
  card && arrayIsSubset(card.colors ?? card.details.color_identity ?? card.details.colors ?? [], combination);

// We want to discourage playing more colors so they get less
// value the more colors, this gets offset by having more cards.
const COLOR_SCALING_FACTOR = [1, 1, 0.6, 0.3, 0.1, 0.07];
const botRatingAndCombination = (
  cards,
  cardIndex,
  picked,
  pickedIndices,
  seen,
  overallPool,
  synergies,
  seats = 1,
  inPack = 1,
  packNum = 1,
  numPacks = 1,
) => {
  // Find the color combination that gives us the highest score
  // that'll be the color combination we want to play currently.
  let bestRating = -1;
  let bestCombination = [];
  const card = cards[cardIndex];
  for (const combination of COLOR_COMBINATIONS) {
    const considerFunc = considerInCombination(combination);
    if (!card || considerFunc(card)) {
      const scaling = COLOR_SCALING_FACTOR[combination.length];

      const cardValue = card?.rating ? toValue(botCardRating(combination, card)) : 1;

      let internalSynergy = 0.0000001;
      let synergy = 0.00000001;
      if (synergies) {
        const pickedInCombo = pickedIndices.filter((index) => considerFunc(cards[index]));
        let count = 0;
        for (let i = 1; i < pickedInCombo.length; i++) {
          for (let j = 0; j < i; j++) {
            internalSynergy += similarity(synergies[pickedInCombo[i]], synergies[pickedInCombo[j]]) ** 10;
            count += 1;
          }
        }
        if (count) {
          internalSynergy /= count;
        }
        if (card) {
          const similarityExponent = pickedIndices.length / 3;
          for (const index of pickedInCombo) {
            synergy += similarity(synergies[index], synergies[cardIndex]) ** similarityExponent;
          }
          if (pickedInCombo.length) {
            synergy /= pickedInCombo.length;
          }
        }
      }
      const synergyWeight = (picked?.cards ?? 9) / 12;
      // The sum of the values of all cards in our pool, possibly
      // plus the card we are considering.
      const poolRating = picked[combination.join('')] + cardValue;
      // The sum of the values of all cards we've seen passed to
      // us times the number of times we've seen them.
      const seenCount = seen?.[combination.join('')] ?? 1;
      // This is technically cheating, but looks at the set of
      // all cards dealt out to players to see what the trends
      // for colors are. This is in value as well.
      const overallCount = overallPool?.[combination.join('')] || 1;
      // The ratio of seen to overall gives us an idea what is
      // being taken.
      const openness = seenCount / overallCount;
      // Roughly the number of cards left that we expect to get from this pack.
      const opennessWeight = (numPacks * inPack) / seats / packNum;
      // We weigh the factors with exponents to get a final score.
      console.log(poolRating, openness, opennessWeight, internalSynergy, synergy, synergyWeight);
      const rating =
        scaling * poolRating ** 3 * openness ** opennessWeight * internalSynergy ** 2 * synergy ** synergyWeight;
      console.log('rating', rating, 'colors', combination);
      if (rating > bestRating) {
        bestRating = rating;
        bestCombination = combination;
      }
    }
  }
  return [bestRating, bestCombination];
};

const botRating = (
  cards,
  cardIndex,
  picked,
  pickedIndices,
  seen,
  overallPool,
  synergies,
  seats = 1,
  inPack = 1,
  packNum = 1,
  numPacks = 1,
) =>
  botRatingAndCombination(
    cards,
    cardIndex,
    picked,
    pickedIndices,
    seen,
    overallPool,
    synergies,
    seats,
    inPack,
    packNum,
    numPacks,
  )[0];
const botColors = (
  cards,
  cardIndex,
  picked,
  pickedIndices,
  seen,
  overallPool,
  synergies,
  seats = 1,
  inPack = 1,
  packNum = 1,
  numPacks = 1,
) =>
  botRatingAndCombination(
    cards,
    cardIndex,
    picked,
    pickedIndices,
    seen,
    overallPool,
    synergies,
    seats,
    inPack,
    packNum,
    numPacks,
  )[1];

function getSortFn(bot, draftCards) {
  return (a, b) => {
    if (bot) {
      return botCardRating(bot, draftCards[b]) - botCardRating(bot, draftCards[a]);
    }
    return draftCards[b].rating - draftCards[a].rating;
  };
}

async function buildDeck(cardIndices, picked, draftCards, synergies) {
  const colors = botColors(draftCards, null, picked, cardIndices, null, synergies);
  const considerFunc = considerInCombination(colors);

  let nonlands = cardIndices.filter((cardIndex) => !draftCards[cardIndex].details.type.toLowerCase().includes('land'));
  const lands = cardIndices.filter((cardIndex) => {
    const card = draftCards[cardIndex];
    return card.details.type.toLowerCase().includes('land') && considerFunc(card);
  });

  const sortFn = getSortFn(colors, draftCards);
  const inColor = nonlands.filter((cardIndex) => considerFunc(draftCards[cardIndex]));
  const outOfColor = nonlands.filter((cardIndex) => !considerFunc(draftCards[cardIndex]));

  inColor.sort(sortFn);
  nonlands = inColor;
  let side = outOfColor;
  if (nonlands.length < 23) {
    outOfColor.sort(sortFn);
    nonlands.push(...outOfColor.splice(0, 23 - nonlands.length));
    side = [...outOfColor];
  }
  lands.sort(sortFn);
  const chosen = [];
  const totalSynergy = nonlands.map((cardIndex) => {
    let synergy = 0.0000001;
    if (synergies) {
      for (const otherIndex of nonlands) {
        if (cardIndex !== otherIndex) {
          synergy += similarity(synergies[cardIndex], synergies[otherIndex]) ** 20;
        }
      }
    }
    return [
      (draftCards[cardIndex].rating ? toValue(botCardRating(colors, draftCards[cardIndex])) : 1) * synergy ** 4,
      cardIndex,
    ];
  });
  totalSynergy.sort((a, b) => b - a);
  const [[, mostSynergy]] = totalSynergy.splice(0, 1);
  chosen.push(mostSynergy);
  let remaining = totalSynergy.map(([, index]) => index);
  while (remaining.length > 0 && chosen.length < 23) {
    const nonlandsWithValue = remaining.map((cardIndex) => {
      let synergy = 0.0000001;
      if (synergies) {
        for (const otherIndex of chosen) {
          synergy += similarity(synergies[cardIndex], synergies[otherIndex]) ** 15;
        }
      }
      return [(draftCards[cardIndex].rating ?? 1) * synergy ** 2, cardIndex];
    });
    nonlandsWithValue.sort(([valueA], [valueB]) => valueB - valueA);
    const [[, bestValue]] = nonlandsWithValue.splice(0, 1);
    chosen.push(bestValue);
    remaining = nonlandsWithValue.map(([, index]) => index);
  }

  const main = chosen.concat(lands.slice(0, 17));
  side.push(...lands.slice(17));
  side.push(...remaining);

  const deck = [];
  const sideboard = [];
  for (let i = 0; i < 16; i += 1) {
    deck.push([]);
    if (i < 8) {
      sideboard.push([]);
    }
  }

  for (const cardIndex of main) {
    const card = draftCards[cardIndex];
    let index = Math.min(cardCmc(card) ?? 0, 7);
    if (!card.details.type.toLowerCase().includes('creature')) {
      index += 8;
    }
    deck[index].push(cardIndex);
  }
  for (const cardIndex of side) {
    sideboard[Math.min(cardCmc(draftCards[cardIndex]) ?? 0, 7)].push(cardIndex);
  }

  return {
    deck,
    sideboard,
    colors,
  };
}

function botPicks() {
  // make bots take one pick out of active packs
  for (let botIndex = 1; botIndex < draft.seats.length; botIndex++) {
    const {
      seen,
      picked,
      packbacklog: [packFrom],
      pickorder,
    } = draft.seats[botIndex];
    const { cards, overallPool, initial_state, synergies } = draft;
    let ratedPicks = [];
    const unratedPicks = [];
    const seats = draft.seats.length;
    const inPack = packFrom.length;
    const [packNum] = packPickNumber();
    const numPacks = initial_state[0].length;
    for (let cardIndex = 0; cardIndex < packFrom.length; cardIndex++) {
      if (cards[packFrom[cardIndex]].rating) {
        ratedPicks.push(cardIndex);
      } else {
        unratedPicks.push(cardIndex);
      }
    }
    ratedPicks = ratedPicks
      .map((cardIndex) => [
        botRating(
          cards,
          packFrom[cardIndex],
          picked,
          pickorder,
          seen,
          overallPool,
          synergies,
          seats,
          inPack,
          packNum,
          numPacks,
        ),
        cardIndex,
      ])
      .sort(([a], [b]) => b - a)
      .map(([, cardIndex]) => cardIndex);
    arrayShuffle(unratedPicks);

    const pickOrder = ratedPicks.concat(unratedPicks);
    const pickedCard = draft.seats[botIndex].packbacklog[0].splice(pickOrder[0], 1)[0];
    draft.seats[botIndex].pickorder.push(pickedCard);
    addSeen(picked, [cards[pickedCard]]);
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
  const { cards } = draft;
  for (const seat of draft.seats) {
    if (seat.packbacklog && seat.packbacklog.length > 0) {
      addSeen(
        seat.seen,
        seat.packbacklog[0].map((cardIndex) => cards[cardIndex]),
      );
    }
  }
}

async function pick(cardIndex) {
  const ci = draft.seats[0].packbacklog[0].splice(cardIndex, 1)[0];
  const card = draft.cards[ci];
  const packFrom = draft.seats[0].packbacklog[0];
  draft.seats[0].pickorder.push(ci);
  passPack();
  await csrfFetch(`/cube/api/draftpickcard/${draft.cube}`, {
    method: 'POST',
    body: JSON.stringify({
      draft_id: draft._id,
      pick: card.details.name,
      pack: packFrom.map((c) => draft.cards[c].details.name),
    }),
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

async function finish() {
  // build bot decks
  const decksPromise = draft.seats.map((seat) => {
    return seat.bot && buildDeck(seat.pickorder, seat.picked, draft.cards, draft.synergies);
  });
  const decks = await Promise.all(decksPromise);
  const { cards } = draft;

  for (let i = 0; i < draft.seats.length; i++) {
    if (draft.seats[i].bot) {
      const { deck, sideboard, colors } = decks[i];
      draft.seats[i].drafted = deck;
      draft.seats[i].sideboard = sideboard;
      draft.seats[i].name = `Bot ${i === 0 ? draft.seats.length : i}: ${colors.length > 0 ? colors.join(', ') : 'C'}`;
      draft.seats[i].description = `This deck was drafted by a bot with color preference for ${colors.join('')}.`;
    } else {
      const picked = fromEntries(COLOR_COMBINATIONS.map((comb) => [comb.join(''), 0]));
      picked.cards = 0;
      addSeen(
        picked,
        draft.seats[i].pickorder.map((cardIndex) => cards[cardIndex]),
      );
      const colors = botColors(draft.cards, null, picked, draft.seats[i].pickorder, null, null, draft.synergies);
      draft.seats[i].name = `${draft.seats[i].name}: ${colors.join(', ')}`;
    }
  }

  for (const seat of draft.seats) {
    delete seat.seen;
    delete seat.picked;
  }

  for (const card of draft.cards) {
    delete card.details;
  }
  delete draft.overallPool;

  // save draft. if we fail, we fail
  await csrfFetch(`/cube/api/draftpick/${draft.cube}`, {
    method: 'POST',
    body: JSON.stringify(draft),
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

export default { init, id, cube, pack, packPickNumber, arrangePicks, pick, finish, botColors, buildDeck, addSeen };
