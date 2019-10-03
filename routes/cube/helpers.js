const fetch = require('node-fetch');
const request = require('request');

const Blog = require('../../models/blog')
const carddb = require('../../serverjs/cards.js');
const Cube = require('../../models/cube')
const Draft = require('../../models/draft')
const draftutil = require('../../serverjs/draftutil.js');
const tcgconfig = require('../../../cubecobrasecrets/tcgplayer');
const util = require('../../serverjs/util.js');
const {
  get_cube_id,
  setCubeType,
} = require('../../serverjs/cubefn.js');

var token = null;
var cached_prices = {};
carddb.initializeCardDb();

function Tomorrow() {
  var date = new Date();
  //add 1 day to expiration date
  date.setDate(date.getDate() + 1);
  return date;
}

function GetToken(callback) {
  if (token && Date.now() < token.expires) {
    //TODO: check if token is expired, if so, fetch a new one
    callback(token.access_token);
  } else {
    console.log(Date(Date.now()).toString(), 'fetching fresh token');
    var options = {
      url: 'https://api.tcgplayer.com/token',
      method: 'POST',
      header: 'application/x-www-form-urlencoded',
      body: 'grant_type=client_credentials&client_id=' + tcgconfig.Public_Key + '&client_secret=' + tcgconfig.Private_Key
    };

    request(options, function(error, response, body) {
      if (error) {
        console.log(error);
        callback();
      } else {
        token = JSON.parse(body);
        token.expires = Tomorrow();
        console.log(token.expires.toString());
        callback(token.access_token);
      }
    });
  }
}

function listToString(list) {
  var str = '';
  list.forEach(function(item, index) {
    if (index != 0) {
      str += ',';
    }
    str += item;
  })
  return str;
}

function checkStatus(response) {
  if (response.ok) {
    return Promise.resolve(response);
  } else {
    return Promise.reject(new Error(response.statusText));
  }
}

function parseJSON(response) {
  return response.json();
}

//callback with a dict of card prices
function GetPrices(card_ids, callback) {
  var price_dict = {};

  //trim card_ids if we have a recent cached date
  for (let i = card_ids.length - 1; i >= 0; i--) {
    if (cached_prices[card_ids[i]] && cached_prices[card_ids[i]].expires < Date.now()) {
      if (cached_prices[card_ids[i]].price) {
        price_dict[card_ids[i]] = cached_prices[card_ids[i]].price;
      }
      if (cached_prices[card_ids[i]].price_foil) {
        price_dict[card_ids[i] + '_foil'] = cached_prices[card_ids[i]].price_foil;
      }
      card_ids.splice(i, 1);
    }
  }

  if (card_ids.length > 0) {

    var chunkSize = 250;
    //max tcgplayer request size is 250
    var chunks = [];
    for (let i = 0; i < card_ids.length / chunkSize; i++) {
      chunks.push(card_ids.slice(i * chunkSize, (i + 1) * chunkSize));
    }

    GetToken(function(access_token) {
      Promise.all(chunks.map(chunk =>
        fetch('http://api.tcgplayer.com/v1.32.0/pricing/product/' + listToString(chunk), {
          headers: {
            Authorization: ' Bearer ' + access_token
          },
          method: 'GET',
        })
        .then(checkStatus)
        .then(parseJSON)
      )).then(function(responses) {
        responses.forEach(function(response, index) {
          response.results.forEach(function(item, index) {
            if (!cached_prices[item.productId]) {
              cached_prices[item.productId] = {};
            }
            if (item.marketPrice && item.subTypeName == 'Normal') {
              price_dict[item.productId] = item.marketPrice;
              cached_prices[item.productId].price = item.marketPrice;
              cached_prices[item.productId].expires = Tomorrow();
            } else if (item.marketPrice && item.subTypeName == 'Foil') {
              price_dict[item.productId + '_foil'] = item.marketPrice;
              cached_prices[item.productId].price_foil = item.marketPrice;
              cached_prices[item.productId].expires = Tomorrow();
            }
          });
        });
        callback(price_dict);
      }).catch(function(error) {
        console.log("error: " + error);
        callback({});
      });
    });
  } else {
    callback(price_dict);
  }
}

function cardHtml(card) {
  if (card.image_flip) {
    return '<a class="dynamic-autocard" card="' + card.image_normal + '" card_flip="' + card.image_flip + '">' + card.name + '</a>';
  } else {
    return '<a class="dynamic-autocard" card="' + card.image_normal + '">' + card.name + '</a>';
  }
}

function addCardHtml(card) {
  return '<span style="font-family: &quot;Lucida Console&quot;, Monaco, monospace;" class="badge badge-success">+</span> ' + cardHtml(card) + '<br/>';
}

function removeCardHtml(card) {
  return '<span style="font-family: &quot;Lucida Console&quot;, Monaco, monospace;" class="badge badge-danger">-</span> ' + cardHtml(card) + '<br/>';
}

function replaceCardHtml(oldCard, newCard) {
  return '<span style="font-family: &quot;Lucida Console&quot;, Monaco, monospace;" class="badge badge-primary">→</span> ' + cardHtml(oldCard) + ' &gt; ' + cardHtml(newCard) + '<br/>';
}

function notPromoOrDigitalId(id) {
  let card = carddb.cardFromId(id);
  return !card.promo && !card.digital && card.border_color != 'gold';
}

function abbreviate(name) {
  return name.length < 20 ? name : name.slice(0, 20) + '…';
}

function bulkuploadCSV(req, res, cards, cube) {
  let added = [];
  let missing = "";
  let changelog = "";
  for (let card_raw of cards) {
    let split = util.CSVtoArray(card_raw);
    let name = split[0];
    let card = {
      name: name,
      cmc: split[1],
      type_line: split[2].replace('-', '—'),
      colors: split[3].split('').filter(c => [...'WUBRG'].includes(c)),
      set: split[4].toUpperCase(),
      collector_number: split[5],
      status: split[6],
      tags: split[7] && split[7].length > 0 ? split[7].split(',') : [],
    };

    let potentialIds = carddb.allIds(card);
    if (potentialIds && potentialIds.length > 0) {
      // First, try to find the correct set.
      let matchingSet = potentialIds.find(id => carddb.cardFromId(id).set.toUpperCase() == card.set);
      let nonPromo = potentialIds.find(notPromoOrDigitalId);
      let first = potentialIds[0];
      card.cardID = matchingSet || nonPromo || first;
      cube.cards.push(card);
      changelog += addCardHtml(carddb.cardFromId(card.cardID));
    } else {
      missing += card.name + '\n';
    }
  }

  var blogpost = new Blog();
  blogpost.title = 'Cube Bulk Import - Automatic Post'
  blogpost.html = changelog;
  blogpost.owner = cube.owner;
  blogpost.date = Date.now();
  blogpost.cube = cube._id;
  blogpost.dev = 'false';
  blogpost.date_formatted = blogpost.date.toLocaleString("en-US");

  //
  if (missing.length > 0) {
    res.render('cube/bulk_upload', {
      missing: missing,
      cube_id: get_cube_id(cube),
      title: `${abbreviate(cube.name)} - Bulk Upload`,
      added: JSON.stringify(added),
      cube: cube,
      user: {
        id: req.user._id,
        username: req.user.username
      }
    });
  } else {
    blogpost.save(function(err) {
      cube = setCubeType(cube, carddb);
      Cube.updateOne({
        _id: cube._id
      }, cube, function(err) {
        if (err) {
          req.flash('danger', 'Error adding cards. Please try again.');
          res.redirect('/cube/list/' + req.params.id);
        } else {
          req.flash('success', 'All cards successfully added.');
          res.redirect('/cube/list/' + req.params.id);
        }
      });
    });
  }
}

function bulkUpload(req, res, list, cube) {
  const cards = list.match(/[^\r\n]+/g);
  if (cards) {
    if (cards[0].trim() == 'Name,CMC,Type,Color,Set,Collector Number,Status,Tags') {
      cards.splice(0, 1);
      bulkuploadCSV(req, res, cards, cube);
    } else {
      cube.date_updated = Date.now();
      cube.updated_string = cube.date_updated.toLocaleString("en-US");
      if (!cards) {
        req.flash('danger', 'No Cards Detected');
        res.redirect('/cube/list/' + req.params.id);
      } else {
        var missing = "";
        var added = [];
        var changelog = "";
        for (let i = 0; i < cards.length; i++) {
          let item = cards[i].toLowerCase().trim();
          if (/([0-9]+x )(.*)/.test(item)) {
            var count = parseInt(item.substring(0, item.indexOf('x')));
            for (j = 0; j < count; j++) {
              cards.push(item.substring(item.indexOf('x') + 1));
            }
          } else {
            let selected = undefined;
            if (/(.*)( \((.*)\))/.test(item)) {
              //has set info
              if (carddb.nameToId[item.toLowerCase().substring(0, item.indexOf('(')).trim()]) {
                let name = item.toLowerCase().substring(0, item.indexOf('(')).trim();
                let set = item.toLowerCase().substring(item.indexOf('(') + 1, item.indexOf(')'))
                //if we've found a match, and it DOES need to be parsed with cubecobra syntax
                let potentialIds = carddb.nameToId[name];
                selected = potentialIds.find(id => carddb.cardFromId(id).set.toUpperCase() == set);
              }
            } else {
              //does not have set info
              let potentialIds = carddb.nameToId[item.toLowerCase().trim()];
              if (potentialIds && potentialIds.length > 0) {
                let nonPromo = potentialIds.find(notPromoOrDigitalId);
                selected = nonPromo || potentialIds[0];
              }
            }
            if (selected) {
              let details = carddb.cardFromId(selected);
              util.addCardToCube(cube, details, details);
              added.push(details);
              changelog += addCardHtml(details);
            } else {
              missing += item + '\n';
            }
          }
        }

        var blogpost = new Blog();
        blogpost.title = 'Cube Bulk Import - Automatic Post'
        blogpost.html = changelog;
        blogpost.owner = cube.owner;
        blogpost.date = Date.now();
        blogpost.cube = cube._id;
        blogpost.dev = 'false';
        blogpost.date_formatted = blogpost.date.toLocaleString("en-US");

        //
        if (missing.length > 0) {
          res.render('cube/bulk_upload', {
            missing: missing,
            cube_id: get_cube_id(cube),
            title: `${abbreviate(cube.name)} - Bulk Upload`,
            added: JSON.stringify(added),
            cube: cube,
            user: {
              id: req.user._id,
              username: req.user.username
            }
          });
        } else {
          blogpost.save(function(err) {
            cube = setCubeType(cube, carddb);
            Cube.updateOne({
              _id: cube._id
            }, cube, function(err) {
              if (err) {
                req.flash('danger', 'Error adding cards. Please try again.');
                res.redirect('/cube/list/' + req.params.id);
              } else {
                req.flash('success', 'All cards successfully added.');
                res.redirect('/cube/list/' + req.params.id);
              }
            });
          });
        }
      }
    }
  } else {
    req.flash('danger', 'Error adding cards. Invalid format.');
    res.redirect('/cube/list/' + req.params.id);
  }
}

function startCustomDraft(req, res, params, cube) {
  //setup draft conditions
  const cards = cube.cards;

  if (cube.draft_formats[params.id].multiples) {
    var format = JSON.parse(cube.draft_formats[params.id].packs);
    for (let j = 0; j < format.length; j++) {
      for (let k = 0; k < format[j].length; k++) {
        format[j][k] = format[j][k].split(',');
        for (let m = 0; m < format[j][k].length; m++) {
          format[j][k][m] = format[j][k][m].trim().toLowerCase();
        }
      }
    }
    var pools = {};
    //sort the cards into groups by tag, then we can pull from them randomly
    pools['*'] = [];
    cards.forEach(function(card, index) {
      pools['*'].push(index);
      if (card.tags && card.tags.length > 0) {
        card.tags.forEach(function(tag, tag_index) {
          tag = tag.toLowerCase();
          if (tag != '*') {
            if (!pools[tag]) {
              pools[tag] = [];
            }
            if (!pools[tag].includes(index)) {
              pools[tag].push(index);
            }
          }
        });
      }
    });
    var draft = new Draft();

    //setup draftbots
    draft.bots = draftutil.getDraftBots(params);

    var fail = false;
    var failMessage = "";

    draft.picks = [];
    draft.packs = [];
    draft.cube = cube._id;
    draft.pickNumber = 1;
    draft.packNumber = 1;
    for (let i = 0; i < params.seats; i++) {
      draft.picks.push([]);
      draft.packs.push([]);
      for (let j = 0; j < format.length; j++) {
        draft.packs[i].push([]);
        for (let k = 0; k < format[j].length; k++) {
          draft.packs[i][j].push(0);
          var tag = format[j][k][Math.floor(Math.random() * format[j][k].length)];
          var pool = pools[tag];
          if (pool && pool.length > 0) {
            var card = cards[pool[Math.floor(Math.random() * pool.length)]];
            draft.packs[i][j][k] = card;
          } else {
            fail = true;
            failMessage = 'Unable to create draft, no card with tag "' + tag + '" found.';
          }
        }
      }
    }
    if (!fail) {
      draft.save(function(err) {
        if (err) {
          console.log(err, req);
        } else {
          res.redirect('/cube/draft/' + draft._id);
        }
      });
    } else {
      req.flash('danger', failMessage);
      res.redirect('/cube/playtest/' + req.params.id);
    }
  } else {
    var cardpool = util.shuffle(cards.slice());
    var format = JSON.parse(cube.draft_formats[params.id].packs);
    for (let j = 0; j < format.length; j++) {
      for (let k = 0; k < format[j].length; k++) {
        format[j][k] = format[j][k].split(',');
        for (let m = 0; m < format[j][k].length; m++) {
          format[j][k][m] = format[j][k][m].trim().toLowerCase();
        }
      }
    }
    var draft = new Draft();
    //setup draftbots
    draft.bots = draftutil.getDraftBots(params);

    var fail = false;
    var failMessage = "";

    draft.picks = [];
    draft.packs = [];
    draft.cube = cube._id;
    draft.pickNumber = 1;
    draft.packNumber = 1;
    for (let i = 0; i < params.seats; i++) {
      draft.picks.push([]);
      draft.packs.push([]);
      for (let j = 0; j < format.length; j++) {
        draft.packs[i].push([]);
        for (let k = 0; k < format[j].length; k++) {
          if (!fail) {
            draft.packs[i][j].push(0);
            var tag = format[j][k][Math.floor(Math.random() * format[j][k].length)];
            var index = draftutil.indexOfTag(cardpool, tag);
            //slice out the first card with the index, or error out
            if (index != -1 && cardpool.length > 0) {
              draft.packs[i][j][k] = cardpool.splice(index, 1)[0];
            } else {
              fail = true;
              failMessage = 'Unable to create draft, not enough cards with tag "' + tag + '" found.';
            }
          }
        }
      }
    }
    if (!fail) {
      draft.save(function(err) {
        if (err) {
          console.log(err, req);
        } else {
          res.redirect('/cube/draft/' + draft._id);
        }
      });
    } else {
      req.flash('danger', failMessage);
      res.redirect('/cube/playtest/' + cube._id);
    }
  }
}

function startStandardDraft(req, res, params, cube) {
  //setup draft conditions
  const cards = cube.cards;
  var cardpool = util.shuffle(cards.slice());
  var draft = new Draft();

  draft.bots = draftutil.getDraftBots(params);
  var totalCards = params.packs * params.cards * params.seats;
  if (cube.cards.length < totalCards) {
    req.flash('danger', 'Requested draft requires ' + totalCards + ' cards, but this cube only has ' + cube.cards.length + ' cards.');
    res.redirect('/cube/playtest/' + cube._id);
  } else {
    draft.picks = [];
    draft.packs = [];
    draft.cube = cube._id;
    draft.packNumber = 1;
    draft.pickNumber = 1;
    for (let i = 0; i < params.seats; i++) {
      draft.picks.push([]);
      draft.packs.push([]);
      for (let j = 0; j < params.packs; j++) {
        draft.packs[i].push([]);
        for (let k = 0; k < params.cards; k++) {
          draft.packs[i][j].push(0);
          draft.packs[i][j][k] = cardpool.pop();
        }
      }
    }
    draft.save(function(err) {
      if (err) {
        console.log(err, req);
      } else {
        res.redirect('/cube/draft/' + draft._id);
      }
    });
  }
}

module.exports = {
  GetPrices,
  abbreviate,
  addCardHtml,
  bulkUpload,
  notPromoOrDigitalId,
  removeCardHtml,
  replaceCardHtml,
  startCustomDraft,
  startStandardDraft,
}