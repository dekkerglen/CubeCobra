import { filterCards, operatorsRegex, parseTokens, tokenizeInput, verifyTokens } from './Filter';
import { arrayShuffle } from './Util';

function matchingCards(cards, filter, restrictAsfan = false) {
  if (filter === null || filter.length === 0 || filter[0] === null || filter[0] === '') {
    return cards;
  }
  const filtered = filterCards(cards, filter, true);
  if (restrictAsfan) {
    return filtered.filter((card) => card.asfan < 1);
  } else {
    return filtered;
  }
}

function makeFilter(filterText) {
  if (!filterText || filterText === '' || filterText == '*') {
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
      tagfilterText = '"' + filterText + '"';
    }
    tagfilterText = 'tag:' + tagfilterText; // TODO: use tag instead of 'tag'
    tokens = [];
    valid = tokenizeInput(tagfilterText, tokens) && verifyTokens(tokens);
  }

  if (!valid) {
    throw new Error('Invalid card filter: ' + filterText);
  }
  return [parseTokens(tokens)];
}

/* Takes the raw data for custom format, converts to JSON and creates
   a data structure: 

      [pack][card in pack][token,token...]
*/
function parseDraftFormat(packsJSON, splitter = ',') {
  let format = JSON.parse(packsJSON);
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

function standardDraft(cards, probabilistic = false) {
  if (cards.length === 0) {
    throw new Error('Unable to create draft: not enough cards.');
  }
  if (probabilistic) {
    const poolCount = cards.length;
    const poolWeight = 1 / poolCount;
    return (cardFormat) => {
      cards.forEach((card) => (card.asfan += poolWeight));
      return { card: true, message: '' };
    };
  } else {
    cards = arrayShuffle(cards);
    return function(cardFormat) {
      return { card: cards.pop(), message: '' };
    };
  }
}

function customDraft(cards, duplicates = false, probabilistic = false) {
  return function(cardFilter) {
    if (cards.length === 0) {
      throw new Error('Unable to create draft: not enough cards.');
    }

    // each filter is an array of parsed filter tokens, we choose one randomly
    let validCardGroups = [];
    let index = -1;
    let messages = [];
    if (cardFilter.length > 0) {
      do {
        if (probabilistic) {
          index++;
        } else {
          index = Math.floor(Math.random() * cardFilter.length);
        }
        const validCards = matchingCards(cards, cardFilter[index], probabilistic && !duplicates);
        if (validCards.length == 0) {
          // TODO: display warnings for players
          messages.push('Warning: no cards matching filter: ' + cardFilter[index]);
          // try another options and remove this filter as it is now empty
          cardFilter.splice(index, 1);
        } else {
          validCardGroups.push(validCards);
        }
      } while (
        (probabilistic || validCardGroups.length == 0) &&
        cardFilter.length > 1 &&
        (!probabilistic || index + 1 < cardFilter.length)
      );
    }

    if (validCardGroups.length == 0) {
      throw new Error('Unable to create draft: not enough cards matching filter.');
    }

    if (probabilistic) {
      validCardGroups.forEach((validCards) => {
        if (duplicates) {
          const poolCount = validCards.length;
          const poolWeight = 1 / poolCount / validCardGroups.length;
          validCards.forEach((card) => (card.asfan += poolWeight));
        } else {
          const poolCount = validCards.reduce((sum, card) => sum + (1 - card.asfan), 0);
          const poolWeight = 1 / poolCount / validCardGroups.length;
          validCards.forEach((card) => (card.asfan += (1 - card.asfan) * poolWeight));
        }
      });
      return { card: true, messages: messages };
    } else {
      const validCards = validCardGroups[0];
      index = Math.floor(Math.random() * validCards.length);

      // slice out the first card with the index, or error out
      let card = validCards[index];
      if (!duplicates) {
        // remove from cards
        index = cards.indexOf(card);
        cards.splice(index, 1);
      }

      return { card: card, messages: messages };
    }
  };
}

export function getDraftBots(params) {
  var botcolors = Math.ceil(((params.seats - 1) * 2) / 5);
  var draftbots = [];
  var colors = [];
  for (let i = 0; i < botcolors; i++) {
    colors.push('W');
    colors.push('U');
    colors.push('B');
    colors.push('R');
    colors.push('G');
  }
  colors = arrayShuffle(colors);
  for (let i = 0; i < params.seats - 1; i++) {
    var colorcombo = [colors.pop(), colors.pop()];
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
  let messages = [];
  draft.picks = [];
  draft.packs = [];
  for (let seat = 0; seat < seats; seat++) {
    draft.picks.push([]);
    draft.packs.push([]);
    for (let packNum = 0; packNum < format.length; packNum++) {
      draft.packs[seat].push([]);
      let pack = [];
      for (let cardNum = 0; cardNum < format[packNum].length; cardNum++) {
        let result = nextCardFn(format[packNum][cardNum]);
        if (result.messages && result.messages.length > 0) {
          messages = messages.concat(result.messages);
        }
        if (result.card) {
          pack.push(result.card);
        }
      }
      if (!format.custom) {
        // Shuffle the cards in the pack.
        draft.packs[seat][packNum] = arrayShuffle(pack);
      } else {
        // Knowing what slots cards come from can be important.
        draft.packs[seat][packNum] = pack;
      }
    }
  }
  return { ok: true, messages: messages };
}

// NOTE: format is an array with extra attributes, see getDraftFormat()
export function populateDraft(draft, format, cards, bots, seats) {
  let nextCardFn = null;

  if (cards.length === 0) {
    throw new Error('Unable to create draft: no cards.');
  }
  if (bots.length === 0) {
    throw new Error('Unable to create draft: no bots.');
  }
  if (seats < 2) {
    throw new Error('Unable to create draft: invalid seats: ' + seats);
  }

  if (format.custom === true) {
    nextCardFn = customDraft(cards, format.multiples);
  } else {
    nextCardFn = standardDraft(cards);
  }

  let result = createPacks(draft, format, seats, nextCardFn);

  if (result.messages.length > 0) {
    // TODO: display messages to user
    draft.messages = result.messages.join('\n');
  }

  if (!result.ok) {
    throw new Error('Could not create draft:\n' + result.messages.join('\n'));
  }

  // initial draft state
  draft.initial_state = draft.packs.slice();
  draft.pickNumber = 1;
  draft.packNumber = 1;
  draft.bots = bots;

  return draft;
}

export function calculateAsfans(format, cards) {
  let nextCardFn = null;

  cards.forEach((card) => (card.asfan = 0));

  if (format.custom === true) {
    nextCardFn = customDraft(cards, format.multiples, true);
  } else {
    nextCardFn = standardDraft(cards, null, true);
  }

  return createPacks({}, format, 1, nextCardFn);
}

export default {
  calculateAsfans,
  populateDraft,
  getDraftBots,
  getDraftFormat,
};
