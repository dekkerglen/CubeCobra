/* eslint-disable no-await-in-loop */
const express = require('express');
const uuid = require('uuid/v4');
// eslint-disable-next-line import/no-unresolved
const { body, param } = require('express-validator');
const RSS = require('rss');

const createdraft = require('../../dist/drafting/createdraft');
const miscutil = require('../../dist/utils/Util');
const carddb = require('../../serverjs/cards');
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
  updateDeckCardAnalytics,
  cachePromise,
  isCubeViewable,
} = require('../../serverjs/cubefn');

const { CARD_HEIGHT, CARD_WIDTH, addBasics, bulkUpload, createPool, shuffle, updateCubeAndBlog } = require('./helper');

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
      Id: uuid(),
      ShortId: null,
      Name: req.body.name,
      Owner: req.user.Id,
      ImageName: 'doubling cube [10e-321]',
      Description: 'This is a brand new cube!',
      Date: Date.now().valueOf(),
      Visibility: Cube.VISIBILITY.PUBLIC,
      PriceVisibility: Cube.PRICE_VISIBLITY.PUBLIC,
      Featured: false,
      TagColors: [],
      DefaultDraftFormat: -1,
      NumDecks: 0,
      DefaultSorts: [],
      ShowUnsorted: false,
      DraftFormats: [],
      UsersFollowing: [],
      DefaultStatus: 'Not Owned',
      DefaultPrinting: 'recent',
      DisableNotifications: false,
      Basics: [
        '1d7dba1c-a702-43c0-8fca-e47bbad4a00f',
        '42232ea6-e31d-46a6-9f94-b2ad2416d79b',
        '19e71532-3f79-4fec-974f-b0e85c7fe701',
        '8365ab45-6d78-47ad-a6ed-282069b0fabc',
        '0c4eaecf-dd4c-45ab-9b50-2abe987d35d4',
      ],
      Tags: [],
      CardCount: 0,
    };

    await Cube.put(cube);

    await Cube.putCards({
      id: cube.Id,
      Mainboard: [],
      Maybeboard: [],
    });

    req.flash('success', 'Cube created!');
    return res.redirect(`/cube/view/${cube.Id}`);
  } catch (err) {
    return util.handleRouteError(req, res, err, `/user/view/${req.user.Id}`);
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

    const sourceCards = await Cube.getCards(source.Id);

    const cube = {
      Id: uuid(),
      ShortId: null,
      Name: `Clone of ${source.Name}`,
      Owner: req.user.Id,
      ImageName: source.ImageName,
      Description: `Cloned from [${source.Name}](/c/${source.Id})\n\n${source.Description}`,
      Date: Date.now().valueOf(),
      Visibility: Cube.VISIBILITY.PUBLIC,
      PriceVisibility: Cube.PRICE_VISIBLITY.PUBLIC,
      Featured: false,
      TagColors: source.TagColors,
      DefaultDraftFormat: source.DefaultDraftFormat,
      NumDecks: 0,
      DefaultSorts: source.DefaultSorts,
      ShowUnsorted: source.ShowUnsorted,
      DraftFormats: source.DraftFormats,
      UsersFollowing: [],
      DefaultStatus: source.DefaultStatus,
      DefaultPrinting: source.DefaultPrinting,
      DisableNotifications: false,
      Basics: source.Basics,
      Tags: source.Tags,
      CardCount: source.CardCount,
    };

    await Cube.put(cube);

    await Cube.putCards({
      ...sourceCards,
      id: cube.Id,
    });

    const sourceOwner = await User.getById(source.Owner);

    if (!source.disableNotifications) {
      await util.addNotification(
        sourceOwner,
        req.user,
        `/cube/view/${cube.Id}`,
        `${req.user.Username} made a cube by cloning yours: ${cube.Name}`,
      );
    }

    req.flash('success', 'Cube Cloned');
    return res.redirect(`/cube/overview/${cube.Id}`);
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
    if (cube.Owner !== req.user.Id) {
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
      if (!cube.DraftFormats) {
        cube.DraftFormats = [];
      }
      cube.DraftFormats.push(format);
      message = 'Custom format successfully added.';
    } else {
      cube.DraftFormats[req.body.id] = format;
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
    const cube = await Cube.getById(req.params.id);

    if (!isCubeViewable(cube, user)) {
      req.flash('danger', 'Cube not found');
      res.status(404).send({
        success: 'false',
      });
    }

    if (!cube.UsersFollowing.some((id) => id === user.Id)) {
      cube.UsersFollowing.push(user.Id);
    }
    if (!user.FollowedCubes.some((id) => id.equals(cube.Id))) {
      user.FollowedCubes.push(cube.Id);
    }

    await User.update(user);
    await Cube.update(cube);

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
    cube.UsersFollowing = cube.UsersFollowing.filter((id) => !req.user.Id === id);
    user.FollowedCubes = user.FollowedCubes.filter((id) => cube.Id !== id);

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
    if (cube.Visibility !== Cube.VISIBILITY.PUBLIC) {
      req.flash('danger', 'Cannot feature a private cube');
      return res.redirect(redirect);
    }

    cube.Featured = true;
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

    cube.Featured = false;
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

    const cards = await Cube.getCards(cube.Id);
    const mainboard = cards.Mainboard;

    const blogs = await Blog.getByCubeId(cube.Id, 1);

    const followers = await User.batchGet(cube.UsersFollowing);

    for (const follower of followers) {
      // don't leak this info
      delete follower.PasswordHash;
      delete follower.Email;
    }

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

    const imagedata = util.getImageData(cube.ImageName);

    return render(
      req,
      res,
      'CubeOverviewPage',
      {
        cube,
        cards,
        post: blogs && blogs.items.length > 0 ? blogs.items[0] : null,
        followed: req.user && cube.UsersFollowing && cube.UsersFollowing.some((id) => req.user.Id === id),
        followers,
        priceOwned: !cube.PrivatePrices ? totalPriceOwned : null,
        pricePurchase: !cube.PrivatePrices ? totalPricePurchase : null,
      },
      {
        title: `${abbreviate(cube.Name)} - Overview`,
        metadata: generateMeta(
          `Cube Cobra Overview: ${cube.Name}`,
          cube.Description,
          imagedata.uri,
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
    const cube = await Cube.getById(cubeID);
    if (!isCubeViewable(cube, req.user)) {
      req.flash('danger', `Cube ID ${req.params.id} not found`);
      return res.redirect('/404');
    }

    const items = [];
    let queryResult;

    do {
      queryResult = await Blog.getByCubeId(cube.Id, 128, queryResult.lastKey);
      items.push(...queryResult.items);
    } while (queryResult.lastKey);

    const feed = new RSS({
      title: cube.Name,
      feed_url: `https://cubecobra.com/cube/rss/${cube.Id}`,
      site_url: 'https://cubecobra.com',
    });

    items.forEach((blog) => {
      feed.item({
        title: blog.title,
        description: `${blog.Body}\n\n${blog.Changelog}`,
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

    const cubeAq = Cube.getById(idA);
    const cubeBq = Cube.getById(idB);

    const [cubeA, cubeB] = await Promise.all([cubeAq, cubeBq]);

    const [cardsA, cardsB] = await Promise.all([Cube.getCards(cubeA.Id), Cube.getCards(cubeB.Id)]);

    if (!isCubeViewable(cubeA, req.user)) {
      req.flash('danger', `Base cube not found: ${idA}`);
      return res.redirect('/404');
    }
    if (!isCubeViewable(cubeB, req.user)) {
      req.flash('danger', `Comparison cube not found: ${idB}`);
      return res.redirect('/404');
    }

    const { aOracles, bOracles, inBoth, allCards } = await compareCubes(cardsA, cardsB);

    const imagedata = util.getImageData(cubeA.ImageName);

    return render(
      req,
      res,
      'CubeComparePage',
      {
        cube: cubeA,
        cubeB,
        onlyA: aOracles,
        onlyB: bOracles,
        both: inBoth.map((card) => card.details.name),
        cards: allCards.map((card, index) =>
          Object.assign(card, {
            index,
          }),
        ),
      },
      {
        title: `Comparing ${cubeA.Name} to ${cubeB.Name}`,
        metadata: generateMeta(
          'Cube Cobra Compare Cubes',
          `Comparing "${cubeA.Name}" To "${cubeB.Name}"`,
          imagedata.uri,
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

    const cards = await Cube.getCards(cube.Id);

    const imagedata = util.getImageData(cube.ImageName);
    return render(
      req,
      res,
      'CubeListPage',
      {
        cube,
        cards,
      },
      {
        title: `${abbreviate(cube.Name)} - List`,
        metadata: generateMeta(
          `Cube Cobra List: ${cube.Name}`,
          cube.Description,
          imagedata.uri,
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

    const query = await Changelog.getByCubeId(cube.Id, 36);

    const imagedata = util.getImageData(cube.ImageName);
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
        title: `${abbreviate(cube.Name)} - List`,
        metadata: generateMeta(
          `Cube Cobra List: ${cube.Name}`,
          cube.Description,
          imagedata.uri,
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
  const query = await Changelog.getByCubeId(cubeId, 18, lastKey);

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

    const decks = await Draft.getByCubeId(cube.Id);
    const imagedata = util.getImageData(cube.ImageName);

    return render(
      req,
      res,
      'CubePlaytestPage',
      {
        cube,
        decks: decks.items,
      },
      {
        title: `${abbreviate(cube.Name)} - Playtest`,
        metadata: generateMeta(
          `Cube Cobra Playtest: ${cube.Name}`,
          cube.Description,
          imagedata.uri,
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

    const cards = await Cube.getCards(cube.Id);

    const tokens = {};
    for (const [boardname, list] of Object.entries(cards)) {
      if (boardname !== 'id') {
        for (const card of list)
          if (card.details.tokens) {
            for (const tokenId in card.details.tokens) {
              if (!tokens[tokenId]) {
                const tokenDetails = carddb.cardFromId(tokenId);
                tokens[tokenId] = {
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
              }
            }
          }
      }
    }

    const cubeAnalytics = await CubeAnalytic.getByCubeId(cube.Id);

    return render(
      req,
      res,
      'CubeAnalysisPage',
      {
        cube,
        cards,
        tokens,
        cubeAnalytics: cubeAnalytics || { cards: [] },
        cubeID: req.params.id,
        defaultNav: req.query.nav,
        defaultShowTagColors: !req.user || !req.user.hide_tag_colors,
        defaultFormatId: Number(req.query.formatId),
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
    const cube = await Cube.getById(req.params.id);

    if (!isCubeViewable(cube, req.user)) {
      req.flash('danger', 'Cube not found');
      return res.redirect('/cube/playtest/404');
    }

    const cards = await Cube.getCards(cube.Id);

    let pack;
    try {
      pack = await generatePack(cube, cards, carddb, req.params.seed);
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
        title: `${abbreviate(cube.Name)} - Sample Pack`,
        metadata: generateMeta(
          'Cube Cobra Sample Pack',
          `A sample pack from ${cube.Name}`,
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

    const cards = await Cube.getCards(cube.Id);

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

    if (cube.Owner !== req.user.Id) {
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

    if (cube.Owner !== req.user.Id) {
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
    const cards = await Cube.getCards(cube.Id);

    if (!isCubeViewable(cube, req.user)) {
      req.flash('danger', 'Cube not found');
      return res.redirect('/404');
    }

    if (cube.Owner !== req.user.Id) {
      req.flash('danger', 'Not Authorized');
      return res.redirect(`/cube/list/${encodeURIComponent(req.params.id)}`);
    }

    const lines = items.match(/[^\r\n]+/g);

    if (lines && (lines[0].match(/,/g) || []).length > 3) {
      const added = [];
      const { newCards, newMaybe, missing } = CSVtoCards(items, carddb);

      const newList = {
        Mainboard: newCards.map((card) => ({
          details: carddb.cardFromId(card.cardID),
          ...card,
        })),
        Maybeboard: newMaybe.map((card) => ({
          details: carddb.cardFromId(card.cardID),
          ...card,
        })),
      };

      const changelog = {
        Mainboard: {
          adds: newList.Mainboard.map(({ cardID }) => {
            return { cardID };
          }),
          removes: cards.Mainboard.map(({ cardID }) => {
            return { oldCard: { cardID } };
          }),
        },
        Maybeboard: {
          adds: newList.Maybeboard.map(({ cardID }) => {
            return { cardID };
          }),
          removes: cards.Maybeboard.map(({ cardID }) => {
            return { oldCard: { cardID } };
          }),
        },
      };

      added.push(...newList.Mainboard);

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
  body('defaultStatus', 'Status must be valid.').isIn(['bot', '2playerlocal']),
  async (req, res) => {
    try {
      const numPacks = parseInt(req.body.packs, 10);

      const numCards = numPacks * 9;

      const cube = await Cube.getById(req.params.id);
      const cubeCards = await Cube.getCards(req.params.id);
      const mainboard = cubeCards.Mainboard;

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
        CubeId: cube.Id,
        Owner: req.user.Id,
        CubeOwner: cube.Owner,
        Date: new Date(),
        Type: Draft.TYPES.GRID,
        Seats: {},
        Cards: [],
        IniitalState: [],
      };

      for (let i = 0; i < numPacks; i++) {
        const pack = source.splice(0, 9);
        doc.cards.push(...pack);
        doc.IniitalState.push(pack.map(({ index }) => index));
      }

      addBasics(doc, cube.basics);
      const pool = createPool();

      // add human
      document.Seats.push({
        bot: false,
        name: req.user ? req.user.Username : 'Anonymous',
        userid: req.user ? req.user.Id : null,
        drafted: pool,
        sideboard: pool,
        pickorder: [],
        pickedIndices: [],
      });

      // add bot
      document.seats.push({
        bot: true,
        name: 'Grid Bot',
        userid: null,
        drafted: pool,
        sideboard: pool,
        pickorder: [],
        pickedIndices: [],
      });

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
      const user = await User.getById(req.user);

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
      const mainboard = cubeCards.Mainboard;

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
        CubeId: cube.Id,
        Owner: req.user.Id,
        CubeOwner: cube.Owner,
        Date: new Date().valueOf(),
        Type: Draft.TYPES.SEALED,
        Seats: [],
        Cards: cardsArray,
      };

      addBasics(deck, cube.basics);

      deck.Seats.push({
        Owner: user.Id,
        Title: `Sealed from ${cube.Name}`,
        Body: '',
        Mainboard: pool,
        Sideboard: createPool(),
      });

      await Draft.put(deck);

      cube.numDecks += 1;
      await updateDeckCardAnalytics(cube.Id, null, 0, deck.Seats[0], deck.Cards, carddb);

      await cube.save();

      const cubeOwner = await User.getById(cube.Owner);

      if (!cube.disableNotifications) {
        await util.addNotification(
          cubeOwner,
          user,
          `/cube/deck/${deck.Id}`,
          `${user.Username} built a sealed deck from your cube: ${cube.Name}`,
        );
      }

      return res.redirect(`/cube/deck/deckbuilder/${deck.Id}`);
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
      const mainboard = cubeCards.Mainboard;

      if (mainboard.length === 0) {
        // This is a 4XX error, not a 5XX error
        req.flash('danger', 'This cube has no cards!');
        return res.redirect(`/cube/playtest/${encodeURIComponent(req.params.id)}`);
      }

      const params = req.body;

      // setup draft
      const format = createdraft.getDraftFormat(params, cube);

      const draft = {};

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
      draft.Seats = populated.seats;
      draft.CubeId = cube.Id;
      draft.Owner = req.user.Id;
      draft.CubeOwner = cube.Owner;
      draft.Type = Draft.TYPES.DRAFT;
      addBasics(populated.cards, cube.Basics, draft);
      draft.Cards = populated.cards;

      const draftId = await Draft.put(draft);

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

    if (document.Type !== Draft.TYPES.GRID) {
      req.flash('danger', 'Draft is not a grid draft');
      return res.redirect('/404');
    }

    const cube = await Cube.getById(document.cube);

    if (!isCubeViewable(cube, req.user)) {
      req.flash('danger', 'Cube not found');
      return res.redirect('/404');
    }

    const user = await User.getById(cube.owner);
    if (!user) {
      req.flash('danger', 'Owner not found');
      return res.redirect('/404');
    }

    const imagedata = util.getImageData(cube.ImageName);

    return render(
      req,
      res,
      'GridDraftPage',
      {
        cube,
        initialDraft: document,
      },
      {
        title: `${abbreviate(cube.Name)} - Grift Draft`,
        metadata: generateMeta(
          `Cube Cobra Grid Draft: ${cube.Name}`,
          cube.Description,
          imagedata.uri,
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

    const imagedata = util.getImageData(cube.ImageName);

    return render(
      req,
      res,
      'CubeDraftPage',
      {
        cube,
        initialDraft: draft,
      },
      {
        title: `${abbreviate(cube.Name)} - Draft`,
        metadata: generateMeta(
          `Cube Cobra Draft: ${cube.Name}`,
          cube.Description,
          imagedata.uri,
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
    if (cube.Owner !== req.user.Id) {
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

    if (cube.Owner !== req.user.Id) {
      return res.status(401).send({
        success: 'false',
        message: 'Not authorized.',
      });
    }
    if (index < 0 || index >= cube.DraftFormats.length) {
      return res.status(400).send({
        success: 'false',
        message: 'Invalid request format.',
      });
    }

    cube.DraftFormats.splice(index, 1);
    // update defaultFormat if necessary
    if (index === cube.defaultDraftFormat) {
      cube.DefaultDraftFormat = -1;
    } else if (index < cube.defaultDraftFormat) {
      cube.DefaultDraftFormat -= 1;
    }

    await Cube.update(cube);

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

    const cube = await Cube.getById(cubeid);
    if (
      !isCubeViewable(cube, req.user) ||
      cube.Owner !== req.user.Id ||
      !Number.isInteger(formatId) ||
      formatId >= cube.DraftFormats.length ||
      formatId < -1
    ) {
      return res.sendStatus(401);
    }

    cube.DefaultDraftFormat = formatId;

    await Cube.update(cube);
    return res.status(200).send({
      success: 'true',
    });
  }),
);

module.exports = router;
