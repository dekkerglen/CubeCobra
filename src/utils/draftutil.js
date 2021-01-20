const seedrandom = require('seedrandom');
const shuffleSeed = require('shuffle-seed');

const Util = require('utils/Util.js');
require('./Card.js');
const { filterToString, makeFilter, operatorsRegex } = require('filtering/FilterCards.js');

export function matchingCards(cards, filter) {
  if (filter) {
    return cards.filter(filter);
  }
  return cards;
}

function compileFilter(filterText) {
  if (!filterText || filterText === '' || filterText === '*') {
    return null;
  }

  let { filter, err } = makeFilter(filterText);
  if (!operatorsRegex.test(filterText)) {
    let tagfilterText = filterText;
    // if it contains spaces then wrap in quotes
    if (tagfilterText.indexOf(' ') >= 0 && !tagfilterText.startsWith('"')) {
      tagfilterText = `"${filterText}"`;
    }
    tagfilterText = `tag:${tagfilterText}`; // TODO: use tag instead of 'tag'
    ({ filter, err } = makeFilter(tagfilterText));
  }

  if (err) {
    throw new Error(`Invalid card filter: ${filterText}`);
  }
  return filter;
}

/* Takes the raw data for custom format, converts to JSON and creates
   a data structure: 

      [pack][card in pack][token,token...]
*/
export function parseDraftFormat(format, splitter = ',') {
  for (let j = 0; j < format.length; j++) {
    for (let k = 0; k < format[j].slots.length; k++) {
      format[j].slots[k] = format[j].slots[k].split(splitter);
      for (let m = 0; m < format[j].slots[k].length; m++) {
        format[j].slots[k][m] = compileFilter(format[j].slots[k][m].trim());
      }
    }
  }
  console.log(format[0]);
  return format;
}

// standard draft has no duplicates
function standardDraft(cards, seed = false) {
  if (cards.length === 0) {
    throw new Error('Unable to create draft: not enough cards.');
  }
  cards = shuffleSeed.shuffle(cards, seed);
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

function customDraft(cards, duplicates = false, seed = false) {
  if (!seed) {
    seed = Date.now().toString();
  }
  const rng = seedrandom(seed);
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
      format[pack] = { steps: null };
      for (let card = 0; card < params.cards; card++) {
        format[pack].slots.push('*'); // any card
      }
    }
  }
  return format;
}

function createPacks(draft, format, seats, nextCardFn) {
  let ok = true;
  let messages = [];
  draft.initial_state = [];
  console.log(format);
  for (let seat = 0; seat < seats; seat++) {
    draft.initial_state.push([]);
    for (let packNum = 0; packNum < format.length; packNum++) {
      draft.initial_state[seat].push([]);
      const pack = [];
      for (let cardNum = 0; cardNum < format[packNum].slots.length; cardNum++) {
        const result = nextCardFn(format[packNum].slots[cardNum]);
        if (result.messages && result.messages.length > 0) {
          messages = messages.concat(result.messages);
        }
        if (result.card) {
          pack.push(result.card);
        } else {
          ok = false;
        }
      }
      draft.initial_state[seat][packNum] = {
        steps: format[packNum].steps,
        cards: pack,
      };
    }
  }
  return { ok, messages };
}

// NOTE: format is an array with extra attributes, see getDraftFormat()
export function createDraft(format, cards, seats, user, seed = false) {
  if (!seed) {
    seed = Date.now().toString();
  }

  const draft = {};

  let nextCardFn = null;
  if (cards.length === 0) {
    throw new Error('Unable to create draft: no cards.');
  }

  if (format.custom === true) {
    nextCardFn = customDraft(cards, format.multiples, seed);
  } else {
    nextCardFn = standardDraft(cards, seed);
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
  draft.cards = [];

  // deep clone packs
  for (let i = 0; i < draft.initial_state.length; i++) {
    draft.unopenedPacks.push([]);
    for (let j = 0; j < draft.initial_state[i].length; j++) {
      draft.unopenedPacks[i].push({
        cards: [],
        trash: draft.initial_state[i][j].trash,
        sealed: draft.initial_state[i][j].sealed,
        picksPerPass: draft.initial_state[i][j].picksPerPass,
      });
      for (let k = 0; k < draft.initial_state[i][j].cards.length; k++) {
        const card = { ...draft.initial_state[i][j].cards[k], index: draft.cards.length };
        delete card.details;
        draft.cards.push(card);
        draft.unopenedPacks[i][j].cards.push(card.index);
        draft.initial_state[i][j].cards[k] = card.index;
      }
    }
  }

  for (let i = 0; i < draft.initial_state.length; i += 1) {
    const seat = {
      bot: i !== 0,
      name: i === 0 ? user.username : `Bot ${i}`,
      userid: i === 0 ? user._id : null,
      drafted: [new Array(8).fill([]), new Array(8).fill([])], // organized draft picks
      sideboard: [new Array(8).fill([]), new Array(8).fill([])],
      pickorder: [],
      trashorder: [],
      packbacklog: [],
    };

    for (let j = 0; j < 16; j++) {
      seat.drafted.push([]);
    }

    seat.packbacklog.push(draft.unopenedPacks[i].shift());
    draft.seats.push(seat);
  }

  return draft;
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

export function weightedAverage(arr) {
  const [count, total] = arr.reduce(([c, t], [weight, value]) => [c + weight, t + weight * value], [0, 0]);
  return total / (count || 1);
}

export function weightedMedian(arr) {
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
}

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

export function weightedStdDev(arr, avg = null) {
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
}

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

  return Util.fromEntries(cards.map((card) => [card.cardID, card.asfan]));
};
