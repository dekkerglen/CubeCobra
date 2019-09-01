const express = require('express');
let mongoose = require('mongoose');
const request = require('request');
const fs = require('fs');
const fetch = require('node-fetch');
const rp = require('request-promise');
const cheerio = require('cheerio');
var {
  addAutocard,
  generatePack,
  sanitize,
  setCubeType,
  cardsAreEquivalent,
  getBasics
} = require('../serverjs/cubefn.js');
var analytics = require('../serverjs/analytics.js');
var draftutil = require('../serverjs/draftutil.js');
var carddb = require('../serverjs/cards.js');
var util = require('../serverjs/util.js');
const tcgconfig = require('../../cubecobrasecrets/tcgplayer');

var mergeImages = require('merge-images');
const {
  Canvas,
  Image
} = require('canvas');
Canvas.Image = Image;

const CARD_HEIGHT = 204;
const CARD_WIDTH = 146;

//grabbing sortfilter.cardIsLabel from client-side
var sortfilter = require('../public/js/sortfilter.js');
const router = express.Router();
// Bring in models
let Cube = require('../models/cube');
let Deck = require('../models/deck');
let Blog = require('../models/blog');
let User = require('../models/user');
let Draft = require('../models/draft');
let CardRating = require('../models/cardrating');

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

function cardHtml(card) {
  if (card.image_flip) {
    return '<a class="dynamic-autocard" card="' + card.image_normal + '" card_flip="' + card.image_flip + '">' + card.name + '</a></br>';
  } else {
    return '<a class="dynamic-autocard" card="' + card.image_normal + '">' + card.name + '</a></br>';
  }
}

function addCardHtml(card) {
  return '<span style=""Lucida Console", Monaco, monospace;" class="badge badge-success">+</span> ' + cardHtml(card);
}

function removeCardHtml(card) {
  return '<span style=""Lucida Console", Monaco, monospace;" class="badge badge-danger">-</span> ' + cardHtml(card);
}

function replaceCardHtml(oldCard, newCard) {
  return '<span style=""Lucida Console", Monaco, monospace;" class="badge badge-primary">→</span> ' + cardHtml(oldCard) + ' > ' + cardHtml(newCard);
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
        console.log(err, req);
        req.flash('danger', 'An error occured saving your custom format.');
        res.redirect('/cube/playtest/' + req.params.id);
      } else {
        req.flash('success', 'Custom format successfully added.');
        res.redirect('/cube/playtest/' + req.params.id);
      }
    });
  });
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
      var pids = [];
      cube.cards.forEach(function(card, index) {
        card.details = carddb.carddict[card.cardID];
        if (card.details.tcgplayer_id && !pids.includes(card.details.tcgplayer_id)) {
          pids.push(card.details.tcgplayer_id);
        }
      });
      GetPrices(pids, function(price_dict) {
        var sum = 0;
        cube.cards.forEach(function(card, index) {
          if (price_dict[card.details.tcgplayer_id]) {
            sum += price_dict[card.details.tcgplayer_id];
          } else if (price_dict[card.details.tcgplayer_id + '_foil']) {
            sum += price_dict[card.details.tcgplayer_id + '_foil'];
          }
        });
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
            if (!user) {
              res.render('cube/cube_overview', {
                cube: cube,
                num_cards: cube.cards.length,
                author: 'unknown',
                post: blogs[0],
                loginCallback: '/cube/overview/' + req.params.id,
                price: sum.toFixed(2)
              });
            } else {
              res.render('cube/cube_overview', {
                cube: cube,
                num_cards: cube.cards.length,
                owner: user.username,
                post: blogs[0],
                loginCallback: '/cube/overview/' + req.params.id,
                editorvalue: cube.raw_desc,
                price: sum.toFixed(2)
              });
            }
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
          if (!user) {
            user = {
              username: 'unknown'
            };
          }
          blogs.forEach(function(item, index) {
            if (!item.date_formatted) {
              item.date_formatted = item.date.toLocaleString("en-US");
            }
            if (item.html) {
              item.html = addAutocard(item.html, carddb);
            }
          });
          var pages = [];
          if (blogs.length > 0) {
            blogs.reverse();
            if (blogs.length > 10) {
              var page = parseInt(split[1]);
              if (!page) {
                page = 0;
              }
              for (i = 0; i < blogs.length / 10; i++) {
                if (page == i) {
                  pages.push({
                    url: '/cube/blog/' + cube._id + ';' + i,
                    content: (i + 1),
                    active: true
                  });
                } else {
                  pages.push({
                    url: '/cube/blog/' + cube._id + ';' + i,
                    content: (i + 1)
                  });
                }
              }
              blog_page = [];
              for (i = 0; i < 10; i++) {
                if (blogs[i + page * 10]) {
                  blog_page.push(blogs[i + page * 10]);
                }
              }
              res.render('cube/cube_blog', {
                cube: cube,
                owner: user.username,
                posts: blog_page,
                pages: pages,
                loginCallback: '/cube/blog/' + req.params.id
              });
            } else {
              res.render('cube/cube_blog', {
                cube: cube,
                owner: user.username,
                posts: blogs,
                loginCallback: '/cube/blog/' + req.params.id
              });
            }
          } else {
            res.render('cube/cube_blog', {
              cube: cube,
              owner: user.username,
              loginCallback: '/cube/blog/' + req.params.id
            });
          }
        });
      });
    }
  });
});

router.get('/compare/:id_a/to/:id_b', function(req, res) {
  const id_a = req.params.id_a;
  const id_b = req.params.id_b;
  const user_id = req.user ? req.user._id : '';
  Cube.findById(id_a, function(err, cubeA) {
    Cube.findById(id_b, function(err, cubeB) {
      if (!cubeA) {
        req.flash('danger', 'Base cube not found');
        res.redirect('/404/');
      } else if (!cubeB) {
        req.flash('danger', 'Comparison cube was not found');
        res.redirect('/cube/list/' + id_a);
      } else {
        User.findById(user_id, function(err, currentuser) {
          if (!currentuser) build_response();
          else {
            if (!currentuser.edit_token || currentuser.edit_token.length <= 0) {
              currentuser.edit_token = util.generate_edit_token();
            }
            currentuser.save(function(err) {
              build_response(currentuser);
            });
          }
        });

        function build_response(currentuser) {
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

                if (currentuser) params.edittoken = currentuser.edit_token;

                if (ownerA) params.owner = ownerA.username;
                else params.author = 'unknown';

                res.render('cube/cube_list', params);
              });
            });
          });
        }
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
      var pids = [];
      cube.cards.forEach(function(card, index) {
        card.details = carddb.carddict[card.cardID];
        if (!card.type_line) {
          card.type_line = card.details.type;
        }
        if (card.details.tcgplayer_id && !pids.includes(card.details.tcgplayer_id)) {
          pids.push(card.details.tcgplayer_id);
        }
      });
      GetPrices(pids, function(price_dict) {
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

        if (req.user) {
          User.findById(req.user._id, function(err, currentuser) {
            if (!currentuser.edit_token || currentuser.edit_token.length <= 0) {
              currentuser.edit_token = util.generate_edit_token();
            }
            currentuser.save(function(err) {
              User.findById(cube.owner, function(err, owner) {
                if (!owner) {
                  res.render('cube/cube_list', {
                    cube: cube,
                    cube_raw: JSON.stringify(cube.cards),
                    author: 'unknown',
                    loginCallback: '/cube/list/' + req.params.id,
                    edittoken: currentuser.edit_token
                  });
                } else {
                  res.render('cube/cube_list', {
                    cube: cube,
                    cube_raw: JSON.stringify(cube.cards),
                    owner: owner.username,
                    loginCallback: '/cube/list/' + req.params.id,
                    edittoken: currentuser.edit_token
                  });
                }
              });
            });
          });
        } else {
          User.findById(cube.owner, function(err, owner) {
            if (!owner) {
              res.render('cube/cube_list', {
                cube: cube,
                cube_raw: JSON.stringify(cube.cards),
                author: 'unknown',
                loginCallback: '/cube/list/' + req.params.id
              });
            } else {
              res.render('cube/cube_list', {
                cube: cube,
                cube_raw: JSON.stringify(cube.cards),
                owner: owner.username,
                loginCallback: '/cube/list/' + req.params.id
              });
            }
          });
        }
      });
    }
  });
});

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
          if (!user || err) {
            res.render('cube/cube_playtest', {
              cube: cube,
              author: 'unknown',
              decks: decklinks,
              cube_raw: JSON.stringify(cube),
              loginCallback: '/cube/playtest/' + req.params.id
            });
          } else {
            res.render('cube/cube_playtest', {
              cube: cube,
              owner: user.username,
              decks: decklinks,
              cube_raw: JSON.stringify(cube),
              loginCallback: '/cube/playtest/' + req.params.id
            });
          }
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
      User.findById(cube.owner, function(err, user) {
        if (!user) {
          user = {
            username: 'unknown'
          };
        }
        if (err) {
          res.render('cube/cube_analysis', {
            cube: cube,
            owner: user.username,
            TypeByColor: analytics.GetTypeByColor(cube.cards, carddb),
            MulticoloredCounts: analytics.GetColorCounts(cube.cards, carddb),
            curve: JSON.stringify(analytics.GetCurve(cube.cards, carddb)),
            loginCallback: '/cube/analysis/' + req.params.id
          });
        } else {
          res.render('cube/cube_analysis', {
            cube: cube,
            owner: user.username,
            TypeByColor: analytics.GetTypeByColor(cube.cards, carddb),
            MulticoloredCounts: analytics.GetColorCounts(cube.cards, carddb),
            curve: JSON.stringify(analytics.GetCurve(cube.cards, carddb)),
            loginCallback: '/cube/analysis/' + req.params.id
          });
        }
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

router.post('/importcubetutor/:id', ensureAuth, function(req, res) {
  Cube.findById(req.params.id, function(err, cube) {
    if (err) {
      console.log(err, req);
    } else {
      if (cube.owner != req.user._id) {
        req.flash('danger', 'Not Authorized');
        res.redirect('/cube/list/' + req.params.id);
      } else {
        if (isNaN(req.body.cubeid)) {
          req.flash('danger', 'Error: Provided ID is not in correct format.');
          res.redirect('/cube/list/' + req.params.id);
        } else {

          const options = {
            uri: 'http://www.cubetutor.com/viewcube/' + req.body.cubeid,
            transform: function(body) {
              return cheerio.load(body);
            },
            headers: {
              //this tricks cubetutor into not redirecting us to the unsupported browser page
              'User-Agent': 'Mozilla/5.0'
            },
          };
          rp(options).then(function(data) {
              var cards = [];
              var unknown = [];
              data('.cardPreview').each(function(i, elem) {
                var str = elem.attribs['data-image'].substring(37, elem.attribs['data-image'].length - 4);
                if (!str.includes('/')) {
                  cards.push({
                    set: 'unknown',
                    name: decodeURIComponent(elem.children[0].data).replace('_flip', '')
                  })
                } else {
                  var split = str.split('/');
                  cards.push({
                    set: split[0],
                    name: decodeURIComponent(elem.children[0].data).replace('_flip', '')
                  })
                }
              });
              var added = [];
              var missing = "";
              var changelog = "";
              for (let card of cards) {
                let potentialIds = carddb.allIds(card);
                if (potentialIds && potentialIds.length > 0) {
                  let matchingSet = potentialIds.find(id => carddb.carddict[id].set.toUpperCase() == card.set);
                  let nonPromo = potentialIds.find(id => !carddb.carddict[id].promo);
                  let selected = matchingSet || nonPromo || potentialIds[0];
                  let details = carddb.carddict[selected];
                  added.push(details);
                  util.addCardToCube(cube, details);
                  changelog += addCardHtml(details);
                } else {
                  missing += card.name + '\n';
                }
              }

              var blogpost = new Blog();
              blogpost.title = 'Cubetutor Import - Automatic Post'
              blogpost.html = changelog;
              blogpost.owner = cube.owner;
              blogpost.date = Date.now();
              blogpost.cube = cube._id;
              blogpost.dev = 'false';
              blogpost.date_formatted = blogpost.date.toLocaleString("en-US");

              if (missing.length > 0) {
                res.render('cube/bulk_upload', {
                  missing: missing,
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
            })
            .catch(function(err) {
              console.log(err);
              req.flash('danger', 'Error: Unable to import this cube.');
              res.redirect('/cube/list/' + req.params.id);
            });
        }
      }
    }
  });
});

router.post('/bulkupload/:id', ensureAuth, function(req, res) {
  Cube.findById(req.params.id, function(err, cube) {
    if (err) {
      console.log(err, req);
    } else {
      if (cube.owner != req.user._id) {
        req.flash('danger', 'Not Authorized');
        res.redirect('/cube/list/' + req.params.id);
      } else {
        bulkUpload(req, res, req.body.body, cube);
      }
    }
  });
});

router.post('/bulkuploadfile/:id', ensureAuth, function(req, res) {
  if (!req.files) {
    req.flash('danger', 'Please attach a file');
    res.redirect('/cube/list/' + req.params.id);
  } else {
    items = req.files.document.data.toString('utf8'); // the uploaded file object

    Cube.findById(req.params.id, function(err, cube) {
      if (cube.owner != req.user._id) {
        req.flash('danger', 'Not Authorized');
        res.redirect('/cube/list/' + req.params.id);
      } else {
        bulkUpload(req, res, items, cube);
      }
    });
  }
});

function bulkuploadCSV(req, res, cards, cube) {
  let added = [];
  let missing = "";
  let changelog = "";
  for (let card_raw of cards) {
    let split = util.CSVtoArray(card_raw);
    let name = split[0];
    let card = {
      cmc: split[1],
      type_line: split[2].replace('-', '—'),
      colors: split[3].split(''),
      set: split[4].toUpperCase(),
      status: split[5],
      tags: split[6].split(',')
    };

    let potentialIds = carddb.allIds(card);
    if (potentialIds && potentialIds.length > 0) {
      // First, try to find the correct set.
      let matchingSet = potentialIds.find(id => carddb.carddict[id].set.toUpperCase() == card.set);
      let nonPromo = potentialIds.find(id => !carddb.carddict[id].promo);
      let first = potentialIds[0];
      card.id = matchingSet || nonPromo || first;
      cube.cards.push(card);
      changelog += addCardHtml(carddb.carddict[card.id]);
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
  cards = list.match(/[^\r\n]+/g);
  if (cards) {
    if (cards[0].trim() == 'Name,CMC,Type,Color,Set,Status,Tags') {
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
        for (i = 0; i < cards.length; i++) {
          item = cards[i].toLowerCase().trim();
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
                selected = potentialIds.find(id => carddb.carddict[id].set.toUpperCase() == card.set);
              }
            } else {
              //does not have set info
              let potentialIds = carddb.nameToId[item.toLowerCase().trim()];
              if (potentialIds && potentialIds.length > 0) {
                let nonPromo = potentialIds.find(id => !carddb.carddict[id].promo);
                selected = nonPromo || potentialIds[0];
              }
            }
            if (selected) {
              let details = carddb.carddict[selected];
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
          console.log(err, req);
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
        console.log(err, req);
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
            User.findById(cube.owner, function(err, user) {
              if (!user || err) {
                res.render('cube/cube_draft', {
                  cube: cube,
                  owner: 'Unknown',
                  loginCallback: '/cube/draft/' + req.params.id,
                  draft_raw: JSON.stringify(draft)
                });
              } else {
                res.render('cube/cube_draft', {
                  cube: cube,
                  owner: user.username,
                  loginCallback: '/cube/draft/' + req.params.id,
                  draft_raw: JSON.stringify(draft)
                });
              }
            });
          }
        });
      });
    }
  });
});

// Edit Submit POST Route
router.post('/editoverview/:id', ensureAuth, function(req, res) {
  req.body.html = sanitize(req.body.html);
  Cube.findById(req.params.id, function(err, cube) {
    if (err) {
      req.flash('danger', 'Server Error');
      res.redirect('/cube/overview/' + req.params.id);
    } else if (!cube) {
      req.flash('danger', 'Cube not found');
      res.redirect('/cube/overview/' + req.params.id);
    } else {
      var image = carddb.imagedict[req.body.imagename.toLowerCase()];
      var name = req.body.name;

      if (name.length < 5) {
        req.flash('danger', 'Cube name should be at least 5 characters long.');
        res.redirect('/cube/overview/' + req.params.id);
      } else {
        if (image) {
          cube.image_uri = image.uri;
          cube.image_artist = image.artist;
          cube.image_name = req.body.imagename;
        }
        cube.descriptionhtml = req.body.html;
        cube.name = name;
        cube.isListed = req.body.isListed ? true : false;
        cube.date_updated = Date.now();
        cube.updated_string = cube.date_updated.toLocaleString("en-US");

        cube = setCubeType(cube, carddb);
        cube.save(function(err) {
          if (err) {
            req.flash('danger', 'Server Error');
            res.redirect('/cube/overview/' + req.params.id);
          } else {
            req.flash('success', 'Cube updated successfully.');
            res.redirect('/cube/overview/' + req.params.id);
          }
        });
      }
    }
  });
});

// Edit Submit POST Route
router.post('/edit/:id', ensureAuth, function(req, res) {
  req.body.blog = sanitize(req.body.blog);
  Cube.findById(req.params.id, function(err, cube) {
    cube.date_updated = Date.now();
    cube.updated_string = cube.date_updated.toLocaleString("en-US");
    if (err) {
      req.flash('danger', 'Server Error');
      res.redirect('/cube/list/' + req.params.id);
    } else if (!cube) {
      req.flash('danger', 'Cube not found');
      res.redirect('/cube/list/' + req.params.id);
    } else {
      var edits = req.body.body.split(';');
      var fail_remove = [];
      var adds = [];
      var removes = [];
      var changelog = "";
      for (let edit of edits) {
        if (edit.charAt(0) == '+') {
          //add id
          var details = carddb.carddict[edit.substring(1)];
          if (!details) {
            console.log('Card not found: ' + edit, req);
          } else {
            util.addCardToCube(cube, details);
            changelog += addCardHtml(carddb.carddict[edit.substring(1)]);
          }
        } else if (edit.charAt(0) == '-') {
          //remove id
          var rm_index = -1;
          cube.cards.forEach(function(card_to_remove, remove_index) {
            if (rm_index == -1) {
              if (card_to_remove.cardID == edit.substring(1)) {
                rm_index = remove_index;
              }
            }
          });
          if (rm_index != -1) {
            cube.cards.splice(rm_index, 1);
            changelog += removeCardHtml(carddb.carddict[edit.substring(1)]);
          } else {
            fail_remove.push(edit.substring(1));
          }
        } else if (edit.charAt(0) == '/') {
          var tmp_split = edit.substring(1).split('>');
          var details = carddb.carddict[tmp_split[1]];
          util.addCardToCube(cube, details);

          var rm_index = -1;
          cube.cards.forEach(function(card_to_remove, remove_index) {
            if (rm_index == -1) {
              if (card_to_remove.cardID == tmp_split[0]) {
                rm_index = remove_index;
              }
            }
          });
          if (rm_index != -1) {
            cube.cards.splice(rm_index, 1);
            changelog += replaceCardHtml(carddb.carddict[tmp_split[0]], carddb.carddict[tmp_split[1]]);
          } else {
            fail_remove.push(tmp_split[0]);
            changelog += addCardHtml(carddb.carddict[tmp_split[1]]);
          }
        }
        changelog += '<br>';
      }

      var blogpost = new Blog();
      blogpost.title = req.body.title;
      if (req.body.blog.length > 0) {
        blogpost.html = req.body.blog;
      }
      blogpost.changelist = changelog;
      blogpost.owner = cube.owner;
      blogpost.date = Date.now();
      blogpost.cube = cube._id;
      blogpost.dev = 'false';
      blogpost.date_formatted = blogpost.date.toLocaleString("en-US");

      blogpost.save(function(err) {
        if (err) {
          console.log(err, req);
        } else {
          if (fail_remove.length > 0) {
            var errors = ""
            fail_remove.forEach(function(fail, index) {
              if (carddb.carddict[fail]) {
                if (index != 0) {
                  errors += ", ";
                }
                errors += carddb.carddict[fail].name;
              } else {
                console.log('ERROR: Could not find the card with ID: ' + fail, req);
              }
            });
            cube = setCubeType(cube, carddb);
            Cube.updateOne({
              _id: cube._id
            }, cube, function(err) {
              if (err) {
                console.log(err, req);
              } else {
                req.flash('warning', 'Cube Updated With Errors, could not remove the following cards: ' + errors);
                res.redirect('/cube/list/' + req.params.id);
              }
            });
          } else {
            cube = setCubeType(cube, carddb);
            Cube.updateOne({
              _id: cube._id
            }, cube, function(err) {
              if (err) {
                console.log(err, req);
              } else {
                req.flash('success', 'Cube Updated');
                res.redirect('/cube/list/' + req.params.id);
              }
            });
          }
        }
      });
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
                console.log(err, req);
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
        User.findById(cube.owner, function(err, owner) {
          var owner_name = 'unknown';
          if (owner) {
            owner_name = owner.username;
          }
          var pages = [];
          var pagesize = 30;
          if (decks.length > 0) {
            decks.reverse();
            if (decks.length > pagesize) {
              var page = parseInt(split[1]);
              if (!page) {
                page = 0;
              }
              for (i = 0; i < decks.length / pagesize; i++) {
                if (page == i) {
                  pages.push({
                    url: '/cube/decks/' + cubeid + ';' + i,
                    content: (i + 1),
                    active: true
                  });
                } else {
                  pages.push({
                    url: '/cube/decks/' + cubeid + ';' + i,
                    content: (i + 1),
                  });
                }
              }
              deck_page = [];
              for (i = 0; i < pagesize; i++) {
                if (decks[i + page * pagesize]) {
                  deck_page.push(decks[i + page * pagesize]);
                }
              }
              res.render('cube/cube_decks', {
                cube: cube,
                owner: owner_name,
                decks: deck_page,
                pages: pages,
                loginCallback: '/user/decks/' + cubeid
              });
            } else {
              res.render('cube/cube_decks', {
                cube: cube,
                owner: owner_name,
                decks: decks,
                loginCallback: '/user/decks/' + cubeid
              });
            }
          } else {
            res.render('cube/cube_decks', {
              cube: cube,
              owner: owner_name,
              loginCallback: '/user/decks/' + cubeid,
              decks: []
            });
          }
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
          User.findById(cube.owner, function(err, user) {
            if (!user || err) {
              res.render('cube/cube_deckbuilder', {
                cube: cube,
                owner: 'Unknown',
                loginCallback: '/cube/draft/' + req.params.id,
                deck_raw: JSON.stringify(deck),
                basics_raw: JSON.stringify(getBasics(carddb)),
                deckid: deck._id
              });
            } else {
              res.render('cube/cube_deckbuilder', {
                cube: cube,
                owner: user.username,
                loginCallback: '/cube/draft/' + req.params.id,
                deck_raw: JSON.stringify(deck),
                basics_raw: JSON.stringify(getBasics(carddb)),
                deckid: deck._id
              });
            }
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
          var owner_name = "Unknown";
          var drafter_name = "Anonymous";
          User.findById(deck.owner, function(err, drafter) {
            if (drafter) {
              drafter_name = drafter.username;
            }
            User.findById(cube.owner, function(err, owner) {
              if (owner) {
                owner_name = owner.username;
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
                  cube: cube,
                  owner: owner_name,
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
                  cube: cube,
                  owner: owner_name,
                  drafter: drafter_name,
                  deck: JSON.stringify(deck.playerdeck),
                  bot_decks: bot_decks,
                  bots: bot_names,
                  loginCallback: '/cube/deck/' + req.params.id
                });
              }
            });
          });
        }
      });
    }
  });
});

router.get('/api/getcard/:name', function(req, res) {
  req.params.name = req.params.name.toLowerCase().trim().replace('-q-', '?');
  while (req.params.name.includes('-slash-')) {
    req.params.name = req.params.name.replace('-slash-', '//');
  }
  console.log(req.params.name);
  let potentialIds = carddb.nameToId[req.params.name];
  if (potentialIds && potentialIds.length > 0) {
    let nonPromo = potentialIds.find(id => !carddb.carddict[id].promo);
    let selected = nonPromo || potentialIds[0];
    let card = carddb.carddict[selected];
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

router.get('/api/getimage/:name', function(req, res) {
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

router.get('/api/getcardfromid/:id', function(req, res) {
  var card = carddb.carddict[req.params.id];
  //need to get the price of the card with the new version in here
  var tcg = [];
  if (card.tcgplayer_id) {
    tcg.push(card.tcgplayer_id);
  }
  GetPrices(tcg, function(price_dict) {
    if (!card) {
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

router.post('/api/updatecard/:id', function(req, res) {
  Cube.findById(req.params.id, function(err, cube) {
    User.findById(cube.owner, function(err, owner) {
      if (req.body.token != owner.edit_token) {
        res.status(401).send({
          success: 'false',
          message: 'Unauthorized'
        });
      } else {
        var found = false;
        cube.cards.forEach(function(card, index) {
          if (!card.type_line) {
            card.type_line = carddb.carddict[card.cardID].type;
          }
          if (!found && cardsAreEquivalent(card, req.body.src, carddb)) {
            found = true;
            cube.cards[index] = req.body.updated;
          }
        });
        if (!found) {
          res.status(400).send({
            success: 'false',
            message: 'Card not found'
          });
        } else {
          cube = setCubeType(cube, carddb);
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
      }
    });
  });
});

router.post('/api/updatecards/:id', function(req, res) {
  Cube.findById(req.params.id, function(err, cube) {
    User.findById(cube.owner, function(err, owner) {
      if (req.body.token != owner.edit_token) {
        res.status(401).send({
          success: 'false',
          message: 'Unauthorized'
        });
      } else {
        var found = false;
        req.body.selected.forEach(function(select, index) {
          if (!cube.cards[select.index].type_line) {
            cube.cards[select.index].type_line = carddb.carddict[cube.cards[select.index].cardID].type;
          }
          if (cube.cards[select.index].details) {
            delete cube.cards[select.index].details;
          }
          if (req.body.updated.status) {
            cube.cards[select.index].status = req.body.updated.status;
          }
          if (req.body.updated.cmc) {
            cube.cards[select.index].cmc = req.body.updated.cmc;
          }
          if (req.body.updated.type_line) {
            cube.cards[select.index].type_line = req.body.updated.type_line;
          }
          if (req.body.updated.colors) {
            cube.cards[select.index].colors = req.body.updated.colors;
          }
          if (req.body.updated.tags) {
            cube.cards[select.index].tags.forEach(function(tag, ind) {
              cube.cards[select.index].tags[ind] = tag.trim();
            });
            if (req.body.updated.addTags) {
              req.body.updated.tags.forEach(function(newtag, tag_ind) {
                if (!cube.cards[select.index].tags.includes(newtag)) {
                  cube.cards[select.index].tags.push(newtag);
                }
              });
            } else {
              //remove the tags
              req.body.updated.tags.forEach(function(tag, tag_in) {
                var temp = cube.cards[index].tags.indexOf(tag);
                if (temp > -1) {
                  cube.cards[index].tags.splice(temp, 1);
                }
              });
            }
          }
        });
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

router.post('/api/savesorts/:id', function(req, res) {
  Cube.findById(req.params.id, function(err, cube) {
    User.findById(cube.owner, function(err, owner) {
      if (req.body.token != owner.edit_token) {
        res.status(401).send({
          success: 'false',
          message: 'Unauthorized'
        });
      } else {
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
});

router.post('/api/draftpickcard/:id', function(req, res) {
  Cube.findById(req.params.id, function(err, cube) {
    Draft.findById({
      _id: req.body.draft_id
    }, function(err, draft) {
      CardRating.findOne({
        'name': req.body.card.details.name
      }, function(err, cardrating) {
        if(draft.packs[0][0])
        {
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
        }
        else
        {
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



// Access Control
function ensureAuth(req, res, next) {
  if (req.isAuthenticated()) {
    return next();
  } else {
    req.flash('danger', 'Please login to view this content');
    res.redirect('/user/login');
  }
}


module.exports = router;
