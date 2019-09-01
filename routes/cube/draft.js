const carddb = require('../../serverjs/cards.js');
const cubefn = require('../../serverjs/cubefn.js');
const draftutil = require('../../serverjs/draftutil.js');
const util = require('../../serverjs/util.js');

const { ensureAuth } = util;
const { generatePack, getBasics } = cubefn;

const express = require('express');
router = express.Router();

const Blog = require('../../models/blog');
const CardRating = require('../../models/cardrating');
const Cube = require('../../models/cube');
const Deck = require('../../models/deck');
const Draft = require('../../models/draft');
const User = require('../../models/user');

router.get('/playtest/:id', function(req, res) {
  Cube.findById(req.params.id, function(err, cube) {
    if (!cube) {
      req.flash('danger', 'Cube not found');
      res.redirect('/404/');
    } else {
      cube.cards.forEach(function(card, index) {
        card.details = carddb.carddict[card.cardID];
      });
      User.findById(cube.owner, function(err, user) {
        Deck.find({
          _id: {
            $in: cube.decks
          }
        }, function(err, decks) {
          decklinks = decks.splice(Math.max(decks.length - 10, 0), decks.length).reverse();
          res.render('cube/cube_playtest', {
            cube,
            decks: decklinks,
            cube_raw: JSON.stringify(cube),
            loginCallback: '/cube/playtest/' + req.params.id
          });
        });
      });
    }
  });
});

router.get('/samplepack/:id', function(req, res) {
  Cube.findById(req.params.id, function(err, cube) {
    if (err) {
      req.flash('danger', 'Cube not found');
      res.redirect('/404/');
    } else {
      generatePack(req.params.id, carddb, false, function(err, pack) {
        if (err) {
          req.flash('danger', 'Pack could not be created');
          res.redirect('/404/');
        } else {
          res.render('cube/cube_samplepack', {
            cube,
            pack: pack.pack,
            seed: pack.seed,
            activeLink: 'playtest',
            loginCallback: '/cube/samplepack/' + req.params.id
          });
        }
      });
    }
  });
});

router.get('/samplepack/:id/:seed', function(req, res) {
  Cube.findById(req.params.id, function(err, cube) {
    if (!cube) {
      req.flash('danger', 'Cube not found');
      res.redirect('/404/');
    }
    generatePack(req.params.id, carddb, req.params.seed, function(err, pack) {
      if (err) {
        req.flash('danger', 'Pack could not be created');
        res.redirect('/404/');
      } else {
        res.render('cube/cube_samplepack', {
          cube,
          pack: pack.pack,
          seed: pack.seed,
          activeLink: 'playtest',
          metadata: [{
            property: 'og:title',
            content: 'Cube Cobra Sample Pack'
          }, {
            property: 'og:description',
            content: `A sample pack from ${cube.name}`
          }, {
            property: 'og:image',
            content: `https://cubecobra.com/cube/samplepackimage/${cube._id}/${pack.seed}`
          }, {
            property: 'og:url',
            content: `https://cubecobra.com/cube/samplepack/${cube._id}/${pack.seed}`
          }],
          loginCallback: '/cube/samplepack/' + req.params.id
        });
      }
    });
  });
});

router.get('/samplepackimage/:id/:seed', function(req, res) {
  generatePack(req.params.id, carddb, req.params.seed, function(err, pack) {
    if (err) {
      req.flash('danger', 'Pack could not be created');
      res.redirect('/404/');
    } else {
      var srcArray = pack.map((card, index) => {
        return {
          src: card.image_small,
          x: CARD_WIDTH * (index % 5),
          y: CARD_HEIGHT * Math.floor(index / 5)
        }
      });
      mergeImages(srcArray, {
        width: CARD_WIDTH * 5,
        height: CARD_HEIGHT * 3,
        Canvas
      }).then(function(image) {
        res.writeHead(200, {
          'Content-Type': 'image/png',
          'Content-Length': image.length
        });
        res.end(Buffer.from(image.replace(/^data:image\/png;base64,/, ''), 'base64'));
      });
    }
  });
});

function startCustomDraft(req, res, params, cube) {
  //setup draft conditions
  cards = cube.cards;

  if (cube.draft_formats[params.id].multiples) {
    var format = JSON.parse(cube.draft_formats[params.id].packs);
    for (j = 0; j < format.length; j++) {
      for (k = 0; k < format[j].length; k++) {
        format[j][k] = format[j][k].split(',');
        for (m = 0; m < format[j][k].length; m++) {
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
    for (i = 0; i < params.seats; i++) {
      draft.picks.push([]);
      draft.packs.push([]);
      for (j = 0; j < format.length; j++) {
        draft.packs[i].push([]);
        for (k = 0; k < format[j].length; k++) {
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
          console.log(err);
        } else {
          res.redirect('/cube/draft/' + draft._id);
        }
      });
    } else {
      req.flash('danger', failMessage);
      res.redirect('/cube/playtest/' + cube._id);
    }
  } else {
    var cardpool = util.shuffle(cards.slice());
    var format = JSON.parse(cube.draft_formats[params.id].packs);
    for (j = 0; j < format.length; j++) {
      for (k = 0; k < format[j].length; k++) {
        format[j][k] = format[j][k].split(',');
        for (m = 0; m < format[j][k].length; m++) {
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
    for (i = 0; i < params.seats; i++) {
      draft.picks.push([]);
      draft.packs.push([]);
      for (j = 0; j < format.length; j++) {
        draft.packs[i].push([]);
        for (k = 0; k < format[j].length; k++) {
          if (!fail) {
            draft.packs[i][j].push(0);
            var tag = format[j][k][Math.floor(Math.random() * format[j][k].length)];
            var index = draftutil.indexOfTag(cardpool, tag);
            //slice out the first card with the index, or error out
            if (index != -1) {
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
          console.log(err);
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
  cards = cube.cards;
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
    for (i = 0; i < params.seats; i++) {
      draft.picks.push([]);
      draft.packs.push([]);
      for (j = 0; j < params.packs; j++) {
        draft.packs[i].push([]);
        for (k = 0; k < params.cards; k++) {
          draft.packs[i][j].push(0);
          draft.packs[i][j][k] = cardpool.pop();
        }
      }
    }
    draft.save(function(err) {
      if (err) {
        console.log(err);
      } else {
        res.redirect('/cube/draft/' + draft._id);
      }
    });
  }
}

router.post('/startdraft/:id', function(req, res) {
  Cube.findById(req.params.id, function(err, cube) {
    if (!cube) {
      req.flash('danger', 'Cube not found');
      res.redirect('/404/');
    } else {
      params = JSON.parse(req.body.body);
      if (params.id == -1) {
        //standard draft
        startStandardDraft(req, res, params, cube);
      } else {
        startCustomDraft(req, res, params, cube);
      }
    }
  });
});

router.get('/draft/:id', function(req, res) {
  Draft.findById(req.params.id, function(err, draft) {
    if (!draft) {
      req.flash('danger', 'Draft not found');
      res.redirect('/404/');
    } else {
      var pickNumber = draft.pickNumber;
      var packNumber = draft.packNumber;
      var title = 'Pack ' + packNumber + ', Pick ' + pickNumber;
      var packsleft = (draft.packs[0].length + 1 - packNumber);
      var subtitle = packsleft + ' unopened packs left.';
      if (packsleft == 1) {
        subtitle = packsleft + ' unopened pack left.';
      }
      names = [];
      //add in details to all cards
      draft.packs.forEach(function(seat, index) {
        seat.forEach(function(pack, index2) {
          pack.forEach(function(card, index3) {
            card.details = carddb.carddict[card.cardID];
            if (!names.includes(card.details.name)) {
              names.push(card.details.name);
            }
          });
        });
      });
      draft.picks.forEach(function(card, index) {
        if (Array.isArray(card)) {
          card.forEach(function(item, index2) {
            if (item) {
              item.details = carddb.carddict[card.cardID];
            }
          });
        } else {
          card.details = carddb.carddict[card.cardID];
        }
      });
      draftutil.getCardRatings(names, CardRating, function(ratings) {
        draft.ratings = ratings;
        Cube.findById(draft.cube, function(err, cube) {
          if (!cube) {
            req.flash('danger', 'Cube not found');
            res.redirect('/404/');
          } else {
            res.render('cube/cube_draft', {
              cube,
              loginCallback: '/cube/draft/' + req.params.id,
              draft_raw: JSON.stringify(draft)
            });
          }
        });
      });
    }
  });
});

router.post('/editdeck/:id', function(req, res) {
  Deck.findById(req.params.id, function(err, deck) {
    if (err || !deck) {
      req.flash('danger', 'Deck not found');
      res.redirect('/404/');
    } else if ((deck.owner && !(req.user)) || (deck.owner && (deck.owner != req.user._id))) {
      req.flash('danger', 'Unauthorized');
      res.redirect('/404/');
    } else {
      deck = JSON.parse(req.body.draftraw);

      Deck.updateOne({
        _id: deck._id
      }, deck, function(err) {
        if (err) {
          req.flash('danger', 'Error saving deck');
        } else {
          req.flash('success', 'Deck saved succesfully');
        }
        res.redirect('/cube/deck/' + deck._id);
      });
    }
  });
});

router.post('/submitdeck/:id', function(req, res) {
  //req.body contains draft
  var draftid = req.body.body;

  Draft.findById(draftid, function(err, draft) {
    var deck = new Deck();
    deck.playerdeck = draft.picks[0];
    deck.cards = draft.picks.slice(1);
    if (req.user) {
      deck.owner = req.user._id;
    }
    deck.cube = draft.cube;
    deck.date = Date.now();
    deck.bots = draft.bots;
    deck.playersideboard = [];
    Cube.findById(draft.cube, function(err, cube) {
      if (!cube.decks) {
        cube.decks = [];
      }
      cube.decks.push(deck._id);
      if (!cube.numDecks) {
        cube.numDecks = 0;
      }
      cube.numDecks += 1;
      cube.save(function(err) {
        User.findById(deck.owner, function(err, user) {
          var owner = "Anonymous";
          if (user) {
            owner = user.username;
          }
          deck.name = owner + "'s draft of " + cube.name + " on " + deck.date.toLocaleString("en-US");
          cube.decks.push(deck._id);
          cube.save(function(err) {
            deck.save(function(err) {
              if (err) {
                console.log(err);
              } else {
                return res.redirect('/cube/deckbuilder/' + deck._id);
              }
            });
          });
        });
      });
    });
  });
});

router.get('/decks/:id', function(req, res) {
  var split = req.params.id.split(';');
  var cubeid = split[0];
  Cube.findById(cubeid, function(err, cube) {
    if (err || !cube) {
      req.flash('danger', 'Cube not found');
      res.redirect('/404/');
    } else {
      Deck.find({
        cube: cubeid
      }).sort('date').exec(function(err, decks) {
        var pages = [];
        var pagesize = 30;
        decks.reverse();
        var page = parseInt(split[1]) || 0;
        for (i = 0; i * pagesize < decks.length; i++) {
          pages.push({
            url: '/cube/decks/' + cubeid + ';' + i,
            content: (i + 1),
            active: page === i
          });
        }
        deck_page = decks.slice(page * pagesize, (page + 1) * pagesize);
        res.render('cube/cube_decks', {
          cube,
          decks: deck_page,
          pages: pages.length > 1 ? pages : undefined,
          loginCallback: '/user/decks/' + cubeid
        });
      });
    }
  });
});

router.get('/deckbuilder/:id', function(req, res) {
  Deck.findById(req.params.id, function(err, deck) {
    if (err || !deck) {
      req.flash('danger', 'Deck not found');
      res.redirect('/404/');
    } else {
      deck.cards.forEach(function(card, index) {
        if (Array.isArray(card)) {
          card.forEach(function(item, index2) {
            if (item) {
              item.details = carddb.carddict[card.cardID];
            }
          });
        } else {
          card.details = carddb.carddict[card.cardID];
        }
      });
      Cube.findById(deck.cube, function(err, cube) {
        if (!deck) {
          req.flash('danger', 'Cube not found');
          res.redirect('/404/');
        } else {
          res.render('cube/cube_deckbuilder', {
            cube,
            loginCallback: '/cube/draft/' + req.params.id,
            deck_raw: JSON.stringify(deck),
            basics_raw: JSON.stringify(getBasics(carddb)),
            deckid: deck._id
          });
        }
      });
    }
  });
});

router.get('/deck/:id', function(req, res) {
  Deck.findById(req.params.id, function(err, deck) {
    if (!deck) {
      req.flash('danger', 'Deck not found');
      res.redirect('/404/');
    } else {
      Cube.findById(deck.cube, function(err, cube) {
        if (!cube) {
          req.flash('danger', 'Cube not found');
          res.redirect('/404/');
        } else {
          var drafter_name = "Anonymous";
          User.findById(deck.owner, function(err, drafter) {
            if (drafter) {
              drafter_name = drafter.username;
            }
            var player_deck = [];
            var bot_decks = [];
            if (typeof deck.cards[deck.cards.length - 1][0] === 'object') {
              //old format
              deck.cards[0].forEach(function(card, index) {
                player_deck.push(carddb.carddict[card]);
              });
              for (i = 1; i < deck.cards.length; i++) {
                var bot_deck = [];
                deck.cards[i].forEach(function(card, index) {
                  if (!card[0].cardID && !carddb.carddict[card[0].cardID]) {
                    console.log(req.params.id + ": Could not find seat " + (bot_decks.length + 1) + ", pick " + (bot_deck.length + 1));
                  } else {
                    bot_deck.push(carddb.carddict[card[0].cardID]);
                  }
                });
                bot_decks.push(bot_deck);
              }
              var bot_names = [];
              for (i = 0; i < deck.bots.length; i++) {
                bot_names.push("Seat " + (i + 2) + ": " + deck.bots[i][0] + ", " + deck.bots[i][1]);
              }
              return res.render('cube/cube_deck', {
                oldformat: true,
                cube,
                drafter: drafter_name,
                cards: player_deck,
                bot_decks: bot_decks,
                bots: bot_names,
                loginCallback: '/cube/deck/' + req.params.id
              });
            } else {
              //new format
              for (i = 0; i < deck.cards.length; i++) {
                var bot_deck = [];
                deck.cards[i].forEach(function(cardid, index) {
                  if (!carddb.carddict[cardid]) {
                    console.log(req.params.id + ": Could not find seat " + (bot_decks.length + 1) + ", pick " + (bot_deck.length + 1));
                  } else {
                    bot_deck.push(carddb.carddict[cardid]);
                  }
                });
                bot_decks.push(bot_deck);
              }
              var bot_names = [];
              for (i = 0; i < deck.bots.length; i++) {
                bot_names.push("Seat " + (i + 2) + ": " + deck.bots[i][0] + ", " + deck.bots[i][1]);
              }
              return res.render('cube/cube_deck', {
                oldformat: false,
                cube,
                drafter: drafter_name,
                deck: JSON.stringify(deck.playerdeck),
                bot_decks: bot_decks,
                bots: bot_names,
                loginCallback: '/cube/deck/' + req.params.id
              });
            }
          });
        }
      });
    }
  });
});

router.post('/format/add/:id', ensureAuth, function(req, res) {
  req.body.html = sanitize(req.body.html);
  Cube.findById(req.params.id, function(err, cube) {
    if (err || !cube) {
      req.flash('danger', 'Cube not found');
      res.redirect('/404/');
    }
    if (req.body.id == -1) {
      if (!cube.draft_formats) {
        cube.draft_formats = [];
      }
      cube.draft_formats.push({
        title: req.body.title,
        multiples: req.body.multiples == 'true',
        html: req.body.html,
        packs: req.body.format
      });
    } else {
      cube.draft_formats[req.body.id] = {
        title: req.body.title,
        multiples: req.body.multiples == 'true',
        html: req.body.html,
        packs: req.body.format
      };
    }
    Cube.updateOne({
      _id: cube._id
    }, cube, function(err) {
      if (err) {
        console.log(err);
        req.flash('danger', 'An error occured saving your custom format.');
        res.redirect('/cube/playtest/' + req.params.id);
      } else {
        req.flash('success', 'Custom format successfully added.');
        res.redirect('/cube/playtest/' + req.params.id);
      }
    });
  });
});

router.delete('/format/remove/:id', ensureAuth, function(req, res) {
  if (!req.user._id) {
    req.flash('danger', 'Not Authorized');
    res.redirect('/' + req.params.id);
  }

  var cubeid = req.params.id.split(';')[0];
  var id = req.params.id.split(';')[1];

  Cube.findById(cubeid, function(err, cube) {
    if (err || (cube.owner != req.user._id)) {
      req.flash('danger', 'Cube not found');
      res.redirect('/404/');
    } else {
      cube.draft_formats.splice(id, 1);

      Cube.updateOne({
        _id: cube._id
      }, cube, function(err) {
        if (err) {
          console.log(err, req);
          req.flash('danger', 'An error occured saving your custom format.');
          res.redirect('/cube/playtest/' + req.params.id);
        }
        req.flash('success', 'Format Removed');
        res.send('Success');
      });
    }
  });
});

router.post('/api/draftpickcard/:id', function(req, res) {
  Cube.findById(req.params.id, function(err, cube) {
    Draft.findById({
      _id: req.body.draft_id
    }, function(err, draft) {
      CardRating.findOne({
        'name': req.body.card.details.name
      }, function(err, cardrating) {
        if (draft.packs[0][0]) {
          const cards_per_pack = draft.packs[0][0].length + draft.pickNumber - 1;
          var rating = (cards_per_pack - draft.packs[0][0].length + 1) / cards_per_pack;

          if (cardrating) {
            cardrating.value = cardrating.value * (cardrating.picks / (cardrating.picks + 1)) + rating * (1 / (cardrating.picks + 1));
            cardrating.picks += 1;
            CardRating.updateOne({
              _id: cardrating._id
            }, cardrating, function(err) {
              if (err) {
                console.log(err, req);
                res.status(500).send({
                  success: 'false',
                  message: 'Error saving pick rating'
                });
                return;
              }
            });
          } else {
            cardrating = new CardRating();
            cardrating.name = req.body.card.details.name;
            cardrating.value = rating;
            cardrating.picks = 1;
            cardrating.save(function(err) {
              if (err) {
                console.log(err, req);
                res.status(500).send({
                  success: 'false',
                  message: 'Error saving pick rating'
                });
                return;
              }
            });
          }
          res.status(200).send({
            success: 'true'
          });
        } else {
          //last card of the draft
          res.status(200).send({
            success: 'true'
          });
        }
      });
    });
  });
});

router.post('/api/draftpick/:id', function(req, res) {
  Cube.findById(req.params.id, function(err, cube) {
    if (!req.body) {
      res.status(400).send({
        success: 'false',
        message: 'No draft passed'
      });
    } else {
      Draft.updateOne({
        _id: req.body._id
      }, req.body, function(err) {
        if (err) {
          res.status(500).send({
            success: 'false',
            message: 'Error saving cube'
          });
        } else {
          res.status(200).send({
            success: 'true'
          });
        }
      });
    }
  });
});

router.get('/api/p1p1/:id', function(req, res) {
  generatePack(req.params.id, carddb, false, function(err, result) {
    if (err) {
      res.status(500).send({
        success: false
      });
    } else {
      const pack = {
        seed: result.seed,
        pack: result.pack.map(card => card.name)
      };
      res.status(200).send(pack);
    }
  });
});

router.get('/api/p1p1/:id/:seed', function(req, res) {
  generatePack(req.params.id, carddb, req.params.seed, function(err, result) {
    if (err) {
      res.status(500).send({
        success: false
      });
    } else {
      const pack = {
        seed: seed,
        pack: result.pack.map(card => card.name)
      };
      res.status(200).send(pack);
    }
  });
});

module.exports = router;
