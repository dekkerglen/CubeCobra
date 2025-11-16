const express = require('express');
const uuid = require('uuid');
const { body, param } = require('express-validator');
const RSS = require('rss');
const { CARD_STATUSES, DefaultPrintingPreference, PrintingPreference } = require('@utils/datatypes/Card');
const { CUBE_DEFAULT_SORTS } = require('@utils/datatypes/Cube');
const cardutil = require('@utils/cardutil');
const miscutil = require('@utils/Util');
const { getIdsFromName, cardFromId } = require('../../serverutils/carddb');
const { handleRouteError, render, redirect } = require('../../serverutils/render');
const { ensureAuth, csrfProtection, recaptcha } = require('../middleware');
const util = require('../../serverutils/util');
const generateMeta = require('../../serverutils/meta');
const FeaturedQueue = require('dynamo/models/featuredQueue');
const { isInFeaturedQueue } = require('../../serverutils/featuredQueue');

import { NoticeType } from '@utils/datatypes/Notice';

const {
  generatePack,
  generateBalancedPack,
  abbreviate,
  CSVtoCards,
  compareCubes,
  generateSamplepackImage,
  cachePromise,
  isCubeViewable,
  isCubeListed,
} = require('../../serverutils/cubefn');

const { CARD_HEIGHT, CARD_WIDTH, addBasics, bulkUpload, createPool, shuffle, updateCubeAndBlog } = require('./helper');

// Bring in models
const Notice = require('dynamo/models/notice');
const Cube = require('dynamo/models/cube');
const Blog = require('dynamo/models/blog');
const p1p1PackModel = require('dynamo/models/p1p1Pack');
const User = require('dynamo/models/user');
const Draft = require('dynamo/models/draft');
const CubeAnalytic = require('dynamo/models/cubeAnalytic');
const Changelog = require('dynamo/models/changelog');

const router = express.Router();
router.use(csrfProtection);

// Shared function for generating pack images for samplepack and p1p1pack images
// Overarching logic here - we want the most visually appealing layout for the pack
// For non-prime numbers that's a balanced rectangle (ideally a square)
// For prime numbers, we use whatever the next non-prime's results would be
// Only use factors in the range 2-7 to avoid things like 2x11 for 22
const generatePackLayout = (count) => {
  const isPrime = (n) => {
    if (n < 2) return false;
    for (let i = 2; i <= Math.sqrt(n); i++) {
      if (n % i === 0) return false;
    }
    return true;
  };

  const findOptimalFactors = (n) => {
    // Start from the middle and work outward to find the most balanced factors
    const sqrt = Math.sqrt(n);
    for (let h = Math.min(7, Math.floor(sqrt)); h >= 2; h--) {
      if (n % h !== 0) continue;
      const w = n / h;
      if (w >= 2 && w <= 7) {
        return [w, h]; // w >= h since we iterate h downward from sqrt
      }
    }
    return null; // no valid factors found
  };

  // Handle small edge cases
  if (count === 1) return [1, 1];
  if (count === 2) return [2, 1];
  if (count === 3) return [3, 1];

  // Handle large edge cases - just make a big square
  if (count > 49) {
    const sqrt = Math.ceil(Math.sqrt(count));
    return [sqrt, sqrt];
  }

  let layoutTarget = count;
  while (true) {
    if (!isPrime(layoutTarget)) {
      const factors = findOptimalFactors(layoutTarget);
      if (factors !== null) {
        return factors; // found acceptable layout
      }
    }
    // Not prime but doesn't have factors in range 2-7, so we bump
    layoutTarget += 1;
  }
};

const absoluteUrl = (url) => {
  if (!url.startsWith('/')) {
    return url;
  }
  return `http://${process.env.DOMAIN}${url}`;
};

const generatePackImage = async (cards) => {
  if (cards.some((card) => !card.imgUrl && !card.details.image_normal)) {
    throw new Error('One or more cards in this pack are missing images.');
  }

  const [width, height] = generatePackLayout(cards.length);

  const srcArray = cards.map((card, index) => ({
    src: absoluteUrl(card.imgUrl || card.details.image_normal),
    x: CARD_WIDTH * (index % width),
    y: CARD_HEIGHT * Math.floor(index / width),
    height: CARD_HEIGHT,
    width: CARD_WIDTH,
  }));

  return generateSamplepackImage(srcArray, CARD_WIDTH * width, CARD_HEIGHT * height);
};

router.use('/deck', require('./deck'));
router.use('/api', require('./api'));
router.use('/download', require('./download'));

router.post('/add', ensureAuth, recaptcha, async (req, res) => {
  try {
    const {
      body: { name },
      user,
    } = req;
    if (!name || name.length < 5 || name.length > 100) {
      req.flash('danger', 'Cube name should be at least 5 characters long, and shorter than 100 characters.');
      return redirect(req, res, `/user/view/${user.id}`);
    }

    if (util.hasProfanity(name)) {
      req.flash('danger', 'Cube name contains a banned word. If you feel this was a mistake, please contact us.');
      return redirect(req, res, `/user/view/${user.id}`);
    }

    // if this user has two empty cubes, we deny them from making a new cube
    const cubes = await Cube.getByOwner(user.id);

    const emptyCubes = cubes.items.filter((cube) => cube.cardCount === 0);

    if (emptyCubes.length >= 2) {
      req.flash(
        'danger',
        'You may only have two empty cubes at a time. To create a new cube, please delete an empty cube, or add cards to it.',
      );
      return redirect(req, res, `/user/view/${user.id}`);
    }

    // if this account is younger than a week, we deny them from making a new cube
    if (req.user.dateCreated && Date.now() - req.user.dateCreated < 1000 * 60 * 60 * 24 * 7) {
      const totalCubes = cubes.items.length;

      if (totalCubes > 2) {
        req.flash('danger', 'You may only have two cubes until your account is a week old.');
        return redirect(req, res, `/user/view/${user.id}`);
      }
    }

    const cube = {
      id: uuid.v4(),
      shortId: null,
      name: name,
      owner: user.id,
      imageName: 'doubling cube [10e-321]',
      description: 'This is a brand new cube!',
      date: Date.now().valueOf(),
      visibility: Cube.VISIBILITY.PUBLIC,
      priceVisibility: Cube.PRICE_VISIBILITY.PUBLIC,
      featured: false,
      tagColors: [],
      defaultFormat: -1,
      numDecks: 0,
      defaultSorts: CUBE_DEFAULT_SORTS,
      showUnsorted: false,
      formats: [],
      following: [],
      defaultStatus: 'Not Owned',
      defaultPrinting: DefaultPrintingPreference,
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
    return redirect(req, res, `/cube/view/${cube.id}`);
  } catch (err) {
    return handleRouteError(req, res, err, `/user/view/${req.user.id}`);
  }
});

router.get('/report/:id', ensureAuth, async (req, res) => {
  try {
    const cube = await Cube.getById(req.params.id);

    if (!cube) {
      req.flash('danger', 'Cube not found');
      return redirect(req, res, '/404');
    }
    const report = {
      subject: cube.owner.id,
      body: `"${cube.name}" was reported by ${req.user.username}`,
      user: req.user ? req.user.id : null,
      date: Date.now().valueOf(),
      type: NoticeType.CUBE_REPORT,
    };

    await Notice.put(report);

    req.flash(
      'success',
      'Thank you for the report! Our moderators will review the report can decide whether to take action.',
    );

    return redirect(req, res, `/cube/overview/${req.params.id}`);
  } catch (err) {
    return handleRouteError(req, res, err, `/cube/overview/${req.params.id}`);
  }
});

router.get('/recents', async (req, res) => {
  const result = await Cube.getByVisibility(Cube.VISIBILITY.PUBLIC);

  return render(req, res, 'RecentlyUpdateCubesPage', {
    items: result.items.filter((cube) => isCubeListed(cube, req.user)),
    lastKey: result.lastKey,
  });
});

router.post('/getmorerecents', ensureAuth, async (req, res) => {
  const { lastKey } = req.body;

  const result = await Cube.getByVisibility(Cube.VISIBILITY.PUBLIC, lastKey);

  return res.status(200).send({
    success: 'true',
    items: result.items.filter((cube) => isCubeListed(cube, req.user)),
    lastKey: result.lastKey,
  });
});

router.get('/clone/:id', async (req, res) => {
  try {
    if (!req.user) {
      req.flash('danger', 'Please log on to clone this cube.');
      return redirect(req, res, `/cube/list/${encodeURIComponent(req.params.id)}`);
    }

    const source = await Cube.getById(req.params.id);
    if (!isCubeViewable(source, req.user)) {
      req.flash('danger', 'Cube not found');
      return redirect(req, res, '/cube/list/404');
    }

    const sourceCards = await Cube.getCards(source.id);

    const cube = {
      id: uuid.v4(),
      shortId: null,
      name: `Clone of ${source.name}`,
      owner: req.user.id,
      imageName: source.imageName,
      description: `Cloned from [${source.name}](/c/${source.id})\n\n${source.description}`,
      date: Date.now().valueOf(),
      visibility: Cube.VISIBILITY.PUBLIC,
      priceVisibility: Cube.PRICE_VISIBILITY.PUBLIC,
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
    return redirect(req, res, `/cube/overview/${cube.id}`);
  } catch (err) {
    return handleRouteError(req, res, err, `/cube/list/${encodeURIComponent(req.params.id)}`);
  }
});

router.get('/view/:id', (req, res) => redirect(req, res, `/cube/overview/${req.params.id}`));

router.post('/format/add/:id', ensureAuth, async (req, res) => {
  try {
    const cube = await Cube.getById(req.params.id);

    if (!isCubeViewable(cube, req.user)) {
      req.flash('danger', 'Cube not found');
      return redirect(req, res, '/cube/list/404');
    }
    if (cube.owner.id !== req.user.id) {
      req.flash('danger', 'Formats can only be changed by cube owner.');
      return redirect(req, res, `/cube/list/${encodeURIComponent(req.params.id)}`);
    }

    let message = '';
    const { id, serializedFormat } = req.body;
    const format = JSON.parse(serializedFormat);

    format.defaultSeats = Number.parseInt(format.defaultSeats, 10);
    if (Number.isNaN(format.defaultSeats)) format.defaultSeats = 8;
    if (format.defaultSeats < 2 || format.defaultSeats > 16) {
      req.flash('danger', 'Default seat count must be between 2 and 16');
      return redirect(req, res, `/cube/playtest/${encodeURIComponent(req.params.id)}`);
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
    return redirect(req, res, `/cube/playtest/${encodeURIComponent(req.params.id)}`);
  } catch (err) {
    return handleRouteError(req, res, err, `/cube/playtest/${encodeURIComponent(req.params.id)}`);
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

    //TODO: Can remove after fixing models to not muck with the original input
    const cubeOwner = cube.owner;
    await User.update(user);
    await Cube.update(cube);

    await util.addNotification(
      cubeOwner,
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

router.get('/feature/:id', ensureAuth, async (req, res) => {
  const redirectUrl = `/cube/overview/${encodeURIComponent(req.params.id)}`;
  try {
    const { user } = req;
    if (!util.isAdmin(user)) {
      req.flash('danger', 'Not Authorized');
      return redirect(req, res, redirectUrl);
    }

    const cube = await Cube.getById(req.params.id);

    if (!cube) {
      req.flash('danger', 'Cube not found');
      return redirect(req, res, redirectUrl);
    }
    if (cube.visibility !== Cube.VISIBILITY.PUBLIC) {
      req.flash('danger', 'Cannot feature a private cube');
      return redirect(req, res, redirectUrl);
    }

    const existingQueueItem = await isInFeaturedQueue(cube);
    if (existingQueueItem) {
      req.flash('danger', 'Cube is already in the featured queue');
      return redirect(req, res, redirectUrl);
    }

    await FeaturedQueue.put({
      cube: cube.id,
      date: Date.now().valueOf(),
      owner: typeof cube.owner === 'object' ? cube.owner.id : cube.owner,
      featuredOn: null,
    });

    req.flash('success', 'Cube added to featured queue successfully.');
    return redirect(req, res, redirectUrl);
  } catch (err) {
    return handleRouteError(req, res, err, redirectUrl);
  }
});

router.get('/unfeature/:id', ensureAuth, async (req, res) => {
  const redirectUrl = `/cube/overview/${encodeURIComponent(req.params.id)}`;
  try {
    const { user } = req;
    if (!util.isAdmin(user)) {
      req.flash('danger', 'Not Authorized');
      return redirect(req, res, redirectUrl);
    }

    const cube = await Cube.getById(req.params.id);

    if (!cube) {
      req.flash('danger', 'Cube not found');
      return redirect(req, res, redirectUrl);
    }

    const existingQueueItem = await isInFeaturedQueue(cube);
    if (!existingQueueItem) {
      req.flash('danger', 'Cube is not in the featured queue');
      return redirect(req, res, redirectUrl);
    }

    await FeaturedQueue.delete(cube.id);

    req.flash('success', 'Cube removed from featured queue successfully.');
    return redirect(req, res, redirectUrl);
  } catch (err) {
    return handleRouteError(req, res, err, redirectUrl);
  }
});

router.get('/overview/:id', async (req, res) => {
  try {
    const cube = await Cube.getById(req.params.id);

    if (!isCubeViewable(cube, req.user)) {
      req.flash('danger', 'Cube not found');
      return redirect(req, res, '/404');
    }

    const cards = await Cube.getCards(cube.id);
    const { mainboard } = cards;

    const blogs = await Blog.getByCube(cube.id, 1);

    const followersCount = cube.following.length;

    const isInQueue = await isInFeaturedQueue(cube);

    // calculate cube prices
    const nameToCards = {};
    for (const card of mainboard) {
      if (!nameToCards[card.details.name]) {
        const allVersionsOfCard = getIdsFromName(card.details.name) || [];
        nameToCards[card.details.name] = allVersionsOfCard.map((id) => cardFromId(id));
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
      //Per CardStatus in datatypes/Card.ts
      const isOwned = ['Ordered', 'Owned', 'Premium Owned'].includes(card.status);
      if (isOwned && card.details.prices) {
        if (card.finish === 'Foil') {
          totalPriceOwned += card.details.prices.usd_foil || card.details.prices.usd || 0;
        } else {
          totalPriceOwned += card.details.prices.usd || card.details.prices.usd_foil || 0;
        }
      }

      totalPricePurchase += cheapestDict[card.details.name] || 0;
    }

    const baseUrl = util.getBaseUrl();
    return render(
      req,
      res,
      'CubeOverviewPage',
      {
        cube: { ...cube, isInFeaturedQueue: !!isInQueue },
        cards,
        post: blogs && blogs.items.length > 0 ? blogs.items[0] : null,
        followed: req.user && cube.following && cube.following.some((id) => req.user.id === id),
        followersCount,
        priceOwned: !cube.PrivatePrices ? totalPriceOwned : null,
        pricePurchase: !cube.PrivatePrices ? totalPricePurchase : null,
      },
      {
        title: `${abbreviate(cube.name)} - Overview`,
        metadata: generateMeta(
          `Cube Cobra Overview: ${cube.name}`,
          cube.description,
          cube.image.uri,
          `${baseUrl}/cube/overview/${req.params.id}`,
        ),
        noindex:
          cube.visibility === Cube.VISIBILITY.PRIVATE ||
          cube.visibility === Cube.VISIBILITY.UNLISTED ||
          mainboard.length < 100,
      },
    );
  } catch (err) {
    return handleRouteError(req, res, err, `/landing/${req.params.id}`);
  }
});

router.get('/rss/:id', async (req, res) => {
  try {
    const split = req.params.id.split(';');
    const cubeID = split[0];
    const cube = await Cube.getById(cubeID);
    if (!isCubeViewable(cube, req.user)) {
      req.flash('danger', `Cube ID ${req.params.id} not found`);
      return redirect(req, res, '/404');
    }

    const items = [];
    let queryResult = { lastKey: null };

    do {
      queryResult = await Blog.getByCube(cube.id, 128, queryResult.lastKey);
      items.push(...queryResult.items);
    } while (queryResult.lastKey);

    const baseUrl = util.getBaseUrl();
    const feed = new RSS({
      title: cube.name,
      feed_url: `${baseUrl}/cube/rss/${cube.id}`,
      site_url: baseUrl,
    });

    items.forEach((blog) => {
      if (blog.body && blog.Changelog) {
        feed.item({
          title: blog.title,
          url: `${feed.site_url}/cube/blog/blogpost/${blog.id}`,
          description: `${blog.body}\n\n${Blog.changelogToText(blog.Changelog)}`,
          guid: blog.id,
          date: blog.date,
        });
      } else if (blog.body) {
        feed.item({
          title: blog.title,
          url: `${feed.site_url}/cube/blog/blogpost/${blog.id}`,
          description: blog.body,
          guid: blog.id,
          date: blog.date,
        });
      } else if (blog.Changelog) {
        feed.item({
          title: blog.title,
          url: `${feed.site_url}/cube/blog/blogpost/${blog.id}`,
          description: Blog.changelogToText(blog.Changelog),
          guid: blog.id,
          date: blog.date,
        });
      }
    });
    res.set('Content-Type', 'text/xml');
    return res.status(200).send(feed.xml());
  } catch (err) {
    return handleRouteError(req, res, err, '/404');
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
      return redirect(req, res, '/404');
    }
    if (!isCubeViewable(cubeB, req.user)) {
      req.flash('danger', `Comparison cube not found: ${idB}`);
      return redirect(req, res, '/404');
    }

    const [cardsA, cardsB] = await Promise.all([Cube.getCards(cubeA.id), Cube.getCards(cubeB.id)]);

    const { aOracles, bOracles, inBoth, allCards } = await compareCubes(cardsA, cardsB);

    const baseUrl = util.getBaseUrl();
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
          `${baseUrl}/cube/compare/${idA}/to/${idB}`,
        ),
      },
    );
  } catch (err) {
    return handleRouteError(req, res, err, '/404');
  }
});

router.get('/list/:id', async (req, res) => {
  try {
    const cube = await Cube.getById(req.params.id);
    if (!isCubeViewable(cube, req.user)) {
      req.flash('danger', 'Cube not found');
      return redirect(req, res, '/404');
    }

    const cards = await Cube.getCards(cube.id);

    const baseUrl = util.getBaseUrl();
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
          `${baseUrl}/cube/list/${req.params.id}`,
        ),
      },
    );
  } catch (err) {
    return handleRouteError(req, res, err, `/cube/overview/${req.params.id}`);
  }
});

router.get('/history/:id', async (req, res) => {
  try {
    const cube = await Cube.getById(req.params.id);
    if (!isCubeViewable(cube, req.user)) {
      req.flash('danger', 'Cube not found');
      return redirect(req, res, '/404');
    }

    const query = await Changelog.getByCube(cube.id, 36);

    const baseUrl = util.getBaseUrl();
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
          `${baseUrl}/cube/list/${req.params.id}`,
        ),
      },
    );
  } catch (err) {
    return handleRouteError(req, res, err, `/cube/overview/${req.params.id}`);
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

router.post('/getmoredecks/:id', async (req, res) => {
  try {
    const { lastKey } = req.body;
    const query = await Draft.getByCube(req.params.id, lastKey);

    return res.status(200).send({
      success: 'true',
      decks: query.items,
      lastKey: query.lastKey,
    });
  } catch (e) {
    return res.status(500).send({
      error: e,
      success: 'false',
    });
  }
});

router.get('/playtest/:id', async (req, res) => {
  try {
    const cube = await Cube.getById(req.params.id);

    if (!isCubeViewable(cube, req.user)) {
      req.flash('danger', 'Cube not found');
      return redirect(req, res, '/404');
    }

    const decks = await Draft.getByCube(cube.id);

    // Get previous P1P1 packs for this cube
    let previousPacks = [];
    let previousPacksLastKey = null;
    try {
      const previousPacksResult = await p1p1PackModel.queryByCube(cube.id, undefined, 10);
      previousPacks = previousPacksResult.items || [];
      previousPacksLastKey = previousPacksResult.lastKey;
    } catch (error) {
      // If we can't get previous packs, just continue without them
      req.logger.error('Failed to fetch previous P1P1 packs:', error);
    }

    const baseUrl = util.getBaseUrl();
    return render(
      req,
      res,
      'CubePlaytestPage',
      {
        cube,
        decks: decks.items,
        decksLastKey: decks.lastEvaluatedKey,
        previousPacks,
        previousPacksLastKey,
      },
      {
        title: `${abbreviate(cube.name)} - Playtest`,
        metadata: generateMeta(
          `Cube Cobra Playtest: ${cube.name}`,
          cube.description,
          cube.image.uri,
          `${baseUrl}/cube/playtest/${req.params.id}`,
        ),
      },
    );
  } catch (err) {
    return handleRouteError(req, res, err, `/cube/overview/${req.params.id}`);
  }
});

router.get('/analysis/:id', async (req, res) => {
  try {
    const cube = await Cube.getById(req.params.id);

    if (!isCubeViewable(cube, req.user)) {
      req.flash('danger', 'Cube not found');
      return redirect(req, res, '/404');
    }

    const cards = await Cube.getCards(cube.id);
    const tokenMap = {};

    for (const [boardname, list] of Object.entries(cards)) {
      if (boardname !== 'id') {
        for (const card of list) {
          if (card.details.tokens) {
            for (const oracle of card.details.tokens) {
              const tokenDetails = cardFromId(oracle);
              tokenMap[oracle] = {
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
            }
          }
        }
      }
    }

    const cubeAnalytics = await CubeAnalytic.getByCube(cube.id);

    const baseUrl = util.getBaseUrl();
    return render(
      req,
      res,
      'CubeAnalysisPage',
      {
        cube,
        cards,
        tokenMap,
        cubeAnalytics: cubeAnalytics || { cards: [] },
        cubeID: req.params.id,
      },
      {
        metadata: generateMeta(
          `Cube Cobra Analysis: ${cube.name}`,
          miscutil.getCubeDescription(cube),
          cube.image_uri,
          `${baseUrl}/cube/analysis/${req.params.id}`,
        ),
        title: `${abbreviate(cube.name)} - Analysis`,
      },
    );
  } catch (err) {
    return handleRouteError(req, res, err, `/cube/overview/${req.params.id}`);
  }
});

router.get('/samplepack/:id', (req, res) => {
  const queryString = req.query.balanced === 'true' ? '?balanced=true' : '';
  redirect(req, res, `/cube/samplepack/${encodeURIComponent(req.params.id)}/${Date.now().toString()}${queryString}`);
});

router.get('/samplepack/:id/:seed', async (req, res) => {
  try {
    const cube = await Cube.getById(req.params.id);

    if (!isCubeViewable(cube, req.user)) {
      req.flash('danger', 'Cube not found');
      return redirect(req, res, '/cube/playtest/404');
    }

    const cards = await Cube.getCards(cube.id);
    const isBalanced = req.query.balanced === 'true';

    let pack;
    let maxBotWeight;
    try {
      if (isBalanced) {
        const result = await generateBalancedPack(cube, cards, req.params.seed, 10, req.params.seed);
        pack = result.packResult;
        maxBotWeight = result.maxBotWeight;
      } else {
        pack = await generatePack(cube, cards, req.params.seed);
      }
    } catch (err) {
      req.flash('danger', `Failed to generate pack: ${err.message}`);
      return redirect(req, res, `/cube/playtest/${encodeURIComponent(req.params.id)}`);
    }

    const width = Math.floor(Math.sqrt((5 / 3) * pack.pack.length));
    const height = Math.ceil(pack.pack.length / width);

    const baseUrl = util.getBaseUrl();
    const queryString = isBalanced ? '?balanced=true' : '';
    return render(
      req,
      res,
      'CubeSamplePackPage',
      {
        seed: pack.seed,
        pack: pack.pack,
        cube,
        isBalanced,
        maxBotWeight,
      },
      {
        title: `${abbreviate(cube.name)} - ${isBalanced ? 'Balanced ' : ''}Sample Pack`,
        metadata: generateMeta(
          `Cube Cobra ${isBalanced ? 'Balanced ' : ''}Sample Pack`,
          `A ${isBalanced ? 'balanced ' : ''}sample pack from ${cube.name}`,
          `${baseUrl}/cube/samplepackimage/${req.params.id}/${pack.seed}.png${queryString}`,
          `${baseUrl}/cube/samplepack/${req.params.id}/${pack.seed}${queryString}`,
          CARD_WIDTH * width,
          CARD_HEIGHT * height,
        ),
      },
    );
  } catch (err) {
    return handleRouteError(req, res, err, `/cube/playtest/${req.params.id}`);
  }
});

router.get('/samplepackimage/:id/:seed', async (req, res) => {
  try {
    req.params.seed = req.params.seed.replace('.png', '');
    const cube = await Cube.getById(req.params.id);

    if (!isCubeViewable(cube, req.user)) {
      req.flash('danger', 'Cube not found');
      return redirect(req, res, '/cube/playtest/404');
    }

    const cards = await Cube.getCards(cube.id);
    const isBalanced = req.query.balanced === 'true';

    const cacheKey = `/samplepack/${req.params.id}/${req.params.seed}${isBalanced ? '?balanced=true' : ''}`;
    const imageBuffer = await cachePromise(cacheKey, async () => {
      if (isBalanced) {
        const result = await generateBalancedPack(cube, cards, req.params.seed, 10, req.params.seed);
        return generatePackImage(result.packResult.pack);
      } else {
        const pack = await generatePack(cube, cards, req.params.seed);
        return generatePackImage(pack.pack);
      }
    });

    res.writeHead(200, {
      'Content-Type': 'image/webp',
    });
    return res.end(imageBuffer);
  } catch (err) {
    req.flash('danger', err.message);
    return redirect(req, res, `/cube/playtest/${encodeURIComponent(req.params.id)}`);
  }
});

router.get('/p1p1/:packId([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})', async (req, res) => {
  try {
    const { packId } = req.params;

    // Validate pack exists
    const pack = await p1p1PackModel.getById(packId);
    if (!pack) {
      req.flash('danger', 'P1P1 pack not found');
      return redirect(req, res, '/404');
    }

    // Get cube data
    const cube = await Cube.getById(pack.cubeId);
    if (!cube) {
      req.flash('danger', 'Associated cube not found');
      return redirect(req, res, '/404');
    }

    // Calculate pack image dimensions
    const width = Math.floor(Math.sqrt((5 / 3) * pack.cards.length));
    const height = Math.ceil(pack.cards.length / width);

    const baseUrl = util.getBaseUrl();
    return render(
      req,
      res,
      'P1P1Page',
      {
        packId,
        cube,
      },
      {
        title: 'Pack 1 Pick 1',
        metadata: generateMeta(
          'Pack 1 Pick 1 - Cube Cobra',
          'Vote on your first pick from this pack!',
          `${baseUrl}/cube/p1p1packimage/${packId}.png`,
          `${baseUrl}/cube/p1p1/${packId}`,
          CARD_WIDTH * width,
          CARD_HEIGHT * height,
        ),
      },
    );
  } catch (err) {
    return handleRouteError(req, res, err, '/404');
  }
});

router.get('/p1p1packimage/:packId', async (req, res) => {
  try {
    req.params.packId = req.params.packId.replace('.png', '');
    const { packId } = req.params;

    const pack = await p1p1PackModel.getById(packId);
    if (!pack || !pack.cards || pack.cards.length === 0) {
      req.flash('danger', 'P1P1 pack not found');
      return redirect(req, res, '/404');
    }

    const cube = await Cube.getById(pack.cubeId);
    if (!isCubeViewable(cube, req.user)) {
      req.flash('danger', 'Cube not found');
      return redirect(req, res, '/404');
    }

    const imageBuffer = await cachePromise(`/p1p1pack/${packId}`, async () => {
      return generatePackImage(pack.cards);
    });

    res.writeHead(200, {
      'Content-Type': 'image/webp',
      'Cache-Control': 'public, max-age=86400, immutable',
      ETag: `"${packId}"`,
    });
    return res.end(imageBuffer);
  } catch (err) {
    req.flash('danger', err.message || 'Error generating pack image');
    return redirect(req, res, '/404');
  }
});

router.post('/bulkupload/:id', ensureAuth, async (req, res) => {
  try {
    const cube = await Cube.getById(req.params.id);

    if (!isCubeViewable(cube, req.user)) {
      req.flash('danger', 'Cube not found');
      return redirect(req, res, '/404');
    }

    if (cube.owner.id !== req.user.id) {
      req.flash('danger', 'Not Authorized');
      return redirect(req, res, `/cube/list/${encodeURIComponent(req.params.id)}`);
    }

    await bulkUpload(req, res, req.body.body, cube);
    return null;
  } catch (err) {
    return handleRouteError(req, res, err, `/cube/list/${req.params.id}`);
  }
});

router.post('/bulkuploadfile/:id', ensureAuth, async (req, res) => {
  try {
    const split = req.body.file.split(',');
    const encodedFile = split[1];

    // decode base64
    const list = Buffer.from(encodedFile, 'base64').toString('utf8');

    const cube = await Cube.getById(req.params.id);

    if (!isCubeViewable(cube, req.user)) {
      req.flash('danger', 'Cube not found');
      return redirect(req, res, '/404');
    }

    if (cube.owner.id !== req.user.id) {
      req.flash('danger', 'Not Authorized');
      return redirect(req, res, `/cube/list/${encodeURIComponent(req.params.id)}`);
    }

    await bulkUpload(req, res, list, cube);
    return null;
  } catch (err) {
    return handleRouteError(req, res, err, `/cube/list/${encodeURIComponent(req.params.id)}`);
  }
});

router.post('/bulkreplacefile/:id', ensureAuth, async (req, res) => {
  try {
    const split = req.body.file.split(',');
    const encodedFile = split[1];

    // decode base64
    const items = Buffer.from(encodedFile, 'base64').toString('utf8');

    const cube = await Cube.getById(req.params.id);
    // use this to maintain customized fields
    const cards = await Cube.getCards(cube.id, true);

    if (!isCubeViewable(cube, req.user)) {
      req.flash('danger', 'Cube not found');
      return redirect(req, res, '/404');
    }

    if (cube.owner.id !== req.user.id) {
      req.flash('danger', 'Not Authorized');
      return redirect(req, res, `/cube/list/${encodeURIComponent(req.params.id)}`);
    }

    const lines = items.match(/[^\r\n]+/g);

    if (lines && (lines[0].match(/,/g) || []).length > 3) {
      const added = [];
      const { newCards, newMaybe, missing } = CSVtoCards(items);

      const newList = {
        mainboard: newCards.map((card) => ({
          details: cardFromId(card.cardID),
          ...card,
        })),
        maybeboard: newMaybe.map((card) => ({
          details: cardFromId(card.cardID),
          ...card,
        })),
      };

      const changelog = {
        mainboard: {
          adds: newList.mainboard.map(({ cardID }) => ({ cardID })),
          removes: cards.mainboard.map(({ cardID }) => ({ oldCard: { cardID } })),
        },
        maybeboard: {
          adds: newList.maybeboard.map(({ cardID }) => ({ cardID })),
          removes: cards.maybeboard.map(({ cardID }) => ({ oldCard: { cardID } })),
        },
      };

      added.push(...newList.mainboard);

      return updateCubeAndBlog(req, res, cube, cards, newList, changelog, added, missing);
    }

    throw new Error('Received empty file');
  } catch (err) {
    return handleRouteError(req, res, err, `/cube/list/${req.params.id}`);
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
        return redirect(req, res, `/cube/playtest/${req.params.id}`);
      }

      const numPacks = parseInt(req.body.packs, 10);

      const numCards = numPacks * 9;

      const cube = await Cube.getById(req.params.id);
      const cubeCards = await Cube.getCards(req.params.id);
      const { mainboard } = cubeCards;

      if (!isCubeViewable(cube, req.user)) {
        req.flash('danger', 'Cube not found');
        return redirect(req, res, '/404');
      }

      if (mainboard.length < numCards) {
        req.flash('danger', `Not enough cards, need ${numCards} cards for a ${numPacks} pack grid draft.`);
        return redirect(req, res, `/cube/playtest/${encodeURIComponent(req.params.id)}`);
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

      return redirect(req, res, `/cube/griddraft/${id}`);
    } catch (err) {
      return handleRouteError(req, res, err, `/cube/playtest/${encodeURIComponent(req.params.id)}`);
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
        return redirect(req, res, `/cube/playtest/${req.params.id}`);
      }

      const user = await User.getById(req.user.id);

      if (!user) {
        req.flash('danger', 'Please Login to build a sealed deck.');
        return redirect(req, res, `/cube/playtest/${encodeURIComponent(req.params.id)}`);
      }

      const packs = parseInt(req.body.packs, 10);
      const cards = parseInt(req.body.cards, 10);

      const numCards = packs * cards;

      const cube = await Cube.getById(req.params.id);

      if (!isCubeViewable(cube, req.user)) {
        req.flash('danger', 'Cube not found');
        return redirect(req, res, '/404');
      }

      const cubeCards = await Cube.getCards(req.params.id);
      const { mainboard } = cubeCards;

      if (mainboard.length < numCards) {
        req.flash('danger', `Not enough cards, need ${numCards} cards for sealed with ${packs} packs of ${cards}.`);
        return redirect(req, res, `/cube/playtest/${encodeURIComponent(req.params.id)}`);
      }

      const source = shuffle(mainboard).slice(0, numCards);
      const pool = createPool();
      const cardsArray = [];
      for (const card of source) {
        let index1 = 0;
        let index2 = 0;

        // sort by color
        const details = cardFromId(card.cardID);
        const type = card.type_line || details.type;
        const colors = cardutil.cardColors(card);

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

      const cubeOwner = cube.owner;
      await Cube.update(cube);

      if (!cube.disableNotifications && cubeOwner) {
        await util.addNotification(
          cubeOwner,
          user,
          `/cube/deck/${deckId}`,
          `${user.username} built a sealed deck from your cube: ${cube.name}`,
        );
      }

      return redirect(req, res, `/draft/deckbuilder/${deckId}`);
    } catch (err) {
      return handleRouteError(req, res, err, `/cube/playtest/${encodeURIComponent(req.params.id)}`);
    }
  },
);

router.get('/griddraft/:id', async (req, res) => {
  try {
    const document = await Draft.getById(req.params.id);

    if (!document) {
      req.flash('danger', 'Draft not found');
      return redirect(req, res, '/404');
    }

    if (document.type !== Draft.TYPES.GRID) {
      req.flash('danger', 'Draft is not a grid draft');
      return redirect(req, res, '/404');
    }

    const cube = await Cube.getById(document.cube);

    if (!isCubeViewable(cube, req.user)) {
      req.flash('danger', 'Cube not found');
      return redirect(req, res, '/404');
    }

    const baseUrl = util.getBaseUrl();
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
          `${baseUrl}/cube/griddraft/${req.params.id}`,
        ),
      },
    );
  } catch (err) {
    return handleRouteError(req, res, err, '/404');
  }
});

router.post('/remove/:id', ensureAuth, async (req, res) => {
  try {
    const cube = await Cube.getById(req.params.id);

    if (!isCubeViewable(cube, req.user)) {
      req.flash('danger', 'Cube not found');
      return redirect(req, res, '/cube/overview/404');
    }
    if (cube.owner.id !== req.user.id) {
      req.flash('danger', 'Not Authorized');
      return redirect(req, res, `/cube/overview/${encodeURIComponent(req.params.id)}`);
    }

    await Cube.deleteById(req.params.id);

    req.flash('success', 'Cube Removed');
    return redirect(req, res, '/dashboard');
  } catch (err) {
    return handleRouteError(req, res, err, '/404');
  }
});

router.get('/format/remove/:cubeid/:index', ensureAuth, param('index').toInt(), async (req, res) => {
  try {
    const { cubeid, index } = req.params;

    const cube = await Cube.getById(cubeid);
    if (!isCubeViewable(cube, req.user)) {
      req.flash('danger', 'Cube not found');
      return redirect(req, res, '/404');
    }

    if (cube.owner.id !== req.user.id) {
      req.flash('danger', 'Not Authorized');
      return redirect(req, res, `/cube/playtest/${encodeURIComponent(cubeid)}`);
    }
    if (index < 0 || index >= cube.formats.length) {
      req.flash('danger', 'Invalid format index.');
      return redirect(req, res, `/cube/playtest/${encodeURIComponent(cubeid)}`);
    }

    cube.formats.splice(index, 1);
    // update defaultFormat if necessary
    if (index === cube.defaultFormat) {
      //When the current default format is deleted, revert to no default specified
      cube.defaultFormat = -1;
    } else if (index < cube.defaultFormat) {
      /* If the format deleted isn't the default but is a custom format before it in the list, shift
       * the default format index to keep the alignment
       */
      cube.defaultFormat -= 1;
    }

    await Cube.update(cube);

    req.flash('success', 'Format removed.');
    return redirect(req, res, `/cube/playtest/${encodeURIComponent(cubeid)}`);
  } catch (err) {
    req.logger.error(err.message, err.stack);
    req.flash('danger', 'Error removing format.');
    return redirect(req, res, `/cube/playtest/${encodeURIComponent(req.params.cubeid)}`);
  }
});

router.post('/updatesettings/:id', ensureAuth, async (req, res) => {
  try {
    const { priceVisibility, disableAlerts, defaultStatus, defaultPrinting, visibility } = req.body;

    const errors = [];
    if (priceVisibility !== 'true' && priceVisibility !== 'false') {
      errors.push({ msg: 'Invalid Price visibility' });
    }
    if (disableAlerts !== 'true' && disableAlerts !== 'false') {
      errors.push({ msg: 'Invalid value for disableAlerts' });
    }
    if (!CARD_STATUSES.includes(defaultStatus)) {
      errors.push({ msg: 'Status must be valid.' });
    }
    if (![PrintingPreference.RECENT, PrintingPreference.FIRST].includes(defaultPrinting)) {
      errors.push({ msg: 'Printing must be valid.' });
    }
    if (!Object.values(Cube.VISIBILITY).includes(visibility)) {
      errors.push({ msg: 'Visibility must be valid' });
    }

    if (errors.length > 0) {
      req.flash('danger', 'Error updating cube: ' + errors.map((error) => error.msg).join(', '));
      return redirect(req, res, '/cube/overview/' + req.params.id);
    }

    const cube = await Cube.getById(req.params.id);

    if (!isCubeViewable(cube, req.user)) {
      req.flash('danger', 'Cube not found.');
      return redirect(req, res, '/404');
    }

    if (cube.owner.id !== req.user.id) {
      req.flash('danger', 'Unauthorized');
      return redirect(req, res, '/cube/overview/' + req.params.id);
    }

    const update = req.body;
    for (const field of ['visibility', 'defaultStatus', 'defaultPrinting']) {
      if (update[field] !== undefined) {
        cube[field] = update[field];
      }
    }
    cube.disableAlerts = update.disableAlerts === 'true';
    cube.priceVisibility =
      update.priceVisibility === 'true' ? Cube.PRICE_VISIBILITY.PUBLIC : Cube.PRICE_VISIBILITY.PRIVATE;

    await Cube.update(cube);
    req.flash('success', 'Settings updated successfully.');
    return redirect(req, res, '/cube/overview/' + req.params.id);
  } catch (err) {
    req.flash('danger', 'Error updating settings. ' + err.message);
    req.logger.error('Error updating settings:', err);
    return redirect(req, res, '/cube/overview/' + req.params.id);
  }
});

router.get(
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
      req.flash('danger', 'Invalid request.');
      return redirect(req, res, `/cube/playtest/${encodeURIComponent(cubeid)}`);
    }
    cube.defaultFormat = formatId;

    await Cube.update(cube);
    req.flash('success', 'Default draft format updated.');
    return redirect(req, res, `/cube/playtest/${encodeURIComponent(cubeid)}`);
  }),
);

module.exports = router;
