const api = require('express').Router();

const carddb = require('../../serverjs/cards.js');
const {
  build_id_query,
  cardsAreEquivalent,
  generatePack,
  setCubeType,
} = require('../../serverjs/cubefn.js');
const util = require('../../serverjs/util.js');
const CardRating = require('../models/cardrating');
const Cube = require('../../models/cube')
const Draft = require('../../models/draft')
const User = require('../../models/user')
const {
  GetPrices,
  build_tag_colors,
  notPromoOrDigitalId,
} = require('./helpers');
const {
  ensureAuth
} = require('./../middleware');

carddb.initializeCardDb();

//API routes
api.get('/cardnames', function(req, res) {
  res.status(200).send({
    success: 'true',
    cardnames: carddb.cardtree
  });
});

// Get the full card images including image_normal and image_flip
api.get('/cardimages', function(req, res) {
  res.status(200).send({
    success: 'true',
    cardimages: carddb.cardimages
  });
});

api.get('/imagedict', function(req, res) {
  res.status(200).send({
    success: 'true',
    dict: carddb.imagedict
  });
});

api.get('/fullnames', function(req, res) {
  res.status(200).send({
    success: 'true',
    cardnames: carddb.full_names
  });
});

api.get('/cubecardnames/:id', function(req, res) {
  Cube.findOne(build_id_query(req.params.id), function(err, cube) {
    var cardnames = [];
    cube.cards.forEach(function(item, index) {
      util.binaryInsert(carddb.cardFromId(item.cardID).name, cardnames);
    });
    var result = util.turnToTree(cardnames);
    res.status(200).send({
      success: 'true',
      cardnames: result
    });
  });
});

api.post('/saveshowtagcolors', function(req, res) {
  if (req.user) {
    req.user.hide_tag_colors = !req.body.show_tag_colors;

    req.user.save(function(err) {
      if (err) console.log(err);
      res.status(200).send({
        success: 'true',
      });
    });
  } else {
    res.status(200).send({
      success: 'true',
    });
  }
});

api.post('/savetagcolors/:id', function(req, res) {
  Cube.findOne(build_id_query(req.params.id), function(err, cube) {
    cube.tag_colors = req.body;

    cube.save(function(err) {
      if (err) console.log(err);
      res.status(200).send({
        success: 'true',
      });
    });
  });
});

api.get('/cubetagcolors/:id', function(req, res) {
  Cube.findOne(build_id_query(req.params.id), function(err, cube) {
    let tag_colors = build_tag_colors(cube);
    let tags = tag_colors.map(item => item.tag);

    Cube.findOne(build_id_query(req.query.b_id), function(err, cubeB) {
      if (cubeB) {
        let b_tag_colors = build_tag_colors(cubeB);
        for (let b_tag of b_tag_colors) {
          if (!tags.includes(b_tag.tag)) {
            tag_colors.push(b_tag);
          }
        }
      }

      let show_tag_colors = (req.user) ? !req.user.hide_tag_colors : true;

      res.status(200).send({
        success: 'true',
        tag_colors,
        show_tag_colors,
      });
    });
  });
});

api.get('/getcardfromcube/:id', function(req, res) {
  var split = req.params.id.split(';');
  var cube = split[0];
  var cardname = split[1].toLowerCase().replace('-q-', '?');
  while (cardname.includes('-slash-')) {
    cardname = cardname.replace('-slash-', '//');
  }
  Cube.findOne(build_id_query(cube), function(err, cube) {
    var found = false;
    cube.cards.forEach(function(card, index) {
      if (!found && carddb.cardFromId(card.cardID).name_lower == cardname) {
        card.details = carddb.cardFromId(card.cardID);
        res.status(200).send({
          success: 'true',
          card: card.details
        });
        found = true;
      }
    });
    if (!found) {
      res.status(200).send({
        success: 'true'
      });
    }
  });
});

api.get('/cubelist/:id', function(req, res) {
  Cube.findOne(build_id_query(req.params.id), function(err, cube) {
    if (err) {
      console.error(err);
      res.sendStatus(500);
    } else if (!cube) {
      res.sendStatus(404);
    } else {
      const names = cube.cards.map(card => carddb.cardFromId(card.cardID).name);
      res.contentType('text/plain');
      res.status(200).send(names.join("\n"));
    }
  });
});

api.get('/getcard/:name', function(req, res) {
  req.params.name = req.params.name.toLowerCase().trim().replace('-q-', '?');
  while (req.params.name.includes('-slash-')) {
    req.params.name = req.params.name.replace('-slash-', '//');
  }

  let potentialIds = carddb.nameToId[req.params.name];
  if (potentialIds && potentialIds.length > 0) {
    let nonPromo = potentialIds.find(notPromoOrDigitalId);
    let selected = nonPromo || potentialIds[0];
    let card = carddb.cardFromId(selected);
    res.status(200).send({
      success: 'true',
      card: card
    });
  } else {
    res.status(200).send({
      success: 'true'
    });
  }
});

api.get('/getimage/:name', function(req, res) {
  req.params.name = req.params.name.toLowerCase().trim().replace('-q-', '?');
  while (req.params.name.includes('-slash-')) {
    req.params.name = req.params.name.replace('-slash-', '//');
  }
  var img = carddb.imagedict[req.params.name];
  if (!img) {
    res.status(200).send({
      success: 'true'
    });
  } else {
    res.status(200).send({
      success: 'true',
      img: img
    });
  }
});

api.get('/getcardfromid/:id', function(req, res) {
  var card = carddb.cardFromId(req.params.id);
  //need to get the price of the card with the new version in here
  var tcg = [];
  if (card.tcgplayer_id) {
    tcg.push(card.tcgplayer_id);
  }
  GetPrices(tcg, function(price_dict) {
    if (card.error) {
      res.status(200).send({
        success: 'true'
      });
    } else {
      if (price_dict[card.tcgplayer_id]) {
        card.price = price_dict[card.tcgplayer_id];
      }
      if (price_dict[card.tcgplayer_id + '_foil']) {
        card.price_foil = price_dict[card.tcgplayer_id + '_foil'];
      }
      res.status(200).send({
        success: 'true',
        card: card
      });
    }
  });
});

api.get('/getversions/:id', function(req, res) {
  let cards = [];
  carddb.nameToId[carddb.cardFromId(req.params.id).name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")].forEach(function(id, index) {
    cards.push(carddb.cardFromId(id));
  });
  res.status(200).send({
    success: 'true',
    cards: cards
  });
});

api.post('/getversions', function(req, res) {
  let cards = {};

  req.body.forEach(function(cardid, index) {
    cards[cardid] = [];
    carddb.nameToId[carddb.cardFromId(cardid).name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")].forEach(function(id, index) {
      cards[cardid].push({
        id: id,
        version: carddb.cardFromId(id).full_name.toUpperCase().substring(carddb.cardFromId(id).full_name.indexOf('[') + 1, carddb.cardFromId(id).full_name.indexOf(']')),
        img: carddb.cardFromId(id).image_normal
      });
    });
  });
  res.status(200).send({
    success: 'true',
    dict: cards
  });
});

api.post('/updatecard/:id', ensureAuth, function(req, res) {
  const {
    src,
    updated
  } = req.body;
  if (!src || (src && typeof src.index !== 'number') ||
    (updated.cardID && typeof updated.cardID !== 'string') ||
    (updated.cmc && !['number', 'string'].includes(typeof updated.cmc)) ||
    (updated.status && typeof updated.status !== 'string') ||
    (updated.type_line && typeof updated.type_line !== 'string') ||
    (updated.colors && !Array.isArray(updated.colors)) ||
    (updated.tags && !Array.isArray(updated.tags))
  ) {
    res.status(400).send({
      success: 'false',
      message: 'Failed input validation',
    });
    return;
  }
  Cube.findOne(build_id_query(req.params.id), function(err, cube) {
    if (err) {
      console.error(err);
      res.status(500).send({
        success: 'false',
        message: 'Internal server error',
      });
    } else if (!cube) {
      res.status(400).send({
        success: 'false',
        message: 'No such cube',
      });
    } else if (cube.owner !== String(req.user.id)) {
      res.status(401).send({
        success: 'false',
        message: 'Insufficient permissions',
      });
    } else if (src.index >= cube.cards.length) {
      res.status(400).send({
        success: 'false',
        message: 'No such card',
      });
    } else {
      const card = cube.cards[src.index];
      if (!card.type_line) {
        card.type_line = carddb.cardFromId(card.cardID).type;
      }
      if (!cardsAreEquivalent(src, card)) {
        console.log(src);
        console.log(card);
        res.status(400).send({
          success: 'false',
          message: 'Cards not equivalent',
        });
      } else {
        Object.keys(Cube.schema.paths.cards.schema.paths).forEach(function(key) {
          if (!updated.hasOwnProperty(key)) {
            updated[key] = card[key];
          }
        });
        Object.keys(updated).forEach(function(key) {
          if (updated[key] === null) {
            delete updated[key];
          }
        });
        cube.cards[src.index] = updated;

        cube = setCubeType(cube, carddb);

        cube.save(function(err) {
          if (err) {
            console.error(err);
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
    }
  });
});

api.post('/updatecards/:id', ensureAuth, function(req, res) {
  const {
    selected,
    updated
  } = req.body;
  if ((updated.cmc && typeof updated.cmc !== 'number') ||
    (updated.status && typeof updated.status !== 'string') ||
    (updated.type_line && typeof updated.type_line !== 'string') ||
    (updated.colors && !Array.isArray(updated.colors)) ||
    (updated.tags && !Array.isArray(updated.tags))
  ) {
    res.status(400).send({
      success: 'false',
      message: 'Failed input validation',
    });
    return;
  }
  Cube.findOne(build_id_query(req.params.id), function(err, cube) {
    if (cube.owner === String(req.user._id)) {
      for (const {
          index
        } of selected) {
        if (typeof index !== 'number') {
          continue;
        }
        const card = cube.cards[index];
        if (!card.type_line) {
          card.type_line = carddb.cardFromId(card.cardID).type;
        }
        if (card.details) {
          delete card.details;
        }
        if (updated.status) {
          card.status = updated.status;
        }
        if (updated.cmc) {
          card.cmc = updated.cmc;
        }
        if (updated.type_line) {
          card.type_line = updated.type_line;
        }
        if (updated.colors) {
          card.colors = updated.colors.filter(color => [...'WUBRG'].includes(color));
        }
        if (updated.colorC) {
          card.colors = [];
        }
        if (updated.tags) {
          if (updated.addTags) {
            card.tags = [...card.tags, ...updated.tags.filter(tag =>
              typeof tag === 'string' && !card.tags.includes(tag)
            )];
          }
          if (updated.deleteTags) {
            card.tags = card.tags.filter(tag => !updated.tags.includes(tag));
          }
        }
      }
      cube.save(function(err) {
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

api.post('/savesorts/:id', ensureAuth, function(req, res) {
  Cube.findOne(build_id_query(req.params.id), function(err, cube) {
    if (cube.owner === String(req.user._id)) {
      var found = false;
      cube.default_sorts = req.body.sorts;
      cube.save(function(err) {
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

api.post('/draftpickcard/:id', function(req, res) {
  Cube.findOne(build_id_query(req.params.id), function(err, cube) {
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

api.post('/draftpick/:id', function(req, res) {
  Cube.findOne(build_id_query(req.params.id), function(err, cube) {
    User.findById(cube.owner, function(err, owner) {
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
});

api.get('/p1p1/:id', function(req, res) {
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

api.get('/p1p1/:id/:seed', function(req, res) {
  generatePack(req.params.id, carddb, req.params.seed, function(err, result) {
    if (err) {
      res.status(500).send({
        success: false
      });
    } else {
      const pack = {
        seed: req.params.seed,
        pack: result.pack.map(card => card.name)
      };
      res.status(200).send(pack);
    }
  });
});

module.exports = api;
