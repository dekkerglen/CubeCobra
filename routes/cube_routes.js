const express = require('express');
// eslint-disable-next-line import/no-unresolved
const { body, param } = require('express-validator');
const fetch = require('node-fetch');
const cheerio = require('cheerio');
const serialize = require('serialize-javascript');
const RSS = require('rss');
const { Canvas, Image } = require('canvas');

Canvas.Image = Image;

const React = require('react');
const ReactDOMServer = require('react-dom/server');

const {
  addAutocard,
  generatePack,
  sanitize,
  setCubeType,
  cardsAreEquivalent,
  getBasics,
  generateShortId,
  buildIdQuery,
  getCubeId,
  addCardHtml,
  removeCardHtml,
  replaceCardHtml,
  abbreviate,
  insertComment,
  getOwnerFromComment,
  saveEdit,
  buildTagColors,
  maybeCards,
  getElo,
  CSVtoCards,
  compareCubes,
  generateSamplepackImage,
} = require('../serverjs/cubefn.js');

const deckutil = require('../dist/utils/Draft.js');
const draftutil = require('../dist/utils/draftutil.js');
const cardutil = require('../dist/utils/Card.js');
const sortutil = require('../dist/utils/Sort.js');
const filterutil = require('../dist/filtering/FilterCards.js');
const carddb = require('../serverjs/cards.js');

const util = require('../serverjs/util.js');
const generateMeta = require('../serverjs/meta.js');

const CARD_HEIGHT = 680;
const CARD_WIDTH = 488;
const CSV_HEADER =
  'Name,CMC,Type,Color,Set,Collector Number,Rarity,Color Category,Status,Finish,Maybeboard,Image URL,Tags,Notes,MTGO ID';

const router = express.Router();
// Bring in models
const Cube = require('../models/cube');
const Deck = require('../models/deck');
const Blog = require('../models/blog');
const User = require('../models/user');
const Draft = require('../models/draft');
const GridDraft = require('../models/gridDraft');
const CardRating = require('../models/cardrating');

const { NODE_ENV } = process.env;

let BulkUploadPage = null;
let CubeDraftPage = null;
let CubeListPage = null;
let CubePlaytestPage = null;
if (NODE_ENV === 'production') {
  BulkUploadPage = require('../dist/pages/BulkUploadPage').default;
  CubeDraftPage = require('../dist/pages/CubeDraftPage').default;
  CubeListPage = require('../dist/pages/CubeListPage').default;
  CubePlaytestPage = require('../dist/pages/CubePlaytestPage').default;
}

const { ensureAuth, csrfProtection, flashValidationErrors, jsonValidationErrors } = require('./middleware');

router.use(csrfProtection);

// Add Submit POST Route
router.post('/add', ensureAuth, async (req, res) => {
  try {
    if (req.body.name.length < 5 || req.body.name.length > 100) {
      req.flash('danger', 'Cube name should be at least 5 characters long, and shorter than 100 characters.');
      return res.redirect(`/user/view/${req.user.id}`);
    }

    if (util.hasProfanity(req.body.name)) {
      req.flash('danger', 'Cube name should not use profanity.');
      return res.redirect(`/user/view/${req.user.id}`);
    }

    const { user } = req;
    const cubes = await Cube.find({
      owner: user._id,
    }).lean();

    if (cubes.length >= 48) {
      req.flash(
        'danger',
        'Cannot create a cube: Users can only have 48 cubes. Please delete one or more cubes to create new cubes.',
      );
      return res.redirect(`/user/view/${req.user.id}`);
    }

    const shortID = await generateShortId();
    let cube = new Cube();
    cube.shortID = shortID;
    cube.name = req.body.name;
    cube.owner = req.user.id;
    cube.cards = [];
    cube.articles = [];
    const details = carddb.cardFromId(carddb.nameToId['doubling cube'][0]);
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
    return res.redirect(`/cube/overview/${cube.shortID}`);
  } catch (err) {
    return util.handleRouteError(req, res, err, `/user/view/${req.user.id}`);
  }
});

router.get('/clone/:id', async (req, res) => {
  try {
    if (!req.user) {
      req.flash('danger', 'Please log on to clone this cube.');
      return res.redirect(`/cube/list/${req.params.id}`);
    }

    const cubes = await Cube.find({
      owner: req.user._id,
    }).lean();

    if (cubes.length >= 48) {
      req.flash(
        'danger',
        'Cannot clone this cube: Users can only have 48 cubes. Please delete one or more cubes to create new cubes.',
      );
      return res.redirect(`/cube/list/${req.params.id}`);
    }

    const source = await Cube.findOne(buildIdQuery(req.params.id)).lean();

    const shortID = await generateShortId();
    let cube = new Cube();
    cube.shortID = shortID;
    cube.name = `Clone of ${source.name}`;
    cube.owner = req.user.id;
    cube.cards = source.cards;
    cube.articles = [];
    cube.image_uri = source.image_uri;
    cube.image_name = source.image_name;
    cube.image_artist = source.image_artist;
    cube.description = source.description;
    cube.owner_name = req.user.username;
    cube.date_updated = Date.now();
    cube.updated_string = cube.date_updated.toLocaleString('en-US');
    cube = setCubeType(cube, carddb);
    await cube.save();

    const sourceOwner = await User.findById(source.owner);

    await util.addNotification(
      sourceOwner,
      req.user,
      `/cube/view/${cube._id}`,
      `${req.user.username} made a cube by cloning yours: ${cube.name}`,
    );

    req.flash('success', 'Cube Cloned');
    return res.redirect(`/cube/overview/${cube.shortID}`);
  } catch (err) {
    return util.handleRouteError(req, res, err, `/cube/list/${req.params.id}`);
  }
});

// GEt view cube Route
router.get('/view/:id', (req, res) => {
  return res.redirect(`/cube/overview/${req.params.id}`);
});

router.post('/format/add/:id', ensureAuth, async (req, res) => {
  try {
    req.body.html = sanitize(req.body.html);

    const cube = await Cube.findOne(buildIdQuery(req.params.id));
    if (!req.user._id.equals(cube.owner)) {
      req.flash('danger', 'Formats can only be changed by cube owner.');
      return res.redirect(`/cube/list/${req.params.id}`);
    }

    let message = '';
    if (req.body.id === '-1') {
      if (!cube.draft_formats) {
        cube.draft_formats = [];
      }
      cube.draft_formats.push({
        title: req.body.title,
        multiples: req.body.multiples === 'true',
        html: req.body.html,
        packs: req.body.format,
      });
      message = 'Custom format successfully added.';
    } else {
      cube.draft_formats[req.body.id] = {
        title: req.body.title,
        multiples: req.body.multiples === 'true',
        html: req.body.html,
        packs: req.body.format,
      };
      message = 'Custom format successfully edited.';
    }

    await cube.save();
    req.flash('success', message);
    return res.redirect(`/cube/playtest/${req.params.id}`);
  } catch (err) {
    return util.handleRouteError(req, res, err, `/cube/playtest/${req.params.id}`);
  }
});

router.post('/blog/post/:id', ensureAuth, async (req, res) => {
  try {
    req.body.html = sanitize(req.body.html);
    if (req.body.title.length < 5 || req.body.title.length > 100) {
      req.flash('danger', 'Blog title length must be between 5 and 100 characters.');
      return res.redirect(`/cube/blog/${req.params.id}`);
    }

    const { user } = req;

    if (req.body.id && req.body.id.length > 0) {
      // update an existing blog post
      const blog = await Blog.findById(req.body.id);

      if (!user._id.equals(blog.owner)) {
        req.flash('danger', 'Unable to update this blog post: Unauthorized.');
        return res.redirect(`/cube/blog/${req.params.id}`);
      }

      blog.html = req.body.html;
      blog.title = req.body.title;

      await blog.save();

      req.flash('success', 'Blog update successful');
      return res.redirect(`/cube/blog/${req.params.id}`);
    }

    let cube = await Cube.findOne(buildIdQuery(req.params.id));

    // post new blog
    if (!user._id.equals(cube.owner)) {
      req.flash('danger', 'Unable to post this blog post: Unauthorized.');
      return res.redirect(`/cube/blog/${req.params.id}`);
    }

    cube.date_updated = Date.now();
    cube.updated_string = cube.date_updated.toLocaleString('en-US');
    cube = setCubeType(cube, carddb);

    await cube.save();

    const blogpost = new Blog();
    blogpost.html = req.body.html;
    blogpost.title = req.body.title;
    blogpost.owner = user._id;
    blogpost.date = Date.now();
    blogpost.cube = cube._id;
    blogpost.dev = 'false';
    blogpost.date_formatted = blogpost.date.toLocaleString('en-US');
    blogpost.username = user.username;
    blogpost.cubename = cube.name;

    await blogpost.save();

    req.flash('success', 'Blog post successful');
    return res.redirect(`/cube/blog/${req.params.id}`);
  } catch (err) {
    return util.handleRouteError(req, res, err, `/cube/blog/${req.params.id}`);
  }
});

router.post(
  '/follow/:id',
  ensureAuth,
  util.wrapAsyncApi(async (req, res) => {
    const { user } = req;
    const cube = await Cube.findOne(buildIdQuery(req.params.id));
    if (!cube) {
      req.flash('danger', 'Cube not found');
      res.status(404).send({
        success: 'false',
      });
    }

    if (!cube.users_following.includes(user.id)) {
      cube.users_following.push(user.id);
    }
    if (!user.followed_cubes.includes(cube.id)) {
      user.followed_cubes.push(cube.id);
    }

    await Promise.all([user.save(), cube.save()]);

    res.status(200).send({
      success: 'true',
    });
  }),
);

router.post(
  '/unfollow/:id',
  ensureAuth,
  util.wrapAsyncApi(async (req, res) => {
    const cube = await Cube.findById(buildIdQuery(req.params.id), 'users_following');
    if (!cube) {
      req.flash('danger', 'Cube not found');
      res.status(404).send({
        success: 'false',
      });
    }

    const { user } = req;
    cube.users_following = cube.users_following.filter((id) => !req.user._id.equals(id));
    user.followed_cubes = user.followed_cubes.filter((id) => id !== req.params.id);

    await Promise.all([user.save(), cube.save()]);

    res.status(200).send({
      success: 'true',
    });
  }),
);

router.post('/feature/:id', ensureAuth, async (req, res) => {
  try {
    const { user } = req;
    if (!util.isAdmin(user)) {
      req.flash('danger', 'Not Authorized');
      return res.redirect(`/cube/overview/${req.params.id}`);
    }

    const cube = await Cube.findOne(buildIdQuery(req.params.id));
    if (!cube) {
      req.flash('danger', 'Cube not found');
      return res.redirect(`/cube/overview/${req.params.id}`);
    }

    cube.isFeatured = true;
    await cube.save();

    req.flash('success', 'Cube updated successfully.');
    return res.redirect(`/cube/overview/${req.params.id}`);
  } catch (err) {
    return util.handleRouteError(req, res, err, `/cube/overview/${req.params.id}`);
  }
});

router.post('/unfeature/:id', ensureAuth, async (req, res) => {
  try {
    const { user } = req;
    if (!util.isAdmin(user)) {
      req.flash('danger', 'Not Authorized');
      return res.redirect(`/cube/overview/${req.params.id}`);
    }

    const cube = await Cube.findOne(buildIdQuery(req.params.id));
    if (!cube) {
      req.flash('danger', 'Cube not found');
      return res.redirect(`/cube/overview/${req.params.id}`);
    }

    cube.isFeatured = false;
    await cube.save();

    req.flash('success', 'Cube updated successfully.');
    return res.redirect(`/cube/overview/${req.params.id}`);
  } catch (err) {
    return util.handleRouteError(req, res, err, `/cube/overview/${req.params.id}`);
  }
});

router.get('/overview/:id', async (req, res) => {
  try {
    const cubeID = req.params.id;
    const cube = await Cube.findOne(buildIdQuery(cubeID)).lean();
    const admin = util.isAdmin(req.user);
    if (!cube) {
      req.flash('danger', 'Cube not found');
      return res.status(404).render('misc/404', {});
    }

    const blogsQ = Blog.find({
      cube: cube._id,
    })
      .sort({ date: -1 })
      .lean();

    const followersQ = User.find(
      {
        _id: { $in: cube.users_following },
      },
      '_id username image artist users_following',
    ).lean();

    // calc cube prices
    for (const card of cube.cards) {
      card.details = { ...carddb.cardFromId(card.cardID, 'name prices') };
    }
    const nameToCards = {};
    for (const card of cube.cards) {
      if (!nameToCards[card.details.name]) {
        const allVersionsOfCard = carddb.getIdsFromName(card.details.name) || [];
        nameToCards[card.details.name] = allVersionsOfCard.map((id) => carddb.cardFromId(id));
      }
    }

    const [blogs, followers] = await Promise.all([blogsQ, followersQ]);

    const cheapestDict = {};
    for (const card of cube.cards) {
      if (!cheapestDict[card.details.name]) {
        for (const version of nameToCards[card.details.name]) {
          if (!cheapestDict[version.name] || (version.prices.usd && version.prices.usd < cheapestDict[version.name])) {
            cheapestDict[version.name] = version.prices.usd;
          }
          if (
            !cheapestDict[version.name] ||
            (version.prices.usd_foil && version.prices.usd_foil < cheapestDict[version.name])
          ) {
            cheapestDict[version.name] = version.prices.usd_foil;
          }
        }
      }
    }

    let totalPriceOwned = 0;
    let totalPricePurchase = 0;
    for (const card of cube.cards) {
      if (!['Not Owned', 'Proxied'].includes(card.status) && card.details.prices) {
        if (card.finish === 'Foil') {
          totalPriceOwned += card.details.prices.usd_foil || card.details.prices.usd || 0;
        } else {
          totalPriceOwned += card.details.prices.usd || card.details.prices.usd_foil || 0;
        }
      }

      totalPricePurchase += cheapestDict[card.details.name] || 0;
    }

    if (blogs) {
      for (const item of blogs) {
        if (!item.date_formatted) {
          item.date_formatted = item.date.toLocaleString('en-US');
        }
        if (item.html) {
          item.html = addAutocard(item.html, carddb, cube);
        }
      }
    }
    cube.raw_desc = cube.body;
    if (cube.descriptionhtml) {
      cube.raw_desc = cube.descriptionhtml;
      cube.descriptionhtml = addAutocard(cube.descriptionhtml, carddb, cube);
    }

    // Performance
    delete cube.cards;
    delete cube.draft_formats;
    delete cube.maybe;

    const reactProps = {
      cube,
      cubeID,
      loggedIn: !!req.user,
      canEdit: req.user ? req.user._id.equals(cube.owner) : false,
      owner: cube.owner_name || 'unknown',
      ownerID: cube.owner || null,
      post: blogs ? blogs[0] : null,
      followed: req.user && cube.users_following ? cube.users_following.includes(req.user.id) : false,
      followers,
      editorvalue: cube.raw_desc,
      priceOwned: !cube.privatePrices ? totalPriceOwned : null,
      pricePurchase: !cube.privatePrices ? totalPricePurchase : null,
      admin,
    };
    return res.render('cube/cube_overview', {
      reactProps: serialize(reactProps),
      title: `${abbreviate(cube.name)} - Overview`,
      metadata: generateMeta(
        `Cube Cobra Overview: ${cube.name}`,
        cube.type ? `${cube.card_count} Card ${cube.type} Cube` : `${cube.card_count} Card Cube`,
        cube.image_uri,
        `https://cubecobra.com/cube/overview/${req.params.id}`,
      ),
      loginCallback: `/cube/overview/${req.params.id}`,
    });
  } catch (err) {
    return util.handleRouteError(req, res, err, `/cube/overview/${req.params.id}`);
  }
});

router.get(
  '/blogsrc/:id',
  util.wrapAsyncApi(async (req, res) => {
    const blog = await Blog.findById(req.params.id);
    res.status(200).send({
      success: 'true',
      src: blog.html,
      title: blog.title,
      body: blog.body,
    });
  }),
);

router.get('/blog/:id', (req, res) => {
  res.redirect(`/cube/blog/${req.params.id}/0`);
});

router.get('/blog/:id/:page', async (req, res) => {
  try {
    const cubeID = req.params.id;
    const cube = await Cube.findOne(buildIdQuery(cubeID), Cube.LAYOUT_FIELDS).lean();

    const page = parseInt(req.params.page, 10) || 0;

    if (!cube) {
      req.flash('danger', 'Cube not found');
      return res.status(404).render('misc/404', {});
    }

    const userQ = User.findById(cube.owner);

    const countQ = Blog.countDocuments({ cube: cube._id });
    const blogsQ = Blog.find({
      cube: cube._id,
    })
      .sort({ date: -1 })
      .skip(page * 10)
      .limit(10)
      .lean();
    const [user, blogs, count] = await Promise.all([userQ, blogsQ, countQ]);

    for (const item of blogs) {
      if (!item.date_formatted) {
        item.date_formatted = item.date.toLocaleString('en-US');
      }
      if (item.html) {
        item.html = addAutocard(item.html, carddb, cube);
      }
    }

    const reactProps = {
      cube,
      cubeID,
      canEdit: req.user ? req.user._id.equals(cube.owner) : false,
      posts: blogs,
      pages: Math.ceil(count / 10),
      activePage: page,
      userid: user._id,
      loggedIn: !!req.user,
    };

    return res.render('cube/cube_blog', {
      reactProps: serialize(reactProps),
      title: `${abbreviate(cube.name)} - Blog`,
      metadata: generateMeta(
        `Cube Cobra Blog: ${cube.name}`,
        cube.type ? `${cube.card_count} Card ${cube.type} Cube` : `${cube.card_count} Card Cube`,
        cube.image_uri,
        `https://cubecobra.com/cube/blog/${req.params.id}`,
      ),
      loginCallback: `/cube/blog/${req.params.id}`,
    });
  } catch (err) {
    return util.handleRouteError(req, res, err, `/cube/overview/${req.params.id}`);
  }
});

router.get('/rss/:id', async (req, res) => {
  try {
    const split = req.params.id.split(';');
    const cubeID = split[0];
    const cube = await Cube.findOne(buildIdQuery(cubeID)).lean();
    if (!cube) {
      req.flash('danger', `Cube ID ${req.params.id} not found/`);
      return res.redirect('/404');
    }
    const blogs = await Blog.find({
      cube: cube._id,
    })
      .sort({ date: -1 })
      .exec();

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
          content += changeSetElement;
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
    return res.status(200).send(feed.xml());
  } catch (err) {
    return util.handleRouteError(req, res, err, '/404/');
  }
});

router.get('/compare/:idA/to/:idB', async (req, res) => {
  try {
    const { idA } = req.params;
    const { idB } = req.params;

    const cubeAq = Cube.findOne(buildIdQuery(idA)).lean();
    const cubeBq = Cube.findOne(buildIdQuery(idB)).lean();

    const [cubeA, cubeB] = await Promise.all([cubeAq, cubeBq]);

    if (!cubeA) {
      req.flash('danger', `Base cube not found: ${idA}`);
      return res.status(401).render('misc/404', {});
    }
    if (!cubeB) {
      req.flash('danger', `Comparison cube not found: ${idB}`);
      return res.status(401).render('misc/404', {});
    }

    const pids = new Set();
    const cardNames = new Set();
    const addDetails = (cards) => {
      cards.forEach((card, index) => {
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
        cardNames.add(card.details.name);
      });
      return cards;
    };

    cubeA.cards = addDetails(cubeA.cards);
    cubeB.cards = addDetails(cubeB.cards);

    const { aNames, bNames, inBoth, allCards } = await compareCubes(cubeA.cards, cubeB.cards);

    const reactProps = {
      cube: cubeA,
      cubeID: idA,
      cubeB,
      cubeBID: idB,
      onlyA: aNames,
      onlyB: bNames,
      both: inBoth.map((card) => card.details.name),
      cards: allCards.map((card, index) => Object.assign(card, { index })),
      defaultTagColors: [...cubeA.tag_colors, ...cubeB.tag_colors],
      defaultShowTagColors: !req.user || !req.user.hide_tag_colors,
      defaultSorts: cubeA.default_sorts,
    };

    return res.render('cube/cube_compare', {
      reactProps: serialize(reactProps),
      title: `Comparing ${cubeA.name} to ${cubeB.name}`,
      metadata: generateMeta(
        'Cube Cobra Compare Cubes',
        `Comparing "${cubeA.name}" To "${cubeB.name}"`,
        cubeA.image_uri,
        `https://cubecobra.com/cube/compare/${idA}/to/${idB}`,
      ),
      loginCallback: `/cube/compare/${idA}/to/${idB}`,
    });
  } catch (err) {
    return util.handleRouteError(req, res, err, '/404/');
  }
});

router.get('/list/:id', async (req, res) => {
  try {
    const fields =
      'cards maybe name owner card_count type tag_colors default_sorts overrideCategory categoryOverride categoryPrefixes';
    const cube = await Cube.findOne(buildIdQuery(req.params.id), fields).lean();
    if (!cube) {
      req.flash('danger', 'Cube not found');
      return res.status(404).render('misc/404', {});
    }

    const addDetails = (cards) => {
      cards.forEach((card, index) => {
        card.details = {
          ...carddb.cardFromId(card.cardID),
        };
        card.index = index;
        if (!card.type_line) {
          card.type_line = card.details.type;
        }
      });
      return cards;
    };

    cube.cards = addDetails(cube.cards);
    cube.maybe = addDetails(cube.maybe ? cube.maybe : []);

    const reactProps = {
      cube,
      cubeID: req.params.id,
      canEdit: req.user ? req.user._id.equals(cube.owner) : false,
      defaultView: req.query.view || 'table',
      defaultPrimarySort: req.query.s1 || '',
      defaultSecondarySort: req.query.s2 || '',
      defaultFilterText: req.query.f || '',
      defaultTagColors: cube.tag_colors || [],
      defaultShowTagColors: !req.user || !req.user.hide_tag_colors,
      defaultSorts: cube.default_sorts,
      maybe: cube.maybe,
    };

    return res.render('cube/cube_list', {
      reactHTML: CubeListPage
        ? ReactDOMServer.renderToString(React.createElement(CubeListPage, reactProps))
        : undefined,
      reactProps: serialize(reactProps),
      cube,
      cubeID: req.params.id,
      activeLink: 'list',
      title: `${abbreviate(cube.name)} - List`,
      metadata: generateMeta(
        `Cube Cobra List: ${cube.name}`,
        cube.type ? `${cube.card_count} Card ${cube.type} Cube` : `${cube.card_count} Card Cube`,
        cube.image_uri,
        `https://cubecobra.com/cube/list/${req.params.id}`,
      ),
      loginCallback: `/cube/list/${req.params.id}`,
    });
  } catch (err) {
    return util.handleRouteError(req, res, err, `/cube/overview/${req.params.id}`);
  }
});

router.get('/playtest/:id', async (req, res) => {
  try {
    const cube = await Cube.findOne(buildIdQuery(req.params.id)).lean();

    if (!cube) {
      req.flash('danger', 'Cube not found');
      return res.status(404).render('misc/404', {});
    }

    const decks = await Deck.find(
      {
        cube: cube._id,
      },
      'date seats _id cube',
    )
      .sort({
        date: -1,
      })
      .limit(10)
      .lean();

    let draftFormats = [];
    // NOTE: older cubes do not have custom drafts
    if (cube.draft_formats) {
      draftFormats = cube.draft_formats.map(({ packs, ...format }) => ({
        ...format,
        packs: JSON.parse(packs),
      }));
    }

    const reactProps = {
      cube,
      cubeID: req.params.id,
      canEdit: req.user ? req.user._id.equals(cube.owner) : false,
      userID: req.user ? req.user._id : null,
      decks,
      draftFormats,
    };

    return res.render('cube/cube_playtest', {
      reactHTML: CubePlaytestPage
        ? ReactDOMServer.renderToString(React.createElement(CubePlaytestPage, reactProps))
        : undefined,
      reactProps: serialize(reactProps),
      title: `${abbreviate(cube.name)} - Playtest`,
      metadata: generateMeta(
        `Cube Cobra Playtest: ${cube.name}`,
        cube.type ? `${cube.card_count} Card ${cube.type} Cube` : `${cube.card_count} Card Cube`,
        cube.image_uri,
        `https://cubecobra.com/cube/playtest/${req.params.id}`,
      ),
      loginCallback: `/cube/playtest/${req.params.id}`,
    });
  } catch (err) {
    return util.handleRouteError(req, res, err, `/cube/overview/${req.params.id}`);
  }
});

router.get('/analysis/:id', async (req, res) => {
  try {
    const cube = await Cube.findOne(buildIdQuery(req.params.id)).lean();

    if (!cube) {
      req.flash('danger', 'Cube not found');
      return res.status(404).render('misc/404', {});
    }

    const pids = new Set();
    const cardNames = new Set();
    const addDetails = (cards) => {
      cards.forEach((card, index) => {
        card.details = {
          ...carddb.cardFromId(card.cardID),
        };
        card.index = index;
        if (card.details.tcgplayer_id) {
          pids.add(card.details.tcgplayer_id);
        }

        if (card.details.tokens) {
          card.details.tokens = card.details.tokens
            .filter((tokenId) => tokenId !== card.cardID)
            .map((tokenId) => {
              const tokenDetails = carddb.cardFromId(tokenId);
              return {
                tags: [],
                status: 'Not Owned',
                colors: tokenDetails.color_identity,
                cmc: tokenDetails.cmc,
                cardID: tokenDetails._id,
                type_line: tokenDetails.type,
                addedTmsp: new Date(),
                finish: 'Non-foil',
                details: tokenDetails,
              };
            });
        }

        cardNames.add(card.details.name);
      });
      return cards;
    };
    cube.cards = addDetails(cube.cards || []);
    cube.maybe = addDetails(cube.maybe || []);

    const reactProps = {
      cube,
      cubeID: req.params.id,
      defaultNav: req.query.nav,
      defaultFormatId: Number(req.query.formatId),
      defaultFilterText: req.query.f,
      defaultTab: Number(req.query.tab),
    };

    return res.render('cube/cube_analysis', {
      reactProps: serialize(reactProps),
      title: `${abbreviate(cube.name)} - Analysis`,
      metadata: generateMeta(
        `Cube Cobra Analysis: ${cube.name}`,
        cube.type ? `${cube.card_count} Card ${cube.type} Cube` : `${cube.card_count} Card Cube`,
        cube.image_uri,
        `https://cubecobra.com/cube/analysis/${req.params.id}`,
      ),
      loginCallback: `/cube/analysis/${req.params.id}`,
    });
  } catch (err) {
    return util.handleRouteError(req, res, err, `/cube/overview/${req.params.id}`);
  }
});

router.get('/samplepack/:id', (req, res) => {
  res.redirect(`/cube/samplepack/${req.params.id}/${Date.now().toString()}`);
});

router.get('/samplepack/:id/:seed', async (req, res) => {
  try {
    const cube = await Cube.findOne(buildIdQuery(req.params.id)).lean();
    const pack = await generatePack(req.params.id, carddb, req.params.seed);

    const reactProps = {
      cube_id: req.params.id,
      seed: pack.seed,
      pack: pack.pack,
    };

    const width = Math.floor(Math.sqrt((5 / 3) * pack.pack.length));
    const height = Math.ceil(pack.pack.length / width);

    return res.render('cube/cube_samplepack', {
      cube,
      title: `${abbreviate(cube.name)} - Sample Pack`,
      reactProps: serialize(reactProps),
      activeLink: 'playtest',
      metadata: generateMeta(
        'Cube Cobra Sample Pack',
        `A sample pack from ${cube.name}`,
        `https://cubecobra.com/cube/samplepackimage/${req.params.id}/${pack.seed}.png`,
        `https://cubecobra.com/cube/samplepack/${req.params.id}/${pack.seed}`,
        CARD_WIDTH * width,
        CARD_HEIGHT * height,
      ),
      loginCallback: `/cube/samplepack/${req.params.id}`,
    });
  } catch (err) {
    return util.handleRouteError(req, res, err, `/cube/playtest/${req.params.id}`);
  }
});

router.get('/samplepackimage/:id/:seed', async (req, res) => {
  try {
    req.params.seed = req.params.seed.replace('.png', '');
    const pack = await generatePack(req.params.id, carddb, req.params.seed);

    const imgScale = 0.9;
    // Try to make it roughly 5 times as wide as it is tall in cards.
    const width = Math.floor(Math.sqrt((5 / 3) * pack.pack.length));
    const height = Math.ceil(pack.pack.length / width);

    const srcArray = pack.pack.map((card, index) => {
      return {
        src: card.imgUrl || card.details.image_normal,
        x: imgScale * CARD_WIDTH * (index % width),
        y: imgScale * CARD_HEIGHT * Math.floor(index / width),
        w: imgScale * CARD_WIDTH,
        h: imgScale * CARD_HEIGHT,
        rX: imgScale * 0.065 * CARD_WIDTH,
        rY: imgScale * 0.0464 * CARD_HEIGHT,
      };
    });

    return generateSamplepackImage(srcArray, {
      width: imgScale * CARD_WIDTH * width,
      height: imgScale * CARD_HEIGHT * height,
      Canvas,
    })
      .then((image) => {
        res.writeHead(200, {
          'Content-Type': 'image/png',
        });
        res.end(Buffer.from(image.replace(/^data:image\/png;base64,/, ''), 'base64'));
      })
      .catch((err) => util.handleRouteError(req, res, err, '/404'));
  } catch (err) {
    return util.handleRouteError(req, res, err, '/404');
  }
});

async function updateCubeAndBlog(req, res, cube, changelog, added, missing) {
  try {
    const blogpost = new Blog();
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
      return res.render('cube/bulk_upload', {
        reactHTML: BulkUploadPage
          ? ReactDOMServer.renderToString(React.createElement(BulkUploadPage, reactProps))
          : undefined,
        reactProps: serialize(reactProps),
        cube,
        cube_id: req.params.id,
        title: `${abbreviate(cube.name)} - Bulk Upload`,
      });
    }
    await blogpost.save();
    cube = setCubeType(cube, carddb);
    try {
      await Cube.updateOne({ _id: cube._id }, cube);
    } catch (err) {
      req.logger.error(err);
      req.flash('danger', 'Error adding cards. Please try again.');
      return res.redirect(`/cube/list/${req.params.id}`);
    }
    req.flash('success', 'All cards successfully added.');
    return res.redirect(`/cube/list/${req.params.id}`);
  } catch (err) {
    return util.handleRouteError(req, res, err, `/cube/list/${req.params.id}`);
  }
}

router.post('/importcubetutor/:id', ensureAuth, body('cubeid').toInt(), flashValidationErrors, async (req, res) => {
  try {
    const cube = await Cube.findOne(buildIdQuery(req.params.id));
    if (!req.user._id.equals(cube.owner)) {
      req.flash('danger', 'Not Authorized');
      return res.redirect(`/cube/list/${req.params.id}`);
    }

    const response = await fetch(`https://www.cubetutor.com/viewcube/${req.body.cubeid}`, {
      headers: {
        // This tricks cubetutor into not redirecting us to the unsupported browser page.
        'User-Agent': 'Mozilla/5.0',
      },
    });
    if (!response.ok) {
      req.flash('danger', 'Error accessing CubeTutor.');
      return res.redirect(`/cube/list${req.params.id}`);
    }
    const text = await response.text();
    const data = cheerio.load(text);

    const tagColors = new Map();
    data('.keyColour').each((_, elem) => {
      const nodeText = elem.firstChild.nodeValue.trim();
      tagColors.set(elem.attribs.class.split(' ')[1], nodeText);
    });

    const cards = [];
    data('.cardPreview').each((_, elem) => {
      const str = elem.attribs['data-image'].substring(37, elem.attribs['data-image'].length - 4);
      const name = decodeURIComponent(elem.children[0].data).replace('_flip', '');
      const tagColorClasses = elem.attribs.class.split(' ').filter((c) => tagColors.has(c));
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
      const potentialIds = carddb.allVersions(card);
      if (potentialIds && potentialIds.length > 0) {
        const matchingSet = potentialIds.find((id) => carddb.cardFromId(id).set.toUpperCase() === card.set);
        const nonPromo = carddb.getMostReasonable(card.name, cube.defaultPrinting)._id;
        const selected = matchingSet || nonPromo || potentialIds[0];
        const details = carddb.cardFromId(selected);
        if (!details.error) {
          added.push(details);
          util.addCardToCube(cube, details, card.tags);
          changelog += addCardHtml(details);
        } else {
          missing += `${card.name}\n`;
        }
      } else {
        missing += `${card.name}\n`;
      }
    }

    return await updateCubeAndBlog(req, res, cube, changelog, added, missing);
  } catch (err) {
    return util.handleRouteError(req, res, err, `/cube/list/${req.params.id}`);
  }
});

const createDraftForSingleDeck = async (deck) => {
  let index = 0;
  const populatedCards = [];
  for (const stack of deck.seats[0].deck) {
    for (const card of stack) {
      card.index = index;
      populatedCards.push(card);
      index += 1;
    }
  }
  const draft = new Draft();
  draft.initial_state = [[populatedCards]];
  try {
    const response = await fetch(`${process.env.FLASKROOT}/embeddings/`, {
      method: 'post',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cards: populatedCards.map((card) => carddb.cardFromId(card.cardID).name_lower),
      }),
    });
    if (response.ok) {
      draft.synergies = await response.json();
    } else {
      draft.synergies = null;
    }
  } catch (err) {
    draft.synergies = null;
  }
  await draft.save();
  return draft._id;
};

router.post('/uploaddecklist/:id', ensureAuth, async (req, res) => {
  try {
    const cube = await Cube.findOne(buildIdQuery(req.params.id)).lean();
    if (!cube) {
      req.flash('danger', 'Cube not found.');
      return res.redirect('/404');
    }

    if (!req.user._id.equals(cube.owner)) {
      req.flash('danger', 'Not Authorized');
      return res.redirect(`/cube/playtest/${req.params.id}`);
    }

    const cards = req.body.body.match(/[^\r\n]+/g);
    if (!cards) {
      req.flash('danger', 'No cards detected');
      return res.redirect(`/cube/playtest/${req.params.id}`);
    }

    // list of cardids
    const added = [];
    for (let i = 0; i < 16; i += 1) {
      added.push([]);
    }

    for (let i = 0; i < cards.length; i += 1) {
      const item = cards[i].toLowerCase().trim();
      if (/([0-9]+x )(.*)/.test(item)) {
        const count = parseInt(item.substring(0, item.indexOf('x')), 10);
        for (let j = 0; j < count; j += 1) {
          cards.push(item.substring(item.indexOf('x') + 1));
        }
      } else {
        let selected = null;
        // does not have set info
        const normalizedName = cardutil.normalizeName(item);
        const potentialIds = carddb.getIdsFromName(normalizedName);
        if (potentialIds && potentialIds.length > 0) {
          const inCube = cube.cards.find((card) => carddb.cardFromId(card.cardID).name_lower === normalizedName);
          if (inCube) {
            selected = {
              ...inCube,
              details: carddb.cardFromId(inCube.cardID),
            };
          } else {
            const reasonableCard = carddb.getMostReasonable(normalizedName, cube.defaultPrinting);
            const reasonableId = reasonableCard ? reasonableCard._id : null;
            const selectedId = reasonableId || potentialIds[0];
            selected = {
              cardID: selectedId,
              details: carddb.cardFromId(selectedId),
            };
          }
        }
        if (selected) {
          // push into correct column.
          let column = Math.min(7, selected.cmc !== undefined ? selected.cmc : selected.details.cmc);
          if (!selected.details.type.toLowerCase().includes('creature')) {
            column += 8;
          }
          added[column].push(selected);
        }
      }
    }

    const deck = new Deck();
    deck.date = Date.now();
    deck.comments = [];
    deck.cubename = cube.name;
    deck.cube = cube._id;
    deck.seats = [
      {
        userid: req.user._id,
        username: req.user.username,
        pickorder: [],
        name: `${req.user.username}'s decklist upload on ${deck.date.toLocaleString('en-US')}`,
        cols: 16,
        deck: added,
        sideboard: [],
      },
    ];
    deck.draft = await createDraftForSingleDeck(deck);

    await deck.save();
    await Cube.updateOne(
      {
        _id: cube._id,
      },
      {
        $inc: {
          numDecks: 1,
        },
      },
    );

    return res.redirect(`/cube/deckbuilder/${deck._id}`);
  } catch (err) {
    return util.handleRouteError(req, res, err, '/404');
  }
});

async function bulkUpload(req, res, list, cube) {
  const cards = list.match(/[^\r\n]+/g);
  let missing = '';
  const added = [];
  let changelog = '';
  if (cards) {
    if ((cards[0].match(/,/g) || []).length > 3) {
      let newCards = [];
      let newMaybe = [];
      ({ newCards, newMaybe, missing } = CSVtoCards(list, carddb));
      changelog = newCards.reduce((changes, card) => changes + addCardHtml(carddb.cardFromId(card.cardID)), changelog);
      cube.cards.push(...newCards);
      cube.maybe.push(...newMaybe);
      added.concat(newCards, newMaybe);
    } else {
      for (const itemUntrimmed of cards) {
        const item = itemUntrimmed.trim();
        const numericMatch = item.match(/([0-9]+)x? (.*)/);
        if (numericMatch) {
          let count = parseInt(numericMatch[1], 10);
          if (!Number.isInteger(count)) {
            count = 1;
          }
          for (let j = 0; j < count; j += 1) {
            cards.push(numericMatch[2]);
          }
        } else {
          let selected = null;
          if (/(.*)( \((.*)\))/.test(item)) {
            // has set info
            const name = item.substring(0, item.indexOf('('));
            const potentialIds = carddb.getIdsFromName(name);
            if (potentialIds && potentialIds.length > 0) {
              const set = item.toLowerCase().substring(item.indexOf('(') + 1, item.indexOf(')'));
              // if we've found a match, and it DOES need to be parsed with cubecobra syntax
              const matching = potentialIds.find((id) => carddb.cardFromId(id).set.toUpperCase() === set);
              selected = matching || potentialIds[0];
            }
          } else {
            // does not have set info
            const selectedCard = carddb.getMostReasonable(item, cube.defaultPrinting);
            selected = selectedCard ? selectedCard._id : null;
          }
          if (selected) {
            const details = carddb.cardFromId(selected);
            if (!details.error) {
              util.addCardToCube(cube, details);
              added.push(details);
              changelog += addCardHtml(details);
            }
          } else {
            missing += `${item}\n`;
          }
        }
      }
    }
  }
  await updateCubeAndBlog(req, res, cube, changelog, added, missing);
}

router.post('/bulkupload/:id', ensureAuth, async (req, res) => {
  try {
    const cube = await Cube.findOne(buildIdQuery(req.params.id));
    if (!cube) {
      req.flash('danger', 'Cube not found');
      return res.status(404).render('misc/404', {});
    }
    if (!req.user._id.equals(cube.owner)) {
      req.flash('danger', 'Not Authorized');
      return res.redirect(`/cube/list/${req.params.id}`);
    }

    await bulkUpload(req, res, req.body.body, cube);
    return null;
  } catch (err) {
    return util.handleRouteError(req, res, err, `/cube/list/${req.params.id}`);
  }
});

router.post('/bulkuploadfile/:id', ensureAuth, async (req, res) => {
  try {
    if (!req.files) {
      req.flash('danger', 'Please attach a file');
      return res.redirect(`/cube/list/${req.params.id}`);
    }

    const items = req.files.document.data.toString('utf8'); // the uploaded file object

    const cube = await Cube.findOne(buildIdQuery(req.params.id));
    if (!cube) {
      req.flash('danger', 'Cube not found');
      return res.status(404).render('misc/404', {});
    }
    if (!req.user._id.equals(cube.owner)) {
      req.flash('danger', 'Not Authorized');
      return res.redirect(`/cube/list/${req.params.id}`);
    }

    await bulkUpload(req, res, items, cube);
    return null;
  } catch (err) {
    return util.handleRouteError(req, res, err, `/cube/list/${req.params.id}`);
  }
});

router.post('/bulkreplacefile/:id', ensureAuth, async (req, res) => {
  try {
    if (!req.files) {
      req.flash('danger', 'Please attach a file');
      return res.redirect(`/cube/list/${req.params.id}`);
    }
    const items = req.files.document.data.toString('utf8'); // the uploaded file object
    const cube = await Cube.findOne(buildIdQuery(req.params.id));
    // We need a copy of cards we can mutate to be able to populate details for the comparison.
    const { cards } = await Cube.findOne(buildIdQuery(req.params.id), 'cards').lean();
    if (!cube) {
      req.flash('danger', 'Cube not found');
      return res.status(404).render('misc/404', {});
    }
    if (!req.user._id.equals(cube.owner)) {
      req.flash('danger', 'Not Authorized');
      return res.redirect(`/cube/list/${req.params.id}`);
    }
    const lines = items.match(/[^\r\n]+/g);
    if (lines) {
      let changelog = '';
      let missing = '';
      const added = [];
      let newCards = [];
      let newMaybe = [];
      if ((lines[0].match(/,/g) || []).length > 3) {
        ({ newCards, newMaybe, missing } = CSVtoCards(items, carddb));
        cube.cards = newCards;
        cube.maybe = newMaybe;
        const addDetails = (cardList) =>
          cardList.map((card, index) => {
            card = { ...card, details: { ...carddb.cardFromId(card.cardID) }, index };
            if (!card.type_line) {
              card.type_line = card.details.type;
            }
            return card;
          });

        const cubeCards = addDetails(cards);
        const newDetails = addDetails(newCards);

        const { onlyA, onlyB } = await compareCubes(cubeCards, newDetails);
        changelog += onlyA.map(({ cardID }) => removeCardHtml(carddb.cardFromId(cardID))).join('');
        changelog += onlyB.map(({ cardID }) => addCardHtml(carddb.cardFromId(cardID))).join('');
        added.push(...onlyB);
      } else {
        // Eventually add plaintext support here.
        throw new Error('Invalid file format');
      }
      await updateCubeAndBlog(req, res, cube, changelog, added, missing);
      return null;
    }
    throw new Error('Received empty file');
  } catch (err) {
    return util.handleRouteError(req, res, err, `/cube/list/${req.params.id}`);
  }
});

router.get('/download/cubecobra/:id', async (req, res) => {
  try {
    const cube = await Cube.findOne(buildIdQuery(req.params.id)).lean();
    if (!cube) {
      req.flash('danger', `Cube ID ${req.params.id} not found/`);
      return res.redirect('/404');
    }

    res.setHeader('Content-disposition', `attachment; filename=${cube.name.replace(/\W/g, '')}.txt`);
    res.setHeader('Content-type', 'text/plain');
    res.charset = 'UTF-8';
    for (const card of cube.cards) {
      res.write(`${carddb.cardFromId(card.cardID).full_name}\r\n`);
    }
    return res.end();
  } catch (err) {
    return util.handleRouteError(req, res, err, '/404');
  }
});

function writeCard(res, card, maybe) {
  if (!card.type_line) {
    card.type_line = carddb.cardFromId(card.cardID).type;
  }
  const { name, rarity, colorcategory } = carddb.cardFromId(card.cardID);
  let { imgUrl } = card;
  if (imgUrl) {
    imgUrl = `"${imgUrl}"`;
  } else {
    imgUrl = '';
  }
  res.write(`"${name.replace(/"/, '""')}",`);
  res.write(`${card.cmc},`);
  res.write(`"${card.type_line.replace('—', '-')}",`);
  res.write(`${(card.colors || []).join('')},`);
  res.write(`"${carddb.cardFromId(card.cardID).set}",`);
  res.write(`"${carddb.cardFromId(card.cardID).collector_number}",`);
  res.write(`${card.rarity && card.rarity !== 'undefined' ? card.rarity : rarity},`);
  res.write(`${card.colorCategory || colorcategory},`);
  res.write(`${card.status},`);
  res.write(`${card.finish},`);
  res.write(`${maybe},`);
  res.write(`${imgUrl},"`);
  card.tags.forEach((tag, tagIndex) => {
    if (tagIndex !== 0) {
      res.write(', ');
    }
    res.write(tag);
  });
  res.write(`","${card.notes || ''}",`);
  res.write(`${carddb.cardFromId(card.cardID).mtgo_id || ''},`);
  res.write('\r\n');
}

router.get('/download/csv/:id', async (req, res) => {
  try {
    const cube = await Cube.findOne(buildIdQuery(req.params.id)).lean();

    if (!cube) {
      req.flash('danger', `Cube ID ${req.params.id} not found/`);
      return res.redirect('/404');
    }

    for (const card of cube.cards) {
      const details = carddb.cardFromId(card.cardID);
      card.details = details;
    }
    cube.cards = sortutil.sortForCSVDownload(cube.cards, req.query.primary, req.query.secondary, req.query.tertiary);

    res.setHeader('Content-disposition', `attachment; filename=${cube.name.replace(/\W/g, '')}.csv`);
    res.setHeader('Content-type', 'text/plain');
    res.charset = 'UTF-8';
    res.write(`${CSV_HEADER}\r\n`);

    for (const card of cube.cards) {
      writeCard(res, card, false);
    }
    if (Array.isArray(cube.maybe)) {
      for (const card of cube.maybe) {
        writeCard(res, card, true);
      }
    }
    return res.end();
  } catch (err) {
    return util.handleRouteError(req, res, err, '/404');
  }
});

router.get('/download/forge/:id', async (req, res) => {
  try {
    const cube = await Cube.findOne(buildIdQuery(req.params.id)).lean();

    if (!cube) {
      req.flash('danger', `Cube ID ${req.params.id} not found/`);
      return res.redirect('/404');
    }

    res.setHeader('Content-disposition', `attachment; filename=${cube.name.replace(/\W/g, '')}.dck`);
    res.setHeader('Content-type', 'text/plain');
    res.charset = 'UTF-8';
    res.write('[metadata]\r\n');
    res.write(`Name=${cube.name}\r\n`);
    res.write('[Main]\r\n');
    for (const card of cube.cards) {
      const { name } = carddb.cardFromId(card.cardID);
      const { set } = carddb.cardFromId(card.cardID);
      res.write(`1 ${name}|${set.toUpperCase()}\r\n`);
    }
    return res.end();
  } catch (err) {
    return util.handleRouteError(req, res, err, '/404');
  }
});

const exportToMtgo = (res, fileName, mainCards, sideCards) => {
  res.setHeader('Content-disposition', `attachment; filename=${fileName.replace(/\W/g, '')}.txt`);
  res.setHeader('Content-type', 'text/plain');
  res.charset = 'UTF-8';
  const main = {};
  for (const card of mainCards) {
    const { name } = carddb.cardFromId(card.cardID);
    if (main[name]) {
      main[name] += 1;
    } else {
      main[name] = 1;
    }
  }
  for (const [key, value] of Object.entries(main)) {
    const name = key.replace(' // ', '/');
    res.write(`${value} ${name}\r\n`);
  }
  res.write('\r\n\r\n');

  const side = {};
  for (const card of sideCards) {
    const { name } = carddb.cardFromId(card.cardID);
    if (side[name]) {
      side[name] += 1;
    } else {
      side[name] = 1;
    }
  }
  for (const [key, value] of Object.entries(side)) {
    const name = key.replace(' // ', '/');
    res.write(`${value} ${name}\r\n`);
  }
  return res.end();
};

router.get('/download/mtgo/:id', async (req, res) => {
  try {
    const cube = await Cube.findOne(buildIdQuery(req.params.id)).lean();
    if (!cube) {
      req.flash('danger', `Cube ID ${req.params.id} not found/`);
      return res.redirect('/404');
    }
    return exportToMtgo(res, cube.name, cube.cards, cube.maybe);
  } catch (err) {
    return util.handleRouteError(req, res, err, '/404');
  }
});

router.get('/download/xmage/:id', async (req, res) => {
  try {
    const cube = await Cube.findOne(buildIdQuery(req.params.id)).lean();
    if (!cube) {
      req.flash('danger', `Cube ID ${req.params.id} not found/`);
      return res.redirect('/404');
    }

    res.setHeader('Content-disposition', `attachment; filename=${cube.name.replace(/\W/g, '')}.dck`);
    res.setHeader('Content-type', 'text/plain');
    res.charset = 'UTF-8';
    for (const card of cube.cards) {
      const { name } = carddb.cardFromId(card.cardID);
      const { set } = carddb.cardFromId(card.cardID);
      const collectorNumber = carddb.cardFromId(card.cardID).collector_number;
      res.write(`1 [${set.toUpperCase()}:${collectorNumber}] ${name}\r\n`);
    }
    return res.end();
  } catch (err) {
    return util.handleRouteError(req, res, err, '/404');
  }
});

router.get('/download/plaintext/:id', async (req, res) => {
  try {
    const cube = await Cube.findOne(buildIdQuery(req.params.id)).lean();
    if (!cube) {
      req.flash('danger', `Cube ID ${req.params.id} not found/`);
      return res.redirect('/404');
    }

    res.setHeader('Content-disposition', `attachment; filename=${cube.name.replace(/\W/g, '')}.txt`);
    res.setHeader('Content-type', 'text/plain');
    res.charset = 'UTF-8';
    for (const card of cube.cards) {
      res.write(`${carddb.cardFromId(card.cardID).name}\r\n`);
    }
    return res.end();
  } catch (err) {
    return util.handleRouteError(req, res, err, '/404');
  }
});

function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

router.post('/startgriddraft/:id', body('packs').toInt({ min: 1, max: 16 }), async (req, res) => {
  try {
    const packs = parseInt(req.body.packs, 10);

    const numCards = packs * 9;

    const cube = await Cube.findOne(
      buildIdQuery(req.params.id),
      '_id name draft_formats card_count type cards owner',
    ).lean();

    if (!cube) {
      req.flash('danger', 'Cube not found');
      return res.status(404).render('misc/404', {});
    }

    if (cube.cards.length < numCards) {
      req.flash('danger', `Not enough cards, need ${numCards} cards for a ${packs} pack grid draft.`);
      return res.redirect(`/cube/playtest/${req.params.id}`);
    }

    const source = shuffle(cube.cards)
      .slice(0, numCards)
      .map((card, index) => {
        card.index = index;
        return card;
      });

    const gridDraft = new GridDraft();

    try {
      const response = await fetch(`${process.env.FLASKROOT}/embeddings/`, {
        method: 'post',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cards: source.map((card) => carddb.cardFromId(card.cardID).name_lower) }),
      });
      if (response.ok) {
        gridDraft.synergies = await response.json();
      } else {
        gridDraft.synergies = null;
      }
    } catch (err) {
      gridDraft.synergies = null;
    }

    gridDraft.cube = cube._id;
    gridDraft.basics = getBasics(carddb);

    const cards = [];
    for (let i = 0; i < packs; i++) {
      cards.push(source.splice(0, 9));
    }

    const pool = [];
    for (let i = 0; i < 16; i += 1) {
      pool.push([]);
    }

    gridDraft.initial_state = cards;
    gridDraft.unopenedPacks = cards;
    gridDraft.seats = [];

    // add human
    gridDraft.seats.push({
      bot: false,
      name: req.user ? req.user.username : 'Anonymous',
      userid: req.user ? req.user._id : null,
      drafted: pool,
      sideboard: pool,
      pickorder: [],
    });

    // add bot
    gridDraft.seats.push({
      bot: true,
      name: 'Grid Bot',
      userid: null,
      drafted: pool,
      sideboard: pool,
      pickorder: [],
    });

    await gridDraft.save();

    return res.redirect(`/cube/griddraft/${gridDraft._id}`);
  } catch (err) {
    return util.handleRouteError(req, res, err, `/cube/playtest/${req.params.id}`);
  }
});

router.post('/startsealed/:id', body('packs').toInt({ min: 1, max: 16 }), body('cards').toInt(), async (req, res) => {
  try {
    const user = await User.findById(req.user);

    if (!user) {
      req.flash('danger', 'Please Login to build a sealed deck.');
      return res.redirect(`/cube/playtest/${req.params.id}`);
    }

    const packs = parseInt(req.body.packs, 10);
    const cards = parseInt(req.body.cards, 10);

    const numCards = packs * cards;

    const cube = await Cube.findOne(buildIdQuery(req.params.id), '_id name draft_formats card_count type cards owner');

    if (!cube) {
      req.flash('danger', 'Cube not found');
      return res.status(404).render('misc/404', {});
    }

    if (cube.cards.length < numCards) {
      req.flash('danger', `Not enough cards, need ${numCards} cards for sealed with ${packs} packs of ${cards}.`);
      return res.redirect(`/cube/playtest/${req.params.id}`);
    }

    const source = shuffle(cube.cards).slice(0, numCards);
    const pool = [];
    for (let i = 0; i < 16; i += 1) {
      pool.push([]);
    }

    for (const card of source) {
      let index = 0;

      // sort by color
      const details = carddb.cardFromId(card.cardID);
      const type = card.type_line || details.type;
      const colors = card.colors || details.colors;

      if (type.toLowerCase().includes('land')) {
        index = 7;
      } else if (colors.length === 1) {
        index = ['W', 'U', 'B', 'R', 'G'].indexOf(colors[0].toUpperCase());
      } else if (colors.length === 0) {
        index = 6;
      } else {
        index = 5;
      }

      if (!type.toLowerCase().includes('creature')) {
        index += 8;
      }

      if (pool[index]) {
        pool[index].push(card);
      } else {
        pool[0].push(card);
      }
    }

    const deck = new Deck();
    deck.cube = cube._id;
    deck.date = Date.now();
    deck.comments = [];
    deck.cubename = cube.name;
    deck.seats = [];

    deck.seats.push({
      userid: user._id,
      username: user.username,
      pickorder: [],
      name: `Sealed from ${cube.name}`,
      description: '',
      cols: 16,
      deck: pool,
      sideboard: [],
    });
    deck.draft = await createDraftForSingleDeck(deck);

    await deck.save();

    if (!cube.numDecks) {
      cube.numDecks = 0;
    }
    cube.numDecks += 1;

    await cube.save();

    const cubeOwner = await User.findById(cube.owner);

    await util.addNotification(
      cubeOwner,
      user,
      `/cube/deck/${deck._id}`,
      `${user.username} built a sealed deck from your cube: ${cube.name}`,
    );

    return res.redirect(`/cube/deckbuilder/${deck._id}`);
  } catch (err) {
    return util.handleRouteError(req, res, err, `/cube/playtest/${req.params.id}`);
  }
});

router.get('/deck/download/xmage/:id/:seat', async (req, res) => {
  try {
    const deck = await Deck.findById(req.params.id).lean();

    if (!deck) {
      req.flash('danger', `Deck ID ${req.params.id} not found/`);
      return res.redirect('/404');
    }

    const seat = deck.seats[req.params.seat];

    res.setHeader('Content-disposition', `attachment; filename=${seat.name.replace(/\W/g, '')}.dck`);
    res.setHeader('Content-type', 'text/plain');
    res.charset = 'UTF-8';
    res.write(`NAME:${seat.name}\r\n`);
    const main = {};
    for (const col of seat.deck) {
      for (const card of col) {
        const details = carddb.cardFromId(card.cardID);
        const name = `[${details.set.toUpperCase()}:${details.collector_number}] ${details.name}`;
        if (main[name]) {
          main[name] += 1;
        } else {
          main[name] = 1;
        }
      }
    }
    for (const [key, value] of Object.entries(main)) {
      res.write(`${value} ${key}\r\n`);
    }

    const side = {};
    for (const col of seat.sideboard) {
      for (const card of col) {
        const details = carddb.cardFromId(card.cardID);
        const name = `[${details.set.toUpperCase()}:${details.collector_number}] ${details.name}`;
        if (side[name]) {
          side[name] += 1;
        } else {
          side[name] = 1;
        }
      }
    }
    for (const [key, value] of Object.entries(side)) {
      res.write(`SB: ${value} ${key}\r\n`);
    }
    return res.end();
  } catch (err) {
    return util.handleRouteError(req, res, err, '/404');
  }
});

router.get('/deck/download/forge/:id/:seat', async (req, res) => {
  try {
    const deck = await Deck.findById(req.params.id).lean();
    if (!deck) {
      req.flash('danger', `Deck ID ${req.params.id} not found/`);
      return res.redirect('/404');
    }
    const seat = deck.seats[req.params.seat];

    res.setHeader('Content-disposition', `attachment; filename=${seat.name.replace(/\W/g, '')}.dck`);
    res.setHeader('Content-type', 'text/plain');
    res.charset = 'UTF-8';
    res.write('[metadata]\r\n');
    res.write(`Name=${seat.name}\r\n`);
    res.write('[Main]\r\n');
    const main = {};
    for (const col of seat.deck) {
      for (const card of col) {
        const details = carddb.cardFromId(card.cardID);
        const name = `${details.name}|${details.set.toUpperCase()}`;
        if (main[name]) {
          main[name] += 1;
        } else {
          main[name] = 1;
        }
      }
    }
    for (const [key, value] of Object.entries(main)) {
      res.write(`${value} ${key}\r\n`);
    }

    res.write('[Side]\r\n');
    const side = {};
    for (const col of seat.sideboard) {
      for (const card of col) {
        const details = carddb.cardFromId(card.cardID);
        const name = `${details.name}|${details.set.toUpperCase()}`;
        if (side[name]) {
          side[name] += 1;
        } else {
          side[name] = 1;
        }
      }
    }
    for (const [key, value] of Object.entries(side)) {
      res.write(`${value} ${key}\r\n`);
    }

    return res.end();
  } catch (err) {
    return util.handleRouteError(req, res, err, '/404');
  }
});

router.get('/deck/download/txt/:id/:seat', async (req, res) => {
  try {
    const deck = await Deck.findById(req.params.id).lean();
    if (!deck) {
      req.flash('danger', `Deck ID ${req.params.id} not found/`);
      return res.redirect('/404');
    }
    const seat = deck.seats[req.params.seat];

    res.setHeader('Content-disposition', `attachment; filename=${seat.name.replace(/\W/g, '')}.txt`);
    res.setHeader('Content-type', 'text/plain');
    res.charset = 'UTF-8';
    for (const col of seat.deck) {
      for (const card of col) {
        const { name } = carddb.cardFromId(card.cardID);
        res.write(`${name}\r\n`);
      }
    }
    return res.end();
  } catch (err) {
    return util.handleRouteError(req, res, err, '/404');
  }
});

router.get('/deck/download/mtgo/:id/:seat', async (req, res) => {
  try {
    const deck = await Deck.findById(req.params.id).lean();
    if (!deck) {
      req.flash('danger', `Deck ID ${req.params.id} not found/`);
      return res.redirect('/404');
    }
    const seat = deck.seats[req.params.seat];
    return exportToMtgo(res, seat.name, seat.deck.flat(), seat.sideboard.flat());
  } catch (err) {
    return util.handleRouteError(req, res, err, '/404');
  }
});

router.get('/deck/download/arena/:id/:seat', async (req, res) => {
  try {
    const deck = await Deck.findById(req.params.id).lean();
    if (!deck) {
      req.flash('danger', `Deck ID ${req.params.id} not found/`);
      return res.redirect('/404');
    }
    const seat = deck.seats[req.params.seat];

    res.setHeader('Content-disposition', `attachment; filename=${seat.name.replace(/\W/g, '')}.txt`);
    res.setHeader('Content-type', 'text/plain');
    res.charset = 'UTF-8';
    res.write('Deck\r\n');
    const main = {};
    for (const col of seat.deck) {
      for (const card of col) {
        const details = carddb.cardFromId(card.cardID);
        const name = `${details.name} (${details.set.toUpperCase()}) ${details.collector_number}`;
        if (main[name]) {
          main[name] += 1;
        } else {
          main[name] = 1;
        }
      }
    }
    for (const [key, value] of Object.entries(main)) {
      res.write(`${value} ${key}\r\n`);
    }

    res.write('\r\nSideboard\r\n');
    const side = {};
    for (const col of seat.sideboard) {
      for (const card of col) {
        const details = carddb.cardFromId(card.cardID);
        const name = `${details.name} (${details.set.toUpperCase()}) ${details.collector_number}`;
        if (side[name]) {
          side[name] += 1;
        } else {
          side[name] = 1;
        }
      }
    }
    for (const [key, value] of Object.entries(side)) {
      res.write(`${value} ${key}\r\n`);
    }

    return res.end();
  } catch (err) {
    return util.handleRouteError(req, res, err, '/404');
  }
});

router.get('/deck/download/cockatrice/:id/:seat', async (req, res) => {
  try {
    const deck = await Deck.findById(req.params.id).lean();
    if (!deck) {
      req.flash('danger', `Deck ID ${req.params.id} not found/`);
      return res.redirect('/404');
    }
    const seat = deck.seats[req.params.seat];

    res.setHeader('Content-disposition', `attachment; filename=${seat.name.replace(/\W/g, '')}.txt`);
    res.setHeader('Content-type', 'text/plain');
    res.charset = 'UTF-8';
    const main = {};
    for (const col of seat.deck) {
      for (const card of col) {
        const details = carddb.cardFromId(card.cardID);
        const name = `${details.name}`;
        if (main[name]) {
          main[name] += 1;
        } else {
          main[name] = 1;
        }
      }
    }
    for (const [key, value] of Object.entries(main)) {
      res.write(`${value}x ${key}\r\n`);
    }

    res.write('Sideboard\r\n');
    const side = {};
    for (const col of seat.sideboard) {
      for (const card of col) {
        const details = carddb.cardFromId(card.cardID);
        const name = `${details.name}`;
        if (side[name]) {
          side[name] += 1;
        } else {
          side[name] = 1;
        }
      }
    }
    for (const [key, value] of Object.entries(side)) {
      res.write(`${value}x ${key}\r\n`);
    }

    return res.end();
  } catch (err) {
    return util.handleRouteError(req, res, err, '/404');
  }
});

router.post(
  '/startdraft/:id',
  body('id').toInt(),
  body('botsOnly').toBoolean(),
  body('seats').toInt({ min: 2, max: 16 }),
  body('packs').toInt({ min: 1, max: 36 }),
  body('cards').toInt({ min: 1, max: 90 }),
  async (req, res) => {
    try {
      const cube = await Cube.findOne(
        buildIdQuery(req.params.id),
        '_id name draft_formats card_count type cards',
      ).lean();

      if (!cube) {
        req.flash('danger', 'Cube not found');
        return res.status(404).render('misc/404', {});
      }

      if (cube.cards.length === 0) {
        // This is a 4XX error, not a 5XX error
        req.flash('danger', 'This cube has no cards!');
        return res.redirect(`/cube/playtest/${req.params.id}`);
      }

      const params = req.body;

      // insert card details everywhere that needs them
      for (const card of cube.cards) {
        card.details = carddb.cardFromId(card.cardID);
      }
      const elo = await getElo(cube.cards.map((card) => card.details.name));
      for (const card of cube.cards) {
        card.rating = elo[card.details.name];
      }

      // setup draft
      const bots = draftutil.getDraftBots(params);
      const format = draftutil.getDraftFormat(params, cube);

      let draft = new Draft();
      let populated = {};
      try {
        populated = draftutil.createDraft(
          format,
          cube.cards,
          bots,
          params.seats,
          req.user ? req.user : { username: 'Anonymous' },
        );
      } catch (err) {
        // This is a 4XX error, not a 5XX error
        req.flash('danger', err.message);
        return res.redirect(`/cube/playtest/${req.params.id}`);
      }

      draft.initial_state = populated.initial_state;
      draft.unopenedPacks = populated.unopenedPacks;
      draft.seats = populated.seats;
      draft.cube = cube._id;
      draft.basics = getBasics(carddb);

      const cards = draft.initial_state.flat(3);

      try {
        const response = await fetch(`${process.env.FLASKROOT}/embeddings/`, {
          method: 'post',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ cards: cards.map((card) => carddb.cardFromId(card.cardID).name_lower) }),
        });
        if (response.ok) {
          draft.synergies = await response.json();
        } else {
          draft.synergies = null;
        }
      } catch (err) {
        draft.synergies = null;
      }
      await draft.save();
      if (req.body.botsOnly) {
        draft = await Draft.findById(draft._id).lean();
        // insert card details everywhere that needs them
        for (const seat of draft.unopenedPacks) {
          for (const pack of seat) {
            for (const card of pack) {
              card.details = carddb.cardFromId(
                card.cardID,
                'cmc type image_normal parsed_cost image_flip name color_identity',
              );
            }
          }
        }

        for (const seat of draft.seats) {
          for (const collection of [seat.drafted, seat.sideboard, seat.packbacklog]) {
            for (const pack of collection) {
              for (const card of pack) {
                card.details = carddb.cardFromId(card.cardID);
              }
            }
          }
          for (const card of seat.pickorder) {
            card.details = carddb.cardFromId(card.cardID);
          }
        }
        for (const key of Object.keys(draft.basics)) {
          draft.basics[key].details = carddb.cardFromId(draft.basics[key].cardID);
        }
        return res.status(200).send({
          success: 'true',
          draft,
        });
      }
      return res.redirect(`/cube/draft/${draft._id}`);
    } catch (err) {
      return util.handleRouteError(req, res, err, `/cube/playtest/${req.params.id}`);
    }
  },
);

router.get('/griddraft/:id', async (req, res) => {
  try {
    const draft = await GridDraft.findById(req.params.id).lean();
    if (!draft) {
      req.flash('danger', 'Draft not found');
      return res.status(404).render('misc/404', {});
    }

    const cube = await Cube.findOne(buildIdQuery(draft.cube)).lean();

    if (!cube) {
      req.flash('danger', 'Cube not found');
      return res.status(404).render('misc/404', {});
    }

    const user = await User.findById(cube.owner);
    if (!user) {
      req.flash('danger', 'Owner not found');
      return res.status(404).render('misc/404', {});
    }

    // insert card details everywhere that needs them
    for (const pack of draft.unopenedPacks) {
      for (const card of pack) {
        card.details = carddb.cardFromId(card.cardID, 'cmc type image_normal image_flip name color_identity');
      }
    }

    for (const seat of draft.seats) {
      for (const collection of [seat.drafted, seat.sideboard]) {
        for (const pack of collection) {
          for (const card of pack) {
            card.details = carddb.cardFromId(card.cardID);
          }
        }
      }
      for (const card of seat.pickorder) {
        card.details = carddb.cardFromId(card.cardID);
      }
    }
    if (draft.basics) {
      for (const key of Object.keys(draft.basics)) {
        draft.basics[key].details = carddb.cardFromId(draft.basics[key].cardID);
      }
    }

    const reactProps = {
      cube,
      cubeID: getCubeId(cube),
      initialDraft: draft,
    };

    return res.render('cube/grid_draft', {
      reactHTML: CubeDraftPage
        ? ReactDOMServer.renderToString(React.createElement(CubeDraftPage, reactProps))
        : undefined,
      reactProps: serialize(reactProps),
      title: `${abbreviate(cube.name)} - Grift Draft`,
      metadata: generateMeta(
        `Cube Cobra Grid Draft: ${cube.name}`,
        cube.type ? `${cube.card_count} Card ${cube.type} Cube` : `${cube.card_count} Card Cube`,
        cube.image_uri,
        `https://cubecobra.com/cube/griddraft/${req.params.id}`,
      ),
    });
  } catch (err) {
    return util.handleRouteError(req, res, err, '/404');
  }
});

router.get('/draft/:id', async (req, res) => {
  try {
    const draft = await Draft.findById(req.params.id).lean();
    if (!draft) {
      req.flash('danger', 'Draft not found');
      return res.status(404).render('misc/404', {});
    }

    const cube = await Cube.findOne(buildIdQuery(draft.cube)).lean();

    if (!cube) {
      req.flash('danger', 'Cube not found');
      return res.status(404).render('misc/404', {});
    }

    const user = await User.findById(cube.owner);
    if (!user) {
      req.flash('danger', 'Owner not found');
      return res.status(404).render('misc/404', {});
    }

    // insert card details everywhere that needs them
    for (const seat of draft.unopenedPacks) {
      for (const pack of seat) {
        for (const card of pack) {
          card.details = carddb.cardFromId(card.cardID, 'cmc type image_normal image_flip name color_identity');
        }
      }
    }

    for (const seat of draft.seats) {
      for (const collection of [seat.drafted, seat.sideboard, seat.packbacklog]) {
        for (const pack of collection) {
          for (const card of pack) {
            card.details = carddb.cardFromId(card.cardID);
          }
        }
      }
      for (const card of seat.pickorder) {
        card.details = carddb.cardFromId(card.cardID);
      }
    }
    if (draft.basics) {
      for (const key of Object.keys(draft.basics)) {
        draft.basics[key].details = carddb.cardFromId(draft.basics[key].cardID);
      }
    }

    const reactProps = {
      cube,
      cubeID: getCubeId(cube),
      initialDraft: draft,
    };

    return res.render('cube/cube_draft', {
      reactHTML: CubeDraftPage
        ? ReactDOMServer.renderToString(React.createElement(CubeDraftPage, reactProps))
        : undefined,
      reactProps: serialize(reactProps),
      title: `${abbreviate(cube.name)} - Draft`,
      metadata: generateMeta(
        `Cube Cobra Draft: ${cube.name}`,
        cube.type ? `${cube.card_count} Card ${cube.type} Cube` : `${cube.card_count} Card Cube`,
        cube.image_uri,
        `https://cubecobra.com/cube/draft/${req.params.id}`,
      ),
      loginCallback: `/cube/draft/${req.params.id}`,
    });
  } catch (err) {
    return util.handleRouteError(req, res, err, '/404');
  }
});

// Edit Submit POST Route
router.post('/edit/:id', ensureAuth, async (req, res) => {
  try {
    req.body.blog = sanitize(req.body.blog);
    let cube = await Cube.findOne(buildIdQuery(req.params.id));

    if (!req.user._id.equals(cube.owner)) {
      req.flash('danger', 'Only cube owner may edit.');
      return res.redirect(`/cube/list/${req.params.id}`);
    }

    cube.date_updated = Date.now();
    cube.updated_string = cube.date_updated.toLocaleString('en-US');

    const edits = req.body.body.split(';');
    const removes = new Set();
    const adds = [];
    let changelog = '';

    for (const edit of edits) {
      if (edit.charAt(0) === '+') {
        // add id
        const details = carddb.cardFromId(edit.substring(1));
        if (!details) {
          req.logger.error({ message: `Card not found: ${edit}` });
        } else {
          adds.push(details);
          changelog += addCardHtml(details);
        }
      } else if (edit.charAt(0) === '-') {
        // remove id
        const [indexOutStr, outID] = edit.substring(1).split('$');
        const indexOut = parseInt(indexOutStr, 10);

        if (!Number.isInteger(indexOut) || indexOut < 0 || indexOut >= cube.cards.length) {
          req.flash('danger', `Unable to remove card due to invalid index: ${carddb.cardFromId(outID).name}`);
        } else {
          const card = cube.cards[indexOut];
          if (card.cardID === outID) {
            removes.add(indexOut);
            changelog += removeCardHtml(carddb.cardFromId(card.cardID));
          } else {
            req.flash('danger', `Unable to remove card due outdated index: ${carddb.cardFromId(outID).name}`);
          }
        }
      } else if (edit.charAt(0) === '/') {
        const [outStr, idIn] = edit.substring(1).split('>');
        const detailsIn = carddb.cardFromId(idIn);
        if (!detailsIn) {
          req.logger.error({ message: `Card not found: ${edit}` });
        } else {
          adds.push(detailsIn);
        }

        const [indexOutStr, outID] = outStr.split('$');
        const indexOut = parseInt(indexOutStr, 10);
        if (!Number.isInteger(indexOut) || indexOut < 0 || indexOut >= cube.cards.length) {
          req.flash('danger', `Unable to replace card due to invalid index: ${carddb.cardFromId(outID).name}`);
          changelog += addCardHtml(detailsIn);
        } else {
          const cardOut = cube.cards[indexOut];
          if (cardOut.cardID === outID) {
            removes.add(indexOut);
            changelog += replaceCardHtml(carddb.cardFromId(cardOut.cardID), detailsIn);
          } else {
            req.flash('danger', `Unable to replace card due outdated index: ${carddb.cardFromId(outID).name}`);
            changelog += addCardHtml(detailsIn);
          }
        }
      } else {
        req.flash('danger', 'Bad request format, all operations must be add, remove, or replace.');
        return res.redirect(`/cube/list/${req.params.id}`);
      }
    }

    // Filter out removed and invalid cards, and add new cards.
    const newCards = adds.map((add) => util.newCard(add, [], cube.defaultStatus));
    cube.cards = cube.cards.filter((card, index) => card.cardID && !removes.has(index)).concat(newCards);
    cube.maybe = cube.maybe.filter((maybeCard) => !adds.some((addedCard) => addedCard._id === maybeCard.cardID));

    const blogpost = new Blog();
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

    cube = setCubeType(cube, carddb);

    await Promise.all([blogpost.save(), cube.save()]);

    req.flash('success', 'Cube Updated');
    return res.redirect(`/cube/list/${req.params.id}?updated=true`);
  } catch (err) {
    return util.handleRouteError(req, res, err, `/cube/list/${req.params.id}`);
  }
});

// API routes
router.get('/api/cardnames', (_, res) => {
  return res.status(200).send({
    success: 'true',
    cardnames: carddb.cardtree,
  });
});

// Get the full card images including image_normal and image_flip
router.get('/api/cardimages', (_, res) => {
  return res.status(200).send({
    success: 'true',
    cardimages: carddb.cardimages,
  });
});

router.get('/blogpost/:id', async (req, res) => {
  try {
    const post = await Blog.findById(req.params.id);
    const owner = await User.findById(post.owner);

    return res.render('cube/blogpost', {
      post,
      owner: owner._id,
      loginCallback: `/blogpost/${req.params.id}`,
    });
  } catch (err) {
    return util.handleRouteError(req, res, err, '/404');
  }
});

router.get('/viewcomment/:id/:position', async (req, res) => {
  try {
    const { position, id } = req.params;

    const post = await Blog.findById(req.params.id);
    const owner = await User.findById(post.owner);

    return res.render('cube/blogpost', {
      post,
      owner: owner._id,
      loginCallback: `/blogpost/${id}`,
      position: position.split('-'),
    });
  } catch (err) {
    return util.handleRouteError(req, res, err, '/404');
  }
});

router.post(
  '/api/editcomment',
  ensureAuth,
  util.wrapAsyncApi(async (req, res) => {
    const post = await Blog.findById(req.body.id);
    const { user } = req;

    if (!user._id.equals(post.owner)) {
      return res.status(403).send({
        success: 'false',
        message: 'Only post owner may edit',
      });
    }

    if (!post) {
      return res.status(404).send({
        success: 'false',
        message: 'Post not found',
      });
    }

    req.body.comment.content = sanitize(req.body.comment.content);
    saveEdit(post.comments, req.body.position.slice(0, 22), req.body.comment);
    await post.save();
    return res.status(200).send({
      success: 'true',
    });
  }),
);

router.post(
  '/api/editoverview',
  ensureAuth,
  body('name', 'Cube name should be between 5 and 100 characters long.').isLength({ min: 5, max: 100 }),
  body('name', 'Cube name may not use profanity.').custom((value) => !util.hasProfanity(value)),
  body('urlAlias', 'Custom URL must contain only alphanumeric characters or underscores.').matches(/[A-Za-z0-9]*/),
  body('urlAlias', `Custom URL may not be longer than 100 characters.`).isLength({ max: 100 }),
  body('urlAlias', 'Custom URL may not use profanity.').custom((value) => !util.hasProfanity(value)),
  jsonValidationErrors,
  util.wrapAsyncApi(async (req, res) => {
    const updatedCube = req.body;

    const cube = await Cube.findById(updatedCube._id);
    if (!cube) {
      return res.status(404).send({
        success: 'false',
        message: 'Cube Not Found',
      });
    }

    const { user } = req;
    if (!user._id.equals(cube.owner)) {
      return res.status(403).send({
        success: 'false',
        message: 'Unauthorized',
      });
    }

    if (updatedCube.urlAlias && updatedCube.urlAlias.length > 0 && updatedCube.urlAlias !== cube.urlAlias) {
      updatedCube.urlAlias = updatedCube.urlAlias.toLowerCase();
      const taken = await Cube.findOne(buildIdQuery(updatedCube.urlAlias));

      if (taken) {
        return res.status(400).send({
          success: 'false',
          message: 'Custom URL already taken.',
        });
      }

      cube.urlAlias = updatedCube.urlAlias;
    } else if (!updatedCube.urlAlias || updatedCube.urlAlias === '') {
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
    setCubeType(cube, carddb);

    // cube category override
    if (cube.overrideCategory) {
      const categories = ['Vintage', 'Legacy+', 'Legacy', 'Modern', 'Pioneer', 'Historic', 'Standard', 'Set'];
      const prefixes = [
        'Powered',
        'Unpowered',
        'Pauper',
        'Peasant',
        'Budget',
        'Silver-bordered',
        'Commander',
        'Battle Box',
        'Multiplayer',
        'Judge Tower',
      ];

      if (!categories.includes(updatedCube.categoryOverride)) {
        return res.status(400).send({
          success: 'false',
          message: 'Not a valid category override.',
        });
      }

      for (let i = 0; i < updatedCube.categoryPrefixes.length; i += 1) {
        if (!prefixes.includes(updatedCube.categoryPrefixes[i])) {
          return res.status(400).send({
            success: 'false',
            message: 'Not a valid category prefix.',
          });
        }
      }

      cube.categoryOverride = updatedCube.categoryOverride;
      cube.categoryPrefixes = updatedCube.categoryPrefixes;
    }

    // cube tags
    cube.tags = updatedCube.tags;

    await cube.save();
    return res.status(200).send({
      success: 'true',
      descriptionhtml: addAutocard(cube.descriptionhtml, carddb, cube),
    });
  }),
);

router.post(
  '/api/settings/:id',
  ensureAuth,
  body('isListed').toBoolean(),
  body('privatePrices').toBoolean(),
  body('defaultStatus', 'Status must be valid.').isIn(['Owned', 'Not Owned']),
  body('defaultPrinting', 'Printing must be valid.').isIn(['recent', 'first']),
  jsonValidationErrors,
  util.wrapAsyncApi(async (req, res) => {
    const cube = await Cube.findOne(buildIdQuery(req.params.id));
    if (!cube) {
      return res.status(404).send({
        success: 'false',
        message: 'Cube Not Found',
      });
    }

    if (!req.user._id.equals(cube.owner)) {
      return res.status(403).send({
        success: 'false',
        message: 'Unauthorized',
      });
    }

    const update = req.body;
    for (const field of ['isListed', 'privatePrices', 'defaultStatus', 'defaultPrinting']) {
      if (update[field] !== undefined) {
        cube[field] = update[field];
      }
    }

    await cube.save();
    return res.status(200).send({ success: 'true' });
  }),
);

router.post(
  '/api/postdeckcomment',
  ensureAuth,
  util.wrapAsyncApi(async (req, res) => {
    const deck = await Deck.findById(req.body.id);
    const { user } = req;

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

    // slice limits the recursive depth
    const comment = insertComment(deck.comments, req.body.position.slice(0, 22), {
      owner: user._id,
      ownerName: user.username,
      ownerImage: '',
      content: sanitize(req.body.content),
      // the -1000 is to prevent weird time display error
      timePosted: Date.now() - 1000,
      comments: [],
    });

    // give notification to owner
    if (req.body.position.length === 0) {
      // owner is blog deck owner
      const owner = await User.findById(deck.seats[0].userid);
      await util.addNotification(
        owner,
        user,
        `/cube/deck/${deck._id}`,
        `${user.username} added a comment to ${deck.name}`,
      );
    } else {
      // need to find owner from comment tree
      const owner = await User.findById(getOwnerFromComment(deck.comments, req.body.position));
      await util.addNotification(
        owner,
        user,
        `/cube/deck/${deck._id}`,
        `${user.username} replied to your comment on ${deck.name}`,
      );
    }

    await deck.save();
    return res.status(200).send({
      success: 'true',
      comment,
    });
  }),
);

router.post(
  '/api/postcomment',
  ensureAuth,
  util.wrapAsyncApi(async (req, res) => {
    const post = await Blog.findById(req.body.id);
    const { user } = req;

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

    // slice limits the recursive depth
    const comment = insertComment(post.comments, req.body.position.slice(0, 22), {
      owner: user._id,
      ownerName: user.username,
      ownerImage: '',
      content: sanitize(req.body.content),
      // the -1000 is to prevent weird time display error
      timePosted: Date.now() - 1000,
      comments: [],
    });

    // give notification to owner
    if (req.body.position.length === 0) {
      // owner is blog post owner
      const owner = await User.findById(post.owner);
      await util.addNotification(
        owner,
        user,
        `/cube/blogpost/${post._id}`,
        `${user.username} added a comment to ${post.title}`,
      );
    } else {
      // need to find owner from comment tree
      const owner = await User.findById(getOwnerFromComment(post.comments, req.body.position));
      let positionText = '';
      for (const pos of req.body.position) {
        positionText += `${pos}-`;
      }
      positionText += comment.index;
      await util.addNotification(
        owner,
        user,
        `/cube/viewcomment/${post._id}/${positionText}`,
        `${user.username} replied to your comment on ${post.title}`,
      );
    }

    await post.save();
    return res.status(200).send({
      success: 'true',
      comment,
    });
  }),
);

router.get('/api/imagedict', (_, res) => {
  res.status(200).send({
    success: 'true',
    dict: carddb.imagedict,
  });
});

router.get('/api/fullnames', (_, res) => {
  res.status(200).send({
    success: 'true',
    cardnames: carddb.full_names,
  });
});

router.get(
  '/api/cubecardnames/:id',
  util.wrapAsyncApi(async (req, res) => {
    const cube = await Cube.findOne(buildIdQuery(req.params.id)).lean();

    const cardnames = [];
    for (const card of cube.cards) {
      util.binaryInsert(carddb.cardFromId(card.cardID).name, cardnames);
    }

    const result = util.turnToTree(cardnames);
    return res.status(200).send({
      success: 'true',
      cardnames: result,
    });
  }),
);

router.post(
  '/api/saveshowtagcolors',
  ensureAuth,
  body('show_tag_colors').toBoolean(),
  jsonValidationErrors,
  util.wrapAsyncApi(async (req, res) => {
    req.user.hide_tag_colors = !req.body.show_tag_colors;
    await req.user.save();

    return res.status(200).send({
      success: 'true',
    });
  }),
);

router.post(
  '/api/savetagcolors/:id',
  util.wrapAsyncApi(async (req, res) => {
    const cube = await Cube.findOne(buildIdQuery(req.params.id));

    if (!req.user._id.equals(cube.owner)) {
      return res.status(401).send({
        success: 'false',
      });
    }

    cube.tag_colors = req.body;

    await cube.save();
    return res.status(200).send({
      success: 'true',
    });
  }),
);

router.get(
  '/api/cubetagcolors/:id',
  util.wrapAsyncApi(async (req, res) => {
    const cube = await Cube.findOne(buildIdQuery(req.params.id)).lean();

    const tagColors = buildTagColors(cube);
    const tags = tagColors.map((item) => item.tag);

    // this is for the case of cube compare
    const cubeB = await Cube.findOne(buildIdQuery(req.query.b_id)).lean();

    if (cubeB) {
      const bTagColors = buildTagColors(cubeB);
      for (const bTag of bTagColors) {
        if (!tags.includes(bTag.tag)) {
          tagColors.push(bTag);
        }
      }
    }

    const showTagColors = req.user ? !req.user.hide_tag_colors : true;

    res.status(200).send({
      success: 'true',
      tagColors,
      showTagColors,
    });
  }),
);

router.get(
  '/api/getcardfromcube/:id',
  util.wrapAsyncApi(async (req, res) => {
    const split = req.params.id.split(';');
    const cubeid = split[0];
    let cardname = split[1];
    cardname = cardutil.decodeName(cardname);
    cardname = cardutil.normalizeName(cardname);

    const cube = await Cube.findOne(buildIdQuery(cubeid)).lean();

    for (const card of cube.cards) {
      if (carddb.cardFromId(card.cardID).name_lower === cardname) {
        card.details = carddb.cardFromId(card.cardID);
        return res.status(200).send({
          success: 'true',
          card: card.details,
        });
      }
    }
    return res.status(200).send({
      success: 'true',
    });
  }),
);

router.get(
  '/api/cubelist/:id',
  util.wrapAsyncApi(async (req, res) => {
    const cube = await Cube.findOne(buildIdQuery(req.params.id)).lean();

    if (!cube) {
      return res.status(404).send('Cube not found.');
    }

    const names = cube.cards.map((card) => carddb.cardFromId(card.cardID).name);
    res.contentType('text/plain');
    res.set('Access-Control-Allow-Origin', '*');
    return res.status(200).send(names.join('\n'));
  }),
);

router.get(
  '/api/cubeJSON/:id',
  util.wrapAsyncApi(async (req, res) => {
    const cube = await Cube.findOne(buildIdQuery(req.params.id)).lean();

    if (!cube) {
      return res.status(404).send('Cube not found.');
    }

    res.contentType('text/json');
    res.set('Access-Control-Allow-Origin', '*');
    return res.status(200).send(JSON.stringify(cube));
  }),
);

router.post('/editdeck/:id', ensureAuth, async (req, res) => {
  try {
    const deck = await Deck.findById(req.params.id);
    const deckOwner = await User.findById(deck.seats[0].userid);

    if (!deckOwner || !deckOwner._id.equals(req.user._id)) {
      req.flash('danger', 'Unauthorized');
      return res.status(404).render('misc/404', {});
    }

    const newdeck = JSON.parse(req.body.draftraw);
    const name = JSON.parse(req.body.name);
    const description = sanitize(JSON.parse(req.body.description));

    deck.seats[0].deck = newdeck.playerdeck;
    deck.seats[0].sideboard = newdeck.playersideboard;
    deck.cols = newdeck.cols;
    deck.seats[0].name = name;
    deck.seats[0].description = description;

    await deck.save();

    req.flash('success', 'Deck saved successfully');
    return res.redirect(`/cube/deck/${deck._id}`);
  } catch (err) {
    return util.handleRouteError(req, res, err, '/404');
  }
});

router.post('/submitdeck/:id', body('skipDeckbuilder').toBoolean(), async (req, res) => {
  try {
    // req.body contains a draft
    const draftid = req.body.body;
    const draft = await Draft.findById(draftid).lean();
    const cube = await Cube.findOne(buildIdQuery(draft.cube));

    const deck = new Deck();
    deck.cube = draft.cube;
    deck.date = Date.now();
    deck.comments = [];
    deck.draft = draft._id;
    deck.cubename = cube.name;
    deck.seats = [];

    for (const seat of draft.seats) {
      deck.seats.push({
        bot: seat.bot,
        userid: seat.userid,
        username: seat.name,
        pickorder: seat.pickorder,
        name: `Draft of ${cube.name}`,
        description: '',
        cols: 16,
        deck: seat.drafted,
        sideboard: seat.sideboard ? seat.sideboard : [],
      });
    }

    if (!cube.numDecks) {
      cube.numDecks = 0;
    }
    cube.numDecks += 1;

    const userq = User.findById(deck.seats[0].userid);
    const cubeOwnerq = User.findById(cube.owner);

    const [user, cubeOwner] = await Promise.all([userq, cubeOwnerq]);

    if (user) {
      await util.addNotification(
        cubeOwner,
        user,
        `/cube/deck/${deck._id}`,
        `${user.username} drafted your cube: ${cube.name}`,
      );
    }

    await Promise.all([cube.save(), deck.save(), cubeOwner.save()]);
    if (req.body.skipDeckbuilder) {
      return res.redirect(`/cube/deck/${deck._id}`);
    }
    return res.redirect(`/cube/deckbuilder/${deck._id}`);
  } catch (err) {
    return util.handleRouteError(req, res, err, `/cube/playtest/${req.params.id}`);
  }
});

router.post('/submitgriddeck/:id', body('skipDeckbuilder').toBoolean(), async (req, res) => {
  try {
    // req.body contains a draft
    const draftid = req.body.body;
    const draft = await GridDraft.findById(draftid).lean();
    const cube = await Cube.findOne(buildIdQuery(draft.cube));

    const deck = new Deck();
    deck.cube = draft.cube;
    deck.date = Date.now();
    deck.comments = [];
    deck.draft = draft._id;
    deck.cubename = cube.name;
    deck.seats = [];

    for (const seat of draft.seats) {
      deck.seats.push({
        bot: seat.bot,
        userid: seat.userid,
        username: seat.name,
        pickorder: seat.pickorder,
        name: `Grid Draft of ${cube.name}`,
        description: '',
        cols: 16,
        deck: seat.drafted,
        sideboard: seat.sideboard ? seat.sideboard : [],
      });
    }

    if (!cube.numDecks) {
      cube.numDecks = 0;
    }
    cube.numDecks += 1;

    const userq = User.findById(deck.seats[0].userid);
    const cubeOwnerq = User.findById(cube.owner);

    const [user, cubeOwner] = await Promise.all([userq, cubeOwnerq]);

    if (user) {
      await util.addNotification(
        cubeOwner,
        user,
        `/cube/deck/${deck._id}`,
        `${user.username} drafted your cube: ${cube.name}`,
      );
    }

    await Promise.all([cube.save(), deck.save(), cubeOwner.save()]);
    if (req.body.skipDeckbuilder) {
      return res.redirect(`/cube/deck/${deck._id}`);
    }
    return res.redirect(`/cube/deckbuilder/${deck._id}`);
  } catch (err) {
    return util.handleRouteError(req, res, err, `/cube/playtest/${req.params.id}`);
  }
});

router.delete('/deletedeck/:id', ensureAuth, async (req, res) => {
  try {
    const query = {
      _id: req.params.id,
    };

    const deck = await Deck.findById(req.params.id);
    const deckOwner = await User.findById(deck.seats[0].userid);

    if (!deckOwner || !deckOwner._id.equals(req.user._id)) {
      req.flash('danger', 'Unauthorized');
      return res.status(404).render('misc/404', {});
    }

    await Deck.deleteOne(query);

    req.flash('success', 'Deck Deleted');
    return res.send('Success');
  } catch (err) {
    return res.status(500).send({
      success: 'false',
      message: 'Error deleting deck.',
    });
  }
});

router.get('/decks/:cubeid/:page', async (req, res) => {
  try {
    const { cubeid } = req.params;
    const pagesize = 30;

    const page = parseInt(req.params.page, 10);

    const cube = await Cube.findOne(buildIdQuery(cubeid), Cube.LAYOUT_FIELDS).lean();

    if (!cube) {
      req.flash('danger', 'Cube not found');
      return res.status(404).render('misc/404', {});
    }

    const decksq = Deck.find(
      {
        cube: cube._id,
      },
      '_id seats date cube',
    )
      .sort({
        date: -1,
      })
      .skip(pagesize * page)
      .limit(pagesize)
      .lean()
      .exec();
    const numDecksq = Deck.countDocuments({
      cube: cube._id,
    }).exec();

    const [numDecks, decks] = await Promise.all([numDecksq, decksq]);

    const reactProps = {
      cube,
      cubeID: cubeid,
      decks,
      userID: req.user ? req.user._id : null,
      canEdit: req.user ? req.user._id.equals(cube.owner) : false,
      pages: Math.ceil(numDecks / pagesize),
      activePage: page,
    };

    return res.render('cube/cube_decks', {
      reactProps: serialize(reactProps),
      title: `${abbreviate(cube.name)} - Draft Decks`,
      metadata: generateMeta(
        `Cube Cobra Decks: ${cube.name}`,
        cube.type ? `${cube.card_count} Card ${cube.type} Cube` : `${cube.card_count} Card Cube`,
        cube.image_uri,
        `https://cubecobra.com/user/decks/${req.params.cubeid}`,
      ),
      loginCallback: `/user/decks/${cubeid}`,
    });
  } catch (err) {
    return util.handleRouteError(req, res, err, `/cube/playtest/${req.params.cubeid}`);
  }
});

router.get('/decks/:id', async (req, res) => {
  res.redirect(`/cube/decks/${req.params.id}/0`);
});

router.get('/rebuild/:id/:index', ensureAuth, async (req, res) => {
  try {
    const base = await Deck.findById(req.params.id).lean();
    if (!base) {
      req.flash('danger', 'Deck not found');
      return res.status(404).render('misc/404', {});
    }
    const cube = await Cube.findById(base.cube);
    const srcDraft = await Draft.findById(base.draft).lean();

    for (const card of base.seats[req.params.index].pickorder) {
      card.details = carddb.cardFromId(card.cardID);
    }
    for (const card of Object.values(srcDraft.basics)) {
      card.details = carddb.cardFromId(card.cardID);
    }
    deckutil.default.init(srcDraft);
    const userPicked = deckutil.default.createSeen();
    deckutil.default.addSeen(userPicked, base.seats[req.params.index].pickorder, srcDraft.synergies);
    const { colors: userColors } = await deckutil.default.buildDeck(
      base.seats[req.params.index].pickorder,
      userPicked,
      srcDraft.synergies,
      srcDraft.initial_state,
      srcDraft.basics,
    );

    const deck = new Deck();
    deck.cube = base.cube;
    deck.date = Date.now();
    deck.cubename = cube.name;
    deck.comments = [];
    deck.draft = base.draft;
    deck.seats = [];
    deck.seats.push({
      userid: req.user._id,
      username: `${req.user.username}: ${userColors}`,
      pickorder: base.seats[req.params.index].pickorder,
      name: `${req.user.username}'s rebuild from ${cube.name} on ${deck.date.toLocaleString('en-US')}`,
      description: 'This deck was rebuilt from another draft deck.',
      cols: base.seats[req.params.index].cols,
      deck: base.seats[req.params.index].deck,
      sideboard: base.seats[req.params.index].sideboard,
    });
    let botNumber = 1;
    for (let i = 0; i < base.seats.length; i++) {
      if (i !== parseInt(req.params.index, 10)) {
        for (const card of base.seats[i].pickorder) {
          card.details = carddb.cardFromId(card.cardID);
        }
        const picked = deckutil.default.createSeen();
        deckutil.default.addSeen(picked, base.seats[i].pickorder, srcDraft.synergies);
        // eslint-disable-next-line no-await-in-loop
        const { deck: builtDeck, sideboard, colors } = await deckutil.default.buildDeck(
          base.seats[i].pickorder,
          picked,
          srcDraft.synergies,
          srcDraft.initial_state,
          srcDraft.basics,
        );
        deck.seats.push({
          userid: null,
          username: `Bot ${botNumber}: ${colors.join(', ')}`,
          pickorder: base.seats[i].pickorder,
          name: `Draft of ${cube.name}`,
          description: `This deck was built by a bot with preference for ${colors.join(', ')}`,
          cols: base.seats[i].cols,
          deck: builtDeck,
          sideboard,
        });
        botNumber += 1;
      }
    }

    if (!cube.numDecks) {
      cube.numDecks = 0;
    }
    cube.numDecks += 1;

    const userq = User.findById(req.user._id);
    const baseuserq = User.findById(base.owner);
    const cubeOwnerq = User.findById(cube.owner);

    const [user, cubeOwner, baseUser] = await Promise.all([userq, cubeOwnerq, baseuserq]);

    if (!cubeOwner._id.equals(user._id)) {
      await util.addNotification(
        cubeOwner,
        user,
        `/cube/deck/${deck._id}`,
        `${user.username} rebuilt a deck from your cube: ${cube.name}`,
      );
    }
    if (baseUser && !baseUser._id.equals(user.id)) {
      await util.addNotification(
        baseUser,
        user,
        `/cube/deck/${deck._id}`,
        `${user.username} rebuilt your deck from cube: ${cube.name}`,
      );
    }

    await Promise.all([cube.save(), deck.save()]);

    return res.redirect(`/cube/deckbuilder/${deck._id}`);
  } catch (err) {
    return util.handleRouteError(req, res, err, `/cube/playtest/${req.params.id}`);
  }
});

router.get('/redraft/:id', async (req, res) => {
  try {
    const base = await Deck.findById(req.params.id).lean();

    if (!(base && base.draft)) {
      req.flash('danger', 'Deck not found');
      return res.status(404).render('misc/404', {});
    }

    const srcDraft = await Draft.findById(base.draft).lean();

    if (!srcDraft) {
      req.flash('danger', 'This deck is not able to be redrafted.');
      return res.redirect(`/cube/deck/${req.params.id}`);
    }

    const draft = new Draft();
    draft.cube = srcDraft.cube;
    draft.seats = srcDraft.seats.slice();
    draft.synergies = srcDraft.synergies;
    draft.basics = getBasics(carddb);

    draft.initial_state = srcDraft.initial_state.slice();
    draft.unopenedPacks = srcDraft.initial_state.slice();
    draft.seats[0].bot = null;

    for (let i = 0; i < draft.seats.length; i += 1) {
      if (!draft.seats[i].bot) {
        draft.seats[i].userid = req.user ? req.user._id : null;
        draft.seats[i].name = req.user ? req.user.username : 'Anonymous';
      }

      draft.seats[i].drafted = [];
      draft.seats[i].sideboard = [];
      draft.seats[i].pickorder = [];
      draft.seats[i].packbacklog = [];

      for (let j = 0; j < 16; j += 1) {
        draft.seats[i].drafted.push([]);
      }

      draft.seats[i].packbacklog.push(draft.unopenedPacks[i].shift());
    }

    // add ratings
    const names = [];
    for (const seat of draft.initial_state) {
      for (const pack of seat) {
        for (const card of pack) {
          names.push(carddb.cardFromId(card.cardID).name);
        }
      }
    }

    draft.ratings = await getElo(names);

    await draft.save();
    return res.redirect(`/cube/draft/${draft._id}`);
  } catch (err) {
    return util.handleRouteError(req, res, err, `/cube/playtest/${req.params.id}`);
  }
});

router.post('/api/redraft/:id', async (req, res) => {
  try {
    const srcDraft = await Draft.findById(req.params.id).lean();

    if (!srcDraft) {
      req.flash('danger', 'This deck is not able to be redrafted.');
      return res.redirect(`/cube/deck/${req.params.id}`);
    }

    let draft = new Draft();
    draft.cube = srcDraft.cube;
    draft.seats = srcDraft.seats.slice();
    draft.synergies = srcDraft.synergies;
    draft.basics = getBasics(carddb);

    draft.initial_state = srcDraft.initial_state.slice();
    draft.unopenedPacks = srcDraft.initial_state.slice();

    for (let i = 0; i < draft.seats.length; i += 1) {
      draft.seats[i].bot = [];
      draft.seats[i].drafted = [];
      draft.seats[i].sideboard = [];
      draft.seats[i].pickorder = [];
      draft.seats[i].packbacklog = [];

      for (let j = 0; j < 16; j += 1) {
        draft.seats[i].drafted.push([]);
      }

      draft.seats[i].packbacklog.push(draft.unopenedPacks[i].pop());
    }

    // add ratings
    const names = [];
    for (const seat of draft.initial_state) {
      for (const pack of seat) {
        for (const card of pack) {
          names.push(carddb.cardFromId(card.cardID).name);
        }
      }
    }

    draft.ratings = await getElo(names);

    await draft.save();

    draft = await Draft.findById(draft._id).lean();
    // insert card details everywhere that needs them
    for (const seat of draft.unopenedPacks) {
      for (const pack of seat) {
        for (const card of pack) {
          card.details = carddb.cardFromId(
            card.cardID,
            'cmc type image_normal parsed_cost image_flip name color_identity',
          );
        }
      }
    }

    for (const seat of draft.seats) {
      for (const collection of [seat.drafted, seat.sideboard, seat.packbacklog]) {
        for (const pack of collection) {
          for (const card of pack) {
            card.details = carddb.cardFromId(card.cardID);
          }
        }
      }
      for (const card of seat.pickorder) {
        card.details = carddb.cardFromId(card.cardID);
      }
    }
    for (const key of Object.keys(draft.basics)) {
      draft.basics[key].details = carddb.cardFromId(draft.basics[key].cardID);
    }
    return res.status(200).send({
      success: 'true',
      draft,
    });
  } catch (err) {
    return util.handleRouteError(req, res, err, `/cube/playtest/${req.params.id}`);
  }
});

router.get('/deckbuilder/:id', async (req, res) => {
  try {
    const deck = await Deck.findById(req.params.id).lean();
    if (!deck) {
      req.flash('danger', 'Deck not found');
      return res.status(404).render('misc/404', {});
    }
    const draft = deck.draft ? await Draft.findById(deck.draft).lean() : null;

    const deckOwner = await User.findById(deck.seats[0].userid).lean();

    if (!req.user || !deckOwner._id.equals(req.user._id)) {
      req.flash('danger', 'Only logged in deck owners can build decks.');
      return res.redirect(`/cube/deck/${req.params.id}`);
    }

    // add images to cards
    for (const seat of deck.seats) {
      for (const collection of [seat.deck, seat.sideboard]) {
        for (const pack of collection) {
          for (const card of pack) {
            card.details = carddb.cardFromId(card.cardID);
          }
        }
      }
      for (const card of seat.pickorder) {
        card.details = carddb.cardFromId(card.cardID);
      }
    }
    if (draft) {
      for (const card of Object.values(draft.basics)) {
        card.details = carddb.cardFromId(card.cardID);
      }
    }

    const cube = await Cube.findOne(buildIdQuery(deck.cube), Cube.LAYOUT_FIELDS).lean();

    if (!cube) {
      req.flash('danger', 'Cube not found');
      return res.status(404).render('misc/404', {});
    }

    const reactProps = {
      cube,
      cubeID: getCubeId(cube),
      initialDeck: deck,
      basics: getBasics(carddb),
      draft,
    };

    return res.render('cube/cube_deckbuilder', {
      reactProps: serialize(reactProps),
      activeLink: 'playtest',
      title: `${abbreviate(cube.name)} - Deckbuilder`,
      metadata: generateMeta(
        `Cube Cobra Draft: ${cube.name}`,
        cube.type ? `${cube.card_count} Card ${cube.type} Cube` : `${cube.card_count} Card Cube`,
        cube.image_uri,
        `https://cubecobra.com/cube/draft/${req.params.id}`,
      ),
      loginCallback: `/cube/draft/${req.params.id}`,
    });
  } catch (err) {
    return util.handleRouteError(req, res, err, '/404');
  }
});

router.get('/deck/:id', async (req, res) => {
  try {
    if (!req.params.id || req.params.id === 'null' || req.params.id === 'false') {
      req.flash('danger', 'Invalid deck ID.');
      return res.status(404).render('misc/404', {});
    }

    const deck = await Deck.findById(req.params.id).lean();

    if (!deck) {
      req.flash('danger', 'Deck not found');
      return res.status(404).render('misc/404', {});
    }

    const cube = await Cube.findOne(buildIdQuery(deck.cube), Cube.LAYOUT_FIELDS).lean();
    if (!cube) {
      req.flash('danger', 'Cube not found');
      return res.status(404).render('misc/404', {});
    }

    let draft = null;
    if (deck.draft) {
      draft = await Draft.findById(deck.draft);
      if (draft && !draft.synergies) {
        // put in synergies for old drafts that don't have em.
        const cards = draft.initial_state.flat(3);

        const response = await fetch(`${process.env.FLASKROOT}/embeddings/`, {
          method: 'post',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ cards: cards.map((card) => carddb.cardFromId(card.cardID).name_lower) }),
        });
        if (response.ok) {
          // we want to save this for later so we don't have to do this every time
          draft.synergies = await response.json();
          await draft.save();
        } else {
          draft.synergies = null;
        }
      }
    }

    let drafter = 'Anonymous';

    const deckUser = await User.findById(deck.owner);

    if (deckUser) {
      drafter = deckUser.username;
    }

    for (const seat of deck.seats) {
      for (const collection of [seat.deck, seat.sideboard]) {
        for (const pack of collection) {
          for (const card of pack) {
            card.details = carddb.cardFromId(card.cardID);
          }
        }
      }
      if (seat.pickorder) {
        for (const card of seat.pickorder) {
          card.details = carddb.cardFromId(card.cardID);
        }
      }
    }

    const reactProps = {
      cube,
      deck,
      draft,
      canEdit: req.user ? req.user.id === deck.seats[0].userid : false,
      userid: req.user ? req.user.id : null,
    };

    return res.render('cube/cube_deck', {
      reactProps: serialize(reactProps),
      title: `${abbreviate(cube.name)} - ${drafter}'s deck`,
      metadata: generateMeta(
        `Cube Cobra Deck: ${cube.name}`,
        cube.type ? `${cube.card_count} Card ${cube.type} Cube` : `${cube.card_count} Card Cube`,
        cube.image_uri,
        `https://cubecobra.com/cube/deck/${req.params.id}`,
      ),
      loginCallback: `/cube/deck/${req.params.id}`,
    });
  } catch (err) {
    return util.handleRouteError(req, res, err, '/404');
  }
});

router.get(
  '/api/getcardforcube/:id/:name',
  util.wrapAsyncApi(async (req, res) => {
    const cube = await Cube.findOne(buildIdQuery(req.params.id), 'defaultPrinting').lean();
    const card = carddb.getMostReasonable(req.params.name, cube.defaultPrinting);
    if (card) {
      return res.status(200).send({
        success: 'true',
        card,
      });
    }
    return res.status(200).send({
      success: 'false',
    });
  }),
);

router.get(
  '/api/getimage/:name',
  util.wrapAsyncApi(async (req, res) => {
    const reasonable = carddb.getMostReasonable(cardutil.decodeName(req.params.name));
    const img = reasonable ? carddb.imagedict[reasonable.name] : null;
    if (!img) {
      return res.status(200).send({
        success: 'false',
      });
    }
    return res.status(200).send({
      success: 'true',
      img,
    });
  }),
);

router.get(
  '/api/getcardfromid/:id',
  util.wrapAsyncApi(async (req, res) => {
    const card = carddb.cardFromId(req.params.id);
    return res.status(200).send({
      success: 'true',
      card,
    });
  }),
);

router.get(
  '/api/getversions/:id',
  util.wrapAsyncApi(async (req, res) => {
    const cardIds = carddb.allVersions(carddb.cardFromId(req.params.id));
    // eslint-disable-next-line prefer-object-spread
    const cards = cardIds.map((id) => Object.assign({}, carddb.cardFromId(id)));
    return res.status(200).send({
      success: 'true',
      cards,
    });
  }),
);

router.post(
  '/api/getversions',
  body([], 'Body must be an array.').isArray(),
  body('*', 'Each ID must be a valid UUID.').matches(/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/),
  jsonValidationErrors,
  util.wrapAsyncApi(async (req, res) => {
    const allDetails = req.body.map((cardID) => carddb.cardFromId(cardID));
    const allIds = allDetails.map(({ name }) => carddb.getIdsFromName(name) || []);
    const allVersions = allIds.map((versions) => versions.map((id) => carddb.cardFromId(id)));

    const result = util.fromEntries(
      allVersions.map((versions, index) => [
        cardutil.normalizeName(allDetails[index].name),
        versions.map(({ _id, full_name, image_normal, image_flip, prices, elo }) => ({
          _id,
          version: full_name.toUpperCase().substring(full_name.indexOf('[') + 1, full_name.indexOf(']')),
          image_normal,
          image_flip,
          price: prices.usd,
          price_foil: prices.usd_foil,
          elo,
        })),
      ]),
    );

    return res.status(200).send({
      success: 'true',
      dict: result,
    });
  }),
);

router.post(
  '/api/updatecard/:id',
  ensureAuth,
  util.wrapAsyncApi(async (req, res) => {
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
      return res.status(400).send({
        success: 'false',
        message: 'Failed input validation',
      });
    }
    const cube = await Cube.findOne(buildIdQuery(req.params.id));

    if (!req.user._id.equals(cube.owner)) {
      return res.status(401).send({
        success: 'false',
        message: 'Insufficient permissions',
      });
    }
    if (src.index >= cube.cards.length) {
      return res.status(400).send({
        success: 'false',
        message: 'No such card',
      });
    }

    const card = cube.cards[src.index];
    if (!card.type_line) {
      card.type_line = carddb.cardFromId(card.cardID).type;
    }

    if (!cardsAreEquivalent(src, card)) {
      return res.status(400).send({
        success: 'false',
        message: 'Cards not equivalent',
      });
    }

    for (const key of Object.keys(Cube.schema.paths.cards.schema.paths)) {
      if (!Object.prototype.hasOwnProperty.call(updated, key)) {
        updated[key] = card[key];
      }
    }
    for (const key of Object.keys(updated)) {
      if (updated[key] === null) {
        delete updated[key];
      }
    }
    cube.cards[src.index] = updated;

    setCubeType(cube, carddb);

    await cube.save();
    return res.status(200).send({
      success: 'true',
    });
  }),
);

router.post(
  '/api/updatecards/:id',
  ensureAuth,
  util.wrapAsyncApi(async (req, res) => {
    const { selected, updated } = req.body;
    if (
      (updated.cmc && typeof updated.cmc !== 'number') ||
      (updated.status && typeof updated.status !== 'string') ||
      (updated.type_line && typeof updated.type_line !== 'string') ||
      (updated.colors && !Array.isArray(updated.colors)) ||
      (updated.tags && !Array.isArray(updated.tags)) ||
      !Array.isArray(selected) ||
      selected.some((index) => !Number.isInteger(index) || index < 0)
    ) {
      return res.status(400).send({
        success: 'false',
        message: 'Failed input validation',
      });
    }

    const cube = await Cube.findOne(buildIdQuery(req.params.id));
    if (!req.user._id.equals(cube.owner)) {
      return res.status(404).send({
        success: 'false',
        message: 'Unauthorized',
      });
    }

    const allUpdates = {
      $set: {},
    };
    for (const index of selected) {
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

    await cube.updateOne(allUpdates);
    return res.status(200).send({
      success: 'true',
    });
  }),
);

router.post('/resize/:id/:size', async (req, res) => {
  try {
    let cube = await Cube.findOne(buildIdQuery(req.params.id));

    const response = await fetch(
      `${process.env.FLASKROOT}/?cube_name=${req.params.id}&num_recs=${1000}&root=${encodeURIComponent(
        process.env.HOST,
      )}`,
    );
    if (!response.ok) {
      return util.handleRouteError(req, res, 'Error fetching suggestion data.', `/cube/list/${req.params.id}`);
    }
    const { cuts, additions } = await response.json();

    // use this instead if you want debug data
    // const additions = { island: 1, mountain: 1, plains: 1, forest: 1, swamp: 1, wastes: 1 };
    // const cuts = { ...additions };

    const pids = new Set();
    const cardNames = new Set();

    const formatTuple = (tuple) => {
      const details = carddb.getMostReasonable(tuple[0]);
      const card = util.newCard(details);
      card.details = details;

      if (card.details.tcgplayer_id) {
        pids.add(card.details.tcgplayer_id);
      }
      cardNames.add(card.details.name);

      return card;
    };

    const newSize = parseInt(req.params.size, 10);

    if (newSize === cube.cards.length) {
      req.flash('success', 'Your cube is already this size!');
      return res.redirect(`/cube/list/${req.params.id}`);
    }

    // we sort the reverse way depending on adding or removing
    let list = Object.entries(newSize > cube.cards.length ? additions : cuts)
      .sort((a, b) => {
        if (a[1] > b[1]) return newSize > cube.cards.length ? -1 : 1;
        if (a[1] < b[1]) return newSize > cube.cards.length ? 1 : -1;
        return 0;
      })
      .map(formatTuple);

    const { filter, err } = filterutil.makeFilter(req.body.filter);
    if (err) {
      return util.handleRouteError(req, res, 'Error parsing filter.', `/cube/list/${req.params.id}`);
    }
    list = (filter ? list.filter(filter) : list).slice(0, Math.abs(newSize - cube.cards.length));

    let changelog = '';
    if (newSize > cube.cards.length) {
      // we add to cube
      const toAdd = list.map((card) => {
        changelog += addCardHtml(card.details);
        return util.newCard(card.details);
      });
      cube.cards = cube.cards.concat(toAdd);
    } else {
      // we cut from cube
      for (const card of list) {
        for (let i = 0; i < cube.cards.length; i += 1) {
          if (carddb.cardFromId(cube.cards[i].cardID).name === carddb.cardFromId(card.cardID).name) {
            changelog += removeCardHtml(card.details);
            cube.cards.splice(i, 1);
            i = cube.cards.length;
          }
        }
      }
    }

    cube = setCubeType(cube, carddb);

    const blogpost = new Blog();
    blogpost.title = 'Resize - Automatic Post';
    blogpost.html = changelog;
    blogpost.owner = cube.owner;
    blogpost.date = Date.now();
    blogpost.cube = cube._id;
    blogpost.dev = 'false';
    blogpost.date_formatted = blogpost.date.toLocaleString('en-US');
    blogpost.username = cube.owner_name;
    blogpost.cubename = cube.name;

    await blogpost.save();
    await cube.save();

    req.flash('success', 'Cube Resized succesfully.');
    return res.redirect(`/cube/list/${req.params.id}`);
  } catch (err) {
    return util.handleRouteError(req, res, err, `/cube/list/${req.params.id}`);
  }
});

router.post(
  '/api/adds/:id',
  util.wrapAsyncApi(async (req, res) => {
    const response = await fetch(
      `${process.env.FLASKROOT}/?cube_name=${req.params.id}&num_recs=${1000}&root=${encodeURIComponent(
        process.env.HOST,
      )}`,
    );
    if (!response.ok) {
      req.logger.error({ message: 'Flask server response not OK.' });
      return res.status(500).send({
        success: 'false',
        result: {},
      });
    }
    const { cuts, additions } = await response.json();

    // use this instead if you want debug data
    // const additions = { island: 1, mountain: 1, plains: 1, forest: 1, swamp: 1, wastes: 1 };
    // const cuts = { ...additions };

    const pids = new Set();
    const cardNames = new Set();

    const formatTuple = (tuple) => {
      const details = carddb.getMostReasonable(tuple[0]);
      const card = util.newCard(details);
      card.details = details;

      if (card.details.tcgplayer_id) {
        pids.add(card.details.tcgplayer_id);
      }
      cardNames.add(card.details.name);

      return card;
    };

    const addlist = Object.entries(additions)
      .sort((a, b) => b[1] - a[1])
      .map(formatTuple);

    // this is sorted the opposite way, as lower numbers mean we want to cut it
    const cutlist = Object.entries(cuts)
      .sort((a, b) => a[1] - b[1])
      .map(formatTuple);

    return res.status(200).send({
      success: 'true',
      result: { toAdd: addlist, toCut: cutlist },
    });
  }),
);

router.get(
  '/api/maybe/:id',
  ensureAuth,
  util.wrapAsyncApi(async (req, res) => {
    const cube = await Cube.findOne(buildIdQuery(req.params.id)).lean();
    return res.status(200).send({
      success: 'true',
      maybe: maybeCards(cube, carddb),
    });
  }),
);

router.post(
  '/api/maybe/:id',
  ensureAuth,
  util.wrapAsyncApi(async (req, res) => {
    const cube = await Cube.findOne(buildIdQuery(req.params.id));
    if (!req.user._id.equals(cube.owner)) {
      return res.status(403).send({
        success: 'false',
        message: 'Maybeboard can only be updated by cube owner.',
      });
    }

    const maybe = [...(cube.maybe || [])];

    const removeIndices = Array.isArray(req.body.remove) ? req.body.remove : [];
    const withRemoved = maybe.filter((_, index) => !removeIndices.includes(index));

    const addCards = Array.isArray(req.body.add) ? req.body.add : [];
    const addCardsNoDetails = addCards.map(({ details, ...card }) => ({ ...util.newCard(details), ...card }));
    const withAdded = [...withRemoved, ...addCardsNoDetails];

    cube.maybe = withAdded;
    await cube.save();

    const added = cube.maybe.slice(cube.maybe.length - addCardsNoDetails.length);

    return res.status(200).send({
      success: 'true',
      added: util.fromEntries(added.map(({ _id, cardID }) => [cardID, _id])),
    });
  }),
);

router.post(
  '/api/maybe/update/:id',
  ensureAuth,
  util.wrapAsyncApi(async (req, res) => {
    const cube = await Cube.findOne(buildIdQuery(req.params.id));
    if (!req.user._id.equals(cube.owner)) {
      return res.status(403).send({
        success: 'false',
        message: 'Maybeboard can only be updated by cube owner.',
      });
    }

    const card = cube.maybe.find((c) => c._id.equals(req.body.id));
    if (!card) {
      return res.status(404).send({
        success: 'false',
        message: 'No card found to update.',
      });
    }

    const { updated } = req.body;
    if (!updated) {
      return res.status(400).send({
        success: 'false',
        message: 'Bad request.',
      });
    }
    const newVersion = updated.cardID && updated.cardID !== card.cardID;
    for (const field of ['cardID', 'status', 'finish', 'cmc', 'type_line', 'imgUrl', 'colors']) {
      if (Object.prototype.hasOwnProperty.call(updated, field)) {
        card[field] = updated[field];
      }
    }
    await cube.save();

    if (newVersion) {
      return res.status(200).send({
        success: 'true',
        details: carddb.cardFromId(card.cardID),
      });
    }

    return res.status(200).send({
      success: 'true',
    });
  }),
);

router.post('/remove/:id', ensureAuth, async (req, res) => {
  try {
    const cube = await Cube.findOne(buildIdQuery(req.params.id));

    if (!req.user._id.equals(cube.owner)) {
      req.flash('danger', 'Not Authorized');
      return res.redirect(`/cube/overview/${req.params.id}`);
    }
    await Cube.deleteOne(buildIdQuery(req.params.id));

    req.flash('success', 'Cube Removed');
    return res.redirect('/dashboard');
  } catch (err) {
    return util.handleRouteError(req, res, err, '/404');
  }
});

router.delete('/blog/remove/:id', ensureAuth, async (req, res) => {
  try {
    const query = {
      _id: req.params.id,
    };

    const blog = await Blog.findById(req.params.id);

    if (!req.user._id.equals(blog.owner)) {
      req.flash('danger', 'Unauthorized');
      return res.status(404).render('misc/404', {});
    }
    await Blog.deleteOne(query);

    req.flash('success', 'Post Removed');
    return res.send('Success');
  } catch (err) {
    return res.status(500).send({
      success: 'false',
      message: 'Error deleting post.',
    });
  }
});

router.delete('/format/remove/:cubeid/:index', ensureAuth, param('index').toInt(), async (req, res) => {
  try {
    const { cubeid, index } = req.params;
    const cube = await Cube.findOne(buildIdQuery(cubeid));
    if (!cube) {
      return res.status(404).send({
        success: 'false',
        message: 'No such cube.',
      });
    }
    if (!req.user._id.equals(cube.owner)) {
      return res.status(401).send({
        success: 'false',
        message: 'Not authorized.',
      });
    }
    if (index < 0 || index >= cube.draft_formats.length) {
      return res.status(400).send({
        success: 'false',
        message: 'Invalid request format.',
      });
    }

    cube.draft_formats.splice(index, 1);

    await cube.save();
    return res.status(200).send({
      success: 'true',
    });
  } catch (err) {
    req.logger.error(err);
    return res.status(500).send({
      success: 'false',
      message: 'Error deleting format.',
    });
  }
});

router.post(
  '/:id/defaultdraftformat/:formatId',
  ensureAuth,
  util.wrapAsyncApi(async (req, res) => {
    const cubeid = req.params.id;
    const formatId = parseInt(req.params.formatId, 10);

    const cube = await Cube.findOne(buildIdQuery(cubeid));
    if (
      !cube ||
      cube.owner !== req.user.id ||
      !Number.isInteger(formatId) ||
      formatId >= cube.draft_formats.length ||
      formatId < -1
    ) {
      return res.sendStatus(401);
    }

    cube.defaultDraftFormat = formatId;

    await cube.save();
    return res.status(200).send({
      success: 'true',
    });
  }),
);

router.post(
  '/api/savesorts/:id',
  ensureAuth,
  util.wrapAsyncApi(async (req, res) => {
    const cube = await Cube.findOne(buildIdQuery(req.params.id));

    if (!req.user._id.equals(cube.owner)) {
      return res.status(404).send({
        success: 'false',
        message: 'Unauthorized',
      });
    }

    cube.default_sorts = req.body.sorts;
    await cube.save();
    return res.status(200).send({
      success: 'true',
    });
  }),
);

const ELO_BASE = 400;
const ELO_RANGE = 1600;
const ELO_SPEED = 1000;
router.post(
  '/api/draftpickcard/:id',
  util.wrapAsyncApi(async (req, res) => {
    const draftQ = Draft.findById({ _id: req.body.draft_id }).lean();
    const ratingQ = CardRating.findOne({ name: req.body.pick }).then((rating) => rating || new CardRating());
    const packQ = CardRating.find({ name: { $in: req.body.pack } });

    const [draft, rating, packRatings] = await Promise.all([draftQ, ratingQ, packQ]);

    if (draft) {
      // TODO: fix cube schema, fix out of sync if an edit is also occuring
      /*
      const cube = await Cube.findOne(buildIdQuery(draft.cube));

      if (cube) {
        const picked = [];
        const passed = [];
        for (const card of cube.cards) {
          const { name } = carddb.cardFromId(card.cardID);
          if (name === req.body.pick) {
            picked.push(card);
          }
          if (req.body.pack.indexOf(name) !== -1) {
            passed.push(card);
          }
        }
        const pick =
          draft.initial_state[0][Math.min(draft.initial_state[0].length - 1, req.body.packNum - 1)].length -
          req.body.pack.length;
        for (const card of picked) {
          if (!card.picks) {
            card.picks = [];
          }
          card.picks.push([req.body.packNum, pick]);
        }
        for (const card of passed) {
          if (!card.passed) {
            card.passed = 0;
          }
          card.passed += 1;
        }
        await cube.save();
      }
      */

      if (!rating.elo) {
        rating.name = req.body.pick;
        rating.elo = ELO_BASE + ELO_RANGE / 2;
      }

      if (!Number.isFinite(rating.elo)) {
        rating.elo = ELO_BASE + ELO_RANGE / (1 + ELO_SPEED ** -(0.5 - rating.value));
      }
      // Update ELO.
      for (const other of packRatings) {
        if (!Number.isFinite(other.elo)) {
          if (!Number.isFinite(other.value)) {
            other.elo = ELO_BASE + ELO_RANGE / 2;
          } else {
            other.elo = ELO_BASE + ELO_RANGE / (1 + ELO_SPEED ** -(0.5 - other.value));
          }
        }

        const diff = other.elo - rating.elo;
        // Expected performance for pick.
        const expectedA = 1 / (1 + 10 ** (diff / 400));
        const expectedB = 1 - expectedA;
        const adjustmentA = 2 * (1 - expectedA);
        const adjustmentB = 2 * (0 - expectedB);
        rating.elo += adjustmentA;
        other.elo += adjustmentB;
      }
      await Promise.all([rating.save(), packRatings.map((r) => r.save())]);
    }
    res.status(200).send({
      success: 'true',
    });
  }),
);

router.post('/api/submitdraft/:id', async (req, res) => {
  await Draft.updateOne({ _id: req.body._id }, req.body);

  return res.status(200).send({
    success: 'true',
  });
});

router.post('/api/submitgriddraft/:id', async (req, res) => {
  await GridDraft.updateOne({ _id: req.body._id }, req.body);

  return res.status(200).send({
    success: 'true',
  });
});

router.get(
  '/api/p1p1/:id',
  util.wrapAsyncApi(async (req, res) => {
    const result = await generatePack(req.params.id, carddb, false);

    return res.status(200).send({
      seed: result.seed,
      pack: result.pack.map((card) => card.name),
    });
  }),
);

router.get(
  '/api/p1p1/:id/:seed',
  util.wrapAsyncApi(async (req, res) => {
    const result = await generatePack(req.params.id, carddb, req.params.seed);

    return res.status(200).send({
      seed: req.params.seed,
      pack: result.pack.map((card) => card.name),
    });
  }),
);

module.exports = router;
