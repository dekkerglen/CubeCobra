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
      _id: id,
    };
  }
  return {
    $or: [
      {
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

  const short_ids = cubes.map((cube) => cube.shortID);
  const url_aliases = cubes.map((cube) => cube.urlAlias);

  const ids = cubes.map((cube) => util.from_base_36(cube.shortID));
  let max = Math.max(...ids);

  if (max < 0) {
    max = 0;
  }

  let new_id = '';
  while (true) {
    max++;
    new_id = util.to_base_36(max);

    if (!util.has_profanity(new_id) && !short_ids.includes(new_id) && !url_aliases.includes(new_id)) break;
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
      return 'Pioneer';
    case 4:
      return 'Standard';
    default:
      return undefined;
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
    case 'Pioneer':
      return 3;
    case 'Standard':
      return 4;
    default:
      return undefined;
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
  if (card.type_line && details.type_line && card.type_line != details.type_line) {
    return false;
  }
  if (!util.arraysEqual(card.tags, details.tags)) {
    return false;
  }
  if (!util.arraysEqual(card.colors, details.colors)) {
    return false;
  }
  if (card.finish && details.finish && card.finish != details.finish) {
    return false;
  }

  return true;
}

function cardHtml(card) {
  if (card.image_flip) {
    return (
      '<a class="dynamic-autocard" card="' +
      card.image_normal +
      '" card_flip="' +
      card.image_flip +
      '">' +
      card.name +
      '</a>'
    );
  } else {
    return '<a class="dynamic-autocard" card="' + card.image_normal + '">' + card.name + '</a>';
  }
}

function addCardHtml(card) {
  return (
    '<span style="font-family: &quot;Lucida Console&quot;, Monaco, monospace;" class="badge badge-success">+</span> ' +
    cardHtml(card) +
    '<br/>'
  );
}

function removeCardHtml(card) {
  return (
    '<span style="font-family: &quot;Lucida Console&quot;, Monaco, monospace;" class="badge badge-danger">-</span> ' +
    cardHtml(card) +
    '<br/>'
  );
}

function replaceCardHtml(oldCard, newCard) {
  return (
    '<span style="font-family: &quot;Lucida Console&quot;, Monaco, monospace;" class="badge badge-primary">→</span> ' +
    cardHtml(oldCard) +
    ' &gt; ' +
    cardHtml(newCard) +
    '<br/>'
  );
}

function abbreviate(name) {
  return name.length < 20 ? name : name.slice(0, 20) + '…';
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
        if (!found && card.set.toLowerCase() == set) {
          found = true;
          res[name] = {
            details: card,
          };
        }
      });
    });
    return res;
  },
  cardsAreEquivalent: cardsAreEquivalent,
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
      allowedTags: [
        'div',
        'p',
        'strike',
        'strong',
        'b',
        'i',
        'em',
        'u',
        'a',
        'h5',
        'h6',
        'ul',
        'ol',
        'li',
        'span',
        'br',
      ],
      selfClosing: ['br'],
    });
  },
  addAutocard: function(src, carddb, cube) {
    while (src.includes('[[') && src.includes(']]') && src.indexOf('[[') < src.indexOf(']]')) {
      var cardname = src.substring(src.indexOf('[[') + 2, src.indexOf(']]'));
      var mid = cardname;
      if (carddb.nameToId[cardname.toLowerCase()]) {
        var possible = carddb.nameToId[cardname.toLowerCase()];
        var cardID = null;
        if (cube && cube.cards) {
          var allIds = cube.cards.map((card) => card.cardID);
          var matchingNameIds = allIds.filter((id) => possible.includes(id));
          cardID = matchingNameIds[0];
        }
        if (!cardID) {
          cardID = possible[0];
        }
        var card = carddb.cardFromId(cardID);
        if (card.image_flip) {
          mid =
            '<a class="autocard" card="' +
            card.image_normal +
            '" card_flip="' +
            card.image_flip +
            '">' +
            card.name +
            '</a>';
        } else {
          mid = '<a class="autocard" card="' + card.image_normal + '">' + card.name + '</a>';
        }
      }
      //front + autocard + back
      src = src.substring(0, src.indexOf('[[')) + mid + src.substring(src.indexOf(']]') + 2);
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
      const pack = util
        .shuffle(cube.cards, seed)
        .slice(0, 15)
        .map((card) => carddb.getCardDetails(card));
      callback(false, {
        seed,
        pack,
      });
    });
  },
  generate_short_id,
  build_id_query,
  get_cube_id,
  intToLegality,
  legalityToInt,
  cardHtml,
  addCardHtml,
  removeCardHtml,
  replaceCardHtml,
  abbreviate
};

module.exports = methods;
