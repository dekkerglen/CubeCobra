const util = require('./util.js');
const Draft = require('../models/draft');
const Filter = require('../dist/util/Filter');

function matchingCards(cards, filter) {
  if (filter === null || filter.length === 0 || filter[0] === null || filter[0] === '') {
    return cards;
  }
  return cards.filter((card) =>
    Filter.filterCard(
      card,
      filter,
      true, // in cube
    ),
  );
}

function makeFilter(filterText) {
  console.log('filterText', filterText, filterText === '');
  if (!filterText || filterText === '' || filterText == '*') {
    return [null];
  }

  let tokens = [];
  let valid = false;
  valid = Filter.tokenizeInput(filterText, tokens) && Filter.verifyTokens(tokens);

  // backwards compatibilty: treat as tag
  if (!valid || !Filter.operatorsRegex.test(filterText)) {
    let tagfilterText = filterText;
    // if it contains spaces then wrap in quotes
    if (tagfilterText.indexOf(' ') >= 0 && !tagfilterText.startsWith('"')) {
      tagfilterText = '"' + filterText + '"';
    }
    tagfilterText = 'tag:' + tagfilterText; // TODO: use Filter.tag instead of 'tag'
    tokens = [];
    valid = Filter.tokenizeInput(tagfilterText, tokens) && Filter.verifyTokens(tokens);
  }

  if (!valid) {
    throw new Error('Invalid card filter: ' + filterText);
  }
  return [Filter.parseTokens(tokens)];
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

function createPacks(draft, format, seats, nextCardfn) {
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
        let result = nextCardfn(format[packNum][cardNum]);
        if (result.messages && result.messages.length > 0) {
          messages = messages.concat(result.messages);
        }
        if (result.card) {
          pack.push(result.card);
        }
      }
      // shuffle the cards in the pack
      draft.packs[seat][packNum] = util.shuffle(pack);
    }
  }
  return { ok: true, messages: messages };
}

function standardDraft(cards) {
  cards = util.shuffle(cards);

  return function(cardFormat) {
    return { card: cards.pop(), message: '' };
  };
}

function customDraft(cards, duplicates = false) {
  return function(cardFilter) {
    if (cards.length === 0) {
      throw new Error('Unable to create draft. Not enough cards.');
    }

    // each filter is an array of parsed filter tokens, we choose one randomly
    let validCards = cards;
    let index = null;
    let messages = [];
    if (cardFilter.length > 0) {
      do {
        index = Math.floor(Math.random() * cardFilter.length);
        validCards = matchingCards(cards, cardFilter[index]);
        if (validCards.length == 0) {
          // try another options and remove this filter as it is now empty
          cardFilter.splice(index, 1);
          messages.push('Warning: no cards matching filter: ' + cardFilter[index]);
        }
      } while (validCards.length == 0 && cardFilter.length > 1);

      // try to fill with any available card
      if (validCards.length == 0) {
        // TODO: warn user that they ran out of matching cards
        messages.push('Warning: not enough cards matching any filter.');
        validCards = cards;
      }
    }

    if (validCards.length == 0) {
      throw new Error('Unable to create draft, not enough cards matching filter.');
    }

    index = Math.floor(Math.random() * validCards.length);

    // slice out the first card with the index, or error out
    let card = validCards[index];
    if (!duplicates) {
      // remove from cards
      index = cards.indexOf(card);
      cards.splice(index, 1);
    }

    return { card: card, messages: messages };
  };
}

var publicMethods = {
  getDraftBots: function(params) {
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
    colors = util.shuffle(colors);
    for (let i = 0; i < params.seats - 1; i++) {
      var colorcombo = [colors.pop(), colors.pop()];
      draftbots.push(colorcombo);
    }
    // TODO: order the bots to avoid same colors next to each other
    return draftbots;
  },

  getDraftFormat: function(params, cube) {
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
  },

  // NOTE: format is an array with extra attributes, see getDraftFormat()
  createDraft: function(format, cards, bots, seats) {
    let draft = new Draft();
    let nextCardfn = null;

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
      nextCardfn = customDraft(cards, format.multiples);
    } else {
      nextCardfn = standardDraft(cards);
    }

    let result = createPacks(draft, format, seats, nextCardfn);

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
  },
};

module.exports = publicMethods;
