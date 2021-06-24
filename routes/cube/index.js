const express = require('express');
// eslint-disable-next-line import/no-unresolved
const { body, param } = require('express-validator');
const fetch = require('node-fetch');
const cheerio = require('cheerio');
const RSS = require('rss');
const { Canvas, Image } = require('canvas');

Canvas.Image = Image;

const createdraft = require('../../dist/drafting/createdraft.js');
const filterutil = require('../../dist/filtering/FilterCards.js');
const miscutil = require('../../dist/utils/Util.js');
const carddb = require('../../serverjs/cards.js');
const { render } = require('../../serverjs/render');
const { ensureAuth, csrfProtection, flashValidationErrors } = require('../middleware');
const util = require('../../serverjs/util.js');
const generateMeta = require('../../serverjs/meta.js');

const {
  generatePack,
  setCubeType,
  generateShortId,
  buildIdQuery,
  addCardHtml,
  removeCardHtml,
  replaceCardHtml,
  abbreviate,
  CSVtoCards,
  compareCubes,
  generateSamplepackImage,
  addDeckCardAnalytics,
  cachePromise,
} = require('../../serverjs/cubefn.js');

const {
  CARD_HEIGHT,
  CARD_WIDTH,
  DEFAULT_BASICS,
  addBasics,
  bulkUpload,
  createPool,
  shuffle,
  updateCubeAndBlog,
} = require('./helper.js');

// Bring in models
const Cube = require('../../models/cube');
const Deck = require('../../models/deck');
const Blog = require('../../models/blog');
const User = require('../../models/user');
const Draft = require('../../models/draft');
const GridDraft = require('../../models/gridDraft');
const CubeAnalytic = require('../../models/cubeAnalytic');
const { fromEntries } = require('../../serverjs/util.js');

const router = express.Router();
router.use(csrfProtection);

router.use('/blog', require('./blog.js'));
router.use('/deck', require('./deck.js'));
router.use('/api', require('./api.js'));
router.use('/download', require('./download.js'));

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
      return res.redirect(`/cube/list/${encodeURIComponent(req.params.id)}`);
    }

    const cubes = await Cube.find({
      owner: req.user._id,
    }).lean();

    if (cubes.length >= 48) {
      req.flash(
        'danger',
        'Cannot clone this cube: Users can only have 48 cubes. Please delete one or more cubes to create new cubes.',
      );
      return res.redirect(`/cube/list/${encodeURIComponent(req.params.id)}`);
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

    if (!source.disableNotifications) {
      await util.addNotification(
        sourceOwner,
        req.user,
        `/cube/view/${cube._id}`,
        `${req.user.username} made a cube by cloning yours: ${cube.name}`,
      );
    }

    req.flash('success', 'Cube Cloned');
    return res.redirect(`/cube/overview/${cube.shortID}`);
  } catch (err) {
    return util.handleRouteError(req, res, err, `/cube/list/${encodeURIComponent(req.params.id)}`);
  }
});

router.get('/view/:id', (req, res) => {
  return res.redirect(`/cube/overview/${encodeURIComponent(req.params.id)}`);
});

router.post('/format/add/:id', ensureAuth, async (req, res) => {
  try {
    const cube = await Cube.findOne(buildIdQuery(req.params.id));
    if (!req.user._id.equals(cube.owner)) {
      req.flash('danger', 'Formats can only be changed by cube owner.');
      return res.redirect(`/cube/list/${encodeURIComponent(req.params.id)}`);
    }

    let message = '';
    const { id, serializedFormat } = req.body;
    const format = JSON.parse(serializedFormat);
    if (id === '-1') {
      if (!cube.draft_formats) {
        cube.draft_formats = [];
      }
      cube.draft_formats.push(format);
      message = 'Custom format successfully added.';
    } else {
      cube.draft_formats[req.body.id] = format;
      message = 'Custom format successfully edited.';
    }

    await cube.save();
    req.flash('success', message);
    return res.redirect(`/cube/playtest/${req.params.id}`);
  } catch (err) {
    return util.handleRouteError(req, res, err, `/cube/playtest/${req.params.id}`);
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
      return res.redirect(`/cube/overview/${encodeURIComponent(req.params.id)}`);
    }

    const cube = await Cube.findOne(buildIdQuery(encodeURIComponent(req.params.id)));
    if (!cube) {
      req.flash('danger', 'Cube not found');
      return res.redirect(`/cube/overview/${encodeURIComponent(req.params.id)}`);
    }

    cube.isFeatured = true;
    await cube.save();

    req.flash('success', 'Cube updated successfully.');
    return res.redirect(`/cube/overview/${encodeURIComponent(req.params.id)}`);
  } catch (err) {
    return util.handleRouteError(req, res, err, `/cube/overview/${encodeURIComponent(req.params.id)}`);
  }
});

router.post('/unfeature/:id', ensureAuth, async (req, res) => {
  try {
    const { user } = req;
    if (!util.isAdmin(user)) {
      req.flash('danger', 'Not Authorized');
      return res.redirect(`/cube/overview/${encodeURIComponent(req.params.id)}`);
    }

    const cube = await Cube.findOne(buildIdQuery(encodeURIComponent(req.params.id)));
    if (!cube) {
      req.flash('danger', 'Cube not found');
      return res.redirect(`/cube/overview/${encodeURIComponent(req.params.id)}`);
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
    if (!cube) {
      req.flash('danger', 'Cube not found');
      return res.redirect('404');
    }

    const blogsQ = Blog.find({
      cube: cube._id,
    })
      .sort({
        date: -1,
      })
      .limit(1)
      .lean();

    const followersQ = User.find(
      {
        _id: {
          $in: cube.users_following,
        },
      },
      '_id username image artist users_following',
    ).lean();

    // calc cube prices
    for (const card of cube.cards) {
      card.details = {
        ...carddb.cardFromId(card.cardID, 'name prices'),
      };
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
    cube.raw_desc = cube.body;

    // Performance
    delete cube.cards;
    delete cube.draft_formats;
    delete cube.maybe;

    cube.basics = cube.basics || DEFAULT_BASICS;

    return render(
      req,
      res,
      'CubeOverviewPage',
      {
        cube,
        post: blogs ? blogs[0] : null,
        followed: req.user && cube.users_following ? cube.users_following.includes(req.user.id) : false,
        followers,
        priceOwned: !cube.privatePrices ? totalPriceOwned : null,
        pricePurchase: !cube.privatePrices ? totalPricePurchase : null,
      },
      {
        title: `${abbreviate(cube.name)} - Overview`,
        metadata: generateMeta(
          `Cube Cobra Overview: ${cube.name}`,
          miscutil.getCubeDescription(cube),
          cube.image_uri,
          `https://cubecobra.com/cube/overview/${req.params.id}`,
        ),
      },
    );
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
      .sort({
        date: -1,
      })
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
    return util.handleRouteError(req, res, err, '/404');
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
      return res.redirect('/404');
    }
    if (!cubeB) {
      req.flash('danger', `Comparison cube not found: ${idB}`);
      return res.redirect('/404');
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

    return render(
      req,
      res,
      'CubeComparePage',
      {
        cube: cubeA,
        cubeB,
        onlyA: aNames,
        onlyB: bNames,
        both: inBoth.map((card) => card.details.name),
        cards: allCards.map((card, index) =>
          Object.assign(card, {
            index,
          }),
        ),
        defaultTagColors: [...cubeA.tag_colors, ...cubeB.tag_colors],
        defaultShowTagColors: !req.user || !req.user.hide_tag_colors,
        defaultSorts: cubeA.default_sorts,
      },
      {
        title: `Comparing ${cubeA.name} to ${cubeB.name}`,
        metadata: generateMeta(
          'Cube Cobra Compare Cubes',
          `Comparing "${cubeA.name}" To "${cubeB.name}"`,
          cubeA.image_uri,
          `https://cubecobra.com/cube/compare/${idA}/to/${idB}`,
        ),
      },
    );
  } catch (err) {
    return util.handleRouteError(req, res, err, '/404');
  }
});

router.get('/list/:id', async (req, res) => {
  try {
    const fields =
      'cards maybe card_count name owner type tag_colors default_sorts default_show_unsorted overrideCategory categoryOverride categoryPrefixes image_uri shortID';
    const cube = await Cube.findOne(buildIdQuery(req.params.id), fields).lean();
    if (!cube) {
      req.flash('danger', 'Cube not found');
      return res.redirect('404');
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

    return render(
      req,
      res,
      'CubeListPage',
      {
        cube,
        defaultView: req.query.view || 'table',
        defaultPrimarySort: req.query.s1 || '',
        defaultSecondarySort: req.query.s2 || '',
        defaultTertiarySort: req.query.s3 || '',
        defaultQuaternarySort: req.query.s4 || '',
        defaultShowUnsorted: req.query.so || '',
        defaultFilterText: req.query.f || '',
        defaultTagColors: cube.tag_colors || [],
        defaultShowTagColors: !req.user || !req.user.hide_tag_colors,
      },
      {
        title: `${abbreviate(cube.name)} - List`,
        metadata: generateMeta(
          `Cube Cobra List: ${cube.name}`,
          miscutil.getCubeDescription(cube),
          cube.image_uri,
          `https://cubecobra.com/cube/list/${req.params.id}`,
        ),
      },
    );
  } catch (err) {
    return util.handleRouteError(req, res, err, `/cube/overview/${req.params.id}`);
  }
});

router.get('/playtest/:id', async (req, res) => {
  try {
    const cube = await Cube.findOne(buildIdQuery(req.params.id)).lean();

    if (!cube) {
      req.flash('danger', 'Cube not found');
      return res.redirect('404');
    }

    const decks = await Deck.find(
      {
        cube: cube._id,
      },
      'date seats _id cube owner cubeOwner',
    )
      .sort({
        date: -1,
      })
      .limit(10)
      .lean();

    return render(
      req,
      res,
      'CubePlaytestPage',
      {
        cube,
        decks,
      },
      {
        title: `${abbreviate(cube.name)} - Playtest`,
        metadata: generateMeta(
          `Cube Cobra Playtest: ${cube.name}`,
          miscutil.getCubeDescription(cube),
          cube.image_uri,
          `https://cubecobra.com/cube/playtest/${req.params.id}`,
        ),
      },
    );
  } catch (err) {
    return util.handleRouteError(req, res, err, `/cube/overview/${req.params.id}`);
  }
});

router.get('/analysis/:id', async (req, res) => {
  try {
    const cube = await Cube.findOne(buildIdQuery(req.params.id)).lean();

    if (!cube) {
      req.flash('danger', 'Cube not found');
      return res.redirect('404');
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

    const cubeAnalytics = await CubeAnalytic.findOne({ cube: cube._id });

    return render(
      req,
      res,
      'CubeAnalysisPage',
      {
        cube,
        cubeAnalytics: cubeAnalytics || { cards: [] },
        cubeID: req.params.id,
        defaultNav: req.query.nav,
        defaultShowTagColors: !req.user || !req.user.hide_tag_colors,
        defaultFormatId: Number(req.query.formatId),
        defaultFilterText: req.query.f,
        defaultTab: req.query.tab ? Number(req.query.tab) : 0,
      },
      {
        metadata: generateMeta(
          `Cube Cobra Analysis: ${cube.name}`,
          miscutil.getCubeDescription(cube),
          cube.image_uri,
          `https://cubecobra.com/cube/analysis/${req.params.id}`,
        ),
        title: `${abbreviate(cube.name)} - Analysis`,
      },
    );
  } catch (err) {
    return util.handleRouteError(req, res, err, `/cube/overview/${req.params.id}`);
  }
});

router.get('/samplepack/:id', (req, res) => {
  res.redirect(`/cube/samplepack/${encodeURIComponent(req.params.id)}/${Date.now().toString()}`);
});

router.get('/samplepack/:id/:seed', async (req, res) => {
  try {
    const cube = await Cube.findOne(buildIdQuery(req.params.id)).lean();
    let pack;
    try {
      pack = await generatePack(req.params.id, carddb, req.params.seed);
    } catch (err) {
      req.flash('danger', err.message);
      return res.redirect(`/cube/playtest/${encodeURIComponent(req.params.id)}`);
    }

    const width = Math.floor(Math.sqrt((5 / 3) * pack.pack.length));
    const height = Math.ceil(pack.pack.length / width);

    return render(
      req,
      res,
      'CubeSamplePackPage',
      {
        seed: pack.seed,
        pack: pack.pack,
        cube,
      },
      {
        title: `${abbreviate(cube.name)} - Sample Pack`,
        metadata: generateMeta(
          'Cube Cobra Sample Pack',
          `A sample pack from ${cube.name}`,
          `https://cubecobra.com/cube/samplepackimage/${req.params.id}/${pack.seed}.png`,
          `https://cubecobra.com/cube/samplepack/${req.params.id}/${pack.seed}`,
          CARD_WIDTH * width,
          CARD_HEIGHT * height,
        ),
      },
    );
  } catch (err) {
    return util.handleRouteError(req, res, err, `/cube/playtest/${req.params.id}`);
  }
});

router.get('/samplepackimage/:id/:seed', async (req, res) => {
  try {
    req.params.seed = req.params.seed.replace('.png', '');

    const imageBuffer = await cachePromise(`/samplepack/${req.params.id}/${req.params.seed}`, async () => {
      let pack;
      try {
        pack = await generatePack(req.params.id, carddb, req.params.seed);
      } catch (err) {
        req.flash('danger', err.message);
        return res.redirect(`/cube/playtest/${encodeURIComponent(req.params.id)}`);
      }

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

      const image = await generateSamplepackImage(srcArray, {
        width: imgScale * CARD_WIDTH * width,
        height: imgScale * CARD_HEIGHT * height,
        Canvas,
      });

      return Buffer.from(image.replace(/^data:image\/png;base64,/, ''), 'base64');
    });

    res.writeHead(200, {
      'Content-Type': 'image/png',
    });
    return res.end(imageBuffer);
  } catch (err) {
    return util.handleRouteError(req, res, err, '/404');
  }
});

router.post('/importcubetutor/:id', ensureAuth, body('cubeid').toInt(), flashValidationErrors, async (req, res) => {
  try {
    const cube = await Cube.findOne(buildIdQuery(req.params.id));
    if (!req.user._id.equals(cube.owner)) {
      req.flash('danger', 'Not Authorized');
      return res.redirect(`/cube/list/${encodeURIComponent(req.params.id)}`);
    }

    const response = await fetch(`https://www.cubetutor.com/viewcube/${req.body.cubeid}`, {
      headers: {
        // This tricks cubetutor into not redirecting us to the unsupported browser page.
        'User-Agent': 'Mozilla/5.0',
      },
    });
    if (!response.ok) {
      req.flash('danger', 'Error accessing CubeTutor.');
      return res.redirect(`/cube/list${encodeURIComponent(req.params.id)}`);
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
    return util.handleRouteError(req, res, err, `/cube/list/${encodeURIComponent(req.params.id)}`);
  }
});

router.post('/bulkupload/:id', ensureAuth, async (req, res) => {
  try {
    const cube = await Cube.findOne(buildIdQuery(req.params.id));
    if (!cube) {
      req.flash('danger', 'Cube not found');
      return res.redirect('/404');
    }
    if (!req.user._id.equals(cube.owner)) {
      req.flash('danger', 'Not Authorized');
      return res.redirect(`/cube/list/${encodeURIComponent(req.params.id)}`);
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
      return res.redirect(`/cube/list/${encodeURIComponent(req.params.id)}`);
    }

    const items = req.files.document.data.toString('utf8'); // the uploaded file object

    const cube = await Cube.findOne(buildIdQuery(req.params.id));
    if (!cube) {
      req.flash('danger', 'Cube not found');
      return res.redirect('/404');
    }
    if (!req.user._id.equals(cube.owner)) {
      req.flash('danger', 'Not Authorized');
      return res.redirect(`/cube/list/${encodeURIComponent(req.params.id)}`);
    }

    await bulkUpload(req, res, items, cube);
    return null;
  } catch (err) {
    return util.handleRouteError(req, res, err, `/cube/list/${encodeURIComponent(req.params.id)}`);
  }
});

router.post('/bulkreplacefile/:id', ensureAuth, async (req, res) => {
  try {
    if (!req.files) {
      req.flash('danger', 'Please attach a file');
      return res.redirect(`/cube/list/${encodeURIComponent(req.params.id)}`);
    }
    const items = req.files.document.data.toString('utf8'); // the uploaded file object
    const cube = await Cube.findOne(buildIdQuery(req.params.id));
    // We need a copy of cards we can mutate to be able to populate details for the comparison.
    const { cards } = await Cube.findOne(buildIdQuery(req.params.id), 'cards').lean();
    if (!cube) {
      req.flash('danger', 'Cube not found');
      return res.redirect('/404');
    }
    if (!req.user._id.equals(cube.owner)) {
      req.flash('danger', 'Not Authorized');
      return res.redirect(`/cube/list/${encodeURIComponent(req.params.id)}`);
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
            card = {
              ...card,
              details: {
                ...carddb.cardFromId(card.cardID),
              },
              index,
            };
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

router.post(
  '/startgriddraft/:id',
  body('packs').toInt({
    min: 1,
    max: 16,
  }),
  body('defaultStatus', 'Status must be valid.').isIn(['bot', '2playerlocal']),
  async (req, res) => {
    try {
      const numPacks = parseInt(req.body.packs, 10);
      const { type } = req.body;

      const numCards = numPacks * 9;

      const cube = await Cube.findOne(buildIdQuery(req.params.id), '_id name draft_formats cards owner basics').lean();

      if (!cube) {
        req.flash('danger', 'Cube not found');
        return res.redirect('/404');
      }

      if (cube.cards.length < numCards) {
        req.flash('danger', `Not enough cards, need ${numCards} cards for a ${numPacks} pack grid draft.`);
        return res.redirect(`/cube/playtest/${encodeURIComponent(req.params.id)}`);
      }

      const source = shuffle(cube.cards)
        .slice(0, numCards)
        .map((card, index) => {
          card.index = index;
          return card;
        });

      const gridDraft = new GridDraft();
      gridDraft.draftType = type;
      gridDraft.cube = cube._id;

      const packs = [];
      const cards = [];
      for (let i = 0; i < numPacks; i++) {
        const pack = source.splice(0, 9);
        cards.push(...pack);
        packs.push(pack.map(({ index }) => index));
      }

      gridDraft.initial_state = packs;
      addBasics(cards, cube.basics, gridDraft);
      gridDraft.cards = cards;
      gridDraft.seats = [];
      const pool = createPool();

      // add human
      gridDraft.seats.push({
        bot: false,
        name: req.user ? req.user.username : 'Anonymous',
        userid: req.user ? req.user._id : null,
        drafted: pool,
        sideboard: pool,
        pickorder: [],
        pickedIndices: [],
      });

      // add bot
      gridDraft.seats.push({
        bot: true,
        name: 'Grid Bot',
        userid: null,
        drafted: pool,
        sideboard: pool,
        pickorder: [],
        pickedIndices: [],
      });

      await gridDraft.save();

      return res.redirect(`/cube/griddraft/${gridDraft._id}`);
    } catch (err) {
      return util.handleRouteError(req, res, err, `/cube/playtest/${encodeURIComponent(req.params.id)}`);
    }
  },
);

router.post(
  '/startsealed/:id',
  body('packs').toInt({
    min: 1,
    max: 16,
  }),
  body('cards').toInt(),
  async (req, res) => {
    try {
      const user = await User.findById(req.user);

      if (!user) {
        req.flash('danger', 'Please Login to build a sealed deck.');
        return res.redirect(`/cube/playtest/${encodeURIComponent(req.params.id)}`);
      }

      const packs = parseInt(req.body.packs, 10);
      const cards = parseInt(req.body.cards, 10);

      const numCards = packs * cards;

      const cube = await Cube.findOne(
        buildIdQuery(req.params.id),
        '_id name basics cards owner numDecks disableNotifications',
      );

      if (!cube) {
        req.flash('danger', 'Cube not found');
        return res.redirect('/404');
      }

      if (cube.cards.length < numCards) {
        req.flash('danger', `Not enough cards, need ${numCards} cards for sealed with ${packs} packs of ${cards}.`);
        return res.redirect(`/cube/playtest/${encodeURIComponent(req.params.id)}`);
      }

      const source = shuffle(cube.cards).slice(0, numCards);
      const pool = createPool();
      const cardsArray = [];
      for (const card of source) {
        let index1 = 0;
        let index2 = 0;

        // sort by color
        const details = carddb.cardFromId(card.cardID);
        const type = card.type_line || details.type;
        const colors = card.colors || details.colors;

        if (type.toLowerCase().includes('land')) {
          index1 = 7;
        } else if (colors.length === 1) {
          index1 = ['W', 'U', 'B', 'R', 'G'].indexOf(colors[0].toUpperCase());
        } else if (colors.length === 0) {
          index1 = 6;
        } else {
          index1 = 5;
        }

        if (!type.toLowerCase().includes('creature')) {
          index2 = 1;
        }

        const cardIndex = cardsArray.length;
        card.index = cardIndex;
        cardsArray.push(card);
        if (pool[index2][index1]) {
          pool[index2][index1].push(cardIndex);
        } else {
          pool[index2][0].push(cardIndex);
        }
      }

      const deck = new Deck();
      deck.cube = cube._id;
      deck.cubeOwner = cube.owner;
      deck.date = Date.now();
      deck.cubename = cube.name;
      deck.seats = [];
      deck.owner = user._id;
      addBasics(cardsArray, cube.basics, deck);
      deck.cards = cardsArray;

      deck.seats.push({
        userid: user._id,
        username: user.username,
        pickorder: cardsArray.map((item, index) => index),
        name: `Sealed from ${cube.name}`,
        description: '',
        deck: pool,
        sideboard: createPool(),
      });
      deck.draft = null;

      await deck.save();

      cube.numDecks += 1;
      await addDeckCardAnalytics(cube, deck, carddb);

      await cube.save();

      const cubeOwner = await User.findById(cube.owner);

      if (!cube.disableNotifications) {
        await util.addNotification(
          cubeOwner,
          user,
          `/cube/deck/${deck._id}`,
          `${user.username} built a sealed deck from your cube: ${cube.name}`,
        );
      }

      return res.redirect(`/cube/deck/deckbuilder/${deck._id}`);
    } catch (err) {
      return util.handleRouteError(req, res, err, `/cube/playtest/${encodeURIComponent(req.params.id)}`);
    }
  },
);

router.post(
  '/startdraft/:id',
  body('id').toInt(),
  body('botsOnly').toBoolean(),
  body('seats').toInt({
    min: 2,
    max: 16,
  }),
  body('packs').toInt({
    min: 1,
    max: 36,
  }),
  body('cards').toInt({
    min: 1,
    max: 90,
  }),
  async (req, res) => {
    try {
      const cube = await Cube.findOne(
        buildIdQuery(req.params.id),
        '_id name draft_formats cards basics useCubeElo',
      ).lean();

      if (!cube) {
        req.flash('danger', 'Cube not found');
        return res.redirect('/404');
      }

      if (cube.cards.length === 0) {
        // This is a 4XX error, not a 5XX error
        req.flash('danger', 'This cube has no cards!');
        return res.redirect(`/cube/playtest/${encodeURIComponent(req.params.id)}`);
      }

      const params = req.body;

      let eloOverrideDict = {};
      if (cube.useCubeElo) {
        const analytic = await CubeAnalytic.findOne({ cube: cube._id });
        if (analytic) {
          eloOverrideDict = fromEntries(analytic.cards.map((c) => [c.cardName, c.elo]));
        }
      }

      // insert card details everywhere that needs them
      for (const card of cube.cards) {
        card.details = carddb.cardFromId(card.cardID);
        if (eloOverrideDict[card.details.name_lower]) {
          card.details.elo = eloOverrideDict[card.details.name_lower];
        }
      }
      // setup draft
      const format = createdraft.getDraftFormat(params, cube);

      let draft = new Draft();
      let populated = {};
      try {
        populated = createdraft.createDraft(
          format,
          cube.cards,
          params.seats,
          req.user
            ? req.user
            : {
                username: 'Anonymous',
              },
          req.body.botsOnly,
        );
      } catch (err) {
        // This is a 4XX error, not a 5XX error
        req.flash('danger', err.message);
        return res.redirect(`/cube/playtest/${encodeURIComponent(req.params.id)}`);
      }

      draft.initial_state = populated.initial_state;
      draft.seats = populated.seats;
      draft.cube = cube._id;
      addBasics(populated.cards, cube.basics, draft);
      draft.cards = populated.cards;

      await draft.save();

      if (req.body.botsOnly) {
        draft = await Draft.findById(draft._id).lean();
        // insert card details everywhere that needs them
        for (const card of draft.cards) {
          card.details = carddb.cardFromId(card.cardID);
        }
        return res.status(200).send({
          success: 'true',
          draft,
        });
      }
      return res.redirect(`/cube/draft/${draft._id}`);
    } catch (err) {
      return util.handleRouteError(req, res, err, `/cube/playtest/${encodeURIComponent(req.params.id)}`);
    }
  },
);

router.get('/griddraft/:id', async (req, res) => {
  try {
    const draft = await GridDraft.findById(req.params.id).lean();
    if (!draft) {
      req.flash('danger', 'Draft not found');
      return res.redirect('/404');
    }

    const cube = await Cube.findOne(buildIdQuery(draft.cube)).lean();

    if (!cube) {
      req.flash('danger', 'Cube not found');
      return res.redirect('/404');
    }

    const user = await User.findById(cube.owner);
    if (!user) {
      req.flash('danger', 'Owner not found');
      return res.redirect('/404');
    }

    let eloOverrideDict = {};
    if (cube.useCubeElo) {
      const analytic = await CubeAnalytic.findOne({ cube: cube._id });
      eloOverrideDict = fromEntries(analytic.cards.map((c) => [c.cardName, c.elo]));
    }

    // insert card details everywhere that needs them
    for (const card of draft.cards) {
      card.details = carddb.cardFromId(card.cardID);
      if (eloOverrideDict[card.details.name_lower]) {
        card.details.elo = eloOverrideDict[card.details.name_lower];
      }
    }

    return render(
      req,
      res,
      'GridDraftPage',
      {
        cube,
        initialDraft: draft,
      },
      {
        title: `${abbreviate(cube.name)} - Grift Draft`,
        metadata: generateMeta(
          `Cube Cobra Grid Draft: ${cube.name}`,
          miscutil.getCubeDescription(cube),
          cube.image_uri,
          `https://cubecobra.com/cube/griddraft/${req.params.id}`,
        ),
      },
    );
  } catch (err) {
    return util.handleRouteError(req, res, err, '/404');
  }
});

router.get('/draft/:id', async (req, res) => {
  try {
    const draft = await Draft.findById(req.params.id).lean();
    if (!draft) {
      req.flash('danger', 'Draft not found');
      return res.redirect('/404');
    }

    const cube = await Cube.findOne(buildIdQuery(draft.cube)).lean();

    if (!cube) {
      req.flash('danger', 'Cube not found');
      return res.redirect('/404');
    }

    const user = await User.findById(cube.owner);
    if (!user) {
      req.flash('danger', 'Owner not found');
      return res.redirect('/404');
    }

    let eloOverrideDict = {};
    if (cube.useCubeElo) {
      const analytic = await CubeAnalytic.findOne({ cube: cube._id });
      eloOverrideDict = fromEntries(analytic.cards.map((c) => [c.cardName, c.elo]));
    }

    // insert card details everywhere that needs them
    for (const card of draft.cards) {
      card.details = carddb.cardFromId(card.cardID);
      if (eloOverrideDict[card.details.name_lower]) {
        card.details.elo = eloOverrideDict[card.details.name_lower];
      }
    }

    return render(
      req,
      res,
      'CubeDraftPage',
      {
        cube,
        initialDraft: draft,
      },
      {
        title: `${abbreviate(cube.name)} - Draft`,
        metadata: generateMeta(
          `Cube Cobra Draft: ${cube.name}`,
          miscutil.getCubeDescription(cube),
          cube.image_uri,
          `https://cubecobra.com/cube/draft/${encodeURIComponent(req.params.id)}`,
        ),
      },
    );
  } catch (err) {
    return util.handleRouteError(req, res, err, '/404');
  }
});

// Edit Submit POST Route
router.post('/edit/:id', ensureAuth, async (req, res) => {
  try {
    let cube = await Cube.findOne(buildIdQuery(req.params.id));

    if (!req.user._id.equals(cube.owner)) {
      req.flash('danger', 'Only cube owner may edit.');
      return res.redirect(`/cube/list/${encodeURIComponent(req.params.id)}`);
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
          req.logger.error({
            message: `Card not found: ${edit}`,
          });
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
          req.logger.error({
            message: `Card not found: ${edit}`,
          });
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
        return res.redirect(`/cube/list/${encodeURIComponent(req.params.id)}`);
      }
    }

    // Filter out removed and invalid cards, and add new cards.
    const newCards = adds.map((add) => util.newCard(add, [], cube.defaultStatus));
    cube.cards = cube.cards.filter((card, index) => card.cardID && !removes.has(index)).concat(newCards);
    cube.maybe = cube.maybe.filter((maybeCard) => !adds.some((addedCard) => addedCard._id === maybeCard.cardID));

    const blogpost = new Blog();
    blogpost.title = req.body.title;
    if (req.body.blog.length > 0) {
      blogpost.markdown = req.body.blog.substring(0, 10000);
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

    if (req.body.mentions) {
      const owner = await User.findById(req.user._id);
      const mentions = req.body.mentions.toLowerCase().split(';');
      const query = User.find({ username_lower: mentions });
      await util.addMultipleNotifications(
        query,
        owner,
        `/cube/blog/blogpost/${blogpost._id}`,
        `${cube.owner_name} mentioned you in their blog post`,
      );
    }

    req.flash('success', 'Cube Updated');
    return res.redirect(`/cube/list/${encodeURIComponent(req.params.id)}?updated=true`);
  } catch (err) {
    return util.handleRouteError(req, res, err, `/cube/list/${encodeURIComponent(req.params.id)}`);
  }
});

router.post('/resize/:id/:size', async (req, res) => {
  try {
    let cube = await Cube.findOne(buildIdQuery(req.params.id));

    if (!cube) {
      return res.status(400).send({
        success: 'false',
        message: 'Cube not found',
      });
    }

    if (!req.user._id.equals(cube.owner)) {
      return res.status(403).send({
        success: 'false',
        message: 'Cube can only be updated by cube owner.',
      });
    }

    const response = await fetch(
      `${process.env.FLASKROOT}/?cube_name=${encodeURIComponent(
        req.params.id,
      )}&num_recs=${1000}&root=${encodeURIComponent(process.env.HOST)}`,
    );
    if (!response.ok) {
      return util.handleRouteError(
        req,
        res,
        'Error fetching suggestion data.',
        `/cube/list/${encodeURIComponent(req.params.id)}`,
      );
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
      return res.redirect(`/cube/list/${encodeURIComponent(req.params.id)}`);
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
      return util.handleRouteError(
        req,
        res,
        'Error parsing filter.',
        `/cube/list/${encodeURIComponent(req.params.id)}`,
      );
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
    blogpost.changelist = changelog;
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
    return util.handleRouteError(req, res, err, `/cube/list/${encodeURIComponent(req.params.id)}`);
  }
});

router.post('/remove/:id', ensureAuth, async (req, res) => {
  try {
    const cube = await Cube.findOne(buildIdQuery(req.params.id));

    if (!req.user._id.equals(cube.owner)) {
      req.flash('danger', 'Not Authorized');
      return res.redirect(`/cube/overview/${encodeURIComponent(req.params.id)}`);
    }
    await Cube.deleteOne(buildIdQuery(req.params.id));

    req.flash('success', 'Cube Removed');
    return res.redirect('/dashboard');
  } catch (err) {
    return util.handleRouteError(req, res, err, '/404');
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
    // update defaultFormat if necessary
    if (index === cube.defaultDraftFormat) {
      cube.defaultDraftFormat = -1;
    } else if (index < cube.defaultDraftFormat) {
      cube.defaultDraftFormat -= 1;
    }

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

module.exports = router;
