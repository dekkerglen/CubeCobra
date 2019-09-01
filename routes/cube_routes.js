const express = require('express');
const request = require('request');
const fetch = require('node-fetch');
const {
  addAutocard,
  sanitize,
  setCubeType
} = require('../serverjs/cubefn.js');
const analytics = require('../serverjs/analytics.js');
const carddb = require('../serverjs/cards.js');
const util = require('../serverjs/util.js');
const tcgconfig = require('../../cubecobrasecrets/tcgplayer');

const { ensureAuth } = util;

const mergeImages = require('merge-images');
const {
  Canvas,
  Image
} = require('canvas');
Canvas.Image = Image;

const CARD_HEIGHT = 204;
const CARD_WIDTH = 146;

//grabbing sortfilter.cardIsLabel from client-side
const sortfilter = require('../public/js/sortfilter.js');
const router = express.Router();

router.use('/', require('./cube/edit'));
router.use('/', require('./cube/draft'));

// Bring in models
const Cube = require('../models/cube');
const Blog = require('../models/blog');
const User = require('../models/user');

var token = null;
var cached_prices = {};

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
      } else {
        token = JSON.parse(body);
        token.expires = Tomorrow();
        console.log(token.expires.toString());
        callback(token.access_token);
      }
    });
  }
}

function Tomorrow() {
  var date = new Date();
  //add 1 day to expiration date
  date.setDate(date.getDate() + 1);
  return date;
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
  for (i = card_ids.length - 1; i >= 0; i--) {
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
    for (i = 0; i < card_ids.length / chunkSize; i++) {
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

// Add Submit POST Route
router.post('/add', ensureAuth, function(req, res) {
  if (req.body.name.length < 5) {
    req.flash('danger', 'Cube name should be at least 5 characters long.');
    res.redirect('/user/view/' + req.user._id);
  } else {
    User.findById(req.user._id, function(err, user) {
      Cube.find({
        owner: user._id
      }, function(err, cubes) {
        if (cubes.length < 24) {
          let cube = new Cube();
          cube.name = req.body.name;
          cube.owner = req.user._id;
          cube.cards = [];
          cube.decks = [];
          cube.articles = [];
          cube.image_uri = carddb.carddict[carddb.nameToId['doubling cube'][0]].art_crop;
          cube.image_name = carddb.carddict[carddb.nameToId['doubling cube'][0]].full_name;
          cube.image_artist = carddb.carddict[carddb.nameToId['doubling cube'][0]].artist;
          cube.description = "This is a brand new cube!";
          cube.owner_name = user.username;
          cube.date_updated = Date.now();
          cube.updated_string = cube.date_updated.toLocaleString("en-US");
          cube = setCubeType(cube, carddb);
          cube.save(function(err) {
            if (err) {
              console.log(err, req);
            } else {
              req.flash('success', 'Cube Added');
              res.redirect('/cube/overview/' + cube._id);
            }
          });
        } else {
          req.flash('danger', 'Cannot create a cube: Users can only have 24 cubes. Please delete one or more cubes to create new cubes.');
          res.redirect('/user/view/' + req.user._id);
        }
      });
    });
  }
});

// GEt view cube Route
router.get('/view/:id', function(req, res) {
  res.redirect('/cube/overview/' + req.params.id);
});

router.post('/blog/post/:id', ensureAuth, function(req, res) {
  req.body.html = sanitize(req.body.html);
  if (req.body.title.length < 5 || req.body.title.length > 100) {
    req.flash('danger', 'Blog title length must be between 5 and 100 characters.');
    res.redirect('/cube/blog/' + req.params.id);
  } else if (req.body.html.length <= 10) {
    req.flash('danger', 'Blog body length must be greater than 10 characters.');
    res.redirect('/cube/blog/' + req.params.id);
  } else {
    Cube.findById(req.params.id, function(err, cube) {
      if (err || !cube) {
        req.flash('danger', 'Cube not found');
        res.redirect('/404/');
      } else {
        cube.date_updated = Date.now();
        cube.updated_string = cube.date_updated.toLocaleString("en-US");
        cube = setCubeType(cube, carddb);
        cube.save(function(err) {
          User.findById(cube.owner, function(err, user) {
            if (req.body.id && req.body.id.length > 0) {
              Blog.findById(req.body.id, function(err, blog) {
                if (err || !blog) {
                  req.flash('success', 'Unable to update this blog post.');
                  res.redirect('/cube/blog/' + cube._id);
                } else {
                  blog.html = req.body.html;
                  blog.title = req.body.title;

                  blog.save(function(err) {
                    if (err) {
                      console.log(err, req);
                    } else {
                      req.flash('success', 'Blog update successful');
                      res.redirect('/cube/blog/' + cube._id);
                    }
                  });
                }
              });
            } else {
              var blogpost = new Blog();
              blogpost.html = req.body.html;
              blogpost.title = req.body.title;
              blogpost.owner = user._id;
              blogpost.date = Date.now();
              blogpost.cube = cube._id;
              blogpost.dev = 'false';
              blogpost.date_formatted = blogpost.date.toLocaleString("en-US");

              blogpost.save(function(err) {
                if (err) {
                  console.log(err, req);
                } else {
                  req.flash('success', 'Blog post successful');
                  res.redirect('/cube/blog/' + cube._id);
                }
              });
            }
          });
        });
      }
    });
  }
});

router.get('/overview/:id', function(req, res) {
  var split = req.params.id.split(';');
  var cube_id = split[0];
  Cube.findById(cube_id, function(err, cube) {
    if (!cube) {
      req.flash('danger', 'Cube not found');
      res.redirect('/404/');
    } else {
      var allDetails = cube.cards.map(card => carddb.carddict[card.cardID]);
      var tcgplayerIds = new Set(allDetails.map(details => details.tcgplayer_id));
      GetPrices(Array.from(tcgplayerIds), function(price_dict) {
        var sum = 0;
        for (let details of allDetails) {
          let tcgplayer = details.tcgplayer_id;
          sum += price_dict[tcgplayer] || price_dict[tcgplayer + '_foil'] || 0;
        }
        User.findById(cube.owner, function(err, user) {
          Blog.find({
            cube: cube._id
          }).sort('date').exec(function(err, blogs) {
            blogs.forEach(function(item, index) {
              if (!item.date_formatted) {
                item.date_formatted = item.date.toLocaleString("en-US");
              }
              if (item.html) {
                item.html = addAutocard(item.html, carddb);
              }
            });
            if (blogs.length > 0) {
              blogs.reverse();
            }
            cube.raw_desc = cube.body;
            if (cube.descriptionhtml) {
              cube.raw_desc = cube.descriptionhtml;
              cube.descriptionhtml = addAutocard(cube.descriptionhtml, carddb);
            }
            res.render('cube/cube_overview', {
              cube,
              num_cards: cube.cards.length,
              owner: user ? user.username : 'unknown',
              post: blogs[0],
              loginCallback: '/cube/overview/' + req.params.id,
              editorvalue: user ? cube.raw_desc : undefined,
              price: sum.toFixed(2)
            });
          });
        });
      });
    }
  });
});

router.get('/blogsrc/:id', function(req, res) {
  Blog.findById(req.params.id, function(err, blog) {
    if (err || !blog) {
      res.status(400).send({
        success: 'false'
      });
    } else {
      res.status(200).send({
        success: 'true',
        src: blog.html,
        title: blog.title,
        body: blog.body
      });
    }
  });
});

router.get('/blog/:id', function(req, res) {
  var split = req.params.id.split(';');
  var cube_id = split[0];
  Cube.findById(cube_id, function(err, cube) {
    if (!cube) {
      req.flash('danger', 'Cube not found');
      res.redirect('/404/');
    } else {
      User.findById(cube.owner, function(err, user) {
        Blog.find({
          cube: cube._id
        }).sort('date').exec(function(err, blogs) {
          let owner = user ? user.username : 'unknown';
          for (let item of blogs) {
            if (!item.date_formatted) {
              item.date_formatted = item.date.toLocaleString("en-US");
            }
            if (!item.html) {
              item.html = addAutocard(item.html, carddb);
            }
          }
          blogs.reverse();
          let page = parseInt(split[1]) || 0;
          let pages = [];
          for (i = 0; i < blogs.length / 10; i++) {
            pages.push({
              url: '/cube/blog/' + cube._id + ';' + i,
              content: (i + 1),
              active: page === i
            });
          }
          let posts = blogs.slice(page * 10, (page + 1) * 10);
          res.render('cube/cube_blog', {
            cube,
            owner,
            posts,
            pages,
            loginCallback: '/cube/blog/' + req.params.id
          });
        });
      });
    }
  });
});

router.get('/compare/:id_a/to/:id_b', function(req, res) {
  const id_a = req.params.id_a;
  const id_b = req.params.id_b;
  Cube.findById(id_a, function(err, cubeA) {
    Cube.findById(id_b, function(err, cubeB) {
      if (!cubeA) {
        req.flash('danger', 'Base cube not found');
        res.redirect('/404/');
      } else if (!cubeB) {
        req.flash('danger', 'Comparison cube was not found');
        res.redirect('/cube/list/' + id_a);
      } else {
        let pids = [];
        cubeA.cards.forEach(function(card, index) {
          card.details = carddb.carddict[card.cardID];
          if (!card.type_line) {
            card.type_line = card.details.type;
          }
          if (card.details.tcgplayer_id && !pids.includes(card.details.tcgplayer_id)) {
            pids.push(card.details.tcgplayer_id);
          }
        });
        cubeB.cards.forEach(function(card, index) {
          card.details = carddb.carddict[card.cardID];
          if (!card.type_line) {
            card.type_line = card.details.type;
          }
          if (card.details.tcgplayer_id && !pids.includes(card.details.tcgplayer_id)) {
            pids.push(card.details.tcgplayer_id);
          }
        });
        GetPrices(pids, function(price_dict) {
          cubeA.cards.forEach(function(card, index) {
            if (card.details.tcgplayer_id) {
              if (price_dict[card.details.tcgplayer_id]) {
                card.details.price = price_dict[card.details.tcgplayer_id];
              }
              if (price_dict[card.details.tcgplayer_id + '_foil']) {
                card.details.price_foil = price_dict[card.details.tcgplayer_id + '_foil'];
              }
            }
          });
          cubeB.cards.forEach(function(card, index) {
            if (card.details.tcgplayer_id) {
              if (price_dict[card.details.tcgplayer_id]) {
                card.details.price = price_dict[card.details.tcgplayer_id];
              }
              if (price_dict[card.details.tcgplayer_id + '_foil']) {
                card.details.price_foil = price_dict[card.details.tcgplayer_id + '_foil'];
              }
            }
          });
          User.findById(cubeA.owner, function(err, ownerA) {
            User.findById(cubeB.owner, function(err, ownerB) {
              let in_both = [];
              let only_a = cubeA.cards.slice(0);
              let only_b = cubeB.cards.slice(0);
              let a_names = only_a.map(card => card.details.name);
              let b_names = only_b.map(card => card.details.name);

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

              params = {
                cube: cubeA,
                cubeB: cubeB,
                in_both: JSON.stringify(in_both.map(card => card.details.name)),
                only_a: JSON.stringify(a_names),
                only_b: JSON.stringify(b_names),
                cube_raw: JSON.stringify(all_cards),
                loginCallback: '/cube/compare/' + id_a + '/to/' + id_b,
              };

              if (ownerA) params.owner = ownerA.username;
              else params.author = 'unknown';

              res.render('cube/cube_list', params);
            });
          });
        });
      }
    });
  });
})

router.get('/list/:id', function(req, res) {
  Cube.findById(req.params.id, function(err, cube) {
    if (!cube) {
      req.flash('danger', 'Cube not found');
      res.redirect('/404/');
    } else {
      var pids = new Set();
      cube.cards.forEach(function(card, index) {
        card.details = carddb.carddict[card.cardID];
        if (!card.type_line) {
          card.type_line = card.details.type;
        }
        if (card.details.tcgplayer_id) {
          pids.add(card.details.tcgplayer_id);
        }
      });
      GetPrices(Array.from(pids), function(price_dict) {
        for (let card of cube.cards) {
          if (card.details.tcgplayer_id) {
            if (price_dict[card.details.tcgplayer_id]) {
              card.details.price = price_dict[card.details.tcgplayer_id];
            }
            if (price_dict[card.details.tcgplayer_id + '_foil']) {
              card.details.price_foil = price_dict[card.details.tcgplayer_id + '_foil'];
            }
          }
        }

        res.render('cube/cube_list', {
          cube: cube,
          cube_raw: JSON.stringify(cube.cards),
          loginCallback: '/cube/list/' + req.params.id
        });
      });
    }
  });
});

router.get('/analysis/:id', function(req, res) {
  Cube.findById(req.params.id, function(err, cube) {
    if (!cube) {
      req.flash('danger', 'Cube not found');
      res.redirect('/404/');
    } else {
      res.render('cube/cube_analysis', {
        cube,
        TypeByColor: analytics.GetTypeByColor(cube.cards, carddb),
        MulticoloredCounts: analytics.GetColorCounts(cube.cards, carddb),
        curve: JSON.stringify(analytics.GetCurve(cube.cards, carddb)),
        loginCallback: '/cube/analysis/' + req.params.id
      });
    }
  });
});

router.get('/download/cubecobra/:id', function(req, res) {
  Cube.findById(req.params.id, function(err, cube) {
    if (!cube) {
      req.flash('danger', 'Cube not found');
      res.redirect('/404/');
    } else {
      res.setHeader('Content-disposition', 'attachment; filename=' + cube.name.replace(/\W/g, '') + '.txt');
      res.setHeader('Content-type', 'text/plain');
      res.charset = 'UTF-8';
      cube.cards.forEach(function(card, index) {
        res.write(carddb.carddict[card.cardID].full_name + '\r\n');
      });
      res.end();
    }
  });
});

router.get('/download/csv/:id', function(req, res) {
  Cube.findById(req.params.id, function(err, cube) {
    if (!cube) {
      req.flash('danger', 'Cube not found');
      res.redirect('/404/');
    } else {
      res.setHeader('Content-disposition', 'attachment; filename=' + cube.name.replace(/\W/g, '') + '.csv');
      res.setHeader('Content-type', 'text/plain');
      res.charset = 'UTF-8';
      res.write('Name,CMC,Type,Color,Set,Status,Tags\r\n');
      cube.cards.forEach(function(card, index) {
        if (!card.type_line) {
          card.type_line = carddb.carddict[card.cardID].type;
        }
        var name = carddb.carddict[card.cardID].name;
        while (name.includes('"')) {
          name = name.replace('"', '-quote-');
        }
        while (name.includes('-quote-')) {
          name = name.replace('-quote-', '""');
        }
        res.write('"' + name + '"' + ',');
        res.write(card.cmc + ',');
        res.write('"' + card.type_line.replace('—', '-') + '"' + ',');
        if (card.colors.length == 0) {
          res.write('C,');
        } else if (card.type_line.toLowerCase().includes('land')) {
          res.write('L,');
        } else {
          card.colors.forEach(function(color, c_index) {
            res.write(color);
          });
          res.write(',');
        }
        res.write('"' + carddb.carddict[card.cardID].set + '"' + ',');
        res.write(card.status + ',"');
        card.tags.forEach(function(tag, t_index) {
          if (t_index != 0) {
            res.write(', ');
          }
          res.write(tag);
        });
        res.write('"\r\n');
      });
      res.end();
    }
  });
});

router.get('/download/plaintext/:id', function(req, res) {
  Cube.findById(req.params.id, function(err, cube) {
    if (!cube) {
      req.flash('danger', 'Cube not found');
      res.redirect('/404/');
    } else {
      res.setHeader('Content-disposition', 'attachment; filename=' + cube.name.replace(/\W/g, '') + '.txt');
      res.setHeader('Content-type', 'text/plain');
      res.charset = 'UTF-8';
      cube.cards.forEach(function(card, index) {
        res.write(carddb.carddict[card.cardID].name + '\r\n');
      });
      res.end();
    }
  });
});

//API routes
router.get('/api/cardnames', function(req, res) {
  res.status(200).send({
    success: 'true',
    cardnames: carddb.cardtree
  });
});

// Get the full card images including image_normal and image_flip
router.get('/api/cardimages', function(req, res) {
  res.status(200).send({
    success: 'true',
    cardimages: carddb.cardimages
  });
});

router.get('/api/imagedict', function(req, res) {
  res.status(200).send({
    success: 'true',
    dict: carddb.imagedict
  });
});

router.get('/api/fullnames', function(req, res) {
  res.status(200).send({
    success: 'true',
    cardnames: carddb.full_names
  });
});

router.get('/api/cubecardnames/:id', function(req, res) {
  Cube.findById(req.params.id, function(err, cube) {
    var cardnames = [];
    cube.cards.forEach(function(item, index) {
      util.binaryInsert(carddb.carddict[item.cardID].name, cardnames);
    });
    var result = util.turnToTree(cardnames);
    res.status(200).send({
      success: 'true',
      cardnames: result
    });
  });
});

router.get('/api/getcardfromcube/:id', function(req, res) {
  var split = req.params.id.split(';');
  var cube = split[0];
  var cardname = split[1].toLowerCase().replace('-q-', '?');
  while (cardname.includes('-slash-')) {
    cardname = cardname.replace('-slash-', '//');
  }
  Cube.findById(cube, function(err, cube) {
    var found = false;
    cube.cards.forEach(function(card, index) {
      if (!found && carddb.carddict[card.cardID].name_lower == cardname) {
        card.details = carddb.carddict[card.cardID];
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

router.get('/api/getcard/:name', function(req, res) {
  req.params.name = req.params.name.toLowerCase().trim().replace('-q-', '?');
  req.params.name = req.params.name.replace('-slash-', '//');

  let ids = carddb.nameToId[req.params.name];
  let card = ids && ids.length > 0 ? carddb.carddict[ids[0]] : undefined;
  res.status(200).send({
    success: 'true',
    card
  });
});

router.get('/api/getimage/:name', function(req, res) {
  req.params.name = req.params.name.toLowerCase().trim().replace('-q-', '?');
  req.params.name = req.params.name.replace('-slash-', '//');
  res.status(200).send({
    success: 'true',
    img: carddb.imagedict[req.params.name]
  });
});

router.get('/api/getcardfromid/:id', function(req, res) {
  let card = carddb.carddict[req.params.id];
  if (!card) {
    res.status(200).send({
      success: 'true'
    });
  } else {
    //need to get the price of the card with the new version in here
    let tcg = [];
    if (card.tcgplayer_id) {
      tcg.push(card.tcgplayer_id);
    }
    GetPrices(tcg, function(price_dict) {
      if (price_dict[card.tcgplayer_id]) {
        card.price = price_dict[card.tcgplayer_id];
      }
      if (price_dict[card.tcgplayer_id + '_foil']) {
        card.price_foil = price_dict[card.tcgplayer_id + '_foil'];
      }
      res.status(200).send({
        success: 'true',
        card
      });
    });
  }
});

router.get('/api/getversions/:id', function(req, res) {
  cards = [];
  carddb.nameToId[carddb.carddict[req.params.id].name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")].forEach(function(id, index) {
    cards.push(carddb.carddict[id]);
  });
  res.status(200).send({
    success: 'true',
    cards: cards
  });
});

router.post('/api/getversions', function(req, res) {
  cards = {};

  req.body.forEach(function(cardid, index) {
    cards[cardid] = [];
    carddb.nameToId[carddb.carddict[cardid].name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")].forEach(function(id, index) {
      cards[cardid].push({
        id: id,
        version: carddb.carddict[id].full_name.toUpperCase().substring(carddb.carddict[id].full_name.indexOf('[') + 1, carddb.carddict[id].full_name.indexOf(']')),
        img: carddb.carddict[id].image_normal
      });
    });
  });
  res.status(200).send({
    success: 'true',
    dict: cards
  });
});

router.delete('/remove/:id', ensureAuth, function(req, res) {
  if (!req.user._id) {
    req.flash('danger', 'Not Authorized');
    res.redirect('/' + req.params.id);
  }

  let query = {
    _id: req.params.id
  };

  Cube.findById(req.params.id, function(err, cube) {
    if (err || !cube || (cube.owner != req.user._id)) {
      req.flash('danger', 'Cube not found');
      res.redirect('/404/');
    } else {
      Cube.deleteOne(query, function(err) {
        if (err) {
          console.log(err, req);
        }
        req.flash('success', 'Cube Removed');
        res.send('Success');
      });
    }
  });
});

router.delete('/blog/remove/:id', ensureAuth, function(req, res) {
  if (!req.user._id) {
    req.flash('danger', 'Not Authorized');
    res.redirect('/' + req.params.id);
  }

  let query = {
    _id: req.params.id
  };

  Blog.findById(req.params.id, function(err, blog) {
    if (err || (blog.owner != req.user._id)) {
      req.flash('danger', 'Cube not found');
      res.redirect('/404/');
    } else {
      Blog.deleteOne(query, function(err) {
        if (err) {
          console.log(err, req);
        }
        req.flash('success', 'Post Removed');
        res.send('Success');
      });
    }
  });
});

router.post('/api/savesorts/:id', ensureAuth, function(req, res) {
  Cube.findById(req.params.id, function(err, cube) {
    if (cube.owner === req.body._id) {
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

module.exports = router;
