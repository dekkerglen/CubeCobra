/* eslint-disable no-await-in-loop */
const express = require('express');
const uuid = require('uuid/v4');
// eslint-disable-next-line import/no-unresolved
const { body, param } = require('express-validator');
const RSS = require('rss');

const createdraft = require('../../dist/drafting/createdraft');
const miscutil = require('../../dist/utils/Util');
const carddb = require('../../serverjs/carddb');
const { render } = require('../../serverjs/render');
const { ensureAuth, csrfProtection } = require('../middleware');
const util = require('../../serverjs/util');
const generateMeta = require('../../serverjs/meta');
const { createLobby } = require('../../serverjs/multiplayerDrafting');

const {
  generatePack,
  abbreviate,
  CSVtoCards,
  compareCubes,
  generateSamplepackImage,
  cachePromise,
  isCubeViewable,
} = require('../../serverjs/cubefn');

const { CARD_HEIGHT, CARD_WIDTH, addBasics, bulkUpload, createPool, shuffle, updateCubeAndBlog } = require('./helper');

const { recommend } = require('../../serverjs/ml');

// Bring in models
const Cube = require('../../dynamo/models/cube');
const Blog = require('../../dynamo/models/blog');
const User = require('../../dynamo/models/user');
const Draft = require('../../dynamo/models/draft');
const CubeAnalytic = require('../../dynamo/models/cubeAnalytic');
const Changelog = require('../../dynamo/models/changelog');

const router = express.Router();
router.use(csrfProtection);

router.use('/blog', require('./blog'));
router.use('/deck', require('./deck'));
router.use('/api', require('./api'));
router.use('/download', require('./download'));

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

    const cube = {
      id: uuid(),
      shortId: null,
      name: req.body.name,
      owner: req.user.id,
      imageName: 'doubling cube [10e-321]',
      description: 'This is a brand new cube!',
      date: Date.now().valueOf(),
      visibility: Cube.VISIBILITY.PUBLIC,
      priceVisibility: Cube.PRICE_VISIBLITY.PUBLIC,
      featured: false,
      tagColors: [],
      defaultFormat: -1,
      numDecks: 0,
      defaultSorts: [],
      showUnsorted: false,
      formats: [],
      following: [],
      defaultStatus: 'Not Owned',
      defaultPrinting: 'recent',
      disableAlerts: false,
      basics: [
        '1d7dba1c-a702-43c0-8fca-e47bbad4a00f',
        '42232ea6-e31d-46a6-9f94-b2ad2416d79b',
        '19e71532-3f79-4fec-974f-b0e85c7fe701',
        '8365ab45-6d78-47ad-a6ed-282069b0fabc',
        '0c4eaecf-dd4c-45ab-9b50-2abe987d35d4',
      ],
      tags: [],
      cardCount: 0,
    };

    await Cube.putNewCube(cube);

    await Cube.putCards({
      id: cube.id,
      mainboard: [],
      maybeboard: [],
    });

    req.flash('success', 'Cube created!');
    return res.redirect(`/cube/view/${cube.id}`);
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

    const source = await Cube.getById(req.params.id);
    if (!isCubeViewable(source, req.user)) {
      req.flash('danger', 'Cube not found');
      return res.redirect('/cube/list/404');
    }

    const sourceCards = await Cube.getCards(source.id);

    const cube = {
      id: uuid(),
      shortId: null,
      name: `Clone of ${source.name}`,
      owner: req.user.id,
      imageName: source.imageName,
      description: `Cloned from [${source.name}](/c/${source.id})\n\n${source.description}`,
      date: Date.now().valueOf(),
      visibility: Cube.VISIBILITY.PUBLIC,
      priceVisibility: Cube.PRICE_VISIBLITY.PUBLIC,
      featured: false,
      tagColors: source.tagColors,
      defaultFormat: source.defaultFormat,
      numDecks: 0,
      defaultSorts: source.defaultSorts,
      showUnsorted: source.showUnsorted,
      formats: source.formats,
      following: [],
      defaultStatus: source.defaultStatus,
      defaultPrinting: source.defaultPrinting,
      disableAlerts: false,
      basics: source.basics,
      tags: source.tags,
      cardCount: source.cardCount,
    };

    const id = await Cube.putNewCube(cube);

    await Cube.putCards({
      ...sourceCards,
      id: cube.id,
    });

    if (!source.disableNotifications && source.owner) {
      await util.addNotification(
        source.owner,
        req.user,
        `/cube/view/${id}`,
        `${req.user.username} made a cube by cloning yours: ${cube.name}`,
      );
    }

    req.flash('success', 'Cube Cloned');
    return res.redirect(`/cube/overview/${cube.id}`);
  } catch (err) {
    return util.handleRouteError(req, res, err, `/cube/list/${encodeURIComponent(req.params.id)}`);
  }
});

router.get('/view/:id', (req, res) => {
  return res.redirect(`/cube/overview/${req.params.id}`);
});

router.post('/format/add/:id', ensureAuth, async (req, res) => {
  try {
    const cube = await Cube.getById(req.params.id);

    if (!isCubeViewable(cube, req.user)) {
      req.flash('danger', 'Cube not found');
      return res.redirect('/cube/list/404');
    }
    if (cube.owner.id !== req.user.id) {
      req.flash('danger', 'Formats can only be changed by cube owner.');
      return res.redirect(`/cube/list/${encodeURIComponent(req.params.id)}`);
    }

    let message = '';
    const { id, serializedFormat } = req.body;
    const format = JSON.parse(serializedFormat);

    format.defaultSeats = Number.parseInt(format.defaultSeats, 10);
    if (Number.isNaN(format.defaultSeats)) format.defaultSeats = 8;
    if (format.defaultSeats < 2 || format.defaultSeats > 16) {
      req.flash('danger', 'Default seat count must be between 2 and 16');
      return res.redirect(`/cube/playtest/${encodeURIComponent(req.params.id)}`);
    }

    if (id === '-1') {
      if (!cube.formats) {
        cube.formats = [];
      }
      cube.formats.push(format);
      message = 'Custom format successfully added.';
    } else {
      cube.formats[req.body.id] = format;
      message = 'Custom format successfully edited.';
    }

    await Cube.update(cube);
    req.flash('success', message);
    return res.redirect(`/cube/playtest/${encodeURIComponent(req.params.id)}`);
  } catch (err) {
    return util.handleRouteError(req, res, err, `/cube/playtest/${encodeURIComponent(req.params.id)}`);
  }
});

router.post(
  '/follow/:id',
  ensureAuth,
  util.wrapAsyncApi(async (req, res) => {
    const { user } = req;
    const cube = await Cube.getById(req.params.id, true);

    if (!isCubeViewable(cube, user)) {
      req.flash('danger', 'Cube not found');
      res.status(404).send({
        success: 'false',
      });
    }

    cube.following = [...new Set([...(cube.following || []), user.id])];

    if (!user.followedCubes) {
      user.followedCubes = [];
    }

    if (!user.followedCubes.some((id) => id.equals === cube.id)) {
      user.followedCubes.push(cube.id);
    }

    await User.update(user);
    await Cube.update(cube);

    await util.addNotification(
      cube.owner,
      user,
      `/cube/overview/${cube.id}`,
      `${user.username} followed your cube: ${cube.name}`,
    );

    res.status(200).send({
      success: 'true',
    });
  }),
);

router.post(
  '/unfollow/:id',
  ensureAuth,
  util.wrapAsyncApi(async (req, res) => {
    const cube = await Cube.getById(req.params.id);

    if (!isCubeViewable(cube, req.user)) {
      req.flash('danger', 'Cube not found');
      return res.status(404).send({
        success: 'false',
      });
    }

    const { user } = req;
    cube.following = cube.following.filter((id) => req.user.id !== id);
    user.followedCubes = user.followedCubes.filter((id) => cube.id !== id);

    await User.update(user);
    await Cube.update(cube);

    return res.status(200).send({
      success: 'true',
    });
  }),
);

router.post('/feature/:id', ensureAuth, async (req, res) => {
  const redirect = `/cube/overview/${encodeURIComponent(req.params.id)}`;
  try {
    const { user } = req;
    if (!util.isAdmin(user)) {
      req.flash('danger', 'Not Authorized');
      return res.redirect(redirect);
    }

    const cube = await Cube.getById(req.params.id);

    if (!cube) {
      req.flash('danger', 'Cube not found');
      return res.redirect(redirect);
    }
    if (cube.visibility !== Cube.VISIBILITY.PUBLIC) {
      req.flash('danger', 'Cannot feature a private cube');
      return res.redirect(redirect);
    }

    cube.featured = true;
    await Cube.update(cube);

    req.flash('success', 'Cube updated successfully.');
    return res.redirect(redirect);
  } catch (err) {
    return util.handleRouteError(req, res, err, redirect);
  }
});

router.post('/unfeature/:id', ensureAuth, async (req, res) => {
  const redirect = `/cube/overview/${encodeURIComponent(req.params.id)}`;
  try {
    const { user } = req;
    if (!util.isAdmin(user)) {
      req.flash('danger', 'Not Authorized');
      return res.redirect(redirect);
    }

    const cube = await Cube.getById(req.params.id);

    if (!cube) {
      req.flash('danger', 'Cube not found');
      return res.redirect(redirect);
    }

    cube.featured = false;
    await Cube.update(cube);

    req.flash('success', 'Cube updated successfully.');
    return res.redirect(redirect);
  } catch (err) {
    return util.handleRouteError(req, res, err, redirect);
  }
});

router.get('/overview/:id', async (req, res) => {
  try {
    const cube = await Cube.getById(req.params.id);

    if (!isCubeViewable(cube, req.user)) {
      req.flash('danger', 'Cube not found');
      return res.redirect('404');
    }

    const cards = await Cube.getCards(cube.id);
    const { mainboard } = cards;

    const blogs = await Blog.getByCube(cube.id, 1);

    const followers = await User.batchGet(cube.following);

    // calculate cube prices
    const nameToCards = {};
    for (const card of mainboard) {
      if (!nameToCards[card.details.name]) {
        const allVersionsOfCard = carddb.getIdsFromName(card.details.name) || [];
        nameToCards[card.details.name] = allVersionsOfCard.map((id) => carddb.cardFromId(id));
      }
    }

    const cheapestDict = {};
    for (const card of mainboard) {
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
    for (const card of mainboard) {
      if (!['Not Owned', 'Proxied'].includes(card.status) && card.details.prices) {
        if (card.finish === 'Foil') {
          totalPriceOwned += card.details.prices.usd_foil || card.details.prices.usd || 0;
        } else {
          totalPriceOwned += card.details.prices.usd || card.details.prices.usd_foil || 0;
        }
      }

      totalPricePurchase += cheapestDict[card.details.name] || 0;
    }

    return render(
      req,
      res,
      'CubeOverviewPage',
      {
        cube,
        cards,
        post: blogs && blogs.items.length > 0 ? blogs.items[0] : null,
        followed: req.user && cube.following && cube.following.some((id) => req.user.id === id),
        followers,
        priceOwned: !cube.PrivatePrices ? totalPriceOwned : null,
        pricePurchase: !cube.PrivatePrices ? totalPricePurchase : null,
      },
      {
        title: `${abbreviate(cube.name)} - Overview`,
        metadata: generateMeta(
          `Cube Cobra Overview: ${cube.name}`,
          cube.description,
          cube.image.uri,
          `https://cubecobra.com/cube/overview/${req.params.id}`,
        ),
      },
    );
  } catch (err) {
    return util.handleRouteError(req, res, err, `/landing/${req.params.id}`);
  }
});

router.get('/rss/:id', async (req, res) => {
  try {
    const split = req.params.id.split(';');
    const cubeID = split[0];
    const cube = await Cube.getById(cubeID);
    if (!isCubeViewable(cube, req.user)) {
      req.flash('danger', `Cube ID ${req.params.id} not found`);
      return res.redirect('/404');
    }

    const items = [];
    let queryResult = { lastKey: null };

    do {
      queryResult = await Blog.getByCube(cube.id, 128, queryResult.lastKey);
      items.push(...queryResult.items);
    } while (queryResult.lastKey);

    const feed = new RSS({
      title: cube.name,
      feed_url: `https://cubecobra.com/cube/rss/${cube.id}`,
      site_url: 'https://cubecobra.com',
    });

    items.forEach((blog) => {
      if (blog.body && blog.Changelog) {
        feed.item({
          title: blog.title,
          description: `${blog.body}\n\n${Blog.changelogToText(blog.Changelog)}`,
          guid: blog.id,
          date: blog.date,
        });
      } else if (blog.body) {
        feed.item({
          title: blog.title,
          description: blog.body,
          guid: blog.id,
          date: blog.date,
        });
      } else if (blog.Changelog) {
        feed.item({
          title: blog.title,
          description: Blog.changelogToText(blog.Changelog),
          guid: blog.id,
          date: blog.date,
        });
      }
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

    const cubeAq = Cube.getById(idA);
    const cubeBq = Cube.getById(idB);

    const [cubeA, cubeB] = await Promise.all([cubeAq, cubeBq]);

    if (!isCubeViewable(cubeA, req.user)) {
      req.flash('danger', `Base cube not found: ${idA}`);
      return res.redirect('/404');
    }
    if (!isCubeViewable(cubeB, req.user)) {
      req.flash('danger', `Comparison cube not found: ${idB}`);
      return res.redirect('/404');
    }

    const [cardsA, cardsB] = await Promise.all([Cube.getCards(cubeA.id), Cube.getCards(cubeB.id)]);

    const { aOracles, bOracles, inBoth, allCards } = await compareCubes(cardsA, cardsB);

    return render(
      req,
      res,
      'CubeComparePage',
      {
        cube: cubeA,
        cubeB,
        onlyA: aOracles,
        onlyB: bOracles,
        both: inBoth.map((card) => card.details.oracle_id),
        cards: allCards.map((card, index) =>
          Object.assign(card, {
            index,
          }),
        ),
      },
      {
        title: `Comparing ${cubeA.name} to ${cubeB.name}`,
        metadata: generateMeta(
          'Cube Cobra Compare cubes',
          `Comparing "${cubeA.name}" To "${cubeB.name}"`,
          cubeA.image.uri,
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
    const cube = await Cube.getById(req.params.id);
    if (!isCubeViewable(cube, req.user)) {
      req.flash('danger', 'Cube not found');
      return res.redirect('404');
    }

    const cards = await Cube.getCards(cube.id);

    return render(
      req,
      res,
      'CubeListPage',
      {
        cube,
        cards,
      },
      {
        title: `${abbreviate(cube.name)} - List`,
        metadata: generateMeta(
          `Cube Cobra List: ${cube.name}`,
          cube.description,
          cube.image.uri,
          `https://cubecobra.com/cube/list/${req.params.id}`,
        ),
      },
    );
  } catch (err) {
    return util.handleRouteError(req, res, err, `/cube/overview/${req.params.id}`);
  }
});

router.get('/history/:id', async (req, res) => {
  try {
    const cube = await Cube.getById(req.params.id);
    if (!isCubeViewable(cube, req.user)) {
      req.flash('danger', 'Cube not found');
      return res.redirect('404');
    }

    const query = await Changelog.getByCube(cube.id, 36);

    return render(
      req,
      res,
      'CubeHistoryPage',
      {
        cube,
        changes: query.items,
        lastKey: query.lastKey,
      },
      {
        title: `${abbreviate(cube.name)} - List`,
        metadata: generateMeta(
          `Cube Cobra List: ${cube.name}`,
          cube.description,
          cube.image.uri,
          `https://cubecobra.com/cube/list/${req.params.id}`,
        ),
      },
    );
  } catch (err) {
    return util.handleRouteError(req, res, err, `/cube/overview/${req.params.id}`);
  }
});

router.post('/getmorechangelogs', async (req, res) => {
  const { lastKey, cubeId } = req.body;
  const query = await Changelog.getByCube(cubeId, 18, lastKey);

  return res.status(200).send({
    success: 'true',
    posts: query.items,
    lastKey: query.lastKey,
  });
});

router.get('/playtest/:id', async (req, res) => {
  try {
    const cube = await Cube.getById(req.params.id);

    if (!isCubeViewable(cube, req.user)) {
      req.flash('danger', 'Cube not found');
      return res.redirect('404');
    }

    const decks = await Draft.getByCube(cube.id);

    return render(
      req,
      res,
      'CubePlaytestPage',
      {
        cube,
        decks: decks.items,
      },
      {
        title: `${abbreviate(cube.name)} - Playtest`,
        metadata: generateMeta(
          `Cube Cobra Playtest: ${cube.name}`,
          cube.description,
          cube.image.uri,
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
    const cube = await Cube.getById(req.params.id);

    if (!isCubeViewable(cube, req.user)) {
      req.flash('danger', 'Cube not found');
      return res.redirect('404');
    }

    const cards = await Cube.getCards(cube.id);

    for (const [boardname, list] of Object.entries(cards)) {
      if (boardname !== 'id') {
        for (const card of list) {
          if (card.details.tokens) {
            card.details.tokens = card.details.tokens.map((oracle) => {
              const tokenDetails = carddb.cardFromId(oracle);
              return {
                tags: [],
                status: 'Not Owned',
                colors: tokenDetails.color_identity,
                cmc: tokenDetails.cmc,
                cardID: tokenDetails.scryfall_id,
                type_line: tokenDetails.type,
                addedTmsp: new Date(),
                finish: 'Non-foil',
                details: tokenDetails,
              };
            });
          }
        }
      }
    }

    const cubeAnalytics = await CubeAnalytic.getByCube(cube.id);

    const { adds, cuts } = recommend(cards.mainboard.map((card) => card.details.oracle_id));

    // keep track of which versions of cards are in the cube
    const oracleScryfallMap = cards.mainboard.reduce((map, { details }) => {
      map[details.oracle_id] = details.scryfall_id;
      return map;
    }, {});
    // use that to personalize the suggested cuts
    const scryfallCuts = cuts.map((cut) => oracleScryfallMap[cut.oracle]);

    return render(
      req,
      res,
      'CubeAnalysisPage',
      {
        cube,
        cards,
        cubeAnalytics: cubeAnalytics || { cards: [] },
        cubeID: req.params.id,
        adds: adds.map((item) => {
          const card = carddb.getReasonableCardByOracle(item.oracle);
          return {
            details: card,
            cardID: card.scryfall_id,
          };
        }),
        cuts: scryfallCuts.map((item) => {
          const card = carddb.cardFromId(item);
          return {
            details: card,
            cardID: card.scryfall_id,
          };
        }),
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
    const cube = await Cube.getById(req.params.id);

    if (!isCubeViewable(cube, req.user)) {
      req.flash('danger', 'Cube not found');
      return res.redirect('/cube/playtest/404');
    }

    const cards = await Cube.getCards(cube.id);

    let pack;
    try {
      pack = await generatePack(cube, cards, carddb, req.params.seed);
    } catch (err) {
      req.flash('danger', "Failed to generate pack. If trying again doesn't work, please file a bug report.");
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
    const cube = await Cube.getById(req.params.id);

    if (!isCubeViewable(cube, req.user)) {
      req.flash('danger', 'Cube not found');
      return res.redirect('/cube/playtest/404');
    }

    const cards = await Cube.getCards(cube.id);

    const imageBuffer = await cachePromise(`/samplepack/${req.params.id}/${req.params.seed}`, async () => {
      let pack;
      try {
        pack = await generatePack(cube, cards, carddb, req.params.seed);
      } catch (err) {
        req.flash('danger', err.message);
        return res.redirect(`/cube/playtest/${encodeURIComponent(req.params.id)}`);
      }

      // Try to make it roughly 5 times as wide as it is tall in cards.
      const width = Math.floor(Math.sqrt((5 / 3) * pack.pack.length));
      const height = Math.ceil(pack.pack.length / width);

      const srcArray = pack.pack.map((card, index) => {
        return {
          src: card.imgUrl || card.details.image_normal,
          x: CARD_WIDTH * (index % width),
          y: CARD_HEIGHT * Math.floor(index / width),
          height: CARD_HEIGHT,
          width: CARD_WIDTH,
        };
      });

      return generateSamplepackImage(srcArray, CARD_WIDTH * width, CARD_HEIGHT * height);
    });

    res.writeHead(200, {
      'Content-Type': 'image/webp',
    });
    return res.end(imageBuffer);
  } catch (err) {
    return util.handleRouteError(req, res, err, '/404');
  }
});

router.post('/bulkupload/:id', ensureAuth, async (req, res) => {
  try {
    const cube = await Cube.getById(req.params.id);

    if (!isCubeViewable(cube, req.user)) {
      req.flash('danger', 'Cube not found');
      return res.redirect('/404');
    }

    if (cube.owner.id !== req.user.id) {
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

    const cube = await Cube.getById(req.params.id);

    if (!isCubeViewable(cube, req.user)) {
      req.flash('danger', 'Cube not found');
      return res.redirect('/404');
    }

    if (cube.owner.id !== req.user.id) {
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

    const cube = await Cube.getById(req.params.id);
    // use this to maintain customized fields
    const cards = await Cube.getCards(cube.id, true);

    if (!isCubeViewable(cube, req.user)) {
      req.flash('danger', 'Cube not found');
      return res.redirect('/404');
    }

    if (cube.owner.id !== req.user.id) {
      req.flash('danger', 'Not Authorized');
      return res.redirect(`/cube/list/${encodeURIComponent(req.params.id)}`);
    }

    const lines = items.match(/[^\r\n]+/g);

    if (lines && (lines[0].match(/,/g) || []).length > 3) {
      const added = [];
      const { newCards, newMaybe, missing } = CSVtoCards(items, carddb);

      const newList = {
        mainboard: newCards.map((card) => ({
          details: carddb.cardFromId(card.cardID),
          ...card,
        })),
        maybeboard: newMaybe.map((card) => ({
          details: carddb.cardFromId(card.cardID),
          ...card,
        })),
      };

      const changelog = {
        mainboard: {
          adds: newList.mainboard.map(({ cardID }) => {
            return { cardID };
          }),
          removes: cards.mainboard.map(({ cardID }) => {
            return { oldCard: { cardID } };
          }),
        },
        maybeboard: {
          adds: newList.maybeboard.map(({ cardID }) => {
            return { cardID };
          }),
          removes: cards.maybeboard.map(({ cardID }) => {
            return { oldCard: { cardID } };
          }),
        },
      };

      added.push(...newList.mainboard);

      return updateCubeAndBlog(req, res, cube, newList, changelog, added, missing);
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
  body('type', 'type must be valid.').isIn(['bot', '2playerlocal']),
  async (req, res) => {
    try {
      if (!req.user) {
        req.flash('danger', 'You must be logged in to start a draft.');
        return res.redirect(`/cube/playtest/${req.params.id}`);
      }

      const numPacks = parseInt(req.body.packs, 10);

      const numCards = numPacks * 9;

      const cube = await Cube.getById(req.params.id);
      const cubeCards = await Cube.getCards(req.params.id);
      const { mainboard } = cubeCards;

      if (!isCubeViewable(cube, req.user)) {
        req.flash('danger', 'Cube not found');
        return res.redirect('/404');
      }

      if (mainboard.length < numCards) {
        req.flash('danger', `Not enough cards, need ${numCards} cards for a ${numPacks} pack grid draft.`);
        return res.redirect(`/cube/playtest/${encodeURIComponent(req.params.id)}`);
      }

      const source = shuffle(mainboard)
        .slice(0, numCards)
        .map((card, index) => {
          card.index = index;
          return card;
        });

      const doc = {
        cube: cube.id,
        owner: req.user.id,
        cubeOwner: cube.owner.id,
        date: new Date().valueOf(),
        type: Draft.TYPES.GRID,
        seats: [],
        cards: [],
        InitialState: [],
        complete: false,
      };

      for (let i = 0; i < numPacks; i++) {
        const pack = source.splice(0, 9);
        doc.cards.push(...pack);
        doc.InitialState.push(pack.map(({ index }) => index));
      }

      addBasics(doc, cube.basics);
      const pool = createPool();

      // add human
      doc.seats.push({
        bot: false,
        name: req.user ? req.user.username : 'Anonymous',
        owner: req.user ? req.user.id : null,
        mainboard: pool,
        sideboard: pool,
        pickorder: [],
        pickedIndices: [],
      });

      if (req.body.type === '2playerlocal') {
        // add human
        doc.seats.push({
          bot: false,
          name: req.user ? req.user.username : 'Anonymous',
          owner: req.user ? req.user.id : null,
          mainboard: pool,
          sideboard: pool,
          pickorder: [],
          pickedIndices: [],
        });
      } else {
        // add bot
        doc.seats.push({
          bot: true,
          name: 'Grid Bot',
          owner: null,
          mainboard: pool,
          sideboard: pool,
          pickorder: [],
          pickedIndices: [],
        });
      }

      const id = await Draft.put(doc);

      return res.redirect(`/cube/griddraft/${id}`);
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
      if (!req.user) {
        req.flash('danger', 'You must be logged in to start a sealed draft.');
        return res.redirect(`/cube/playtest/${req.params.id}`);
      }

      const user = await User.getById(req.user.id);

      if (!user) {
        req.flash('danger', 'Please Login to build a sealed deck.');
        return res.redirect(`/cube/playtest/${encodeURIComponent(req.params.id)}`);
      }

      const packs = parseInt(req.body.packs, 10);
      const cards = parseInt(req.body.cards, 10);

      const numCards = packs * cards;

      const cube = await Cube.getById(req.params.id);

      if (!isCubeViewable(cube, req.user)) {
        req.flash('danger', 'Cube not found');
        return res.redirect('/404');
      }

      const cubeCards = await Cube.getCards(req.params.id);
      const { mainboard } = cubeCards;

      if (mainboard.length < numCards) {
        req.flash('danger', `Not enough cards, need ${numCards} cards for sealed with ${packs} packs of ${cards}.`);
        return res.redirect(`/cube/playtest/${encodeURIComponent(req.params.id)}`);
      }

      const source = shuffle(mainboard).slice(0, numCards);
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

      const deck = {
        cube: cube.id,
        owner: req.user.id,
        cubeOwner: cube.owner.id,
        date: new Date().valueOf(),
        type: Draft.TYPES.SEALED,
        seats: [],
        cards: cardsArray,
        complete: true,
      };

      addBasics(deck, cube.basics);

      deck.seats.push({
        owner: user.id,
        title: `Sealed from ${cube.name}`,
        body: '',
        mainboard: pool,
        sideboard: createPool(),
      });

      const deckId = await Draft.put(deck);

      cube.numDecks += 1;

      await Cube.update(cube);

      if (!cube.disableNotifications && cube.owner) {
        await util.addNotification(
          cube.owner,
          user,
          `/cube/deck/${deckId}`,
          `${user.username} built a sealed deck from your cube: ${cube.name}`,
        );
      }

      return res.redirect(`/cube/deck/deckbuilder/${deckId}`);
    } catch (err) {
      return util.handleRouteError(req, res, err, `/cube/playtest/${encodeURIComponent(req.params.id)}`);
    }
  },
);

router.post(
  '/startdraft/:id',
  ensureAuth,
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
      const cube = await Cube.getById(req.params.id);

      if (!isCubeViewable(cube, req.user)) {
        req.flash('danger', 'Cube not found');
        return res.redirect('/404');
      }

      const cubeCards = await Cube.getCards(req.params.id);
      const { mainboard } = cubeCards;

      if (mainboard.length === 0) {
        // This is a 4XX error, not a 5XX error
        req.flash('danger', 'This cube has no cards!');
        return res.redirect(`/cube/playtest/${encodeURIComponent(req.params.id)}`);
      }

      const params = req.body;

      // setup draft
      const format = createdraft.getDraftFormat(params, cube);

      const draft = {
        complete: false,
      };

      let populated = {};
      try {
        populated = createdraft.createDraft(
          format,
          mainboard,
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

      draft.InitialState = populated.initial_state;
      draft.seats = populated.seats;
      draft.cube = cube.id;
      draft.owner = req.user.id;
      draft.cubeOwner = cube.owner.id;
      draft.type = Draft.TYPES.DRAFT;
      draft.date = new Date().valueOf();
      draft.cards = populated.cards;
      addBasics(draft, cube.basics);

      const draftId = await Draft.put(draft);
      draft.id = draftId;

      await createLobby(draft, req.user);

      return res.redirect(`/cube/draft/${draftId}`);
    } catch (err) {
      return util.handleRouteError(req, res, err, `/cube/playtest/${encodeURIComponent(req.params.id)}`);
    }
  },
);

router.get('/griddraft/:id', async (req, res) => {
  try {
    const document = await Draft.getById(req.params.id);

    if (!document) {
      req.flash('danger', 'Draft not found');
      return res.redirect('/404');
    }

    if (document.type !== Draft.TYPES.GRID) {
      req.flash('danger', 'Draft is not a grid draft');
      return res.redirect('/404');
    }

    const cube = await Cube.getById(document.cube);

    if (!isCubeViewable(cube, req.user)) {
      req.flash('danger', 'Cube not found');
      return res.redirect('/404');
    }

    return render(
      req,
      res,
      'GridDraftPage',
      {
        cube,
        initialDraft: document,
      },
      {
        title: `${abbreviate(cube.name)} - Grift Draft`,
        metadata: generateMeta(
          `Cube Cobra Grid Draft: ${cube.name}`,
          cube.description,
          cube.image.uri,
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
    const draft = await Draft.getById(req.params.id);

    if (!draft) {
      req.flash('danger', 'Draft not found');
      return res.redirect('/404');
    }

    const cube = await Cube.getById(draft.cube);

    if (!isCubeViewable(cube, req.user)) {
      req.flash('danger', 'Cube not found');
      return res.redirect('/404');
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
          cube.description,
          cube.image.uri,
          `https://cubecobra.com/cube/draft/${encodeURIComponent(req.params.id)}`,
        ),
      },
    );
  } catch (err) {
    return util.handleRouteError(req, res, err, '/404');
  }
});

router.post('/remove/:id', ensureAuth, async (req, res) => {
  try {
    const cube = await Cube.getById(req.params.id);

    if (!isCubeViewable(cube, req.user)) {
      req.flash('danger', 'Cube not found');
      return res.redirect('/cube/overview/404');
    }
    if (cube.owner.id !== req.user.id) {
      req.flash('danger', 'Not Authorized');
      return res.redirect(`/cube/overview/${encodeURIComponent(req.params.id)}`);
    }

    await Cube.deleteById(req.params.id);

    req.flash('success', 'Cube Removed');
    return res.redirect('/dashboard');
  } catch (err) {
    return util.handleRouteError(req, res, err, '/404');
  }
});

router.delete('/format/remove/:cubeid/:index', ensureAuth, param('index').toInt(), async (req, res) => {
  try {
    const { cubeid, index } = req.params;

    const cube = await Cube.getById(cubeid);
    if (!isCubeViewable(cube, req.user)) {
      return res.status(404).send({
        success: 'false',
        message: 'No such cube.',
      });
    }

    if (cube.owner.id !== req.user.id) {
      return res.status(401).send({
        success: 'false',
        message: 'Not authorized.',
      });
    }
    if (index < 0 || index >= cube.formats.length) {
      return res.status(400).send({
        success: 'false',
        message: 'Invalid request format.',
      });
    }

    cube.formats.splice(index, 1);
    // update defaultFormat if necessary
    if (index === cube.defaultDraftFormat) {
      cube.defaultFormat = -1;
    } else if (index < cube.defaultDraftFormat) {
      cube.defaultFormat -= 1;
    }

    await Cube.update(cube);

    return res.status(200).send({
      success: 'true',
    });
  } catch (err) {
    req.logger.error(err.message, err.stack);
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

    const cube = await Cube.getById(cubeid);
    if (
      !isCubeViewable(cube, req.user) ||
      cube.owner.id !== req.user.id ||
      !Number.isInteger(formatId) ||
      formatId >= cube.formats.length ||
      formatId < -1
    ) {
      return res.sendStatus(401);
    }

    cube.defaultFormat = formatId;

    await Cube.update(cube);
    return res.status(200).send({
      success: 'true',
    });
  }),
);

module.exports = router;
