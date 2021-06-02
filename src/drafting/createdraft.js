import seedrandom from 'seedrandom';
import shuffleSeed from 'shuffle-seed';

import { filterToString, makeFilter, operatorsRegex } from 'filtering/FilterCards';
import { fromEntries } from 'utils/Util';

export const matchingCards = (cards, filter) => {
  if (filter) {
    return cards.filter(filter);
  }
  return cards;
};

const compileFilter = (filterText) => {
  if (!filterText || filterText === '' || filterText === '*') {
    return null;
  }

  let tagfilterText = null;
  if (!operatorsRegex.test(filterText)) {
    // if it contains spaces then wrap in quotes
    tagfilterText = filterText;
    if (tagfilterText.indexOf(' ') >= 0 && !tagfilterText.startsWith('"')) {
      tagfilterText = `"${filterText}"`;
    }
    tagfilterText = `tag:${tagfilterText}`; // TODO: use tag instead of 'tag'
  }
  const { filter, err } = makeFilter(tagfilterText || filterText);
  if (err) {
    throw new Error(`Invalid card filter: ${filterText}`);
  }
  console.log('filter compiled:', filter);
  return filter;
};

export const parseDraftFormat = (format, splitter = ',') => {
  const result = format.map((pack) => ({
    ...pack,
    slots: pack.slots.map((slot) => slot.split(splitter).map((txt) => compileFilter(txt.trim()))),
  }));
  console.log('parsedFormat', JSON.stringify(result));
  return result;
};

// standard draft has no duplicates
const standardDraft = (cards, rng) => {
  if (cards.length === 0) {
    throw new Error('Unable to create draft: not enough cards.');
  }
  cards = shuffleSeed.shuffle(cards, rng());
  return () => {
    // ignore cardFilters, just take any card in cube
    if (cards.length === 0) {
      throw new Error('Unable to create draft: not enough cards.');
    }
    // remove a random card
    return { card: cards.pop(), messages: [] };
  };
};

const standardDraftAsfan = (cards) => {
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
};

const customDraft = (cards, duplicates = false, rng) => {
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
        index = Math.floor(rng() * cardFilters.length);
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

    index = Math.floor(rng() * validCards.length);

    // slice out the first card with the index, or error out
    const card = validCards[index];
    if (!duplicates) {
      // remove from cards
      index = cards.indexOf(card);
      cards.splice(index, 1);
    }

    return { card, messages };
  };
};

const customDraftAsfan = (cards, duplicates = false) => {
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
        // This one's simple 1 / number of cards to pick from / number of filters to choose from
        const poolCount = validCards.length;
        const poolWeight = 1 / poolCount / validCardGroups.length;
        for (const card of validCards) {
          card.asfan += poolWeight;
        }
      } else {
        // This is the expected number of cards to still be in the pool we're pulling out of
        // otherwise this is the same as above for poolWeight.
        const poolCount = validCards.reduce((sum, card) => sum + (1 - card.asfan), 0);
        const poolWeight = 1 / poolCount / validCardGroups.length;
        for (const card of validCards) {
          // The 1 - card.asfan is the odds that it is still in the pool.
          card.asfan += (1 - card.asfan) * poolWeight;
        }
      }
    }
    return { card: true, messages: [] };
  };
};

export const getDraftFormat = (params, cube) => {
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
      format[pack] = { slots: [], steps: null };
      for (let card = 0; card < params.cards; card++) {
        format[pack].slots.push('*'); // any card
      }
    }
  }
  return format;
};

const createPacks = (draft, format, seats, nextCardFn) => {
  let ok = true;
  let messages = [];
  draft.initial_state = [];
  for (let seat = 0; seat < seats; seat++) {
    draft.initial_state.push([]);
    for (let packNum = 0; packNum < format.length; packNum++) {
      draft.initial_state[seat].push([]);
      const cards = [];
      for (let cardNum = 0; cardNum < format[packNum].slots.length; cardNum++) {
        const result = nextCardFn(format[packNum].slots[cardNum]);
        if (result.messages && result.messages.length > 0) {
          messages = messages.concat(result.messages);
        }
        if (result.card) {
          cards.push(result.card);
        } else {
          ok = false;
        }
      }
      draft.initial_state[seat][packNum] = {
        steps: format[packNum].steps,
        cards,
      };
    }
  }
  return { ok, messages };
};

// NOTE: format is an array with extra attributes, see getDraftFormat()
export const createDraft = (format, cubeCards, seats, user, seed = false) => {
  if (!seed) {
    seed = Date.now().toString();
  }
  const rng = seedrandom(seed);

  const draft = {
    seats: [],
    cards: [],
    seed,
  };
  console.debug('createDraft', JSON.stringify(format, null, 2));

  let nextCardFn = null;
  if (cubeCards.length === 0) {
    throw new Error('Unable to create draft: no cards.');
  }

  if (format.custom === true) {
    nextCardFn = customDraft(cubeCards, format.multiples, rng);
  } else {
    nextCardFn = standardDraft(cubeCards, rng);
  }

  const result = createPacks(draft, format, seats, nextCardFn);

  if (result.messages.length > 0) {
    draft.messages = result.messages.join('\n');
  }

  if (!result.ok) {
    throw new Error(`Could not create draft:\n${result.messages.join('\n')}`);
  }

  draft.seats = [];
  draft.cards = [];
  draft.initial_state = draft.initial_state.map((packs) =>
    packs.map(({ cards, ...pack }) => ({
      ...pack,
      cards: cards.map(({ details: _, ...card }) => {
        card.index = draft.cards.length;
        draft.cards.push(card);
        return card.index;
      }),
    })),
  );
  // No we randomize the order of the cards array to prevent leaking information.
  const shuffledIndices = shuffleSeed
    .shuffle(
      draft.cards.map((card, idx) => [card, idx]),
      rng(),
    )
    .map(([card, oldIdx], newIdx) => [card, oldIdx, newIdx])
    .sort(([, a], [, b]) => a - b);
  draft.initial_state = draft.initial_state.map((packs) =>
    packs.map(({ cards, ...pack }) => ({
      ...pack,
      cards: cards.map((oldIndex) => shuffledIndices[oldIndex][2]),
    })),
  );
  draft.cards = shuffledIndices.sort(([, , a], [, , b]) => a - b).map(([card], index) => ({ ...card, index }));

  // Need a better way to assign this for when there's more than one player, or the player isn't index 0
  draft.seats = draft.initial_state.map((_, seatIndex) => ({
    bot: seatIndex !== 0,
    name: seatIndex === 0 ? user.username : `Bot ${seatIndex}`,
    userid: seatIndex === 0 ? user._id : null,
    drafted: [new Array(8).fill([]), new Array(8).fill([])], // organized draft picks
    sideboard: [new Array(8).fill([]), new Array(8).fill([])],
    pickorder: [],
    trashorder: [],
  }));

  return draft;
};

export const checkFormat = (format, cards) => {
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
};

export const weightedAverage = (arr) => {
  const [count, total] = arr.reduce(([c, t], [weight, value]) => [c + weight, t + weight * value], [0, 0]);
  return total / (count || 1);
};

export const weightedMedian = (arr) => {
  const count = arr.reduce((acc, [weight]) => acc + weight, 0);
  const nums = [...arr].sort(([, a], [, b]) => a - b);
  const mid = count / 2;
  let total = 0;
  let prevValue = nums[0]?.[1] ?? 0;
  for (const [weight, value] of nums) {
    const newTotal = total + weight;
    // We can assume that total < mid since otherwise we would've already returned
    // Small exception happens if mid = 0 due to zero weights or empty array
    // which we do handle correctly.
    if (newTotal > mid) return (prevValue + value) / 2;
    if (newTotal === mid) return value;
    prevValue = value;
    total = newTotal;
  }
  return 0;
};

// Returns num+1 elements that are min, 1/num, 2/num, ..., max
export const weightedPercentiles = (arr, num) => {
  const count = arr.reduce((acc, [weight]) => acc + weight, 0);
  const nums = [...arr].sort(([, a], [, b]) => a - b);
  let total = 0;
  let prevValue = nums[0]?.[1] ?? 0;
  const percentiles = [];
  for (const [weight, value] of nums) {
    const newTotal = total + weight;
    while (newTotal > (percentiles.length * count) / num) {
      percentiles.push((prevValue + value) / 2);
    }
    if (newTotal === (percentiles.length * count) / num) {
      percentiles.push(value);
    }
    prevValue = value;
    total = newTotal;
  }
  return percentiles;
};

export const weightedStdDev = (arr, avg = null) => {
  if (avg === null) {
    avg = weightedAverage(arr);
  }
  const squareDiffs = arr.map(([weight, value]) => [weight, (value - avg) ** 2]);

  const count = arr.filter(([weight]) => weight).length;
  // Don't take stddev of 0 or 1 length vectors. The normalization is correct
  // something about degrees of freedom.
  const avgSquareDiff = (weightedAverage(squareDiffs) * count) / (count - 1 || 1);

  const stdDev = Math.sqrt(avgSquareDiff);
  return stdDev;
};

export const calculateAsfans = (cube, draftFormat) => {
  const draft = {};

  let nextCardFn = null;

  const cards = cube.cards.map((card) => ({ ...card, asfan: 0 }));
  const format = getDraftFormat({ id: draftFormat, packs: 3, cards: 15 }, cube);

  if (cards.length === 0) {
    throw new Error('Unable to create draft: no cards.');
  }

  if (format.custom === true) {
    nextCardFn = customDraftAsfan(cards, format.multiples);
  } else {
    nextCardFn = standardDraftAsfan(cards);
  }

  const result = createPacks(draft, format, 1, nextCardFn);

  if (result.messages.length > 0) {
    draft.messages = result.messages.join('\n');
  }

  if (!result.ok) {
    throw new Error(`Could not create draft:\n${result.messages.join('\n')}`);
  }

  return fromEntries(cards.map((card) => [card.cardID, card.asfan]));
};
