/* eslint-disable no-await-in-loop */
const express = require('express');
const uuid = require('uuid/v4');
// eslint-disable-next-line import/no-unresolved
const { body, param } = require('express-validator');
const fetch = require('node-fetch');
const RSS = require('rss');

const createdraft = require('../../dist/drafting/createdraft');
const filterutil = require('../../dist/filtering/FilterCards');
const miscutil = require('../../dist/utils/Util');
const carddb = require('../../serverjs/cards');
const { render } = require('../../serverjs/render');
const { ensureAuth, csrfProtection } = require('../middleware');
const util = require('../../serverjs/util');
const generateMeta = require('../../serverjs/meta');
const { createLobby } = require('../../serverjs/multiplayerDrafting');

const {
  generatePack,
  buildIdQuery,
  abbreviate,
  CSVtoCards,
  compareCubes,
  generateSamplepackImage,
  addDeckCardAnalytics,
  cachePromise,
  isCubeViewable,
  addCardHtml,
  removeCardHtml,
  replaceCardHtml,
} = require('../../serverjs/cubefn');

const { CARD_HEIGHT, CARD_WIDTH, addBasics, bulkUpload, createPool, shuffle, updateCubeAndBlog } = require('./helper');

// Bring in models
const Cube = require('../../dynamo/models/cube');
const Deck = require('../../models/deck');
const Blog = require('../../models/blog');
const User = require('../../dynamo/models/user');
const Draft = require('../../models/draft');
const GridDraft = require('../../models/gridDraft');
const CubeAnalytic = require('../../models/cubeAnalytic');
const { fillBlogpostChangelog } = require('../../serverjs/blogpostUtils');

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

    const details = carddb.cardFromId(carddb.nameToId['doubling cube'][0]);

    const cube = {
      Id: uuid(),
      ShortId: null,
      Name: req.body.name,
      Owner: req.user.Id,
      ImageUri: details.art_crop,
      ImageName: details.full_name,
      ImageArtist: details.artist,
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
      boards: [
        {
          name: 'Mainboard',
          cards: [],
        },
        {
          name: 'Maybeboard',
          cards: [],
        },
      ],
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

    const sourceCards = await Cube.getCards(req.params.id);

    const cube = {
      Id: uuid(),
      ShortId: null,
      Name: `Clone of ${source.Name}`,
      Owner: req.user.Id,
      ImageUri: source.ImageUri,
      ImageName: source.ImageName,
      ImageArtist: source.ImageArtist,
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
      id: cube.Id,
      boards: sourceCards.boards,
    });

    const sourceOwner = await User.getById(source.owner);

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
    const mainboard = cards.boards.find((b) => b.name === 'Mainboard');

    const blogs = await Blog.find({
      cube: cube.Id,
    })
      .sort({
        date: -1,
      })
      .limit(1)
      .lean();

    const followers = await User.batchGet(cube.UsersFollowing);

    for (const follower of followers) {
      delete follower.UsersFollowing; // don't leak this info
      delete follower.PasswordHash;
      delete follower.Email;
    }

    // calculate cube prices
    const nameToCards = {};
    for (const card of mainboard.cards) {
      if (!nameToCards[card.details.name]) {
        const allVersionsOfCard = carddb.getIdsFromName(card.details.name) || [];
        nameToCards[card.details.name] = allVersionsOfCard.map((id) => carddb.cardFromId(id));
      }
    }

    const cheapestDict = {};
    for (const card of mainboard.cards) {
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
    for (const card of mainboard.cards) {
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
        post: blogs && blogs.length > 0 ? fillBlogpostChangelog(blogs[0]) : null,
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
          cube.ImageUri,
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
    const blogs = await Blog.find({
      cube: cube.Id,
    })
      .sort({
        date: -1,
      })
      .exec();

    const feed = new RSS({
      title: cube.Name,
      feed_url: `https://cubecobra.com/cube/rss/${cube.Id}`,
      site_url: 'https://cubecobra.com',
    });

    blogs.forEach((blog) => {
      let content = blog.html ? blog.html : blog.content;

      fillBlogpostChangelog(blog);
      if (blog.changelist || blog.changed_cards) {
        let changeSetElement = '<div class="change-set">';
        if (blog.changelist) changeSetElement += blog.changelist;
        else {
          for (const change in blog.changed_cards) {
            if (change.added && change.removed) {
              changeSetElement += replaceCardHtml(change.removed, change.added);
            } else if (change.added) {
              changeSetElement += addCardHtml(change.added);
            } else if (change.removed) {
              changeSetElement += removeCardHtml(change.removed);
            }
          }
        }
        changeSetElement += '</div>';
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

    const cubeACards = await Cube.getCards(cubeA.Id);
    const cubeBCards = await Cube.getCards(cubeB.Id);

    const mainboardA = cubeACards.find((c) => c.Type === 'Mainboard');
    const mainboardB = cubeBCards.find((c) => c.Type === 'Mainboard');

    const pids = new Set();
    const cardNames = new Set();
    const countIds = (cards) => {
      cards.forEach((card) => {
        if (card.details.tcgplayer_id) {
          pids.add(card.details.tcgplayer_id);
        }
        cardNames.add(card.details.name);
      });
      return cards;
    };

    countIds(mainboardA.cards);
    countIds(mainboardB.cards);

    const { aNames, bNames, inBoth, allCards } = await compareCubes(cubeACards, cubeBCards);

    return render(
      req,
      res,
      'CubeComparePage',
      {
        cube: cubeA,
        cubeB,
        cubeACards,
        cubeBCards,
        onlyA: aNames,
        onlyB: bNames,
        both: inBoth.map((card) => card.details.name),
        cards: allCards.map((card, index) =>
          Object.assign(card, {
            index,
          }),
        ),
        defaultTagColors: [...cubeA.TagColors, ...cubeB.TagColors],
        defaultShowTagColors: !req.user || !req.user.HideTagColors,
        defaultSorts: cubeA.DefaultSorts,
      },
      {
        title: `Comparing ${cubeA.Name} to ${cubeB.Name}`,
        metadata: generateMeta(
          'Cube Cobra Compare Cubes',
          `Comparing "${cubeA.Name}" To "${cubeB.Name}"`,
          cubeA.ImageUri,
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

    const cards = await Cube.getCards(req.params.id);

    return render(
      req,
      res,
      'CubeListPage',
      {
        cube,
        cards,
        defaultView: req.query.view || 'table',
        defaultPrimarySort: req.query.s1 || '',
        defaultSecondarySort: req.query.s2 || '',
        defaultTertiarySort: req.query.s3 || '',
        defaultQuaternarySort: req.query.s4 || '',
        defaultShowUnsorted: req.query.so || '',
        defaultFilterText: req.query.f || '',
        defaultTagColors: cube.TagColors || [],
        defaultShowTagColors: !req.user || !req.user.hide_tag_colors,
      },
      {
        title: `${abbreviate(cube.Name)} - List`,
        metadata: generateMeta(
          `Cube Cobra List: ${cube.Name}`,
          cube.Description,
          cube.ImageUri,
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
    const cube = await Cube.getById(req.params.id);

    if (!isCubeViewable(cube, req.user)) {
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
        title: `${abbreviate(cube.Name)} - Playtest`,
        metadata: generateMeta(
          `Cube Cobra Playtest: ${cube.Name}`,
          cube.Description,
          cube.ImageUri,
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

    const cards = await Cube.getCards(req.params.id);

    const tokens = {};
    for (const board of cards) {
      for (const card of board.cards)
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

    const cubeAnalytics = await CubeAnalytic.findOne({ cube: cube._id });

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
    const cube = await Cube.getById(req.params.id);

    if (!isCubeViewable(cube, req.user)) {
      req.flash('danger', 'Cube not found');
      return res.redirect('/cube/playtest/404');
    }

    const cards = await Cube.getCards(req.params.id);

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

    const cards = await Cube.getCards(req.params.id);

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
    const cube = await Cube.getById(buildIdQuery(req.params.id));

    if (!isCubeViewable(cube, req.user)) {
      req.flash('danger', 'Cube not found');
      return res.redirect('/404');
    }

    if (!cube.Owner.equals(req.user.Id)) {
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

    if (!cube.Owner.equals(req.user.Id)) {
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
    const cards = await Cube.getCards(req.params.id);

    if (!isCubeViewable(cube, req.user)) {
      req.flash('danger', 'Cube not found');
      return res.redirect('/404');
    }

    if (!cube.Owner.equals(req.user.Id)) {
      req.flash('danger', 'Not Authorized');
      return res.redirect(`/cube/list/${encodeURIComponent(req.params.id)}`);
    }

    const lines = items.match(/[^\r\n]+/g);
    if (lines) {
      const changelog = [];
      let missing = [];
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

        const newDetails = addDetails(newCards);

        const { onlyA, onlyB } = await compareCubes(cards, newDetails);
        changelog.push(
          ...onlyA.map(({ cardID }) => {
            return { addedID: null, removedID: cardID };
          }),
        );
        changelog.push(
          ...onlyB.map(({ cardID }) => {
            return { addedID: cardID, removedID: null };
          }),
        );
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

      const cube = await Cube.getById(req.params.id);
      const cubeCards = await Cube.getCards(req.params.id);
      const mainboard = cubeCards.boards.find((board) => board.type === 'Mainboard');

      if (!isCubeViewable(cube, req.user)) {
        req.flash('danger', 'Cube not found');
        return res.redirect('/404');
      }

      if (mainboard.cards.length < numCards) {
        req.flash('danger', `Not enough cards, need ${numCards} cards for a ${numPacks} pack grid draft.`);
        return res.redirect(`/cube/playtest/${encodeURIComponent(req.params.id)}`);
      }

      const source = shuffle(mainboard.cards)
        .slice(0, numCards)
        .map((card, index) => {
          card.index = index;
          return card;
        });

      const gridDraft = new GridDraft();
      gridDraft.draftType = type;
      gridDraft.cube = cube.Id;

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
        name: req.user ? req.user.Username : 'Anonymous',
        userid: req.user ? req.user.Id : null,
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
      const mainboard = cubeCards.boards.find((board) => board.type === 'Mainboard');

      if (mainboard.cards.length < numCards) {
        req.flash('danger', `Not enough cards, need ${numCards} cards for sealed with ${packs} packs of ${cards}.`);
        return res.redirect(`/cube/playtest/${encodeURIComponent(req.params.id)}`);
      }

      const source = shuffle(mainboard.cards).slice(0, numCards);
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
      deck.cube = cube.Id;
      deck.cubeOwner = cube.Owner;
      deck.date = Date.now();
      deck.cubename = cube.Name;
      deck.seats = [];
      deck.owner = user.Id;
      addBasics(cardsArray, cube.Basics, deck);
      deck.cards = cardsArray;

      deck.seats.push({
        userid: user.Id,
        username: user.Username,
        pickorder: cardsArray.map((item, index) => index),
        name: `Sealed from ${cube.Name}`,
        description: '',
        deck: pool,
        sideboard: createPool(),
      });
      deck.draft = null;

      await deck.save();

      cube.numDecks += 1;
      await addDeckCardAnalytics(cube, deck, carddb);

      await cube.save();

      const cubeOwner = await User.getById(cube.Owner);

      if (!cube.disableNotifications) {
        await util.addNotification(
          cubeOwner,
          user,
          `/cube/deck/${deck._id}`,
          `${user.Username} built a sealed deck from your cube: ${cube.Name}`,
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
      const mainboard = cubeCards.boards.find((board) => board.type === 'Mainboard');

      if (mainboard.cards.length === 0) {
        // This is a 4XX error, not a 5XX error
        req.flash('danger', 'This cube has no cards!');
        return res.redirect(`/cube/playtest/${encodeURIComponent(req.params.id)}`);
      }

      const params = req.body;

      // setup draft
      const format = createdraft.getDraftFormat(params, cube);

      const draft = new Draft();
      let populated = {};
      try {
        populated = createdraft.createDraft(
          format,
          mainboard.cards,
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
      draft.cube = cube.Id;
      addBasics(populated.cards, cube.Basics, draft);
      draft.cards = populated.cards;

      await draft.save();

      await createLobby(draft, req.user);

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

    const cube = await Cube.getById(draft.cube);

    if (!isCubeViewable(cube, req.user)) {
      req.flash('danger', 'Cube not found');
      return res.redirect('/404');
    }

    const user = await User.getById(cube.owner);
    if (!user) {
      req.flash('danger', 'Owner not found');
      return res.redirect('/404');
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
        title: `${abbreviate(cube.Name)} - Grift Draft`,
        metadata: generateMeta(
          `Cube Cobra Grid Draft: ${cube.Name}`,
          cube.Description,
          cube.ImageUri,
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
        title: `${abbreviate(cube.Name)} - Draft`,
        metadata: generateMeta(
          `Cube Cobra Draft: ${cube.Name}`,
          cube.Description,
          cube.ImageUri,
          `https://cubecobra.com/cube/draft/${encodeURIComponent(req.params.id)}`,
        ),
      },
    );
  } catch (err) {
    return util.handleRouteError(req, res, err, '/404');
  }
});

router.post('/resize/:id/:size', async (req, res) => {
  try {
    const cube = await Cube.getById(req.params.id);
    const cards = await Cube.getCards(req.params.id);
    const mainboard = cards.boards.find((board) => board.type === 'Mainboard');

    if (!isCubeViewable(cube, req.user)) {
      return res.status(400).send({
        success: 'false',
        message: 'Cube not found',
      });
    }

    if (!cube.Owner.equals(req.user.Id)) {
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

    if (newSize === mainboard.cards.length) {
      req.flash('success', 'Your cube is already this size!');
      return res.redirect(`/cube/list/${encodeURIComponent(req.params.id)}`);
    }

    // we sort the reverse way depending on adding or removing
    let list = Object.entries(newSize > mainboard.cards.length ? additions : cuts)
      .sort((a, b) => {
        if (a[1] > b[1]) return newSize > mainboard.cards.length ? -1 : 1;
        if (a[1] < b[1]) return newSize > mainboard.cards.length ? 1 : -1;
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
    list = (filter ? list.filter(filter) : list).slice(0, Math.abs(newSize - mainboard.cards.length));

    const changelog = [];
    if (newSize > mainboard.cards.length) {
      // we add to cube
      const toAdd = list.map((card) => {
        changelog.push({ addedID: card.details._id, removedID: null });
        return util.newCard(card.details);
      });
      mainboard.cards.push(toAdd);
    } else {
      // we cut from cube
      for (const card of list) {
        for (let i = 0; i < mainboard.cards.length; i += 1) {
          if (carddb.cardFromId(mainboard.cards[i].cardID).name === carddb.cardFromId(card.cardID).name) {
            changelog.push({ addedID: null, removedID: card.cardID });
            mainboard.cards.splice(i, 1);
            i = mainboard.cards.length;
          }
        }
      }
    }

    const blogpost = new Blog();
    blogpost.title = 'Resize - Automatic Post';
    blogpost.changed_cards = changelog;
    blogpost.owner = cube.Owner;
    blogpost.date = Date.now();
    blogpost.cube = cube.Id;
    blogpost.dev = 'false';
    blogpost.date_formatted = blogpost.date.toLocaleString('en-US');
    blogpost.username = cube.owner_name;
    blogpost.cubename = cube.name;

    await blogpost.save();
    await Cube.updateCards(cube.Id, cards);

    req.flash('success', 'Cube Resized succesfully.');
    return res.redirect(`/cube/list/${req.params.id}`);
  } catch (err) {
    return util.handleRouteError(req, res, err, `/cube/list/${encodeURIComponent(req.params.id)}`);
  }
});

router.post('/remove/:id', ensureAuth, async (req, res) => {
  try {
    const cube = await Cube.getById(req.params.id);

    if (!isCubeViewable(cube, req.user)) {
      req.flash('danger', 'Cube not found');
      return res.redirect('/cube/overview/404');
    }
    if (!cube.Owner.equals(req.user.Id)) {
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

    if (!cube.Owner.equals(req.user.Id)) {
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
      !cube.Owner.equals(req.user.Id) ||
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
