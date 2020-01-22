const sanitizeHtml = require('sanitize-html');

const Blog = require('../models/blog');
const CardRating = require('../models/cardrating');
const Cube = require('../models/cube');

const { GetPrices } = require('../serverjs/prices.js');

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

function insertComment(comments, position, comment) {
  if (position.length <= 0) {
    comment.index = comments.length;
    comments.push(comment);
    return comment;
  } else {
    return insertComment(comments[position[0]].comments, position.slice(1), comment);
  }
}

function getOwnerFromComment(comments, position) {
  if (position.length <= 0) {
    return '';
  } else if (position.length == 1) {
    return comments[position[0]].owner;
  } else {
    return getOwnerFromComment(comments[position[0]].comments, position.slice(1));
  }
}

function saveEdit(comments, position, comment) {
  if (position.length == 1) {
    comments[position[0]] = comment;
  } else if (position.length > 1) {
    saveEdit(comments[position[0]].comments, position.slice(1), comment);
  }
}
function build_tag_colors(cube) {
  let tag_colors = cube.tag_colors;
  let tags = tag_colors.map((item) => item.tag);
  let not_found = tag_colors.map((item) => item.tag);

  cube.cards.forEach(function(card, index) {
    card.tags.forEach(function(tag, index) {
      tag = tag.trim();
      if (!tags.includes(tag)) {
        tag_colors.push({
          tag,
          color: null,
        });
        tags.push(tag);
      }
      if (not_found.includes(tag)) not_found.splice(not_found.indexOf(tag), 1);
    });
  });

  let tmp = [];
  tag_colors.forEach(function(item, index) {
    if (!not_found.includes(item.tag)) tmp.push(item);
  });
  tag_colors = tmp;

  return tag_colors;
}

function maybeCards(cube, carddb) {
  const maybe = (cube.maybe || []).filter((card) => card.cardID);
  return maybe.map((card) => ({ ...card, details: carddb.cardFromId(card.cardID) }));
}

async function getElo(cardnames, round) {
  const ratings = await CardRating.find({ name: { $in: cardnames } });
  const result = {};

  ratings.forEach(function(item, index) {
    result[item.name] = round ? Math.round(item.elo) : item.elo;
  });

  return result;
}

function setCubeType(cube, carddb) {
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
}

async function CSVtoCards(cards, carddb) {
  let missing = '';
  let newCards = [];
  let newMaybe = [];
  for (let card_raw of cards) {
    let split = util.CSVtoArray(card_raw);
    let name = split[0];
    let maybeboard = split[8];
    let card = {
      name: name,
      cmc: split[1],
      type_line: split[2].replace('-', '—'),
      colors: split[3].split('').filter((c) => [...'WUBRG'].includes(c)),
      set: split[4].toUpperCase(),
      addedTmsp: new Date(),
      collector_number: split[5],
      status: split[6],
      finish: split[7],
      imgUrl: split[9] && split[9] != 'undefined' ? split[9] : null,
      tags: split[10] && split[10].length > 0 ? split[10].split(',') : [],
    };

    let potentialIds = carddb.allIds(card);
    if (potentialIds && potentialIds.length > 0) {
      // First, try to find the correct set.
      let matchingSet = potentialIds.find((id) => carddb.cardFromId(id).set.toUpperCase() == card.set);
      let nonPromo = potentialIds.find(carddb.notPromoOrDigitalId);
      let first = potentialIds[0];
      card.cardID = matchingSet || nonPromo || first;
      if (maybeboard == 'true') {
        newMaybe.push(card);
      } else {
        newCards.push(card);
      }
    } else {
      missing += card.name + '\n';
    }
  }
  return { newCards: newCards, newMaybe: newMaybe, missing: missing };
}

async function generateBlogpost(req, res, cube, changelog, added, missing, carddb) {
  var blogpost = new Blog();
  blogpost.title = 'Cube Bulk Import - Automatic Post';
  blogpost.html = changelog;
  blogpost.owner = cube.owner;
  blogpost.date = Date.now();
  blogpost.cube = cube._id;
  blogpost.dev = 'false';
  blogpost.date_formatted = blogpost.date.toLocaleString('en-US');
  blogpost.username = cube.owner_name;
  blogpost.cubename = cube.name;

  if (missing.length > 0) {
    const reactProps = {
      cubeID: req.params.id,
      missing,
      added: added.map(({ _id, name, image_normal, image_flip }) => ({ _id, name, image_normal, image_flip })),
      blogpost: blogpost.toObject(),
    };
    res.render('cube/bulk_upload', {
      reactHTML:
        NODE_ENV === 'production'
          ? await ReactDOMServer.renderToString(React.createElement(BulkUploadPage, reactProps))
          : undefined,
      reactProps: serialize(reactProps),
      cube: cube,
      cube_id: req.params.id,
      title: `${abbreviate(cube.name)} - Bulk Upload`,
    });
  } else {
    blogpost.save(function(err) {
      cube = setCubeType(cube, carddb);
      Cube.updateOne(
        {
          _id: cube._id,
        },
        cube,
        function(err) {
          if (err) {
            req.flash('danger', 'Error adding cards. Please try again.');
            res.redirect('/cube/list/' + req.params.id);
          } else {
            req.flash('success', 'All cards successfully added.');
            res.redirect('/cube/list/' + req.params.id);
          }
        },
      );
    });
  }
}

async function compareCubes(req, res, cubeA, cubeB, carddb) {
  if (!cubeA) {
    req.flash('danger', 'Base cube not found');
    res.status(404).render('misc/404', {});
  } else if (!cubeB) {
    req.flash('danger', 'Comparison cube was not found');
    res.redirect('/cube/list/' + cubeA._id);
  } else {
    const pids = new Set();
    [cubeA, cubeB].forEach((cube) => {
      cube.cards.forEach(function(card, index) {
        card.details = {
          ...carddb.cardFromId(card.cardID),
        };
        if (!card.type_line) {
          card.type_line = card.details.type;
        }
        if (card.details.tcgplayer_id) {
          pids.add(card.details.tcgplayer_id);
        }
      });
    });

    const price_dict = await GetPrices([...pids]);
    [cubeA, cubeB].forEach((cube) => {
      cube.cards.forEach(function(card, index) {
        if (card.details.tcgplayer_id) {
          if (price_dict[card.details.tcgplayer_id]) {
            card.details.price = price_dict[card.details.tcgplayer_id];
          }
          if (price_dict[card.details.tcgplayer_id + '_foil']) {
            card.details.price_foil = price_dict[card.details.tcgplayer_id + '_foil'];
          }
        }
      });
    });

    let in_both = [];
    let only_a = cubeA.cards.slice(0);
    let only_b = cubeB.cards.slice(0);
    let a_names = only_a.map((card) => card.details.name);
    let b_names = only_b.map((card) => card.details.name);

    cubeA.cards.forEach(function(card, index) {
      if (b_names.includes(card.details.name)) {
        in_both.push(card);

        only_a.splice(a_names.indexOf(card.details.name), 1);
        only_b.splice(b_names.indexOf(card.details.name), 1);

        a_names.splice(a_names.indexOf(card.details.name), 1);
        b_names.splice(b_names.indexOf(card.details.name), 1);
      }
    });

    let all_cards = in_both.concat(only_a).concat(only_b);
    return {
      in_both,
      only_a,
      only_b,
      a_names,
      b_names,
      all_cards,
    };
  }
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
  generatePack: async (cubeId, carddb, seed) => {
    const cube = await Cube.findOne(build_id_query(cubeId));
    if (!seed) {
      seed = Date.now().toString();
    }

    const pack = util
      .shuffle(cube.cards, seed)
      .slice(0, 15)
      .map((card) => carddb.getCardDetails(card));

    return {
      seed,
      pack,
    };
  },
  generate_short_id,
  build_id_query,
  get_cube_id,
  intToLegality,
  legalityToInt,
  addCardHtml,
  removeCardHtml,
  replaceCardHtml,
  abbreviate,
  insertComment,
  getOwnerFromComment,
  saveEdit,
  build_tag_colors,
  maybeCards,
  getElo,
  setCubeType,
  CSVtoCards,
  generateBlogpost,
  compareCubes,
};

module.exports = methods;
