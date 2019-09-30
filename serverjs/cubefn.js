const sanitizeHtml = require('sanitize-html');
const Cube = require('../models/cube');
const util = require('./util');

function get_cube_id(cube) {
  if (cube.urlAlias) return cube.urlAlias;
  if (cube.shortID) return cube.shortID;
  return cube._id;
}

function build_id_query(id) {
  if (!id || id.match(/^[0-9a-fA-F]{24}$/)) {
    return {
      _id: id
    };
  }
  return {
    $or: [{
        shortID: id.toLowerCase(),
      },
      {
        urlAlias: id.toLowerCase(),
      },
    ],
  };
}

async function generate_short_id() {
  let cubes = await Cube.find({}, ['shortID', 'urlAlias']);

  const short_ids = cubes.map(cube => cube.shortID);
  const url_aliases = cubes.map(cube => cube.urlAlias);

  const ids = cubes.map(cube => util.from_base_36(cube.shortID));
  let max = Math.max(...ids);

  if (max < 0) {
    max = 0;
  }

  let new_id = '';
  while (true) {
    max++;
    new_id = util.to_base_36(max);

    if (!util.has_profanity(new_id) &&
      !short_ids.includes(new_id) &&
      !url_aliases.includes(new_id)) break;
  }

  return new_id;
}

function intToLegality(val) {
  switch (val) {
    case 0:
      return 'Vintage';
    case 1:
      return 'Legacy';
    case 2:
      return 'Modern';
    case 3:
      return 'Standard';
  }
}

function legalityToInt(legality) {
  switch (legality) {
    case 'Vintage':
      return 0;
    case 'Legacy':
      return 1;
    case 'Modern':
      return 2;
    case 'Standard':
      return 3;
  }
}

function cardsAreEquivalent(card, details) {
  if (card.cardID != details.cardID) {
    return false;
  }
  if (card.status != details.status) {
    return false;
  }
  if (card.cmc != details.cmc) {
    return false;
  }
  if (card.type_line != details.type_line) {
    return false;
  }
  if (!util.arraysEqual(card.tags, details.tags)) {
    return false;
  }
  if (!util.arraysEqual(card.colors, details.colors)) {
    return false;
  }

  return true;
}

var methods = {
  getBasics: function(carddb) {
    var names = ['Plains', 'Mountain', 'Forest', 'Swamp', 'Island'];
    var set = 'unh';
    var res = {};
    names.forEach(function(name, index) {
      var found = false;
      var options = carddb.nameToId[name.toLowerCase()];
      options.forEach(function(option, index2) {
        var card = carddb.cardFromId(option);
        card.display_image = util.getCardImageURL({
          details: card
        });
        if (!found && card.set.toLowerCase() == set) {
          found = true;
          res[name] = {
            details: card
          };
        }
      });
    });
    return res;
  },
  cardsAreEquivalent: cardsAreEquivalent,
  selectionContainsCard: function(card, selection) {
    selection.forEach(function(select, index) {
      if (cardsAreEquivalent(select, card.details)) {
        return true;
      }
    });
    return false;
  },
  setCubeType: function(cube, carddb) {
    var pauper = true;
    var type = legalityToInt('Standard');
    cube.cards.forEach(function(card, index) {
      if (pauper && !carddb.cardFromId(card.cardID).legalities.Pauper) {
        pauper = false;
      }
      while (type > 0 && !carddb.cardFromId(card.cardID).legalities[intToLegality(type)]) {
        type -= 1;
      }
    });

    cube.type = intToLegality(type);
    if (pauper) {
      cube.type += ' Pauper';
    }
    cube.card_count = cube.cards.length;
    return cube;
  },
  sanitize: function(html) {
    return sanitizeHtml(html, {
      allowedTags: ['div', 'p', 'strike', 'strong', 'b', 'i', 'em', 'u', 'a', 'h5', 'h6', 'ul', 'ol', 'li', 'span', 'br'],
      selfClosing: ['br']
    });
  },
  addAutocard: function(src, carddb) {
    while (src.includes('[[') && src.includes(']]') && src.indexOf('[[') < src.indexOf(']]')) {
      var cardname = src.substring(src.indexOf('[[') + 2, src.indexOf(']]'));
      var mid = cardname;
      if (carddb.nameToId[cardname.toLowerCase()]) {
        var card = carddb.cardFromId(carddb.nameToId[cardname.toLowerCase()][0]);
        if (card.image_flip) {
          mid = '<a class="autocard" card="' + card.image_normal + '" card_flip="' + card.image_flip + '">' + card.name + '</a>';
        } else {
          mid = '<a class="autocard" card="' + card.image_normal + '">' + card.name + '</a>';
        }
      }
      //front + autocard + back
      src = src.substring(0, src.indexOf('[[')) +
        mid +
        src.substring(src.indexOf(']]') + 2);
    }
    return src;
  },
  generatePack: function(cubeId, carddb, seed, callback) {
    Cube.findOne(build_id_query(cubeId), function(err, cube) {
      if (!cube) {
        callback(true);
      }
      if (!seed) {
        seed = Date.now().toString();
      }
      const pack = util.shuffle(cube.cards, seed).slice(0, 15).map(card => carddb.getCardDetails(card));
      callback(false, {
        seed,
        pack
      });
    });
  },
  generate_short_id,
  build_id_query,
  get_cube_id,
  intToLegality,
  legalityToInt
};

module.exports = methods;
