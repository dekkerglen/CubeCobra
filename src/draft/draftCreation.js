import { COLOR_COMBINATIONS } from 'utils/Card';
import { arrayIsSubset, arraysAreEqualSets, arrayShuffle, fromEntries, stdDevOf, meanOf } from 'utils/Util';
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
  const ITERATIONS = 1000;

  const colorCounts = fromEntries(COLOR_COMBINATIONS.map((c) => [c.join(''), { elo: 0, count: 0 }]));
  const cards = initialState.flat(3);

  for (const card of cards) {
    const { elo } = card.details;
    const cardColorSet = card.colors ?? card.details.color_identity ?? [];
    // Colorless will be null since it is recorded as 'C' not ''.
    const cardColorsNormalized = COLOR_COMBINATIONS.find((colors) => arraysAreEqualSets(colors, cardColorSet));
    // We can skip colorless since it would just apply to every seat.
    if (cardColorsNormalized) {
      const cardColors = cardColorsNormalized.join('');
      colorCounts[cardColors].elo += elo * (0.75 + 0.25 * cardColors.length);
      colorCounts[cardColors].count += 1;
    }
  }

  const validCombinations = fromEntries(
    Object.entries(colorCounts).map(([comb, { count }]) => [
      comb,
      (comb.length > 1 && count > 0) ||
        (comb.length === 2 && colorCounts[comb[0]].count > 0 && colorCounts[comb[1]].count > 0),
    ]),
  );
  const validCombinationArray = Object.keys(validCombinations)
    .filter((c) => validCombinations[c])
    .map((c) => c.split(''));

  const seatsRating = (seatColors) => {
    const seatColorCounts = fromEntries(
      Object.entries(colorCounts).map(([c, colorCount]) => [c, { ...colorCount, seatCount: 0 }]),
    );
    let includedCount = 0;
    for (const [combination, { count }] of Object.entries(colorCounts)) {
      let included = false;
      const combinationArray = combination.split('');
      for (const colors of seatColors) {
        if (combinationArray.length <= colors.length && arrayIsSubset(combinationArray, colors)) {
          seatColorCounts[combination].seatCount += 1;
          included = true;
        }
      }
      if (included) {
        includedCount += count;
      }
    }
    const fValues = seatColors.map((colors) => {
      let f = 0;
      for (const [comb, { elo, seatCount }] of Object.entries(seatColorCounts)) {
        if (seatCount > 0 && comb.length <= colors.length && arrayIsSubset(comb.split(''), colors)) {
          f += elo / seatCount;
        }
      }
      f /= colors.length;
      return f;
    });
    return (includedCount * Math.min(...fValues) * meanOf(fValues)) / stdDevOf(fValues);
  };
  const seatsAndRatingFrom = (combOrder) => {
    const seatColors = [];
    for (let i = 0; i < seats; i++) {
      seatColors.push(combOrder[i % combOrder.length]);
    }
    return [seatColors, seatsRating(seatColors)];
  };

  // Any prefix of this maximizes the minimum number of occurences of each color.
  const initialOrder = ['WU', 'BR', 'GW', 'UB', 'RG', 'WB', 'UR', 'BG', 'RW', 'GU']
    .filter((c) => validCombinations[c])
    .map((c) => c.split(''));
  let [bestSeats, bestRating] = seatsAndRatingFrom(initialOrder);
  for (let i = 0; i < ITERATIONS; i++) {
    // We're okay mutating this so we don't need to make a copy.
    const combinations = arrayShuffle(validCombinationArray);
    const [currentSeats, rating] = seatsAndRatingFrom(combinations);
    if (rating > bestRating) {
      [bestSeats, bestRating] = [currentSeats, rating];
    }
  }
  return bestSeats.slice(0, botCount);
}

// NOTE: format is an array with extra attributes, see getDraftFormat()
export function populateDraft(format, cards, botCount, seats, user) {
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
