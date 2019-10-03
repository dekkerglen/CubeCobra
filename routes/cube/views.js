const RSS = require('rss');
const views = require('express').Router();
var mergeImages = require('merge-images');
const {
  Canvas,
  Image,
} = require('canvas');
const rp = require('request-promise');
const cheerio = require('cheerio');

const {
  GetPrices,
  abbreviate,
  addCardHtml,
  bulkUpload,
  notPromoOrDigitalId,
  removeCardHtml,
  replaceCardHtml,
  startCustomDraft,
  startStandardDraft,
} = require('./helpers');
const analytics = require('../../serverjs/analytics.js');
const draftutil = require('../../serverjs/draftutil.js');
const carddb = require('../../serverjs/cards.js');
const {
  addAutocard,
  build_id_query,
  getBasics,
  get_cube_id,
  generatePack,
  generate_short_id,
  sanitize,
  setCubeType,
} = require('../../serverjs/cubefn.js');
const generateMeta = require('../../serverjs/meta.js');
const util = require('../../serverjs/util.js');
const Blog = require('../../models/blog')
const CardRating = require('../models/cardrating');
const Cube = require('../../models/cube')
const Deck = require('../../models/deck')
const Draft = require('../../models/draft')
const User = require('../../models/user')
const {
  ensureAuth,
} = require('./../middleware');

const CARD_HEIGHT = 680;
const CARD_WIDTH = 488;
carddb.initializeCardDb();
Canvas.Image = Image;

// Add Submit POST Route
views.post('/add', ensureAuth, async (req, res) => {
  if (req.body.name.length < 5) {
    req.flash('danger', 'Cube name should be at least 5 characters long.');
    res.redirect('/user/view/' + req.user._id);
  } else if (util.has_profanity(req.body.name)) {
    req.flash('danger', 'Cube name should not use profanity.');
    res.redirect('/user/view/' + req.user._id);
  } else {
    let user = await User.findById(req.user._id);
    let cubes = await Cube.find({
      owner: user._id
    });
    if (cubes.length < 24) {
      let short_id = await generate_short_id();
      let cube = new Cube();
      cube.shortID = short_id;
      cube.name = req.body.name;
      cube.owner = req.user._id;
      cube.cards = [];
      cube.decks = [];
      cube.articles = [];
      var details = carddb.cardFromId(carddb.nameToId['doubling cube'][0]);
      cube.image_uri = details.art_crop;
      cube.image_name = details.full_name;
      cube.image_artist = details.artist;
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
          res.redirect('/cube/overview/' + cube.shortID);
        }
      });
    } else {
      req.flash('danger', 'Cannot create a cube: Users can only have 24 cubes. Please delete one or more cubes to create new cubes.');
      res.redirect('/user/view/' + req.user._id);
    }
  }
});

// GEt view cube Route
views.get('/view/:id', function(req, res) {
  res.redirect('/cube/overview/' + req.params.id);
});

views.post('/format/add/:id', ensureAuth, function(req, res) {
  req.body.html = sanitize(req.body.html);
  Cube.findOne(build_id_query(req.params.id), function(err, cube) {
    if (err || !cube) {
      req.flash('danger', 'Cube not found');
      res.status(404).render('misc/404', {});
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

views.post('/blog/post/:id', ensureAuth, function(req, res) {
  req.body.html = sanitize(req.body.html);
  if (req.body.title.length < 5 || req.body.title.length > 100) {
    req.flash('danger', 'Blog title length must be between 5 and 100 characters.');
    res.redirect('/cube/blog/' + req.params.id);
  } else if (req.body.html.length <= 10) {
    req.flash('danger', 'Blog body length must be greater than 10 characters.');
    res.redirect('/cube/blog/' + req.params.id);
  } else {
    Cube.findOne(build_id_query(req.params.id), function(err, cube) {
      if (err || !cube) {
        req.flash('danger', 'Cube not found');
        res.status(404).render('misc/404', {});
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
                  res.redirect('/cube/blog/' + req.params.id);
                } else {
                  blog.html = req.body.html;
                  blog.title = req.body.title;

                  blog.save(function(err) {
                    if (err) {
                      console.log(err, req);
                    } else {
                      req.flash('success', 'Blog update successful');
                      res.redirect('/cube/blog/' + req.params.id);
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
                  res.redirect('/cube/blog/' + req.params.id);
                }
              });
            }
          });
        });
      }
    });
  }
});

views.get('/overview/:id', function(req, res) {
  var split = req.params.id.split(';');
  var cube_id = split[0];
  Cube.findOne(build_id_query(cube_id), function(err, cube) {
    if (!cube) {
      req.flash('danger', 'Cube not found');
      res.status(404).render('misc/404', {});
    } else {
      var pids = [];
      cube.cards.forEach(function(card, index) {
        card.details = carddb.cardFromId(card.cardID);
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
                cube_id: cube_id,
                title: `${abbreviate(cube.name)} - Overview`,
                activeLink: 'overview',
                num_cards: cube.cards.length,
                author: 'unknown',
                post: blogs[0],
                metadata: generateMeta(
                  `Cube Cobra Overview: ${cube.name}`,
                  (cube.type) ? `${cube.card_count} Card ${cube.type} Cube` : `${cube.card_count} Card Cube`,
                  cube.image_uri,
                  `https://cubecobra.com/cube/overview/${req.params.id}`
                ),
                loginCallback: '/cube/overview/' + req.params.id,
                price: sum.toFixed(2)
              });
            } else {
              res.render('cube/cube_overview', {
                cube: cube,
                cube_id: cube_id,
                title: `${abbreviate(cube.name)} - Overview`,
                activeLink: 'overview',
                num_cards: cube.cards.length,
                owner: user.username,
                post: blogs[0],
                metadata: generateMeta(
                  `Cube Cobra Overview: ${cube.name}`,
                  (cube.type) ? `${cube.card_count} Card ${cube.type} Cube` : `${cube.card_count} Card Cube`,
                  cube.image_uri,
                  `https://cubecobra.com/cube/overview/${req.params.id}`
                ),
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

views.get('/blogsrc/:id', function(req, res) {
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

views.get('/blog/:id', function(req, res) {
  var split = req.params.id.split(';');
  var cube_id = split[0];
  Cube.findOne(build_id_query(cube_id), function(err, cube) {
    if (!cube) {
      req.flash('danger', 'Cube not found');
      res.status(404).render('misc/404', {});
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
              for (let i = 0; i < blogs.length / 10; i++) {
                if (page == i) {
                  pages.push({
                    url: '/cube/blog/' + cube_id + ';' + i,
                    content: (i + 1),
                    active: true
                  });
                } else {
                  pages.push({
                    url: '/cube/blog/' + cube_id + ';' + i,
                    content: (i + 1)
                  });
                }
              }
              let blog_page = [];
              for (let i = 0; i < 10; i++) {
                if (blogs[i + page * 10]) {
                  blog_page.push(blogs[i + page * 10]);
                }
              }
              res.render('cube/cube_blog', {
                cube: cube,
                cube_id: cube_id,
                owner: user.username,
                activeLink: 'blog',
                title: `${abbreviate(cube.name)} - Blog`,
                posts: blog_page,
                pages: pages,
                metadata: generateMeta(
                  `Cube Cobra Blog: ${cube.name}`,
                  (cube.type) ? `${cube.card_count} Card ${cube.type} Cube` : `${cube.card_count} Card Cube`,
                  cube.image_uri,
                  `https://cubecobra.com/cube/blog/${req.params.id}`
                ),
                loginCallback: '/cube/blog/' + req.params.id
              });
            } else {
              res.render('cube/cube_blog', {
                cube: cube,
                cube_id: cube_id,
                owner: user.username,
                activeLink: 'blog',
                title: `${abbreviate(cube.name)} - Blog`,
                posts: blogs,
                metadata: generateMeta(
                  `Cube Cobra Blog: ${cube.name}`,
                  (cube.type) ? `${cube.card_count} Card ${cube.type} Cube` : `${cube.card_count} Card Cube`,
                  cube.image_uri,
                  `https://cubecobra.com/cube/blog/${req.params.id}`
                ),
                loginCallback: '/cube/blog/' + req.params.id
              });
            }
          } else {
            res.render('cube/cube_blog', {
              cube: cube,
              cube_id: cube_id,
              owner: user.username,
              activeLink: 'blog',
              title: `${abbreviate(cube.name)} - Blog`,
              metadata: generateMeta(
                `Cube Cobra Blog: ${cube.name}`,
                (cube.type) ? `${cube.card_count} Card ${cube.type} Cube` : `${cube.card_count} Card Cube`,
                cube.image_uri,
                `https://cubecobra.com/cube/blog/${req.params.id}`
              ),
              loginCallback: '/cube/blog/' + req.params.id
            });
          }
        });
      });
    }
  });
});

views.get('/blog/:id/rss', function(req, res) {
  var split = req.params.id.split(';');
  var cube_id = split[0];
  Cube.findOne(build_id_query(cube_id), function(err, cube) {
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

          const feed = new RSS({
            title: cube.name,
            feed_url: `https://cubecobra.com/cube/blog/${cube.id}/rss`,
            site_url: 'https://cubecobra.com',
          });

          blogs.forEach((blog) => {
            feed.item({
              title: blog.title,
              description: blog.html ? blog.html : blog.content,
              guid: blog.id,
              date: blog.date
            });
          });
          res.set('Content-Type', 'text/xml');
          res.status(200).send(feed.xml());
        });
      });
    }
  });
});

views.get('/compare/:id_a/to/:id_b', function(req, res) {
  const id_a = req.params.id_a;
  const id_b = req.params.id_b;
  const user_id = req.user ? req.user._id : '';
  Cube.findOne(build_id_query(id_a), function(err, cubeA) {
    Cube.findOne(build_id_query(id_b), function(err, cubeB) {
      if (!cubeA) {
        req.flash('danger', 'Base cube not found');
        res.status(404).render('misc/404', {});
      } else if (!cubeB) {
        req.flash('danger', 'Comparison cube was not found');
        res.redirect('/cube/list/' + id_a);
      } else {
        let pids = [];
        cubeA.cards.forEach(function(card, index) {
          card.details = {
            ...carddb.cardFromId(card.cardID)
          };
          if (!card.type_line) {
            card.type_line = card.details.type;
          }
          if (card.details.tcgplayer_id && !pids.includes(card.details.tcgplayer_id)) {
            pids.push(card.details.tcgplayer_id);
          }
          card.details.display_image = util.getCardImageURL(card);
        });
        cubeB.cards.forEach(function(card, index) {
          card.details = carddb.cardFromId(card.cardID);
          if (!card.type_line) {
            card.type_line = card.details.type;
          }
          if (card.details.tcgplayer_id && !pids.includes(card.details.tcgplayer_id)) {
            pids.push(card.details.tcgplayer_id);
          }
          card.details.display_image = util.getCardImageURL(card);
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

              let params = {
                cube: cubeA,
                cubeB: cubeB,
                cube_id: id_a,
                cube_b_id: id_b,
                title: `Comparing ${cubeA.name} to ${cubeB.name}`,
                in_both: JSON.stringify(in_both.map(card => card.details.name)),
                only_a: JSON.stringify(a_names),
                only_b: JSON.stringify(b_names),
                cube_raw: JSON.stringify(all_cards),
                metadata: generateMeta(
                  'Cube Cobra Compare Cubes',
                  `Comparing "${cubeA.name}" To "${cubeB.name}"`,
                  cubeA.image_uri,
                  `https://cubecobra.com/cube/compare/${id_a}/to/${id_b}`
                ),
                loginCallback: '/cube/compare/' + id_a + '/to/' + id_b,
              };

              if (ownerA) params.owner = ownerA.username;
              else params.author = 'unknown';

              res.render('cube/cube_compare', params);
            });
          });
        });
      }
    });
  });
})

views.get('/list/:id', function(req, res) {
  Cube.findOne(build_id_query(req.params.id), function(err, cube) {
    if (!cube) {
      req.flash('danger', 'Cube not found');
      res.status(404).render('misc/404', {});
    } else {
      var pids = [];
      cube.cards.forEach(function(card, index) {
        card.details = {
          ...carddb.cardFromId(card.cardID)
        };
        card.details.display_image = util.getCardImageURL(card);
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
        res.render('cube/cube_list', {
          cube: cube,
          activeLink: 'list',
          cube_id: req.params.id,
          title: `${abbreviate(cube.name)} - List`,
          cube_raw: JSON.stringify(cube.cards),
          metadata: generateMeta(
            `Cube Cobra List: ${cube.name}`,
            (cube.type) ? `${cube.card_count} Card ${cube.type} Cube` : `${cube.card_count} Card Cube`,
            cube.image_uri,
            `https://cubecobra.com/cube/list/${req.params.id}`
          ),
          loginCallback: '/cube/list/' + req.params.id
        });
      });
    }
  });
});

views.get('/playtest/:id', function(req, res) {
  Cube.findOne(build_id_query(req.params.id), function(err, cube) {
    if (!cube) {
      req.flash('danger', 'Cube not found');
      res.status(404).render('misc/404', {});
    } else {
      cube.cards.forEach(function(card, index) {
        card.details = carddb.cardFromId(card.cardID);
        card.details.display_image = util.getCardImageURL(card);
      });
      User.findById(cube.owner, function(err, user) {
        Deck.find({
          _id: {
            $in: cube.decks
          }
        }, function(err, decks) {
          const decklinks = decks.splice(Math.max(decks.length - 10, 0), decks.length).reverse();
          if (!user || err) {
            res.render('cube/cube_playtest', {
              cube: cube,
              cube_id: req.params.id,
              activeLink: 'playtest',
              title: `${abbreviate(cube.name)} - Playtest`,
              author: 'unknown',
              decks: decklinks,
              cube_raw: JSON.stringify(cube),
              metadata: generateMeta(
                `Cube Cobra Playtest: ${cube.name}`,
                (cube.type) ? `${cube.card_count} Card ${cube.type} Cube` : `${cube.card_count} Card Cube`,
                cube.image_uri,
                `https://cubecobra.com/cube/playtest/${req.params.id}`
              ),
              loginCallback: '/cube/playtest/' + req.params.id
            });
          } else {
            res.render('cube/cube_playtest', {
              cube: cube,
              cube_id: req.params.id,
              activeLink: 'playtest',
              title: `${abbreviate(cube.name)} - Playtest`,
              owner: user.username,
              decks: decklinks,
              cube_raw: JSON.stringify(cube),
              metadata: generateMeta(
                `Cube Cobra Playtest: ${cube.name}`,
                (cube.type) ? `${cube.card_count} Card ${cube.type} Cube` : `${cube.card_count} Card Cube`,
                cube.image_uri,
                `https://cubecobra.com/cube/playtest/${req.params.id}`
              ),
              loginCallback: '/cube/playtest/' + req.params.id
            });
          }
        });
      });
    }
  });
});

views.get('/analysis/:id', function(req, res) {
  Cube.findOne(build_id_query(req.params.id), function(err, cube) {
    if (!cube) {
      req.flash('danger', 'Cube not found');
      res.status(404).render('misc/404', {});
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
            cube_id: req.params.id,
            owner: user.username,
            activeLink: 'analysis',
            title: `${abbreviate(cube.name)} - Analysis`,
            TypeByColor: analytics.GetTypeByColor(cube.cards, carddb),
            MulticoloredCounts: analytics.GetColorCounts(cube.cards, carddb),
            curve: JSON.stringify(analytics.GetCurve(cube.cards, carddb)),
            metadata: generateMeta(
              `Cube Cobra Analysis: ${cube.name}`,
              (cube.type) ? `${cube.card_count} Card ${cube.type} Cube` : `${cube.card_count} Card Cube`,
              cube.image_uri,
              `https://cubecobra.com/cube/analysis/${req.params.id}`
            ),
            loginCallback: '/cube/analysis/' + req.params.id
          });
        } else {
          res.render('cube/cube_analysis', {
            cube: cube,
            cube_id: req.params.id,
            owner: user.username,
            activeLink: 'analysis',
            title: `${abbreviate(cube.name)} - Analysis`,
            TypeByColor: analytics.GetTypeByColor(cube.cards, carddb),
            MulticoloredCounts: analytics.GetColorCounts(cube.cards, carddb),
            curve: JSON.stringify(analytics.GetCurve(cube.cards, carddb)),
            metadata: generateMeta(
              `Cube Cobra Analysis: ${cube.name}`,
              (cube.type) ? `${cube.card_count} Card ${cube.type} Cube` : `${cube.card_count} Card Cube`,
              cube.image_uri,
              `https://cubecobra.com/cube/analysis/${req.params.id}`
            ),
            loginCallback: '/cube/analysis/' + req.params.id
          });
        }
      });
    }
  });
});

views.get('/samplepack/:id', function(req, res) {
  res.redirect('/cube/samplepack/' + req.params.id + '/' + Date.now().toString());
});

views.get('/samplepack/:id/:seed', function(req, res) {
  Cube.findOne(build_id_query(req.params.id), function(err, cube) {
    if (!cube) {
      req.flash('danger', 'Cube not found');
      res.status(404).render('misc/404', {});
    }
    generatePack(req.params.id, carddb, req.params.seed, function(err, pack) {
      if (err) {
        req.flash('danger', 'Pack could not be created');
        res.status(404).render('misc/404', {});
      } else {
        res.render('cube/cube_samplepack', {
          cube,
          title: `${abbreviate(cube.name)} - Sample Pack`,
          pack: pack.pack,
          seed: pack.seed,
          cube_id: req.params.id,
          activeLink: 'playtest',
          metadata: generateMeta(
            'Cube Cobra Sample Pack',
            `A sample pack from ${cube.name}`,
            `https://cubecobra.com/cube/samplepackimage/${req.params.id}/${pack.seed}.png`,
            `https://cubecobra.com/cube/samplepack/${req.params.id}/${pack.seed}`,
            CARD_WIDTH * 5,
            CARD_HEIGHT * 3
          ),
          loginCallback: '/cube/samplepack/' + req.params.id
        });
      }
    });
  });
});

views.get('/samplepackimage/:id/:seed', function(req, res) {
  req.params.seed = req.params.seed.replace('.png', '');
  generatePack(req.params.id, carddb, req.params.seed, function(err, pack) {
    if (err) {
      req.flash('danger', 'Pack could not be created');
      res.status(404).render('misc/404', {});
    } else {
      var srcArray = pack.pack.map((card, index) => {
        return {
          src: card.image_normal,
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
          'Content-Type': 'image/png'
        });
        res.end(Buffer.from(image.replace(/^data:image\/png;base64,/, ''), 'base64'));
      });
    }
  });
});

views.post('/importcubetutor/:id', ensureAuth, function(req, res) {
  Cube.findOne(build_id_query(req.params.id), function(err, cube) {
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
                  let matchingSet = potentialIds.find(id => carddb.cardFromId(id).set.toUpperCase() == card.set);
                  let nonPromo = potentialIds.find(notPromoOrDigitalId);
                  let selected = matchingSet || nonPromo || potentialIds[0];
                  let details = carddb.cardFromId(selected);
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
                  cube_id: req.params.id,
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

views.post('/bulkupload/:id', ensureAuth, function(req, res) {
  Cube.findOne(build_id_query(req.params.id), function(err, cube) {
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

views.post('/bulkuploadfile/:id', ensureAuth, function(req, res) {
  if (!req.files) {
    req.flash('danger', 'Please attach a file');
    res.redirect('/cube/list/' + req.params.id);
  } else {
    const items = req.files.document.data.toString('utf8'); // the uploaded file object

    Cube.findOne(build_id_query(req.params.id), function(err, cube) {
      if (cube.owner != req.user._id) {
        req.flash('danger', 'Not Authorized');
        res.redirect('/cube/list/' + req.params.id);
      } else {
        bulkUpload(req, res, items, cube);
      }
    });
  }
});

views.get('/download/cubecobra/:id', function(req, res) {
  Cube.findOne(build_id_query(req.params.id), function(err, cube) {
    if (!cube) {
      req.flash('danger', 'Cube not found');
      res.status(404).render('misc/404', {});
    } else {
      res.setHeader('Content-disposition', 'attachment; filename=' + cube.name.replace(/\W/g, '') + '.txt');
      res.setHeader('Content-type', 'text/plain');
      res.charset = 'UTF-8';
      cube.cards.forEach(function(card, index) {
        res.write(carddb.cardFromId(card.cardID).full_name + '\r\n');
      });
      res.end();
    }
  });
});

views.get('/download/csv/:id', function(req, res) {
  Cube.findOne(build_id_query(req.params.id), function(err, cube) {
    if (!cube) {
      req.flash('danger', 'Cube not found');
      res.status(404).render('misc/404', {});
    } else {
      res.setHeader('Content-disposition', 'attachment; filename=' + cube.name.replace(/\W/g, '') + '.csv');
      res.setHeader('Content-type', 'text/plain');
      res.charset = 'UTF-8';
      res.write('Name,CMC,Type,Color,Set,Collector Number,Status,Tags\r\n');
      cube.cards.forEach(function(card, index) {
        if (!card.type_line) {
          card.type_line = carddb.cardFromId(card.cardID).type;
        }
        var name = carddb.cardFromId(card.cardID).name;
        while (name.includes('"')) {
          name = name.replace('"', '-quote-');
        }
        while (name.includes('-quote-')) {
          name = name.replace('-quote-', '""');
        }
        res.write('"' + name + '"' + ',');
        res.write(card.cmc + ',');
        res.write('"' + card.type_line.replace('—', '-') + '"' + ',');
        res.write(card.colors.join('') + ',');
        res.write('"' + carddb.cardFromId(card.cardID).set + '"' + ',');
        res.write('"' + carddb.cardFromId(card.cardID).collector_number + '"' + ',');
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

views.get('/download/forge/:id', function(req, res) {
  Cube.findOne(build_id_query(req.params.id), function(err, cube) {
    if (!cube) {
      req.flash('danger', 'Cube not found');
      res.status(404).render('misc/404', {});
    } else {
      res.setHeader('Content-disposition', 'attachment; filename=' + cube.name.replace(/\W/g, '') + '.dck');
      res.setHeader('Content-type', 'text/plain');
      res.charset = 'UTF-8';
      res.write('[metadata]\r\n');
      res.write('Name=' + cube.name + '\r\n');
      res.write('[Main]\r\n');
      cube.cards.forEach(function(card, index) {
        var name = carddb.cardFromId(card.cardID).name;
        var set = carddb.cardFromId(card.cardID).set;
        res.write('1 ' + name + '|' + set.toUpperCase() + '\r\n');
      });
      res.end();
    }
  });
});

views.get('/download/xmage/:id', function(req, res) {
  Cube.findOne(build_id_query(req.params.id), function(err, cube) {
    if (!cube) {
      req.flash('danger', 'Cube not found');
      res.status(404).render('misc/404', {});
    } else {
      res.setHeader('Content-disposition', 'attachment; filename=' + cube.name.replace(/\W/g, '') + '.dck');
      res.setHeader('Content-type', 'text/plain');
      res.charset = 'UTF-8';
      cube.cards.forEach(function(card, index) {
        var name = carddb.cardFromId(card.cardID).name;
        var set = carddb.cardFromId(card.cardID).set;
        var collectorNumber = carddb.cardFromId(card.cardID).collector_number;
        res.write('1 [' + set.toUpperCase() + ':' + collectorNumber + '] ' + name + '\r\n');
      });
      res.end();
    }
  });
});

views.get('/download/plaintext/:id', function(req, res) {
  Cube.findOne(build_id_query(req.params.id), function(err, cube) {
    if (!cube) {
      req.flash('danger', 'Cube not found');
      res.status(404).render('misc/404', {});
    } else {
      res.setHeader('Content-disposition', 'attachment; filename=' + cube.name.replace(/\W/g, '') + '.txt');
      res.setHeader('Content-type', 'text/plain');
      res.charset = 'UTF-8';
      cube.cards.forEach(function(card, index) {
        res.write(carddb.cardFromId(card.cardID).name + '\r\n');
      });
      res.end();
    }
  });
});

views.post('/startdraft/:id', function(req, res) {
  Cube.findOne(build_id_query(req.params.id), function(err, cube) {
    if (!cube) {
      req.flash('danger', 'Cube not found');
      res.status(404).render('misc/404', {});
    } else {
      let params = {
        id: parseInt(req.body.id),
        seats: parseInt(req.body.seats),
        packs: parseInt(req.body.packs),
        cards: parseInt(req.body.cards),
      };
      if (req.body.id == -1) {
        //standard draft
        startStandardDraft(req, res, params, cube);
      } else {
        startCustomDraft(req, res, params, cube);
      }
    }
  });
});

views.get('/draft/:id', function(req, res) {
  Draft.findById(req.params.id, function(err, draft) {
    if (!draft) {
      req.flash('danger', 'Draft not found');
      res.status(404).render('misc/404', {});
    } else {
      var pickNumber = draft.pickNumber;
      var packNumber = draft.packNumber;
      var title = 'Pack ' + packNumber + ', Pick ' + pickNumber;
      var packsleft = (draft.packs[0].length + 1 - packNumber);
      var subtitle = packsleft + ' unopened packs left.';
      if (packsleft == 1) {
        subtitle = packsleft + ' unopened pack left.';
      }
      let names = [];
      //add in details to all cards
      draft.packs.forEach(function(seat, index) {
        seat.forEach(function(pack, index2) {
          pack.forEach(function(card, index3) {
            card.details = carddb.cardFromId(card.cardID);
            if (!names.includes(card.details.name)) {
              names.push(card.details.name);
            }
            card.details.display_image = util.getCardImageURL(card);
          });
        });
      });
      // TODO this only handles the user picks (item 0 of draft picks), so custom images won't work with bot picks.
      draft.picks[0].forEach(function(col, index) {
        col.forEach(function(card, index) {
          card.details = carddb.cardFromId(card.cardID);
          card.details.display_image = util.getCardImageURL(card);
        });
      });
      draftutil.getCardRatings(names, CardRating, function(ratings) {
        draft.ratings = ratings;
        Cube.findOne(build_id_query(draft.cube), function(err, cube) {
          if (!cube) {
            req.flash('danger', 'Cube not found');
            res.status(404).render('misc/404', {});
          } else {
            User.findById(cube.owner, function(err, user) {
              if (!user || err) {
                res.render('cube/cube_draft', {
                  cube: cube,
                  cube_id: get_cube_id(cube),
                  owner: 'Unknown',
                  activeLink: 'playtest',
                  title: `${abbreviate(cube.name)} - Draft`,
                  metadata: generateMeta(
                    `Cube Cobra Draft: ${cube.name}`,
                    (cube.type) ? `${cube.card_count} Card ${cube.type} Cube` : `${cube.card_count} Card Cube`,
                    cube.image_uri,
                    `https://cubecobra.com/cube/draft/${req.params.id}`
                  ),
                  loginCallback: '/cube/draft/' + req.params.id,
                  draft_raw: JSON.stringify(draft)
                });
              } else {
                res.render('cube/cube_draft', {
                  cube: cube,
                  cube_id: get_cube_id(cube),
                  owner: user.username,
                  activeLink: 'playtest',
                  title: `${abbreviate(cube.name)} - Draft`,
                  metadata: generateMeta(
                    `Cube Cobra Draft: ${cube.name}`,
                    (cube.type) ? `${cube.card_count} Card ${cube.type} Cube` : `${cube.card_count} Card Cube`,
                    cube.image_uri,
                    `https://cubecobra.com/cube/draft/${req.params.id}`
                  ),
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
views.post('/editoverview/:id', ensureAuth, function(req, res) {
  req.body.html = sanitize(req.body.html);
  Cube.findOne(build_id_query(req.params.id), function(err, cube) {
    if (err) {
      req.flash('danger', 'Server Error');
      res.redirect('/cube/overview/' + req.params.id);
    } else if (!cube) {
      req.flash('danger', 'Cube not found');
      res.redirect('/cube/overview/' + req.params.id);
    } else {
      const old_alias = cube.urlAlias;
      const used_alias = (cube.urlAlias === req.params.id);

      var image = carddb.imagedict[req.body.imagename.toLowerCase()];
      var name = req.body.name;

      if (name.length < 5) {
        req.flash('danger', 'Cube name should be at least 5 characters long.');
        res.redirect('/cube/overview/' + req.params.id);
      } else if (util.has_profanity(name)) {
        req.flash('danger', 'Cube name should not use profanity.');
        res.redirect('/cube/overview/' + req.params.id);
      } else {
        let urlAliasMaxLength = 100;
        if (req.body.urlAlias && cube.urlAlias !== req.body.urlAlias) {
          if (!req.body.urlAlias.match(/^[0-9a-zA-Z_]*$/)) {
            req.flash('danger', 'Custom URL must contain only alphanumeric characters or underscores.');
            res.redirect('/cube/overview/' + req.params.id);
          } else if (req.body.urlAlias.length > urlAliasMaxLength) {
            req.flash('danger', 'Custom URL may not be longer than ' + urlAliasMaxLength + ' characters.');
            res.redirect('/cube/overview/' + req.params.id);
          } else {
            if (util.has_profanity(req.body.urlAlias)) {
              req.flash('danger', 'Custom URL may not contain profanity.');
              res.redirect('/cube/overview/' + req.params.id);
            } else {
              Cube.findOne(build_id_query(req.body.urlAlias), function(err, takenAlias) {
                if (takenAlias) {
                  req.flash('danger', 'Custom URL already taken.');
                  res.redirect('/cube/overview/' + req.params.id);
                } else {
                  update_cube();
                }
              });
            }
          }
        } else {
          update_cube();
        }

        function update_cube() {
          if (image) {
            cube.image_uri = image.uri;
            cube.image_artist = image.artist;
            cube.image_name = req.body.imagename;
          }
          cube.descriptionhtml = req.body.html;
          cube.name = name;
          cube.isListed = req.body.isListed ? true : false;
          cube.privatePrices = req.body.privatePrices ? true : false;
          cube.urlAlias = req.body.urlAlias ? req.body.urlAlias.toLowerCase() : null;
          cube.date_updated = Date.now();
          cube.updated_string = cube.date_updated.toLocaleString("en-US");

          let url = req.params.id;
          if (used_alias) {
            if (!cube.urlAlias) url = get_cube_id(cube)
            else if (cube.urlAlias !== req.params.id) url = cube.urlAlias;
          } else if (!old_alias && cube.urlAlias) {
            url = cube.urlAlias;
          }

          cube = setCubeType(cube, carddb);
          cube.save(function(err) {
            if (err) {
              req.flash('danger', 'Server Error');
              res.redirect('/cube/overview/' + url);
            } else {
              req.flash('success', 'Cube updated successfully.');
              res.redirect('/cube/overview/' + url);
            }
          });
        }
      }
    }
  });
});

// Edit Submit POST Route
views.post('/edit/:id', ensureAuth, function(req, res) {
  req.body.blog = sanitize(req.body.blog);
  Cube.findOne(build_id_query(req.params.id), function(err, cube) {
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
          var details = carddb.cardFromId(edit.substring(1));
          if (!details) {
            console.log('Card not found: ' + edit, req);
          } else {
            util.addCardToCube(cube, details);
            changelog += addCardHtml(carddb.cardFromId(edit.substring(1)));
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
            changelog += removeCardHtml(carddb.cardFromId(edit.substring(1)));
          } else {
            fail_remove.push(edit.substring(1));
          }
        } else if (edit.charAt(0) == '/') {
          var tmp_split = edit.substring(1).split('>');
          var details = carddb.cardFromId(tmp_split[1]);
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
            changelog += replaceCardHtml(carddb.cardFromId(tmp_split[0]), carddb.cardFromId(tmp_split[1]));
          } else {
            fail_remove.push(tmp_split[0]);
            changelog += addCardHtml(carddb.cardFromId(tmp_split[1]));
          }
        }
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
              if (!carddb.cardFromId(fail).error) {
                if (index != 0) {
                  errors += ", ";
                }
                errors += carddb.cardFromId(fail).name;
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

views.post('/editdeck/:id', function(req, res) {
  Deck.findById(req.params.id, function(err, deck) {
    if (err || !deck) {
      req.flash('danger', 'Deck not found');
      res.status(404).render('misc/404', {});
    } else if ((deck.owner && !(req.user)) || (deck.owner && (deck.owner != req.user._id))) {
      req.flash('danger', 'Unauthorized');
      res.status(404).render('misc/404', {});
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

views.post('/submitdeck/:id', function(req, res) {
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
    Cube.findOne(build_id_query(draft.cube), function(err, cube) {
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

views.get('/decks/:id', function(req, res) {
  var split = req.params.id.split(';');
  var cubeid = split[0];
  Cube.findOne(build_id_query(cubeid), function(err, cube) {
    if (err || !cube) {
      req.flash('danger', 'Cube not found');
      res.status(404).render('misc/404', {});
    } else {
      Deck.find({
        cube: cube._id
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
              for (let i = 0; i < decks.length / pagesize; i++) {
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
              let deck_page = [];
              for (let i = 0; i < pagesize; i++) {
                if (decks[i + page * pagesize]) {
                  deck_page.push(decks[i + page * pagesize]);
                }
              }
              res.render('cube/cube_decks', {
                cube: cube,
                cube_id: cubeid,
                owner: owner_name,
                activeLink: 'playtest',
                title: `${abbreviate(cube.name)} - Draft Decks`,
                decks: deck_page,
                pages: pages,
                metadata: generateMeta(
                  `Cube Cobra Decks: ${cube.name}`,
                  (cube.type) ? `${cube.card_count} Card ${cube.type} Cube` : `${cube.card_count} Card Cube`,
                  cube.image_uri,
                  `https://cubecobra.com/user/decks/${req.params.id}`
                ),
                loginCallback: '/user/decks/' + cubeid
              });
            } else {
              res.render('cube/cube_decks', {
                cube: cube,
                cube_id: cubeid,
                owner: owner_name,
                activeLink: 'playtest',
                title: `${abbreviate(cube.name)} - Draft Decks`,
                decks: decks,
                metadata: generateMeta(
                  `Cube Cobra Decks: ${cube.name}`,
                  (cube.type) ? `${cube.card_count} Card ${cube.type} Cube` : `${cube.card_count} Card Cube`,
                  cube.image_uri,
                  `https://cubecobra.com/user/decks/${req.params.id}`
                ),
                loginCallback: '/user/decks/' + cubeid
              });
            }
          } else {
            res.render('cube/cube_decks', {
              cube: cube,
              cube_id: cubeid,
              owner: owner_name,
              activeLink: 'playtest',
              metadata: generateMeta(
                `Cube Cobra Decks: ${cube.name}`,
                (cube.type) ? `${cube.card_count} Card ${cube.type} Cube` : `${cube.card_count} Card Cube`,
                cube.image_uri,
                `https://cubecobra.com/user/decks/${req.params.id}`
              ),
              loginCallback: '/user/decks/' + cubeid,
              decks: []
            });
          }
        });
      });
    }
  });
});

views.get('/deckbuilder/:id', function(req, res) {
  Deck.findById(req.params.id, function(err, deck) {
    if (err || !deck) {
      req.flash('danger', 'Deck not found');
      res.status(404).render('misc/404', {});
    } else {
      deck.cards.forEach(function(card, index) {
        if (Array.isArray(card)) {
          card.forEach(function(item, index2) {
            if (item) {
              item = {
                cardID: item
              };
              item.details = carddb.cardFromId(item.cardID);
              item.details.display_image = util.getCardImageURL(item);
            }
          });
        } else {
          card.details = carddb.cardFromId(card);
          card.details.display_image = util.getCardImageURL(card);
        }
      });
      Cube.findOne(build_id_query(deck.cube), function(err, cube) {
        if (!deck) {
          req.flash('danger', 'Cube not found');
          res.status(404).render('misc/404', {});
        } else {
          User.findById(cube.owner, function(err, user) {
            if (!user || err) {
              res.render('cube/cube_deckbuilder', {
                cube: cube,
                cube_id: get_cube_id(cube),
                owner: 'Unknown',
                activeLink: 'playtest',
                title: `${abbreviate(cube.name)} - Deckbuilder`,
                metadata: generateMeta(
                  `Cube Cobra Draft: ${cube.name}`,
                  (cube.type) ? `${cube.card_count} Card ${cube.type} Cube` : `${cube.card_count} Card Cube`,
                  cube.image_uri,
                  `https://cubecobra.com/cube/draft/${req.params.id}`
                ),
                loginCallback: '/cube/draft/' + req.params.id,
                deck_raw: JSON.stringify(deck),
                basics_raw: JSON.stringify(getBasics(carddb)),
                deckid: deck._id
              });
            } else {
              res.render('cube/cube_deckbuilder', {
                cube: cube,
                cube_id: get_cube_id(cube),
                owner: user.username,
                activeLink: 'playtest',
                title: `${abbreviate(cube.name)} - Deckbuilder`,
                metadata: generateMeta(
                  `Cube Cobra Draft: ${cube.name}`,
                  (cube.type) ? `${cube.card_count} Card ${cube.type} Cube` : `${cube.card_count} Card Cube`,
                  cube.image_uri,
                  `https://cubecobra.com/cube/draft/${req.params.id}`
                ),
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

views.get('/deck/:id', function(req, res) {
  Deck.findById(req.params.id, function(err, deck) {
    if (!deck) {
      req.flash('danger', 'Deck not found');
      res.status(404).render('misc/404', {});
    } else {
      Cube.findOne(build_id_query(deck.cube), function(err, cube) {
        if (!cube) {
          req.flash('danger', 'Cube not found');
          res.status(404).render('misc/404', {});
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
                  card.details = carddb.cardFromId(card);
                  card.details.display_image = util.getCardImageURL(card);
                  player_deck.push(card.details);
                });
                for (let i = 1; i < deck.cards.length; i++) {
                  var bot_deck = [];
                  deck.cards[i].forEach(function(card, index) {
                    if (!card[0].cardID && !carddb.cardFromId(card[0].cardID).error) {
                      console.log(req.params.id + ": Could not find seat " + (bot_decks.length + 1) + ", pick " + (bot_deck.length + 1));
                    } else {
                      var details = carddb.cardFromId(card[0].cardID);
                      details.display_image = util.getCardImageURL({
                        details
                      });
                      bot_deck.push(details);
                    }
                  });
                  bot_decks.push(bot_deck);
                }
                var bot_names = [];
                for (let i = 0; i < deck.bots.length; i++) {
                  bot_names.push("Seat " + (i + 2) + ": " + deck.bots[i][0] + ", " + deck.bots[i][1]);
                }
                return res.render('cube/cube_deck', {
                  oldformat: true,
                  cube: cube,
                  cube_id: get_cube_id(cube),
                  owner: owner_name,
                  activeLink: 'playtest',
                  title: `${abbreviate(cube.name)} - ${drafter_name}'s deck`,
                  drafter: drafter_name,
                  cards: player_deck,
                  bot_decks: bot_decks,
                  bots: bot_names,
                  metadata: generateMeta(
                    `Cube Cobra Deck: ${cube.name}`,
                    (cube.type) ? `${cube.card_count} Card ${cube.type} Cube` : `${cube.card_count} Card Cube`,
                    cube.image_uri,
                    `https://cubecobra.com/cube/deck/${req.params.id}`
                  ),
                  loginCallback: '/cube/deck/' + req.params.id
                });
              } else {
                deck.playerdeck.forEach(function(col, ind) {
                  col.forEach(function(card, index) {
                    card.details.display_image = util.getCardImageURL(card);
                  });
                });
                //new format
                for (let i = 0; i < deck.cards.length; i++) {
                  let bot_deck = [];
                  deck.cards[i].forEach(function(cardid, index) {
                    if (carddb.cardFromId(cardid).error) {
                      console.log(req.params.id + ": Could not find seat " + (bot_decks.length + 1) + ", pick " + (bot_deck.length + 1));
                    } else {
                      var details = carddb.cardFromId(cardid);
                      details.display_image = util.getCardImageURL({
                        details
                      });
                      bot_deck.push(details);
                    }
                  });
                  bot_decks.push(bot_deck);
                }
                let bot_names = [];
                for (let i = 0; i < deck.bots.length; i++) {
                  bot_names.push("Seat " + (i + 2) + ": " + deck.bots[i][0] + ", " + deck.bots[i][1]);
                }
                return res.render('cube/cube_deck', {
                  oldformat: false,
                  cube: cube,
                  cube_id: get_cube_id(cube),
                  owner: owner_name,
                  activeLink: 'playtest',
                  title: `${abbreviate(cube.name)} - ${drafter_name}'s deck`,
                  drafter: drafter_name,
                  deck: JSON.stringify(deck.playerdeck),
                  bot_decks: bot_decks,
                  bots: bot_names,
                  metadata: generateMeta(
                    `Cube Cobra Deck: ${cube.name}`,
                    (cube.type) ? `${cube.card_count} Card ${cube.type} Cube` : `${cube.card_count} Card Cube`,
                    cube.image_uri,
                    `https://cubecobra.com/cube/deck/${req.params.id}`
                  ),
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

views.delete('/remove/:id', ensureAuth, function(req, res) {
  if (!req.user._id) {
    req.flash('danger', 'Not Authorized');
    res.redirect('/' + req.params.id);
  }

  let query = build_id_query(req.params.id)

  Cube.findOne(query, function(err, cube) {
    if (err || !cube || (cube.owner != req.user._id)) {
      req.flash('danger', 'Cube not found');
      res.status(404).render('misc/404', {});
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

views.delete('/blog/remove/:id', ensureAuth, function(req, res) {
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
      res.status(404).render('misc/404', {});
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

views.delete('/format/remove/:id', ensureAuth, function(req, res) {
  if (!req.user._id) {
    req.flash('danger', 'Not Authorized');
    res.redirect('/' + req.params.id);
  }

  var cubeid = req.params.id.split(';')[0];
  var id = parseInt(req.params.id.split(';')[1]);

  Cube.findOne(build_id_query(cubeid), function(err, cube) {
    if (err || !cube || cube.owner != req.user._id || id === NaN || id < 0 || id >= cube.draft_formats.length) {
      res.sendStatus(401);
    } else {
      cube.draft_formats.splice(id, 1);

      Cube.updateOne({
        _id: cube._id
      }, cube, function(err) {
        if (err) {
          console.log(err, req);
          res.sendStatus(500);
        } else {
          res.sendStatus(200);
        }
      });
    }
  });
});

module.exports = views;