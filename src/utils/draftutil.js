'use strict';
const seedrandom = require('seedrandom');
const shuffleSeed = require('shuffle-seed');

const Util = require('utils/Util.js');
require('./Card.js');
const { filterToString, makeFilter, operatorsRegex } = require('filtering/FilterCards.js');
var Sort = require('utils/Sort.js');

function matchingCards(cards, filter) {
  if (filter === null) {
    return cards;
  }
  return cards.filter(filter);
}

function compileFilter(filterText) {
  if (!filterText || filterText === '' || filterText == '*') {
    return null;
  }

  const { filter, err } = makeFilter(filterText);
  if (err || !operatorsRegex.test(filterText)) {
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
export function parseDraftFormat(packsJSON, splitter = ',') {
  const format = JSON.parse(packsJSON);
  for (let j = 0; j < format.length; j++) {
    for (let k = 0; k < format[j].length; k++) {
      format[j][k] = format[j][k].split(splitter);
      for (let m = 0; m < format[j][k].length; m++) {
        format[j][k][m] = compileFilter(format[j][k][m].trim());
      }
    }
  }
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
  return function(cardFilters) {
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
        if (validCards.length == 0) {
          // TODO: display warnings for players
          messages.push(`Warning: no cards matching filter: ${filterToString(filter)}`);
          // try another options and remove this filter as it is now empty
          cardFilters.splice(index, 1);
        }
      } while (validCards.length == 0 && cardFilters.length > 0);
    }

    if (validCards.length == 0) {
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

export function getDraftBots(params) {
  const botcolors = Math.ceil(((params.seats - 1) * 2) / 5);
  const draftbots = [];
  let colors = [];
  for (let i = 0; i < botcolors; i++) {
    colors.push('W');
    colors.push('U');
    colors.push('B');
    colors.push('R');
    colors.push('G');
  }
  colors = Util.arrayShuffle(colors);
  for (let i = 0; i < params.seats - 1; i++) {
    const colorcombo = [colors.pop(), colors.pop()];
    draftbots.push(colorcombo);
  }
  // TODO: order the bots to avoid same colors next to each other
  return draftbots;
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
      let pack = [];
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

// NOTE: format is an array with extra attributes, see getDraftFormat()
export function createDraft(format, cards, bots, seats, user, seed = false) {
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

  for (let i = 0; i < draft.initial_state.length; i += 1) {
    const seat = {
      bot: i == 0 ? null : bots[i - 1],
      name: i == 0 ? user.username : 'Bot ' + i + ': ' + bots[i - 1][0] + ', ' + bots[i - 1][1],
      userid: i == 0 ? user._id : null,
      drafted: [], //organized draft picks
      pickorder: [],
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

export function average(arr) {
  const total = arr.reduce((acc, c) => acc + c, 0);
  return total / arr.length;
}

export function median(arr) {
  const mid = Math.floor(arr.length / 2);
  const nums = [...arr].sort((a, b) => a - b);
  return arr.length % 2 !== 0 ? nums[mid] : (nums[mid - 1] + nums[mid]) / 2;
}

export function stddev(arr, avg) {
  const squareDiffs = arr.map((value) => {
    const diff = value - avg;
    const sqrDiff = diff * diff;
    return sqrDiff;
  });

  const avgSquareDiff = average(squareDiffs);

  const stdDev = Math.sqrt(avgSquareDiff);
  return stdDev;
}

export function calculateAsfans(cards, cube, sort) {
  return [
    {
      label: '',
      data: Object.entries(Sort.sortIntoGroups(cards, sort)).map((tuple) => {
        return {
          label: tuple[0],
          asfan: (tuple[1].length / cube.cards.length) * 15, // 15 cards a pack
        };
      }),
    },
  ];
}

export function calculateCustomAsfans(cards, cube, sort, draftFormat) {
  const matchesDict = {};
  return draftFormat.map((pack, index) => {
    const asfanDict = {};
    for (const card of cards) {
      let total = 0;
      for (const slot of pack) {
        let sum = 0;
        for (const filter of slot) {
          if (!matchesDict[JSON.stringify(filter)]) {
            matchesDict[JSON.stringify(filter)] = matchingCards(cube.cards, filter);
          }
          const matches = matchesDict[JSON.stringify(filter)];
          if (matches.includes(card)) {
            sum += 1 / matches.length;
          }
        }
        total += ((1 - total) * sum) / slot.length;
      }
      asfanDict[card.cardID] = total;
    }
    console.log(matchesDict);

    return {
      label: `Pack ${index + 1}`,
      data: Object.entries(Sort.sortIntoGroups(cards, sort)).map((tuple) => {
        return {
          label: tuple[0],
          asfan: tuple[1].reduce((acc, c) => acc + asfanDict[c.cardID], 0),
        };
      }),
    };
  });
}
