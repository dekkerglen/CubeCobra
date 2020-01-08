const util = require('./util.js');
const Draft = require('../models/draft');
const Filter = require('../dist/util/Filter');

function matchingCards(cards, filter) {
  if (filter === null || filter.length === 0 || filter[0] === null) {
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
  if (!filterText || filterText === '' || filterText === '*') {
    return [null];
  }

  let tokens = [];
  let valid = false;

  valid = Filter.tokenizeInput(filterText, tokens) && Filter.verifyTokens(tokens);

  if (!valid) {
    // backwards compatibilty: * = any card or treat as tag
    if (filterText == '*') {
      return []; // any card
    }
    let tagfilterText = filterText;
    // if it contains spaces then wrap in quotes
    if (tagfilterText.indexOf(' ') >= 0 && !tagfilterText.startsWith('"')) {
      tagfilterText = '"' + filterText + '"';
    }
    tagfilterText = 'tag:' + tagfilterText; // TODO: use Filter.tag instead of 'tag'
    valid = Filter.tokenizeInput(tagfilterText, tokens) && Filter.verifyTokens(tokens);
  }

  if (valid) {
    return [Filter.parseTokens(tokens)];
  }

  // TODO: throw error
  console.log('Invalid card filter: ' + filterText);
  return [];
}

/* Takes the raw data for custom format, converts to JSON and creates
   a data structure: 

      [pack][card in pack][token,token...]

*/
function parseDraftFormat(packsJSON, splitter = ',') {
  let format = JSON.parse(packsJSON);
  for (j = 0; j < format.length; j++) {
    for (k = 0; k < format[j].length; k++) {
      format[j][k] = format[j][k].split(splitter);

      for (m = 0; m < format[j][k].length; m++) {
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
  draft.pickNumber = 1;
  draft.packNumber = 1;
  for (i = 0; i < seats; i++) {
    draft.picks.push([]);
    draft.packs.push([]);
    for (j = 0; j < format.length; j++) {
      draft.packs[i].push([]);
      let pack = [];
      for (k = 0; k < format[j].length; k++) {
        let result = nextCardfn(format[j][k]);
        if (result.message && result.message !== '') {
          messages.push(result.message);
        }
        if (result.card) {
          pack.push(result.card);
        } else {
          return { ok: false, messages: messages };
        }
      }
      // shuffle the cards in the pack
      draft.packs[i][j] = util.shuffle(pack);
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
    if (typeof cardFilter === 'string') {
      return { card: null, message: 'Unable to create draft. ' + cardFilter };
    }
    if (cards.length == 0) {
      return { card: null, message: 'Unable to create draft. Not enough cards.' };
    }

    // each filter is an array of parsed filter tokens, we choose one randomly
    let validCards = cards;
    let index = null;
    let message = '';
    if (cardFilter.length > 0) {
      do {
        index = Math.floor(Math.random() * cardFilter.length);
        validCards = matchingCards(cards, cardFilter[index]);
        if (validCards.length == 0) {
          // try another options and remove this filter as it is now empty
          cardFilter.splice(index, 1);
        }
      } while (validCards.length == 0 && cardFilter.length > 1);

      // try to fill with any available card
      if (validCards.length == 0) {
        // TODO: warn user that they ran out of matching cards
        message = 'Warning not enough cards matching any filter';
        validCards = cards;
      }
    }

    if (validCards.length == 0) {
      return { card: null, message: 'Unable to create draft, not enough cards matching filter.' };
    }

    index = Math.floor(Math.random() * validCards.length);

    // slice out the first card with the index, or error out
    let card = validCards[index];
    if (!duplicates) {
      // remove from cards
      index = cards.indexOf(card);
      cards.splice(index, 1);
    }

    return { card: card, message: message };
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

  getCardRatings: function(names, CardRating, callback) {
    CardRating.find(
      {
        name: {
          $in: names,
        },
      },
      function(err, ratings) {
        var dict = {};
        if (ratings) {
          ratings.forEach(function(rating, index) {
            dict[rating.name] = rating.value;
          });
        }
        callback(dict);
      },
    );
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
          format[pack].push('');
        }
      }
    }
    return format;
  },

  // NOTE: format is an array with extra attributes, see getDraftFormat()
  createDraft: function(format, cards, bots, seats) {
    let draft = new Draft();
    let nextCardfn = null;

    if (format.custom == true) {
      nextCardfn = customDraft(cards, format.multiples);
    } else {
      nextCardfn = standardDraft(cards);
    }
    format.drop = 2;

    let result = createPacks(draft, format, seats, nextCardfn);

    if (result.messages.length > 0) {
      // TODO: display messages to user
      draft.messages = result.messages.join('\n');
    }

    if (!result.ok) {
      throw new Error('Could not create draft:\n' + result.messages.join('\n'));
    }

    draft.initial_state = draft.packs.slice();
    draft.bots = bots;

    return draft;
  },
};

module.exports = publicMethods;
