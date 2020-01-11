const express = require('express');
const fetch = require('node-fetch');
const cheerio = require('cheerio');
var {
  addAutocard,
  generatePack,
  sanitize,
  setCubeType,
  cardsAreEquivalent,
  getBasics,
  generate_short_id,
  build_id_query,
  get_cube_id,
} = require('../serverjs/cubefn.js');
const analytics = require('../serverjs/analytics.js');
const draftutil = require('../serverjs/draftutil.js');
const cardutil = require('../dist/util/Card.js');
const carddb = require('../serverjs/cards.js');
carddb.initializeCardDb();
const util = require('../serverjs/util.js');
const { GetPrices } = require('../serverjs/prices.js');
const mergeImages = require('merge-images');
const generateMeta = require('../serverjs/meta.js');
const { Canvas, Image } = require('canvas');
Canvas.Image = Image;

const React = require('react');
const ReactDOMServer = require('react-dom/server');

const RSS = require('rss');
const CARD_HEIGHT = 680;
const CARD_WIDTH = 488;

const router = express.Router();
// Bring in models
let Cube = require('../models/cube');
let Deck = require('../models/deck');
let Blog = require('../models/blog');
let User = require('../models/user');
let Draft = require('../models/draft');
let CardRating = require('../models/cardrating');

const { ensureAuth, csrfProtection } = require('./middleware');

const NODE_ENV = process.env.NODE_ENV;

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

router.use(csrfProtection);

// Add Submit POST Route
router.post('/add', ensureAuth, async (req, res) => {
  try {
    if (req.body.name.length < 5 || req.body.name.length > 100) {
      req.flash('danger', 'Cube name should be at least 5 characters long, and shorter than 100 characters.');
      return res.redirect('/user/view/' + req.user._id);
    }

    if (util.has_profanity(req.body.name)) {
      req.flash('danger', 'Cube name should not use profanity.');
      return res.redirect('/user/view/' + req.user._id);
    }

    const user = await User.findById(req.user._id);
    const cubes = await Cube.find({
      owner: user._id,
    });

    if (cubes.length >= 24) {
      req.flash(
        'danger',
        'Cannot create a cube: Users can only have 24 cubes. Please delete one or more cubes to create new cubes.',
      );
      return res.redirect('/user/view/' + req.user._id);
    }

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
    cube.description = 'This is a brand new cube!';
    cube.owner_name = user.username;
    cube.date_updated = Date.now();
    cube.updated_string = cube.date_updated.toLocaleString('en-US');
    cube = setCubeType(cube, carddb);
    await cube.save();

    req.flash('success', 'Cube Added');
    return res.redirect('/cube/overview/' + cube.shortID);
  } catch (err) {
    console.error(err);
    res.status(500).send({
      success: 'false',
      message: err,
    });
  }
});

// GEt view cube Route
router.get('/view/:id', function(req, res) {
  res.redirect('/cube/overview/' + req.params.id);
});

router.post('/format/add/:id', ensureAuth, async (req, res) => {
  try {
    req.body.html = sanitize(req.body.html);

    const cube = await Cube.findOne(build_id_query(req.params.id));

    if (req.body.id == -1) {
      if (!cube.draft_formats) {
        cube.draft_formats = [];
      }
      cube.draft_formats.push({
        title: req.body.title,
        multiples: req.body.multiples == 'true',
        html: req.body.html,
        packs: req.body.format,
      });
    } else {
      cube.draft_formats[req.body.id] = {
        title: req.body.title,
        multiples: req.body.multiples == 'true',
        html: req.body.html,
        packs: req.body.format,
      };
    }
    await Cube.updateOne(
      {
        _id: cube._id,
      },
      cube,
    );

    req.flash('success', 'Custom format successfully added.');
    res.redirect('/cube/playtest/' + req.params.id);
  } catch (err) {
    console.error(err);
    res.status(500).send({
      success: 'false',
      message: err,
    });
  }
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
    Cube.findOne(build_id_query(req.params.id), function(err, cube) {
      if (err || !cube) {
        req.flash('danger', 'Cube not found');
        res.status(404).render('misc/404', {});
      } else {
        cube.date_updated = Date.now();
        cube.updated_string = cube.date_updated.toLocaleString('en-US');
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
              blogpost.date_formatted = blogpost.date.toLocaleString('en-US');
              blogpost.username = user.username;
              blogpost.cubename = cube.name;

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

router.post('/follow/:id', ensureAuth, async (req, res) => {
  try {
    if (!req.user._id) {
      req.flash('danger', 'Not Authorized');
      res.status(404).send({
        success: 'false',
      });
    }

    const user = await User.findById(req.user._id);
    const cube = await Cube.findOne(build_id_query(req.params.id));
    if (!cube) {
      req.flash('danger', 'Cube not found');
      res.status(404).send({
        success: 'false',
      });
    }

    if (!cube.users_following.includes(user._id)) {
      cube.users_following.push(user._id);
    }
    if (!user.followed_cubes.includes(cube._id)) {
      user.followed_cubes.push(cube._id);
    }

    await user.save();
    await cube.save();

    res.status(200).send({
      success: 'true',
    });
  } catch (err) {
    res.status(500).send({
      success: 'false',
    });
    console.error(err);
  }
});

router.post('/unfollow/:id', ensureAuth, async (req, res) => {
  try {
    if (!req.user._id) {
      req.flash('danger', 'Not Authorized');
      res.status(404).send({
        success: 'false',
      });
    }

    const user = await User.findById(req.user._id);
    const cube = await Cube.findOne(build_id_query(req.params.id));
    if (!cube) {
      req.flash('danger', 'Cube not found');
      res.status(404).send({
        success: 'false',
      });
    }

    while (cube.users_following.includes(user._id)) {
      cube.users_following.splice(cube.users_following.indexOf(user._id), 1);
    }
    while (user.followed_cubes.includes(cube._id)) {
      user.followed_cubes.splice(user.followed_cubes.indexOf(cube._id), 1);
    }

    await user.save();
    await cube.save();

    res.status(200).send({
      success: 'true',
    });
  } catch (err) {
    res.status(500).send({
      success: 'false',
    });
    console.error(err);
  }
});

router.post('/feature/:id', ensureAuth, async (req, res) => {
  try {
    if (!req.user._id) {
      req.flash('danger', 'Not Authorized');
      return res.redirect('/cube/overview/' + req.params.id);
    }

    const user = await User.findById(req.user._id);
    if (!util.isAdmin(user)) {
      req.flash('danger', 'Not Authorized');
      return res.redirect('/cube/overview/' + req.params.id);
    }

    const cube = await Cube.findOne(build_id_query(req.params.id));
    if (!cube) {
      req.flash('danger', 'Cube not found');
      return res.redirect('/cube/overview/' + req.params.id);
    }

    cube.isFeatured = true;
    await cube.save();

    req.flash('success', 'Cube updated successfully.');
    return res.redirect('/cube/overview/' + req.params.id);
  } catch (err) {
    req.flash('danger', 'Server Error');
    return res.redirect('/cube/overview/' + req.params.id);
  }
});

router.post('/unfeature/:id', ensureAuth, function(req, res) {
  if (!req.user._id) {
    req.flash('danger', 'Not Authorized');
    res.redirect('/cube/overview/' + req.params.id);
  } else {
    User.findById(req.user._id, function(err, user) {
      if (!util.isAdmin(user)) {
        req.flash('danger', 'Not Authorized');
        res.redirect('/cube/overview/' + req.params.id);
      } else {
        Cube.findOne(build_id_query(req.params.id), function(err, cube) {
          if (err) {
            req.flash('danger', 'Server Error');
            res.redirect('/cube/overview/' + req.params.id);
          } else if (!cube) {
            req.flash('danger', 'Cube not found');
            res.redirect('/cube/overview/' + req.params.id);
          } else {
            cube.isFeatured = false;
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
        });
      }
    });
  }
});

router.get('/overview/:id', async (req, res) => {
  try {
    var split = req.params.id.split(';');
    var cube_id = split[0];
    var currentUser;
    admin = false;
    if (req.user) {
      currentUser = await User.findById(req.user._id);
      admin = util.isAdmin(currentUser);
    }
    const cube = await Cube.findOne(build_id_query(cube_id));
    if (!cube) {
      req.flash('danger', 'Cube not found');
      return res.status(404).render('misc/404', {});
    }

    var pids = [];
    cube.cards.forEach(function(card, index) {
      card.details = carddb.cardFromId(card.cardID);
      if (card.details.tcgplayer_id && !pids.includes(card.details.tcgplayer_id)) {
        pids.push(card.details.tcgplayer_id);
      }
    });

    const price_dict = await GetPrices(pids);
    var sum = 0;
    cube.cards.forEach(function(card, index) {
      if (price_dict[card.details.tcgplayer_id]) {
        sum += price_dict[card.details.tcgplayer_id];
      } else if (price_dict[card.details.tcgplayer_id + '_foil']) {
        sum += price_dict[card.details.tcgplayer_id + '_foil'];
      }
    });
    const user = await User.findById(cube.owner);
    const blogs = await Blog.find({
      cube: cube._id,
    }).sort('date');

    if (blogs) {
      blogs.forEach(function(item, index) {
        if (!item.date_formatted) {
          item.date_formatted = item.date.toLocaleString('en-US');
        }
        if (item.html) {
          item.html = addAutocard(item.html, carddb, cube);
        }
      });
      if (blogs.length > 0) {
        blogs.reverse();
      }
    }
    cube.raw_desc = cube.body;
    if (cube.descriptionhtml) {
      cube.raw_desc = cube.descriptionhtml;
      cube.descriptionhtml = addAutocard(cube.descriptionhtml, carddb, cube);
    }
    return res.render('cube/cube_overview', {
      cube: cube,
      is_following: JSON.stringify(currentUser ? currentUser.followed_cubes.includes(cube._id) : null),
      cube_id: cube_id,
      title: `${abbreviate(cube.name)} - Overview`,
      activeLink: 'overview',
      num_cards: cube.cards.length,
      owner: user ? user.username : 'unknown',
      post: blogs ? blogs[0] : null,
      metadata: generateMeta(
        `Cube Cobra Overview: ${cube.name}`,
        cube.type ? `${cube.card_count} Card ${cube.type} Cube` : `${cube.card_count} Card Cube`,
        cube.image_uri,
        `https://cubecobra.com/cube/overview/${req.params.id}`,
      ),
      loginCallback: '/cube/overview/' + req.params.id,
      editorvalue: cube.raw_desc,
      price: sum.toFixed(2),
      admin: JSON.stringify(admin),
    });
  } catch (err) {
    req.flash('danger', 'Server Error');
    return res.redirect('/cube/overview/' + req.params.id);
  }
});

router.get('/blogsrc/:id', function(req, res) {
  Blog.findById(req.params.id, function(err, blog) {
    if (err || !blog) {
      res.status(400).send({
        success: 'false',
      });
    } else {
      res.status(200).send({
        success: 'true',
        src: blog.html,
        title: blog.title,
        body: blog.body,
      });
    }
  });
});

router.get('/blog/:id', function(req, res) {
  res.redirect('/cube/blog/' + req.params.id + '/0');
});

router.get('/blog/:id/:page', async (req, res) => {
  try {
    var cube_id = req.params.id;
    cube = await Cube.findOne(build_id_query(cube_id));

    if (!cube) {
      req.flash('danger', 'Cube not found');
      return res.status(404).render('misc/404', {});
    }

    user = await User.findById(cube.owner);
    blogs = await Blog.find({
      cube: cube._id,
    });

    if (!user) {
      user = {
        username: 'unknown',
      };
    }

    blogs.forEach(function(item, index) {
      if (!item.date_formatted) {
        item.date_formatted = item.date.toLocaleString('en-US');
      }
      if (item.html) {
        item.html = addAutocard(item.html, carddb, cube);
      }
    });

    var pages = [];
    var blog_page = [];
    if (blogs.length > 0) {
      blogs.reverse();

      var page = parseInt(req.params.page);
      if (!page) {
        page = 0;
      }
      for (var i = 0; i < blogs.length / 10; i++) {
        if (page == i) {
          pages.push({
            url: '/cube/blog/' + cube_id + '/' + i,
            content: i + 1,
            active: true,
          });
        } else {
          pages.push({
            url: '/cube/blog/' + cube_id + '/' + i,
            content: i + 1,
          });
        }
      }
      blog_page = [];
      for (var i = 0; i < 10; i++) {
        if (blogs[i + page * 10]) {
          blog_page.push(blogs[i + page * 10]);
        }
      }
    }

    return res.render('cube/cube_blog', {
      cube: cube,
      cube_id: cube_id,
      owner: user.username,
      activeLink: 'blog',
      title: `${abbreviate(cube.name)} - Blog`,
      posts: blogs.length > 0 ? blog_page : blogs,
      pages: blogs.length > 0 ? pages : null,
      metadata: generateMeta(
        `Cube Cobra Blog: ${cube.name}`,
        cube.type ? `${cube.card_count} Card ${cube.type} Cube` : `${cube.card_count} Card Cube`,
        cube.image_uri,
        `https://cubecobra.com/cube/blog/${req.params.id}`,
      ),
      loginCallback: '/cube/blog/' + req.params.id,
    });
  } catch (err) {
    return res.status(500).send(err);
  }
});

router.get('/rss/:id', function(req, res) {
  var split = req.params.id.split(';');
  var cube_id = split[0];
  Cube.findOne(build_id_query(cube_id), function(err, cube) {
    if (!cube) {
      req.flash('danger', 'Cube not found');
      res.redirect('/404/');
    } else {
      User.findById(cube.owner, function(err, user) {
        Blog.find({
          cube: cube._id,
        })
          .sort('-date')
          .exec(function(err, blogs) {
            if (!user) {
              user = {
                username: 'unknown',
              };
            }

            const feed = new RSS({
              title: cube.name,
              feed_url: `https://cubecobra.com/cube/rss/${cube.id}`,
              site_url: 'https://cubecobra.com',
            });

            blogs.forEach((blog) => {
              let content = blog.html ? blog.html : blog.content;

              if (blog.changelist) {
                const changeSetElement = `<div class="change-set">${blog.changelist}</div>`;
                if (content) {
                  content = content + changeSetElement;
                } else {
                  content = changeSetElement;
                }
              }

              feed.item({
                title: blog.title,
                description: content,
                guid: blog.id,
                date: blog.date,
              });
            });
            res.set('Content-Type', 'text/xml');
            res.status(200).send(feed.xml());
          });
      });
    }
  });
});

router.get('/compare/:id_a/to/:id_b', function(req, res) {
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
            ...carddb.cardFromId(card.cardID),
          };
          if (!card.type_line) {
            card.type_line = card.details.type;
          }
          if (card.details.tcgplayer_id && !pids.includes(card.details.tcgplayer_id)) {
            pids.push(card.details.tcgplayer_id);
          }
        });
        cubeB.cards.forEach(function(card, index) {
          card.details = carddb.cardFromId(card.cardID);
          if (!card.type_line) {
            card.type_line = card.details.type;
          }
          if (card.details.tcgplayer_id && !pids.includes(card.details.tcgplayer_id)) {
            pids.push(card.details.tcgplayer_id);
          }
        });
        GetPrices(pids).then(function(price_dict) {
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

              params = {
                cube: cubeA,
                cubeB: cubeB,
                cube_id: id_a,
                cube_b_id: id_b,
                title: `Comparing ${cubeA.name} to ${cubeB.name}`,
                in_both: JSON.stringify(in_both.map((card) => card.details.name)),
                only_a: JSON.stringify(a_names),
                only_b: JSON.stringify(b_names),
                cube_raw: JSON.stringify(all_cards.map((card, index) => Object.assign(card, { index }))),
                metadata: generateMeta(
                  'Cube Cobra Compare Cubes',
                  `Comparing "${cubeA.name}" To "${cubeB.name}"`,
                  cubeA.image_uri,
                  `https://cubecobra.com/cube/compare/${id_a}/to/${id_b}`,
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
});

let CubeListPage = null;
if (NODE_ENV === 'production') {
  CubeListPage = require('../dist/components/CubeListPage').default;
}
router.get('/list/:id', async function(req, res) {
  try {
    const cube = await Cube.findOne(build_id_query(req.params.id)).setOptions({ lean: true });
    if (!cube) {
      req.flash('danger', 'Cube not found');
      return res.status(404).render('misc/404', {});
    }

    const pids = new Set();
    const cards = [...cube.cards];
    cards.forEach(function(card, index) {
      card.details = {
        ...carddb.cardFromId(card.cardID),
      };
      card.index = index;
      if (!card.type_line) {
        card.type_line = card.details.type;
      }
      if (card.details.tcgplayer_id) {
        pids.add(card.details.tcgplayer_id);
      }
    });

    const price_dict = await GetPrices([...pids]);
    for (const card of cards) {
      if (card.details.tcgplayer_id) {
        if (price_dict[card.details.tcgplayer_id]) {
          card.details.price = price_dict[card.details.tcgplayer_id];
        }
        if (price_dict[card.details.tcgplayer_id + '_foil']) {
          card.details.price_foil = price_dict[card.details.tcgplayer_id + '_foil'];
        }
      }
    }

    const reactProps = {
      canEdit: req.user && req.user.id === cube.owner,
      cubeID: req.params.id,
      defaultTagColors: cube.tag_colors,
      defaultShowTagColors: !req.user || !req.user.hide_tag_colors,
      defaultSorts: cube.default_sorts,
      cards,
      maybe: maybeCards(cube),
    };

    res.render('cube/cube_list', {
      reactHTML:
        NODE_ENV === 'production'
          ? await ReactDOMServer.renderToString(React.createElement(CubeListPage, reactProps))
          : undefined,
      reactProps,
      cube,
      activeLink: 'list',
      title: `${abbreviate(cube.name)} - List`,
      metadata: generateMeta(
        `Cube Cobra List: ${cube.name}`,
        cube.type ? `${cube.card_count} Card ${cube.type} Cube` : `${cube.card_count} Card Cube`,
        cube.image_uri,
        `https://cubecobra.com/cube/list/${req.params.id}`,
      ),
      loginCallback: '/cube/list/' + req.params.id,
    });
  } catch (err) {
    console.error(err);
    res.status(500).send({
      success: 'false',
      message: err,
    });
  }
});

router.get('/playtest/:id', async (req, res) => {
  try {
    const cube = await Cube.findOne(build_id_query(req.params.id));

    if (!cube) {
      req.flash('danger', 'Cube not found');
      return res.status(404).render('misc/404', {});
    }

    const userq = User.findById(cube.owner).exec();
    const decksq = Deck.find({
      cube: cube._id,
    })
      .sort({
        date: -1,
      })
      .limit(10)
      .exec();

    const [user, decks] = await Promise.all([userq, decksq]);

    res.render('cube/cube_playtest', {
      cube: cube,
      cube_id: req.params.id,
      activeLink: 'playtest',
      title: `${abbreviate(cube.name)} - Playtest`,
      owner: user ? user.username : 'Unknown',
      decks: decks,
      cube_raw: JSON.stringify(cube),
      metadata: generateMeta(
        `Cube Cobra Playtest: ${cube.name}`,
        cube.type ? `${cube.card_count} Card ${cube.type} Cube` : `${cube.card_count} Card Cube`,
        cube.image_uri,
        `https://cubecobra.com/cube/playtest/${req.params.id}`,
      ),
      loginCallback: '/cube/playtest/' + req.params.id,
    });
  } catch (err) {
    console.error(err);
    res.status(500).send({
      success: 'false',
      message: err,
    });
  }
});

router.get('/analysis/:id', function(req, res) {
  Cube.findOne(build_id_query(req.params.id), function(err, cube) {
    if (!cube) {
      req.flash('danger', 'Cube not found');
      res.status(404).render('misc/404', {});
    } else {
      User.findById(cube.owner, function(err, user) {
        if (!user) {
          user = {
            username: 'unknown',
          };
        }
        if (err) {
          res.render('cube/cube_analysis', {
            cube: cube,
            cube_id: req.params.id,
            owner: user.username,
            activeLink: 'analysis',
            title: `${abbreviate(cube.name)} - Analysis`,
            TypeByColor: analytics.GetTypeByColorIdentity(cube.cards, carddb),
            MulticoloredCounts: analytics.GetColorIdentityCounts(cube.cards, carddb),
            curve: JSON.stringify(analytics.GetCurve(cube.cards, carddb)),
            GeneratedTokensCounts: analytics.GetTokens(cube.cards, carddb),
            metadata: generateMeta(
              `Cube Cobra Analysis: ${cube.name}`,
              cube.type ? `${cube.card_count} Card ${cube.type} Cube` : `${cube.card_count} Card Cube`,
              cube.image_uri,
              `https://cubecobra.com/cube/analysis/${req.params.id}`,
            ),
            loginCallback: '/cube/analysis/' + req.params.id,
          });
        } else {
          res.render('cube/cube_analysis', {
            cube: cube,
            cube_id: req.params.id,
            owner: user.username,
            activeLink: 'analysis',
            title: `${abbreviate(cube.name)} - Analysis`,
            TypeByColor: analytics.GetTypeByColorIdentity(cube.cards, carddb),
            MulticoloredCounts: analytics.GetColorIdentityCounts(cube.cards, carddb),
            curve: JSON.stringify(analytics.GetCurve(cube.cards, carddb)),
            GeneratedTokensCounts: analytics.GetTokens(cube.cards, carddb),
            metadata: generateMeta(
              `Cube Cobra Analysis: ${cube.name}`,
              cube.type ? `${cube.card_count} Card ${cube.type} Cube` : `${cube.card_count} Card Cube`,
              cube.image_uri,
              `https://cubecobra.com/cube/analysis/${req.params.id}`,
            ),
            loginCallback: '/cube/analysis/' + req.params.id,
          });
        }
      });
    }
  });
});

router.get('/samplepack/:id', function(req, res) {
  res.redirect('/cube/samplepack/' + req.params.id + '/' + Date.now().toString());
});

router.get('/samplepack/:id/:seed', function(req, res) {
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
            CARD_HEIGHT * 3,
          ),
          loginCallback: '/cube/samplepack/' + req.params.id,
        });
      }
    });
  });
});

router.get('/samplepackimage/:id/:seed', function(req, res) {
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
          y: CARD_HEIGHT * Math.floor(index / 5),
        };
      });
      mergeImages(srcArray, {
        width: CARD_WIDTH * 5,
        height: CARD_HEIGHT * 3,
        Canvas,
      }).then(function(image) {
        res.writeHead(200, {
          'Content-Type': 'image/png',
        });
        res.end(Buffer.from(image.replace(/^data:image\/png;base64,/, ''), 'base64'));
      });
    }
  });
});

router.post('/importcubetutor/:id', ensureAuth, async function(req, res) {
  try {
    const cube = await Cube.findOne(build_id_query(req.params.id));
    if (cube.owner != req.user._id) {
      req.flash('danger', 'Not Authorized');
      res.redirect('/cube/list/' + req.params.id);
      return;
    }
    if (isNaN(req.body.cubeid)) {
      req.flash('danger', 'Error: Provided ID is not in correct format.');
      res.redirect('/cube/list/' + req.params.id);
      return;
    }

    const response = await fetch(`https://www.cubetutor.com/viewcube/${req.body.cubeid}`, {
      headers: {
        // This tricks cubetutor into not redirecting us to the unsupported browser page.
        'User-Agent': 'Mozilla/5.0',
      },
    });
    if (!response.ok) {
      req.flash('danger', 'Error accessing CubeTutor.');
      res.redirect('/cube/list' + req.params.id);
      return;
    }
    const text = await response.text();
    const data = cheerio.load(text);

    const tagColors = new Map();
    data('.keyColour').each((i, elem) => {
      const text = elem.firstChild.nodeValue.trim();
      tagColors.set(elem.attribs['class'].split(' ')[1], text);
    });

    const cards = [];
    data('.cardPreview').each((i, elem) => {
      const str = elem.attribs['data-image'].substring(37, elem.attribs['data-image'].length - 4);
      const name = decodeURIComponent(elem.children[0].data).replace('_flip', '');
      const tagColorClasses = elem.attribs['class'].split(' ').filter((c) => tagColors.has(c));
      const tags = tagColorClasses.map((c) => tagColors.get(c));
      cards.push({
        set: str.includes('/') ? str.split('/')[0] : 'unknown',
        name,
        tags,
      });
    });

    const added = [];
    let missing = '';
    let changelog = '';
    for (const card of cards) {
      const potentialIds = carddb.allIds(card);
      if (potentialIds && potentialIds.length > 0) {
        const matchingSet = potentialIds.find((id) => carddb.cardFromId(id).set.toUpperCase() == card.set);
        const nonPromo = potentialIds.find(carddb.notPromoOrDigitalId);
        const selected = matchingSet || nonPromo || potentialIds[0];
        const details = carddb.cardFromId(selected);
        added.push(details);
        util.addCardToCube(cube, details, card.tags);
        changelog += addCardHtml(details);
      } else {
        missing += card.name + '\n';
      }
    }

    const blogpost = new Blog();
    blogpost.title = 'Cubetutor Import - Automatic Post';
    blogpost.html = changelog;
    blogpost.owner = cube.owner;
    blogpost.date = Date.now();
    blogpost.cube = cube._id;
    blogpost.dev = 'false';
    blogpost.date_formatted = blogpost.date.toLocaleString('en-US');
    blogpost.username = cube.owner_name;
    blogpost.cubename = cube.name;

    if (missing.length > 0) {
      res.render('cube/bulk_upload', {
        missing: missing,
        cube_id: req.params.id,
        title: `${abbreviate(cube.name)} - Bulk Upload`,
        added: JSON.stringify(added),
        cube: cube,
        user: {
          id: req.user._id,
          username: req.user.username,
        },
      });
    } else {
      try {
        const blogQ = blogpost.save();
        setCubeType(cube, carddb);
        const cubeQ = cube.save();
        await Promise.all([blogQ, cubeQ]);
        req.flash('success', 'All cards successfully added.');
        res.redirect('/cube/list/' + req.params.id);
      } catch (e) {
        console.error(e);
        req.flash('danger', 'Error adding cards. Please try again.');
        res.redirect('/cube/list/' + req.params.id);
      }
    }
  } catch (err) {
    console.error(err);
    req.flash('danger', 'Error: Unable to import this cube.');
    res.redirect('/cube/list/' + req.params.id);
  }
});

router.post('/uploaddecklist/:id', ensureAuth, async function(req, res) {
  try {
    const cube = await Cube.findOne(build_id_query(req.params.id));
    if (!cube) {
      req.flash('danger', 'Cube not found.');
      return res.redirect('/404');
    }

    if (cube.owner != req.user._id) {
      req.flash('danger', 'Not Authorized');
      return res.redirect('/cube/playtest/' + req.params.id);
    }

    cards = req.body.body.match(/[^\r\n]+/g);
    if (!cards) {
      req.flash('danger', 'No cards detected');
      return res.redirect('/cube/playtest/' + req.params.id);
    }

    //list of cardids
    var added = [];
    for (let i = 0; i < 16; i++) {
      added.push([]);
    }
    let missing = '';

    for (i = 0; i < cards.length; i++) {
      item = cards[i].toLowerCase().trim();
      if (/([0-9]+x )(.*)/.test(item)) {
        var count = parseInt(item.substring(0, item.indexOf('x')));
        for (j = 0; j < count; j++) {
          cards.push(item.substring(item.indexOf('x') + 1));
        }
      } else {
        let selected = undefined;
        //does not have set info
        let normalizedName = cardutil.normalizeName(item);
        let potentialIds = carddb.getIdsFromName(normalizedName);
        if (potentialIds && potentialIds.length > 0) {
          //change this to grab a version that exists in the cube
          for (let i = 0; i < cube.cards.length; i++) {
            if (carddb.cardFromId(cube.cards[i].cardID).name_lower == normalizedName) {
              selected = cube.cards[i];
              selected.details = carddb.cardFromId(cube.cards[i].cardID);
            }
          }
          if (!selected) {
            // TODO: get most reasonable card?
            selected = { cardID: potentialIds[0] };
            selected.details = carddb.cardFromId(potentialIds[0]);
          }
        }
        if (selected) {
          //push into correct column.
          let column = Math.min(7, selected.details.cmc);
          if (!selected.details.type.toLowerCase().includes('creature')) {
            column += 8;
          }
          added[column].push(selected);
        } else {
          missing += item + '\n';
        }
      }
    }

    var deck = new Deck();
    deck.playerdeck = added;
    deck.owner = req.user._id;
    deck.cube = cube._id;
    deck.date = Date.now();
    deck.bots = [];
    deck.playersideboard = [];
    deck.pickOrder = [];
    deck.newformat = true;
    deck.name = req.user.username + "'s decklist upload on " + deck.date.toLocaleString('en-US');

    if (!cube.decks) {
      cube.decks = [];
    }
    cube.decks.push(deck._id);

    if (!cube.numDecks) {
      cube.numDecks = 0;
    }
    cube.numDecks += 1;

    await Promise.all([cube.save(), deck.save()]);

    return res.redirect('/cube/deckbuilder/' + deck._id);
  } catch (err) {
    console.log(err);
    req.flash('danger', err.message);
    res.redirect('/404');
  }
});

router.post('/bulkupload/:id', ensureAuth, function(req, res) {
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

router.post('/bulkuploadfile/:id', ensureAuth, function(req, res) {
  if (!req.files) {
    req.flash('danger', 'Please attach a file');
    res.redirect('/cube/list/' + req.params.id);
  } else {
    items = req.files.document.data.toString('utf8'); // the uploaded file object

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

function bulkuploadCSV(req, res, cards, cube) {
  let added = [];
  let missing = '';
  let changelog = '';
  for (let card_raw of cards) {
    let split = util.CSVtoArray(card_raw);
    let name = split[0];
    let card = {
      name: name,
      cmc: split[1],
      type_line: split[2].replace('-', '—'),
      colors: split[3].split('').filter((c) => [...'WUBRG'].includes(c)),
      set: split[4].toUpperCase(),
      addedTmsp: new Date(),
      collector_number: split[5],
      status: split[6],
      tags: split[7] && split[7].length > 0 ? split[7].split(',') : [],
    };

    let potentialIds = carddb.allIds(card);
    if (potentialIds && potentialIds.length > 0) {
      // First, try to find the correct set.
      let matchingSet = potentialIds.find((id) => carddb.cardFromId(id).set.toUpperCase() == card.set);
      let nonPromo = potentialIds.find(carddb.notPromoOrDigitalId);
      let first = potentialIds[0];
      card.cardID = matchingSet || nonPromo || first;
      cube.cards.push(card);
      changelog += addCardHtml(carddb.cardFromId(card.cardID));
    } else {
      missing += card.name + '\n';
    }
  }

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
        username: req.user.username,
      },
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

function bulkUpload(req, res, list, cube) {
  cards = list.match(/[^\r\n]+/g);
  if (cards) {
    if (cards[0].trim() == 'Name,CMC,Type,Color,Set,Collector Number,Status,Tags') {
      cards.splice(0, 1);
      bulkuploadCSV(req, res, cards, cube);
    } else {
      cube.date_updated = Date.now();
      cube.updated_string = cube.date_updated.toLocaleString('en-US');
      if (!cards) {
        req.flash('danger', 'No Cards Detected');
        res.redirect('/cube/list/' + req.params.id);
      } else {
        var missing = '';
        var added = [];
        var changelog = '';
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
              if (
                carddb.nameToId[
                  item
                    .toLowerCase()
                    .substring(0, item.indexOf('('))
                    .trim()
                ]
              ) {
                let name = item
                  .toLowerCase()
                  .substring(0, item.indexOf('('))
                  .trim();
                let set = item.toLowerCase().substring(item.indexOf('(') + 1, item.indexOf(')'));
                //if we've found a match, and it DOES need to be parsed with cubecobra syntax
                let potentialIds = carddb.nameToId[name];
                selected = potentialIds.find((id) => carddb.cardFromId(id).set.toUpperCase() == set);
              }
            } else {
              //does not have set info
              let potentialIds = carddb.nameToId[item.toLowerCase().trim()];
              if (potentialIds && potentialIds.length > 0) {
                let nonPromo = potentialIds.find(carddb.notPromoOrDigitalId);
                selected = nonPromo || potentialIds[0];
              }
            }
            if (selected) {
              let details = carddb.cardFromId(selected);
              util.addCardToCube(cube, details);
              added.push(details);
              changelog += addCardHtml(details);
            } else {
              missing += item + '\n';
            }
          }
        }

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
              username: req.user.username,
            },
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
    }
  } else {
    req.flash('danger', 'Error adding cards. Invalid format.');
    res.redirect('/cube/list/' + req.params.id);
  }
}

router.get('/download/cubecobra/:id', function(req, res) {
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

router.get('/download/csv/:id', function(req, res) {
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

router.get('/download/forge/:id', function(req, res) {
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

router.get('/download/xmage/:id', function(req, res) {
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

router.get('/download/plaintext/:id', function(req, res) {
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
    var failMessage = '';

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
    draft.initial_state = draft.packs.slice();
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
    var failMessage = '';

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
    draft.initial_state = draft.packs.slice();
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
    req.flash(
      'danger',
      'Requested draft requires ' + totalCards + ' cards, but this cube only has ' + cube.cards.length + ' cards.',
    );
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
    draft.initial_state = draft.packs.slice();
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

router.get('/draft/:id', function(req, res) {
  Draft.findById(req.params.id, function(err, draft) {
    if (!draft) {
      req.flash('danger', 'Draft not found');
      res.status(404).render('misc/404', {});
    } else {
      var pickNumber = draft.pickNumber;
      var packNumber = draft.packNumber;
      var title = 'Pack ' + packNumber + ', Pick ' + pickNumber;
      var packsleft = draft.packs[0].length + 1 - packNumber;
      var subtitle = packsleft + ' unopened packs left.';
      if (packsleft == 1) {
        subtitle = packsleft + ' unopened pack left.';
      }
      names = [];
      //add in details to all cards
      draft.packs.forEach(function(seat, index) {
        seat.forEach(function(pack, index2) {
          pack.forEach(function(card, index3) {
            card.details = carddb.cardFromId(card.cardID);
            if (!names.includes(card.details.name)) {
              names.push(card.details.name);
            }
          });
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
                    cube.type ? `${cube.card_count} Card ${cube.type} Cube` : `${cube.card_count} Card Cube`,
                    cube.image_uri,
                    `https://cubecobra.com/cube/draft/${req.params.id}`,
                  ),
                  loginCallback: '/cube/draft/' + req.params.id,
                  draft_raw: JSON.stringify(draft),
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
                    cube.type ? `${cube.card_count} Card ${cube.type} Cube` : `${cube.card_count} Card Cube`,
                    cube.image_uri,
                    `https://cubecobra.com/cube/draft/${req.params.id}`,
                  ),
                  loginCallback: '/cube/draft/' + req.params.id,
                  draft_raw: JSON.stringify(draft),
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
router.post('/edit/:id', ensureAuth, function(req, res) {
  req.body.blog = sanitize(req.body.blog);
  Cube.findOne(build_id_query(req.params.id), function(err, cube) {
    cube.date_updated = Date.now();
    cube.updated_string = cube.date_updated.toLocaleString('en-US');
    if (err) {
      req.flash('danger', 'Server Error');
      res.redirect('/cube/list/' + req.params.id);
    } else if (!cube) {
      req.flash('danger', 'Cube not found');
      res.redirect('/cube/list/' + req.params.id);
    } else {
      var edits = req.body.body.split(';');
      var removes = new Set();
      var adds = [];
      var changelog = '';
      for (let edit of edits) {
        if (edit.charAt(0) == '+') {
          //add id
          var details = carddb.cardFromId(edit.substring(1));
          if (!details) {
            console.log('Card not found: ' + edit, req);
          } else {
            adds.push(details);
            changelog += addCardHtml(details);
          }
        } else if (edit.charAt(0) == '-') {
          //remove id
          const indexOut = parseInt(edit.substring(1));
          if (isNaN(indexOut) || indexOut < 0 || indexOut >= cube.cards.length) {
            req.flash('danger', 'Bad request format.');
            return res.redirect('/cube/list/' + req.params.id);
          }
          removes.add(indexOut);
          const card = cube.cards[indexOut];
          changelog += removeCardHtml(carddb.cardFromId(card.cardID));
        } else if (edit.charAt(0) == '/') {
          const [indexOutStr, idIn] = edit.substring(1).split('>');
          const detailsIn = carddb.cardFromId(idIn);
          if (!detailsIn) {
            console.log('Card not found: ' + edit, req);
          } else {
            adds.push(detailsIn);
          }

          const indexOut = parseInt(indexOutStr);
          if (isNaN(indexOut) || indexOut < 0 || indexOut >= cube.cards.length) {
            req.flash('danger', 'Bad request format.');
            return res.redirect('/cube/list/' + req.params.id);
          }
          removes.add(indexOut);
          const cardOut = cube.cards[indexOut];
          changelog += replaceCardHtml(carddb.cardFromId(cardOut.cardID), detailsIn);
        } else {
          req.flash('danger', 'Bad request format.');
          return res.redirect('/cube/list/' + req.params.id);
        }
      }
      //need to do numerical sort..
      const removesArray = [...removes];
      removesArray.sort((a, b) => a - b);
      for (let i = removesArray.length - 1; i >= 0; i--) {
        cube.cards.splice(removesArray[i], 1);
      }
      for (const add of adds) {
        util.addCardToCube(cube, add);
        const maybeIndex = cube.maybe.findIndex((card) => card.cardID === add._id);
        if (maybeIndex !== -1) {
          cube.maybe.splice(maybeIndex, 1);
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
      blogpost.date_formatted = blogpost.date.toLocaleString('en-US');
      blogpost.username = cube.owner_name;
      blogpost.cubename = cube.name;

      blogpost.save(function(err) {
        if (err) {
          console.log(err, req);
        } else {
          cube = setCubeType(cube, carddb);
          Cube.updateOne(
            {
              _id: cube._id,
            },
            cube,
            function(err) {
              if (err) {
                console.log(err, req);
              } else {
                req.flash('success', 'Cube Updated');
                res.redirect(`/cube/list/${req.params.id}?updated=true`);
              }
            },
          );
        }
      });
    }
  });
});

//API routes
router.get('/api/cardnames', function(req, res) {
  res.status(200).send({
    success: 'true',
    cardnames: carddb.cardtree,
  });
});

// Get the full card images including image_normal and image_flip
router.get('/api/cardimages', function(req, res) {
  res.status(200).send({
    success: 'true',
    cardimages: carddb.cardimages,
  });
});

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

router.get('/blogpost/:id', async (req, res) => {
  try {
    const post = await Blog.findById(req.params.id);
    const owner = await User.findById(post.owner);

    return res.render('cube/blogpost', {
      post: post,
      owner: owner._id,
      loginCallback: '/blogpost/' + req.params.id,
    });
  } catch (err) {
    res.redirect('/404');
  }
});

router.get('/viewcomment/:id/:position', async (req, res) => {
  try {
    const { position, id } = req.params;

    const post = await Blog.findById(req.params.id);
    const owner = await User.findById(post.owner);

    return res.render('cube/blogpost', {
      post: post,
      owner: owner._id,
      loginCallback: `/blogpost/${id}`,
      position: position.split('-'),
    });
  } catch (err) {
    res.redirect('/404');
  }
});

router.post('/api/editcomment', ensureAuth, async (req, res) => {
  user = await User.findById(req.user._id);
  post = await Blog.findById(req.body.id);

  if (!user) {
    return res.status(403).send({
      success: 'false',
      message: 'Unauthorized',
    });
  }

  if (!post) {
    return res.status(404).send({
      success: 'false',
      message: 'Post not found',
    });
  }

  try {
    req.body.comment.content = sanitize(req.body.comment.content);
    saveEdit(post.comments, req.body.position.slice(0, 22), req.body.comment);
    await post.save();
    res.status(200).send({
      success: 'true',
    });
  } catch (err) {
    console.log(err);
    return res.status(500).send({
      success: 'false',
      message: err,
    });
  }
});

router.post('/api/editoverview', ensureAuth, async (req, res) => {
  try {
    const updatedCube = req.body;

    cube = await Cube.findById(updatedCube._id);
    if (!cube) {
      return res.status(404).send({
        success: 'false',
        message: 'Cube Not Found',
      });
    }

    user = await User.findById(req.user._id);
    if (!user || user._id != cube.owner) {
      return res.status(403).send({
        success: 'false',
        message: 'Unauthorized',
      });
    }

    if (updatedCube.name.length < 5 || updatedCube.name.length > 100) {
      res.statusMessage = 'Cube name should be at least 5 characters long, and shorter than 100 characters.';
      return res.status(400).send({
        success: 'false',
      });
    }

    if (util.has_profanity(updatedCube.name)) {
      res.statusMessage = 'Cube name should not use profanity.';
      return res.status(400).send({
        success: 'false',
      });
    }

    if (updatedCube.urlAlias && updatedCube.urlAlias.length > 0 && updatedCube.urlAlias != cube.urlAlias) {
      let urlAliasMaxLength = 100;

      if (!updatedCube.urlAlias.match(/^[0-9a-zA-Z_]*$/)) {
        res.statusMessage = 'Custom URL must contain only alphanumeric characters or underscores.';
        return res.status(400).send({
          success: 'false',
        });
      }

      if (updatedCube.urlAlias.length > urlAliasMaxLength) {
        res.statusMessage = 'Custom URL may not be longer than ' + urlAliasMaxLength + ' characters.';
        return res.status(400).send({
          success: 'false',
        });
      }

      if (util.has_profanity(updatedCube.urlAlias)) {
        res.statusMessage = 'Custom URL may not contain profanity.';
        return res.status(400).send({
          success: 'false',
        });
      }

      const taken = await Cube.findOne(build_id_query(updatedCube.urlAlias));

      if (taken) {
        res.statusMessage = 'Custom URL already taken.';
        return res.status(400).send({
          success: 'false',
        });
      }

      cube.urlAlias = updatedCube.urlAlias;
    } else if (!updatedCube.urlAlias || updatedCube.urlAlias == '') {
      cube.urlAlias = null;
    }

    cube.name = updatedCube.name;
    cube.isListed = updatedCube.isListed;
    cube.privatePrices = updatedCube.privatePrices;
    cube.overrideCategory = updatedCube.overrideCategory;

    const image = carddb.imagedict[updatedCube.image_name.toLowerCase()];

    if (image) {
      cube.image_uri = updatedCube.image_uri;
      cube.image_artist = updatedCube.image_artist;
      cube.image_name = updatedCube.image_name;
    }

    cube.descriptionhtml = sanitize(updatedCube.descriptionhtml);
    cube.date_updated = Date.now();
    cube.updated_string = cube.date_updated.toLocaleString('en-US');
    cube = setCubeType(cube, carddb);

    //cube category override
    if (cube.overrideCategory) {
      const categories = ['Vintage', 'Legacy+', 'Legacy', 'Modern', 'Pioneer', 'Standard', 'Set'];
      const prefixes = ['Powered', 'Unpowered', 'Pauper', 'Peasant', 'Budget', 'Silver-bordered'];

      if (!categories.includes(updatedCube.categoryOverride)) {
        res.statusMessage = 'Not a valid category override.';
        return res.status(400).send({
          success: 'false',
        });
      }

      for (var i = 0; i < updatedCube.categoryPrefixes.length; i++) {
        if (!prefixes.includes(updatedCube.categoryPrefixes[i])) {
          res.statusMessage = 'Not a valid category prefix.';
          return res.status(400).send({
            success: 'false',
          });
        }
      }

      cube.categoryOverride = updatedCube.categoryOverride;
      cube.categoryPrefixes = updatedCube.categoryPrefixes;
    }

    //cube tags
    cube.tags = updatedCube.tags.map((tag) => tag.text);

    await cube.save();
    return res.status(200).send({ success: 'true' });
  } catch (err) {
    res.statusMessage = err;
    console.log(err);
    return res.status(500).send({
      success: 'false',
      message: err,
    });
  }
});

router.post('/api/postdeckcomment', ensureAuth, async (req, res) => {
  const userq = User.findById(req.user._id);
  const deckq = Deck.findById(req.body.id);

  const [user, deck] = await Promise.all([userq, deckq]);

  if (!user) {
    return res.status(403).send({
      success: 'false',
      message: 'Unauthorized',
    });
  }

  if (!deck) {
    return res.status(404).send({
      success: 'false',
      message: 'Deck not found',
    });
  }

  try {
    //slice limits the recursive depth
    var comment = insertComment(deck.comments, req.body.position.slice(0, 22), {
      owner: user._id,
      ownerName: user.username,
      ownerImage: '',
      content: sanitize(req.body.content),
      //the -1000 is to prevent weird time display error
      timePosted: Date.now() - 1000,
      comments: [],
    });

    //give notification to owner
    if (req.body.position.length == 0) {
      //owner is blog deck owner
      const owner = await User.findById(deck.owner);
      await util.addNotification(
        owner,
        user,
        '/cube/deck/' + deck._id,
        user.username + ' added a comment to ' + deck.name,
      );
    } else {
      //need to find owner from comment tree
      const owner = await User.findById(getOwnerFromComment(deck.comments, req.body.position));
      var positionText = '';
      req.body.position.forEach(function(pos, index) {
        positionText += pos + '-';
      });
      positionText += comment.index;
      await util.addNotification(
        owner,
        user,
        '/cube/deck/' + deck._id,
        user.username + ' replied to your comment on ' + deck.name,
      );
    }

    await deck.save();
    res.status(200).send({
      success: 'true',
      comment: comment,
    });
  } catch (err) {
    console.log(err);
    return res.status(500).send({
      success: 'false',
      message: err,
    });
  }
});

router.post('/api/postcomment', ensureAuth, async (req, res) => {
  const userq = User.findById(req.user._id);
  const postq = Blog.findById(req.body.id);

  const [user, post] = await Promise.all([userq, postq]);

  if (!user) {
    return res.status(403).send({
      success: 'false',
      message: 'Unauthorized',
    });
  }

  if (!post) {
    return res.status(404).send({
      success: 'false',
      message: 'Post not found',
    });
  }

  try {
    //slice limits the recursive depth
    var comment = insertComment(post.comments, req.body.position.slice(0, 22), {
      owner: user._id,
      ownerName: user.username,
      ownerImage: '',
      content: sanitize(req.body.content),
      //the -1000 is to prevent weird time display error
      timePosted: Date.now() - 1000,
      comments: [],
    });

    //give notification to owner
    if (req.body.position.length == 0) {
      //owner is blog post owner
      const owner = await User.findById(post.owner);
      await util.addNotification(
        owner,
        user,
        '/cube/blogpost/' + post._id,
        user.username + ' added a comment to ' + post.title,
      );
    } else {
      //need to find owner from comment tree
      const owner = await User.findById(getOwnerFromComment(post.comments, req.body.position));
      var positionText = '';
      req.body.position.forEach(function(pos, index) {
        positionText += pos + '-';
      });
      positionText += comment.index;
      await util.addNotification(
        owner,
        user,
        '/cube/viewcomment/' + post._id + '/' + positionText,
        user.username + ' replied to your comment on ' + post.title,
      );
    }

    await post.save();
    res.status(200).send({
      success: 'true',
      comment: comment,
    });
  } catch (err) {
    console.log(err);
    return res.status(500).send({
      success: 'false',
      message: err,
    });
  }
});

router.get('/api/imagedict', function(req, res) {
  res.status(200).send({
    success: 'true',
    dict: carddb.imagedict,
  });
});

router.get('/api/fullnames', function(req, res) {
  res.status(200).send({
    success: 'true',
    cardnames: carddb.full_names,
  });
});

router.get('/api/cubecardnames/:id', function(req, res) {
  Cube.findOne(build_id_query(req.params.id), function(err, cube) {
    var cardnames = [];
    cube.cards.forEach(function(item, index) {
      util.binaryInsert(carddb.cardFromId(item.cardID).name, cardnames);
    });
    var result = util.turnToTree(cardnames);
    res.status(200).send({
      success: 'true',
      cardnames: result,
    });
  });
});

router.post('/api/saveshowtagcolors', function(req, res) {
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

router.post('/api/savetagcolors/:id', function(req, res) {
  Cube.findOne(build_id_query(req.params.id), function(err, cube) {
    if (!cube) {
      res.status(404).send({
        success: 'false',
      });
      return;
    }

    cube.tag_colors = req.body;

    cube.save(function(err) {
      if (err) console.log(err);
      res.status(200).send({
        success: 'true',
      });
    });
  });
});

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

router.get('/api/cubetagcolors/:id', function(req, res) {
  Cube.findOne(build_id_query(req.params.id), function(err, cube) {
    let tag_colors = build_tag_colors(cube);
    let tags = tag_colors.map((item) => item.tag);

    Cube.findOne(build_id_query(req.query.b_id), function(err, cubeB) {
      if (cubeB) {
        let b_tag_colors = build_tag_colors(cubeB);
        for (let b_tag of b_tag_colors) {
          if (!tags.includes(b_tag.tag)) {
            tag_colors.push(b_tag);
          }
        }
      }

      let show_tag_colors = req.user ? !req.user.hide_tag_colors : true;

      res.status(200).send({
        success: 'true',
        tag_colors,
        show_tag_colors,
      });
    });
  });
});

router.get('/api/getcardfromcube/:id', function(req, res) {
  var split = req.params.id.split(';');
  var cube = split[0];
  let cardname = split[1];
  cardname = cardutil.decodeName(cardname);
  cardname = cardutil.normalizeName(cardname);

  Cube.findOne(build_id_query(cube), function(err, cube) {
    var found = false;
    cube.cards.forEach(function(card, index) {
      if (!found && carddb.cardFromId(card.cardID).name_lower == cardname) {
        card.details = carddb.cardFromId(card.cardID);
        res.status(200).send({
          success: 'true',
          card: card.details,
        });
        found = true;
      }
    });
    if (!found) {
      res.status(200).send({
        success: 'true',
      });
    }
  });
});

router.get('/api/cubelist/:id', function(req, res) {
  Cube.findOne(build_id_query(req.params.id), function(err, cube) {
    if (err) {
      console.error(err);
      res.sendStatus(500);
    } else if (!cube) {
      res.sendStatus(404);
    } else {
      const names = cube.cards.map((card) => carddb.cardFromId(card.cardID).name);
      res.contentType('text/plain');
      res.status(200).send(names.join('\n'));
    }
  });
});

router.post('/editdeck/:id', async (req, res) => {
  try {
    const deck = await Deck.findById(req.params.id);

    if (!deck) {
      req.flash('danger', 'Deck not found');
      return res.status(404).render('misc/404', {});
    }
    if ((deck.owner && !req.user) || (deck.owner && deck.owner != req.user._id)) {
      req.flash('danger', 'Unauthorized');
      return res.status(404).render('misc/404', {});
    }

    var newdeck = JSON.parse(req.body.draftraw);
    var name = JSON.parse(req.body.name);
    var description = sanitize(JSON.parse(req.body.description));

    deck.cards = newdeck.cards;
    deck.playerdeck = newdeck.playerdeck;
    deck.playersideboard = newdeck.playersideboard;
    deck.cols = newdeck.cols;
    deck.name = name;
    deck.description = description;

    await deck.save();

    req.flash('success', 'Deck saved succesfully');
    res.redirect('/cube/deck/' + deck._id);
  } catch (err) {
    console.error(err);
    res.status(500).send({
      success: 'false',
      message: err,
    });
  }
});

router.post('/submitdeck/:id', async (req, res) => {
  try {
    //req.body contains draft0
    var draftid = req.body.body;
    const draft = await Draft.findById(draftid);

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
    deck.pickOrder = draft.pickOrder;
    deck.draft = draft._id;

    cube = await Cube.findOne(build_id_query(draft.cube));

    if (!cube.decks) {
      cube.decks = [];
    }

    cube.decks.push(deck._id);
    if (!cube.numDecks) {
      cube.numDecks = 0;
    }

    cube.numDecks += 1;
    const userq = User.findById(deck.owner);
    const cubeOwnerq = User.findById(cube.owner);

    var [user, cubeOwner] = await Promise.all([userq, cubeOwnerq]);

    var owner = user ? user.username : 'Anonymous';
    deck.name = 'Draft of ' + cube.name;
    deck.username = owner;
    deck.cubename = cube.name;
    cube.decks.push(deck._id);

    if (!user) {
      user = {
        _id: '',
        username: 'Anonymous',
      };
    }

    await util.addNotification(
      cubeOwner,
      user,
      '/cube/deck/' + deck._id,
      user.username + ' drafted your cube: ' + cube.name,
    );

    await Promise.all([cube.save(), deck.save(), cubeOwner.save()]);

    return res.redirect('/cube/deckbuilder/' + deck._id);
  } catch (err) {
    console.error(err);
    res.status(500).send({
      success: 'false',
      message: err,
    });
  }
});

router.get('/decks/:cubeid/:page', async (req, res) => {
  try {
    var cubeid = req.params.cubeid;
    var page = req.params.page;
    var pagesize = 30;

    const cube = await Cube.findOne(build_id_query(cubeid));

    if (!cube) {
      req.flash('danger', 'Cube not found');
      return res.status(404).render('misc/404', {});
    }

    const decksq = Deck.find({
      cube: cube._id,
    })
      .sort({
        date: -1,
      })
      .skip(pagesize * page)
      .limit(pagesize)
      .exec();
    const numDecksq = Deck.countDocuments({
      cube: cube._id,
    }).exec();
    const ownerq = User.findById(cube.owner).exec();

    const [decks, numDecks, owner] = await Promise.all([decksq, numDecksq, ownerq]);

    var owner_name = owner ? owner.username : 'unknown';

    var pages = [];
    for (i = 0; i < numDecks / pagesize; i++) {
      if (page == i) {
        pages.push({
          url: '/cube/decks/' + cubeid + '/' + i,
          content: i + 1,
          active: true,
        });
      } else {
        pages.push({
          url: '/cube/decks/' + cubeid + '/' + i,
          content: i + 1,
        });
      }
    }

    res.render('cube/cube_decks', {
      cube: cube,
      cube_id: cubeid,
      owner: owner_name,
      activeLink: 'playtest',
      title: `${abbreviate(cube.name)} - Draft Decks`,
      decks: decks,
      pages: pages,
      metadata: generateMeta(
        `Cube Cobra Decks: ${cube.name}`,
        cube.type ? `${cube.card_count} Card ${cube.type} Cube` : `${cube.card_count} Card Cube`,
        cube.image_uri,
        `https://cubecobra.com/user/decks/${req.params.id}`,
      ),
      loginCallback: '/user/decks/' + cubeid,
    });
  } catch (err) {
    console.error(err);
    res.status(500).send({
      success: 'false',
      message: err,
    });
  }
});

router.get('/decks/:id', async (req, res) => {
  res.redirect('/cube/decks/' + req.params.id + '/0');
});

router.get('/rebuild/:id', ensureAuth, async (req, res) => {
  try {
    const base = await Deck.findById(req.params.id);
    if (!base) {
      req.flash('danger', 'Deck not found');
      return res.status(404).render('misc/404', {});
    }

    var deck = new Deck();
    deck.playerdeck = base.playerdeck;
    deck.cards = base.cards;
    deck.owner = req.user._id;
    deck.cube = base.cube;
    deck.date = Date.now();
    deck.bots = base.bots;
    deck.playersideboard = base.playersideboard;

    cube = await Cube.findOne(build_id_query(deck.cube));

    if (!cube.decks) {
      cube.decks = [];
    }

    cube.decks.push(deck._id);
    if (!cube.numDecks) {
      cube.numDecks = 0;
    }

    cube.numDecks += 1;
    const userq = User.findById(deck.owner);
    const baseuserq = User.findById(base.owner);
    const cubeOwnerq = User.findById(cube.owner);

    const [user, cubeOwner, baseUser] = await Promise.all([userq, cubeOwnerq, baseuserq]);

    var owner = user ? user.username : 'Anonymous';
    deck.name = owner + "'s rebuild from " + cube.name + ' on ' + deck.date.toLocaleString('en-US');
    deck.username = owner;
    deck.cubename = cube.name;
    cube.decks.push(deck._id);

    if (cubeOwner._id != user.id) {
      await util.addNotification(
        cubeOwner,
        user,
        '/cube/deck/' + deck._id,
        user.username + ' rebuilt a deck from your cube: ' + cube.name,
      );
    }
    if (baseUser && baseUser._id != user.id) {
      await util.addNotification(
        baseUser,
        user,
        '/cube/deck/' + deck._id,
        user.username + ' rebuilt your deck from cube: ' + cube.name,
      );
    }

    await Promise.all([cube.save(), deck.save()]);

    return res.redirect('/cube/deckbuilder/' + deck._id);
  } catch (err) {
    console.log(err);

    req.flash('danger', 'This deck is not able to be cloned and rebuilt.');
    res.redirect('/cube/deck/' + req.params.id);
  }
});

router.get('/redraft/:id', async (req, res) => {
  try {
    const base = await Deck.findById(req.params.id);

    if (!base) {
      req.flash('danger', 'Deck not found');
      return res.status(404).render('misc/404', {});
    }

    const srcDraft = await Draft.findById(base.draft);

    if (!srcDraft) {
      req.flash('danger', 'This deck is not able to be redrafted.');
      res.redirect('/cube/deck/' + req.params.id);
    }

    var draft = new Draft();
    draft.bots = base.bots.slice();
    draft.cube = base.cube.slice();
    draft.packNumber = 1;
    draft.pickNumber = 1;

    draft.initial_state = srcDraft.initial_state.slice();
    draft.packs = srcDraft.initial_state.slice();
    draft.picks = [];

    for (i = 0; i < draft.packs.length; i++) {
      draft.picks.push([]);
    }

    await draft.save();
    res.redirect('/cube/draft/' + draft._id);
  } catch (err) {
    console.log(err);

    req.flash('danger', 'This deck is not able to be redrafted.');
    res.redirect('/cube/deck/' + req.params.id);
  }
});

router.get('/deckbuilder/:id', async (req, res) => {
  try {
    const deck = await Deck.findById(req.params.id);
    if (!deck) {
      req.flash('danger', 'Deck not found');
      return res.status(404).render('misc/404', {});
    }

    const deckOwner = await User.findById(deck.owner);

    if (!req.user || deckOwner._id != req.user.id) {
      req.flash('danger', 'Only logged in deck owners can build decks.');
      return res.redirect('/cube/deck/' + req.params.id);
    }

    //add images to cards
    deck.cards.forEach(function(card, index) {
      if (Array.isArray(card)) {
        card.forEach(function(item, index2) {
          if (item) {
            item = {
              cardID: item,
            };
            item.details = carddb.cardFromId(item.cardID);
          }
        });
      } else {
        card.details = carddb.cardFromId(card);
      }
    });

    const cube = await Cube.findOne(build_id_query(deck.cube));

    if (!cube) {
      req.flash('danger', 'Cube not found');
      return res.status(404).render('misc/404', {});
    }

    return res.render('cube/cube_deckbuilder', {
      cube: cube,
      cube_id: get_cube_id(cube),
      owner: deckOwner ? deckOwner.username : 'Unknown',
      ownerid: deckOwner ? deckOwner._id : '',
      activeLink: 'playtest',
      title: `${abbreviate(cube.name)} - Deckbuilder`,
      metadata: generateMeta(
        `Cube Cobra Draft: ${cube.name}`,
        cube.type ? `${cube.card_count} Card ${cube.type} Cube` : `${cube.card_count} Card Cube`,
        cube.image_uri,
        `https://cubecobra.com/cube/draft/${req.params.id}`,
      ),
      loginCallback: '/cube/draft/' + req.params.id,
      deck_raw: JSON.stringify(deck),
      basics_raw: JSON.stringify(getBasics(carddb)),
      deckid: deck._id,
    });
  } catch (err) {
    console.log(err);
    req.flash('danger', err.message);
    res.redirect('/404');
  }
});

router.get('/deck/:id', async (req, res) => {
  try {
    const deck = await Deck.findById(req.params.id);

    if (!deck) {
      req.flash('danger', 'Deck not found');
      return res.status(404).render('misc/404', {});
    }

    const cube = await Cube.findOne(build_id_query(deck.cube));
    if (!cube) {
      req.flash('danger', 'Cube not found');
      return res.status(404).render('misc/404', {});
    }

    let owner = {
      name: 'Unknown',
      id: null,
      profileUrl: null,
    };

    let drafter = {
      name: 'Anonymous',
      id: null,
      profileUrl: null,
    };

    const deckUserq = User.findById(deck.owner);
    const cubeUserq = User.findById(cube.owner);

    const [deckUser, cubeUser] = await Promise.all([deckUserq, cubeUserq]);

    if (deckUser) {
      drafter.name = deckUser.username;
      drafter.id = deckUser._id;
      drafter.profileUrl = `/user/view/${deckUser._id}`;
    }

    if (cubeUser) {
      owner.name = cubeUser.username;
      owner.id = cubeUser._id;
      owner.profileUrl = `/user/view/${cubeUser._id}`;
    }

    var player_deck = [];
    var bot_decks = [];
    if (deck.newformat == false && typeof deck.cards[deck.cards.length - 1][0] === 'object') {
      //old format
      deck.cards[0].forEach(function(card, index) {
        card.details = carddb.cardFromId(card);
        player_deck.push(card.details);
      });
      for (i = 1; i < deck.cards.length; i++) {
        var bot_deck = [];
        deck.cards[i].forEach(function(card, index) {
          if (!card[0].cardID && !carddb.cardFromId(card[0].cardID).error) {
            console.log(
              req.params.id + ': Could not find seat ' + (bot_decks.length + 1) + ', pick ' + (bot_deck.length + 1),
            );
          } else {
            var details = carddb.cardFromId(card[0].cardID);
            bot_deck.push(details);
          }
        });
        bot_decks.push(bot_deck);
      }
      var bot_names = [];
      for (i = 0; i < deck.bots.length; i++) {
        bot_names.push('Seat ' + (i + 2) + ': ' + deck.bots[i][0] + ', ' + deck.bots[i][1]);
      }
      return res.render('cube/cube_deck', {
        oldformat: true,
        deckid: deck._id,
        cube: cube,
        cube_id: get_cube_id(cube),
        owner: owner,
        activeLink: 'playtest',
        title: `${abbreviate(cube.name)} - ${drafter.name}'s deck`,
        drafter: drafter,
        cards: player_deck,
        bot_decks: bot_decks,
        bots: bot_names,
        name: deck.name,
        description: deck.description,
        owner: deck.owner,
        comments: deck.comments,
        metadata: generateMeta(
          `Cube Cobra Deck: ${cube.name}`,
          cube.type ? `${cube.card_count} Card ${cube.type} Cube` : `${cube.card_count} Card Cube`,
          cube.image_uri,
          `https://cubecobra.com/cube/deck/${req.params.id}`,
        ),
        loginCallback: '/cube/deck/' + req.params.id,
      });
    } else {
      //new format
      for (i = 0; i < deck.cards.length; i++) {
        var bot_deck = [];
        deck.cards[i].forEach(function(cardid, index) {
          if (carddb.cardFromId(cardid).error) {
            console.log(
              req.params.id + ': Could not find seat ' + (bot_decks.length + 1) + ', pick ' + (bot_deck.length + 1),
            );
          } else {
            var details = carddb.cardFromId(cardid);
            bot_deck.push(details);
          }
        });
        bot_decks.push(bot_deck);
      }
      var bot_names = [];
      for (i = 0; i < deck.bots.length; i++) {
        bot_names.push('Seat ' + (i + 2) + ': ' + deck.bots[i][0] + ', ' + deck.bots[i][1]);
      }
      return res.render('cube/cube_deck', {
        oldformat: false,
        deckid: deck._id,
        cube: cube,
        cube_id: get_cube_id(cube),
        owner: owner,
        activeLink: 'playtest',
        title: `${abbreviate(cube.name)} - ${drafter.name}'s deck`,
        drafter: drafter,
        deck: JSON.stringify(deck.playerdeck),
        sideboard: JSON.stringify(deck.playersideboard),
        bot_decks: bot_decks,
        bots: bot_names,
        name: deck.name,
        description: deck.description,
        owner: deck.owner,
        comments: deck.comments,
        metadata: generateMeta(
          `Cube Cobra Deck: ${cube.name}`,
          cube.type ? `${cube.card_count} Card ${cube.type} Cube` : `${cube.card_count} Card Cube`,
          cube.image_uri,
          `https://cubecobra.com/cube/deck/${req.params.id}`,
        ),
        loginCallback: '/cube/deck/' + req.params.id,
      });
    }
  } catch (err) {
    req.flash('danger', err);
    res.redirect('/404');
  }
});

router.get('/api/getcard/:name', function(req, res) {
  let potentialIds = carddb.getIdsFromName(cardutil.decodeName(req.params.name));
  if (potentialIds && potentialIds.length > 0) {
    let nonPromo = potentialIds.find(carddb.notPromoOrDigitalId);
    let selected = nonPromo || potentialIds[0];
    let card = carddb.cardFromId(selected);
    res.status(200).send({
      success: 'true',
      card: card,
    });
  } else {
    res.status(200).send({
      success: 'false',
    });
  }
});

router.get('/api/getimage/:name', function(req, res) {
  var reasonable = carddb.getMostReasonable(cardutil.decodeName(req.params.name));
  var img = carddb.imagedict[reasonable.name];
  if (!img) {
    res.status(200).send({
      success: 'false',
    });
  } else {
    res.status(200).send({
      success: 'true',
      img: img,
    });
  }
});

router.get('/api/getcardfromid/:id', function(req, res) {
  var card = carddb.cardFromId(req.params.id);
  //need to get the price of the card with the new version in here
  var tcg = [];
  if (card.tcgplayer_id) {
    tcg.push(card.tcgplayer_id);
  }
  GetPrices(tcg).then(function(price_dict) {
    if (card.error) {
      res.status(200).send({
        success: 'false',
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
        card: card,
      });
    }
  });
});

router.get('/api/getversions/:id', function(req, res) {
  cards = [];
  tcg = [];
  carddb.allIds(carddb.cardFromId(req.params.id)).forEach(function(id, index) {
    const card = carddb.cardFromId(id);
    cards.push(card);
    if (card.tcgplayer_id) {
      tcg.push(card.tcgplayer_id);
    }
  });
  GetPrices(tcg).then(function(price_dict) {
    cards.forEach(function(card, index) {
      if (card.tcgplayer_id) {
        const card_price_data = price_dict[card.tcgplayer_id];
        if (card_price_data) {
          card.price = card_price_data;
        }
        const card_foil_price_data = price_dict[card.tcgplayer_id + '_foil'];
        if (card_foil_price_data) {
          card.price_foil = card_foil_price_data;
        }
      }
    });
    res.status(200).send({
      success: 'true',
      cards: cards,
    });
  });
});

router.post('/api/getversions', function(req, res) {
  cards = {};

  req.body.forEach(function(cardid, index) {
    cards[cardid] = [];
    carddb.nameToId[
      carddb
        .cardFromId(cardid)
        .name.toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
    ].forEach(function(id, index) {
      const card = carddb.cardFromId(id);
      cards[cardid].push({
        id: id,
        version: card.full_name
          .toUpperCase()
          .substring(carddb.cardFromId(id).full_name.indexOf('[') + 1, card.full_name.indexOf(']')),
        img: card.image_normal,
      });
    });
  });
  res.status(200).send({
    success: 'true',
    dict: cards,
  });
});

router.post('/api/updatecard/:id', ensureAuth, function(req, res) {
  const { src, updated } = req.body;
  if (
    !src ||
    (src && typeof src.index !== 'number') ||
    (updated.cardID && typeof updated.cardID !== 'string') ||
    (updated.cmc && !['number', 'string'].includes(typeof updated.cmc)) ||
    (updated.status && typeof updated.status !== 'string') ||
    (updated.type_line && typeof updated.type_line !== 'string') ||
    (updated.colors && !Array.isArray(updated.colors)) ||
    (updated.tags && !Array.isArray(updated.tags)) ||
    (updated.finish && typeof updated.finish !== 'string')
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
              message: 'Error saving cube',
            });
          } else {
            res.status(200).send({
              success: 'true',
            });
          }
        });
      }
    }
  });
});

router.post('/api/updatecards/:id', ensureAuth, function(req, res) {
  const { selected, updated } = req.body;
  if (
    (updated.cmc && typeof updated.cmc !== 'number') ||
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
      const allUpdates = {
        $set: {},
      };
      for (const index of selected) {
        if (typeof index !== 'number' || !cube.cards[index]) {
          continue;
        }
        if (updated.status) {
          allUpdates.$set[`cards.${index}.status`] = updated.status;
        }
        if (updated.cmc) {
          allUpdates.$set[`cards.${index}.cmc`] = updated.cmc;
        }
        if (updated.type_line) {
          allUpdates.$set[`cards.${index}.type_line`] = updated.type_line;
        }
        if (updated.colors) {
          allUpdates.$set[`cards.${index}.colors`] = updated.colors.filter((color) => [...'WUBRG'].includes(color));
        }
        if (updated.colorC) {
          allUpdates.$set[`cards.${index}.colors`] = [];
        }
        if (updated.finish) {
          allUpdates.$set[`cards.${index}.finish`] = updated.finish;
        }
        if (updated.tags) {
          if (updated.addTags) {
            if (!allUpdates.$addToSet) {
              allUpdates.$addToSet = {};
            }
            allUpdates.$addToSet[`cards.${index}.tags`] = updated.tags;
          }
          if (updated.deleteTags) {
            if (!allUpdates.$pullAll) {
              allUpdates.$pullAll = {};
            }
            allUpdates.$pullAll[`cards.${index}.tags`] = updated.tags;
          }
        }
      }
      cube.updateOne(allUpdates, function(err) {
        if (err) {
          console.error(err);
          res.status(500).send({
            success: 'false',
            message: 'Error saving cube',
          });
        } else {
          res.status(200).send({
            success: 'true',
          });
        }
      });
    }
  });
});

function maybeCards(cube) {
  const maybe = (cube.maybe || []).filter((card) => card.cardID);
  return maybe.map((card) => ({ ...card, details: carddb.cardFromId(card.cardID) }));
}

router.get(
  '/api/maybe/:id',
  ensureAuth,
  util.wrapAsyncApi(async function(req, res) {
    const cube = await Cube.findOne(build_id_query(req.params.id));
    if (!cube) {
      return res.status(404).send({
        success: 'false',
        message: 'Cube not found.',
      });
    }

    return res.status(200).send({
      success: 'true',
      maybe: maybeCards(cube),
    });
  }),
);

router.post(
  '/api/maybe/:id',
  ensureAuth,
  util.wrapAsyncApi(async function(req, res) {
    const cube = await Cube.findOne(build_id_query(req.params.id));
    if (!cube) {
      return res.status(404).send({
        success: 'false',
        message: 'Cube not found.',
      });
    } else if (!req.user._id.equals(cube.owner)) {
      return res.status(403).send({
        success: 'false',
        message: 'Maybeboard can only be updated by cube owner.',
      });
    }

    const maybe = [...(cube.maybe || [])];

    const removeIndices = Array.isArray(req.body.remove) ? req.body.remove : [];
    const withRemoved = maybe.filter((card, index) => !removeIndices.includes(index));

    const addCards = Array.isArray(req.body.add) ? req.body.add : [];
    const addCardsNoDetails = addCards.map(({ details, ...card }) => ({ ...util.newCard(details), ...card }));
    const withAdded = [...withRemoved, ...addCardsNoDetails];

    cube.maybe = withAdded;
    await cube.save();

    return res.status(200).send({
      success: 'true',
    });
  }),
);

router.delete('/remove/:id', ensureAuth, function(req, res) {
  if (!req.user._id) {
    req.flash('danger', 'Not Authorized');
    res.redirect('/cube/' + req.params.id);
  }

  let query = build_id_query(req.params.id);

  Cube.findOne(query, function(err, cube) {
    if (err || !cube || cube.owner != req.user._id) {
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

router.delete('/blog/remove/:id', ensureAuth, function(req, res) {
  if (!req.user._id) {
    req.flash('danger', 'Not Authorized');
    res.redirect('/' + req.params.id);
  }

  let query = {
    _id: req.params.id,
  };

  Blog.findById(req.params.id, function(err, blog) {
    if (err || blog.owner != req.user._id) {
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

router.delete('/format/remove/:id', ensureAuth, function(req, res) {
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

      Cube.updateOne(
        {
          _id: cube._id,
        },
        cube,
        function(err) {
          if (err) {
            console.log(err, req);
            res.sendStatus(500);
          } else {
            res.sendStatus(200);
          }
        },
      );
    }
  });
});

router.post('/api/savesorts/:id', ensureAuth, function(req, res) {
  Cube.findOne(build_id_query(req.params.id), function(err, cube) {
    if (cube.owner === String(req.user._id)) {
      var found = false;
      cube.default_sorts = req.body.sorts;
      cube.save(function(err) {
        if (err) {
          res.status(500).send({
            success: 'false',
            message: 'Error saving cube',
          });
        } else {
          res.status(200).send({
            success: 'true',
          });
        }
      });
    }
  });
});

const ELO_BASE = 400;
const ELO_RANGE = 1600;
const ELO_SPEED = 1000;
router.post('/api/draftpickcard/:id', async function(req, res) {
  try {
    const draftQ = Draft.findById({ _id: req.body.draft_id });
    const ratingQ = CardRating.findOne({ name: req.body.pick });
    const packQ = CardRating.find({ name: { $in: req.body.pack } });

    let [draft, rating, packRatings] = await Promise.all([draftQ, ratingQ, packQ]);

    if (draft && draft.packs[0] && draft.packs[0][0]) {
      const cards_per_pack = draft.packs[0][0].length + draft.pickNumber - 1;
      var updatedRating = (cards_per_pack - draft.packs[0][0].length + 1) / cards_per_pack;

      if (rating) {
        rating.value = rating.value * (rating.picks / (rating.picks + 1)) + updatedRating * (1 / (rating.picks + 1));
        rating.picks += 1;
      } else {
        rating = new CardRating();
        rating.name = req.body.pick;
        rating.value = updatedRating;
        rating.elo = ELO_BASE + ELO_RANGE / 2;
        rating.picks = 1;
      }

      if (isNaN(rating.elo)) {
        rating.elo = ELO_BASE + ELO_RANGE / (1 + Math.pow(ELO_SPEED, -(0.5 - rating.value)));
      }
      // Update ELO.
      for (const other of packRatings) {
        if (isNaN(other.elo)) {
          if (isNaN(other.rating)) {
            other.elo = ELO_BASE + ELO_RANGE / 2;
          } else {
            other.elo = ELO_BASE + ELO_RANGE / (1 + Math.pow(ELO_SPEED, -(0.5 - other.value)));
          }
        }

        // console.log(`[${rating.name}] over [${other.name}]:`);
        // console.log('Initial:', rating.elo, other.elo);
        const diff = other.elo - rating.elo;
        // Expected performance for pick.
        const expectedA = 1 / (1 + Math.pow(10, diff / 400));
        const expectedB = 1 - expectedA;
        const adjustmentA = 2 * (1 - expectedA);
        const adjustmentB = 2 * (0 - expectedB);
        rating.elo += adjustmentA;
        other.elo += adjustmentB;
        // console.log('Updated:', rating.elo, other.elo);
      }

      try {
        await Promise.all([rating.save(), packRatings.map((r) => r.save())]);
      } catch (err) {
        console.error(err);
        res.status(500).send({
          success: 'false',
          message: 'Error saving pick rating',
        });
        return;
      }
    }
    res.status(200).send({
      success: 'true',
    });
  } catch (err) {
    console.error(err);
    res.status(500).send({
      success: 'false',
      message: err,
    });
  }
});

router.post('/api/draftpick/:id', function(req, res) {
  Cube.findOne(build_id_query(req.params.id), function(err, cube) {
    User.findById(cube.owner, function(err, owner) {
      if (!req.body) {
        res.status(400).send({
          success: 'false',
          message: 'No draft passed',
        });
      } else {
        Draft.updateOne(
          {
            _id: req.body._id,
          },
          req.body,
          function(err) {
            if (err) {
              res.status(500).send({
                success: 'false',
                message: 'Error saving cube',
              });
            } else {
              res.status(200).send({
                success: 'true',
              });
            }
          },
        );
      }
    });
  });
});

router.get('/api/p1p1/:id', function(req, res) {
  generatePack(req.params.id, carddb, false, function(err, result) {
    if (err) {
      res.status(500).send({
        success: false,
      });
    } else {
      const pack = {
        seed: result.seed,
        pack: result.pack.map((card) => card.name),
      };
      res.status(200).send(pack);
    }
  });
});

router.get('/api/p1p1/:id/:seed', function(req, res) {
  generatePack(req.params.id, carddb, req.params.seed, function(err, result) {
    if (err) {
      res.status(500).send({
        success: false,
      });
    } else {
      const pack = {
        seed: req.params.seed,
        pack: result.pack.map((card) => card.name),
      };
      res.status(200).send(pack);
    }
  });
});

module.exports = router;
