import { COLOR_COMBINATIONS, COLOR_INCLUSION_MAP } from 'utils/Card';
import { arraysAreEqualSets, arrayShuffle, fromEntries, stdDevOf } from 'utils/Util';
import { filterCards, filterToString, operatorsRegex, parseTokens, tokenizeInput, verifyTokens } from 'utils/Filter';

function matchingCards(cards, filter) {
  if (filter === null || filter.length === 0 || filter[0] === null || filter[0] === '') {
    return cards;
  }
  return filterCards(cards, filter, true);
}

function makeFilter(filterText) {
  if (!filterText || filterText === '' || filterText === '*') {
    return [null];
  }

  let tokens = [];
  let valid = false;
  valid = tokenizeInput(filterText, tokens) && verifyTokens(tokens);

  // backwards compatibilty: treat as tag
  if (!valid || !operatorsRegex.test(filterText)) {
    let tagfilterText = filterText;
    // if it contains spaces then wrap in quotes
    if (tagfilterText.indexOf(' ') >= 0 && !tagfilterText.startsWith('"')) {
      tagfilterText = `"${filterText}"`;
    }
    tagfilterText = `tag:${tagfilterText}`; // TODO: use tag instead of 'tag'
    tokens = [];
    valid = tokenizeInput(tagfilterText, tokens) && verifyTokens(tokens);
  }

  if (!valid) {
    throw new Error(`Invalid card filter: ${filterText}`);
  }
  return [parseTokens(tokens)];
}

/* Takes the raw data for custom format, converts to JSON and creates
   a data structure:

      [pack][card in pack][token,token...]
*/
export function parseDraftFormat(packsJSON, splitter = ',') {
  const format = JSON.parse(packsJSON);
  for (let j = 0; j < format.length; j++) {
    for (let k = 0; k < format[j].length; k++) {
      format[j][k] = format[j][k].split(splitter);
      for (let m = 0; m < format[j][k].length; m++) {
        format[j][k][m] = makeFilter(format[j][k][m].trim());
      }
    }
  }
  return format;
}

// standard draft has no duplicates
function standardDraft(cards) {
  if (cards.length === 0) {
    throw new Error('Unable to create draft: not enough cards.');
  }
  cards = arrayShuffle(cards);
  return () => {
    // ignore cardFilters, just take any card in cube
    if (cards.length === 0) {
      throw new Error('Unable to create draft: not enough cards.');
    }
    // remove a random card
    return { card: cards.pop(), messages: [] };
  };
}

function standardDraftAsfan(cards) {
  if (cards.length === 0) {
    throw new Error('Unable to create draft asfan: not enough cards.');
  }
  const poolCount = cards.length;
  const poolWeight = 1 / poolCount;
  return () => {
    for (const card of cards) {
      card.asfan += poolWeight;
    }
    return { card: true, messages: [] };
  };
}

function customDraft(cards, duplicates = false) {
  return (cardFilters) => {
    if (cards.length === 0) {
      throw new Error('Unable to create draft: not enough cards.');
    }

    // each filter is an array of parsed filter tokens, we choose one randomly
    let validCards = cards;
    let index = null;
    const messages = [];
    if (cardFilters.length > 0) {
      do {
        index = Math.floor(Math.random() * cardFilters.length);
        const filter = cardFilters[index];
        validCards = matchingCards(cards, filter);
        if (validCards.length === 0) {
          // TODO: display warnings for players
          messages.push(`Warning: no cards matching filter: ${filterToString(filter)}`);
          // try another options and remove this filter as it is now empty
          cardFilters.splice(index, 1);
        }
      } while (validCards.length === 0 && cardFilters.length > 0);
    }

    if (validCards.length === 0) {
      throw new Error(`Unable to create draft: not enough cards matching filter.\n${messages.join('\n')}`);
    }

    index = Math.floor(Math.random() * validCards.length);

    // slice out the first card with the index, or error out
    const card = validCards[index];
    if (!duplicates) {
      // remove from cards
      index = cards.indexOf(card);
      cards.splice(index, 1);
    }

    return { card, messages };
  };
}

function customDraftAsfan(cards, duplicates = false) {
  return (cardFilters) => {
    if (cards.length === 0) {
      throw new Error('Unable to create draft asfan: not enough cards.');
    }

    // each filter is an array of parsed filter tokens, we choose one randomly
    const validCardGroups = [];
    for (let i = 0; i < cardFilters.length; i++) {
      let validCards = matchingCards(cards, cardFilters[i]);
      if (!duplicates) {
        validCards = validCards.filter((card) => card.asfan < 1);
      }
      if (validCards.length > 0) {
        validCardGroups.push(validCards);
      }
    }

    if (validCardGroups.length === 0) {
      throw new Error('Unable to create draft asfan: not enough cards matching filter.');
    }
    for (const validCards of validCardGroups) {
      if (duplicates) {
        const poolCount = validCards.length;
        const poolWeight = 1 / poolCount / validCardGroups.length;
        for (const card of validCards) {
          card.asfan += poolWeight;
        }
      } else {
        const poolCount = validCards.reduce((sum, card) => sum + (1 - card.asfan), 0);
        const poolWeight = 1 / poolCount / validCardGroups.length;
        for (const card of validCards) {
          card.asfan += (1 - card.asfan) * poolWeight;
        }
      }
    }
    return { card: true, messages: [] };
  };
}

export function getDraftFormat(params, cube) {
  let format;
  if (params.id >= 0) {
    format = parseDraftFormat(cube.draft_formats[params.id].packs);
    format.custom = true;
    format.multiples = cube.draft_formats[params.id].multiples;
  } else {
    // default format
    format = [];
    format.custom = false;
    format.multiples = false;
    for (let pack = 0; pack < params.packs; pack++) {
      format[pack] = [];
      for (let card = 0; card < params.cards; card++) {
        format[pack].push('*'); // any card
      }
    }
  }
  return format;
}

function createPacks(draft, format, seats, nextCardFn) {
  let ok = true;
  let messages = [];
  draft.initial_state = [];

  for (let seat = 0; seat < seats; seat++) {
    draft.initial_state.push([]);

    for (let packNum = 0; packNum < format.length; packNum++) {
      draft.initial_state[seat].push([]);
      const pack = [];
      for (let cardNum = 0; cardNum < format[packNum].length; cardNum++) {
        const result = nextCardFn(format[packNum][cardNum]);
        if (result.messages && result.messages.length > 0) {
          messages = messages.concat(result.messages);
        }
        if (result.card) {
          pack.push(result.card);
        } else {
          ok = false;
        }
      }
      draft.initial_state[seat][packNum] = pack;
    }
  }
  return { ok, messages };
}

function assignBotColors(initialState, botCount, seats) {
  // Seems to converge to a good result reasonably well and takes about
  //   350ms to run on a local machine with 13 seats.
  //   Assuming every mono color and pair are available to choose there
  //     are 6435 possible assignments for 8 seats, if you add 5 3+ color
  //     combinations that grows to 125,970 which is infeasible.
  const ITERATIONS = 10000;
  // Think of these as scaling how much of the cards available to a seat
  //   they can reasonably use.
  const SEAT_COLORS_MULTIPLIERS = [1, 1, 0.75, 0.45, 0.3, 0.2];
  const START_INDEX = [0, 1, 6, 16, 26, 31];
  const END_INDEX = [1, 6, 16, 26, 31, 32];

  let colorCounts = fromEntries(COLOR_COMBINATIONS.map((c) => [c.join(''), { value: 0, count: 0 }]));
  const cards = initialState.flat(3);

  for (const card of cards) {
    const { elo, color_identity: colorIdentity } = card.details;
    const cardColorSet = card.colors ?? colorIdentity ?? [];
    // Colorless will usually be null since it is recorded as ['C'] not [] so we normalize it to [].
    // We don't currently guarantee order of colors in saved cards so we do have to do set comparisons here.
    const cardColors = (
      COLOR_COMBINATIONS.slice(START_INDEX[cardColorSet.length], END_INDEX[cardColorSet.length]).find(
        (colors) => colors.length === cardColorSet.length && arraysAreEqualSets(colors, cardColorSet),
      ) ?? []
    ).join('');
    // Use the estimated value of the card, not the elo directly.
    colorCounts[cardColors].value += 10 ** ((elo ?? 0) / 400) - 1;
    colorCounts[cardColors].count += 1;
  }

  // Cut out all the color combinations that don't contribute any value
  // and increase the value of each card by the additive increment from above.
  colorCounts = fromEntries(
    Object.entries(colorCounts).filter(([colors, { value }]) => colors.length > 0 && value > 0),
  );

  // We allow playing any combination with at least 1 color
  //   and at least one card with exactly that color identity.
  //   We also allow running a pair if there are mono color cards
  //   of both the colors that make up the pair.
  let validCombinationArray = COLOR_COMBINATIONS.map((comb) => comb.join('')).filter(
    (comb) =>
      comb.length > 0 &&
      ((colorCounts[comb]?.value ?? 0) > 0 ||
        (comb.length === 2 && (colorCounts[comb[0]]?.value ?? 0) > 0 && (colorCounts[comb[1]]?.value ?? 0) > 0)),
  );
  if (validCombinationArray.length === 0) {
    // There are no non-empty color combinations with cards in them
    //   so everything must be colorless so that's the only valid combination.
    validCombinationArray = [[]];
  }
  if (validCombinationArray.length === 1) {
    const botColors = [];
    for (let i = 0; i < botCount; i++) {
      botColors.push(validCombinationArray[0]);
    }
    return botColors;
  }

  const seatsRating = (seatColors) => {
    const seatColorValues = {};
    let includedCount = 0;
    for (const [combination, { count, value }] of Object.entries(colorCounts)) {
      const includedInCount = seatColors.filter((colors) => COLOR_INCLUSION_MAP[colors][combination]).length;
      if (includedInCount > 0) {
        // The cards are desired by includedInCount different seats
        // so their value will get split between them.
        seatColorValues[combination] = value / includedInCount;
        includedCount += count;
      }
    }
    // Sum of the value each combination colors provides to the seat
    // scaled by the amount of an indiviudal card they can utilize
    // given how many colors they are playing.
    const fValues = seatColors.map(
      (colors) =>
        COLOR_INCLUSION_MAP[colors].includes.reduce((f, comb) => f + (seatColorValues[comb] ?? 0), 0) *
        SEAT_COLORS_MULTIPLIERS[colors.length],
    );
    // Final rating is linear in:
    //   the number of cards at least one seat has the colors to play.
    //   the minimum value of cards available to a seat, used
    //     to attempt to maximize the power level available to each seat.
    const sumF = fValues.reduce((a, f) => a + f, 0);
    //   the sum of all the values available to encourage playing as much powerful
    //   stuff as they can.
    const minF = Math.min(...fValues);
    // We use a product to combine them so we don't have to normalize their
    //   magnitudes relative to each other.
    const rating = includedCount * minF * sumF;
    return rating;
  };

  const visited = {};
  const seatsAndRatingFrom = (combOrder) => {
    let seatColors = [];
    for (let i = 0; i < seats; i++) {
      seatColors.push(combOrder[i % combOrder.length]);
    }
    seatColors = seatColors.sort();
    const lookupKey = seatColors.join('_');
    if (visited[lookupKey]) {
      return [[], -1];
    }
    visited[lookupKey] = true;
    return [seatColors, seatsRating(seatColors)];
  };

  // Any prefix of this maximizes the minimum number of occurences of each color.
  //   We use this as an initial seed since it's a relatively safe guess at being
  //   decent in most cubes. Ally colors are first since they historically more support.
  const initialOrder = ['WU', 'BR', 'GW', 'UB', 'RG', 'WB', 'UR', 'BG', 'RW', 'GU'];
  let [bestSeats, bestRating] = seatsAndRatingFrom(initialOrder);
  let currentSeats;
  let rating;
  for (let i = 0; i < ITERATIONS; i++) {
    for (let j = 0; j < 20; j++) {
      // We're okay mutating this so we don't need to make a copy.
      arrayShuffle(validCombinationArray);
      [currentSeats, rating] = seatsAndRatingFrom(validCombinationArray);
      if (rating !== -1) {
        break;
      }
    }
    if (rating === -1) {
      break;
    }
    if (rating > bestRating) {
      [bestSeats, bestRating] = [currentSeats, rating];
    }
  }
  arrayShuffle(bestSeats);
  // Return just the bot assignments.
  return bestSeats.slice(0, botCount).map((c) => c.split(''));
}

// NOTE: format is an array with extra attributes, see getDraftFormat()
export function createDraft(format, cards, botCount, seats, user) {
  const draft = {};

  let nextCardFn = null;

  if (cards.length === 0) {
    throw new Error('Unable to create draft: no cards.');
  }
  if (botCount === 0) {
    throw new Error('Unable to create draft: no bots.');
  }
  if (seats < 2) {
    throw new Error(`Unable to create draft: invalid seats: ${seats}`);
  }

  if (format.custom === true) {
    nextCardFn = customDraft(cards, format.multiples);
  } else {
    nextCardFn = standardDraft(cards);
  }

  const result = createPacks(draft, format, seats, nextCardFn);

  if (result.messages.length > 0) {
    draft.messages = result.messages.join('\n');
  }

  if (!result.ok) {
    throw new Error(`Could not create draft:\n${result.messages.join('\n')}`);
  }

  draft.seats = [];
  draft.unopenedPacks = [];

  // deep clone packs
  for (let i = 0; i < draft.initial_state.length; i++) {
    draft.unopenedPacks.push([]);
    for (let j = 0; j < draft.initial_state[i].length; j++) {
      draft.unopenedPacks[i].push([]);
      for (let k = 0; k < draft.initial_state[i][j].length; k++) {
        draft.unopenedPacks[i][j].push(draft.initial_state[i][j][k]);
      }
    }
  }

  const bots = assignBotColors(draft.initial_state, botCount, seats);

  for (let i = 0; i < draft.initial_state.length; i += 1) {
    const seat = {
      bot: i === 0 ? null : bots[i - 1],
      name: i === 0 ? user.username : `Bot ${i}: ${bots[i - 1].join(', ')}`,
      userid: i === 0 ? user._id : null,
      drafted: [], // organized draft picks
      pickorder: [],
      packbacklog: [],
    };

    for (let j = 0; j < 16; j++) {
      seat.drafted.push([]);
    }

    seat.packbacklog.push(draft.unopenedPacks[i].pop());
    draft.seats.push(seat);
  }

  return draft;
}

export function calculateAsfans(format, cards) {
  let nextCardFn = null;

  cards.forEach((card) => {
    card.asfan = 0;
  });

  if (format.custom === true) {
    nextCardFn = customDraftAsfan(cards, format.multiples);
  } else {
    nextCardFn = standardDraftAsfan(cards);
  }

  return createPacks({}, format, 1, nextCardFn);
}

export function checkFormat(format, cards) {
  // check that all filters are sane and match at least one card
  const checkFn = (cardFilters) => {
    const messages = [];
    for (let i = 0; i < cardFilters.length; i++) {
      const filter = cardFilters[i];
      const validCards = matchingCards(cards, filter);
      if (validCards.length === 0) {
        messages.push(`Warning: no cards matching filter: ${filterToString(filter)}`);
      }
    }
    if (messages.length > 0) {
      throw new Error(messages.join('\n'));
    }
    return { ok: messages.length === 0, messages };
  };
  return createPacks({}, format, 1, checkFn);
}
