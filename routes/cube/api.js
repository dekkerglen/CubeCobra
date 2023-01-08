require('dotenv').config();
const express = require('express');
// eslint-disable-next-line import/no-unresolved
const { body } = require('express-validator');
const fetch = require('node-fetch');

const cardutil = require('../../dist/utils/Card');
const carddb = require('../../serverjs/carddb');
const { ensureAuth, jsonValidationErrors } = require('../middleware');
const util = require('../../serverjs/util');

const { generatePack, buildTagColors, cubeCardTags, isCubeViewable } = require('../../serverjs/cubefn');

// Bring in models
const Cube = require('../../dynamo/models/cube');
const CubeHash = require('../../dynamo/models/cubeHash');
const Draft = require('../../dynamo/models/draft');
const Package = require('../../dynamo/models/package');
const Blog = require('../../dynamo/models/blog');
const Changelog = require('../../dynamo/models/changelog');
const Feed = require('../../dynamo/models/feed');
const User = require('../../dynamo/models/user');

const router = express.Router();

// API routes
router.get('/cardnames', (_, res) => {
  return res.status(200).send({
    success: 'true',
    cardnames: carddb.cardtree,
  });
});

// Get the full card images including image_normal and image_flip
router.get('/cardimages', (_, res) => {
  return res.status(200).send({
    success: 'true',
    cardimages: carddb.cardimages,
  });
});

router.post(
  '/editoverview',
  ensureAuth,
  body('name', 'Cube name should be between 5 and 100 characters long.').isLength({
    min: 5,
    max: 100,
  }),
  body('name', 'Cube name may not use profanity.').custom((value) => !util.hasProfanity(value)),
  body('shortId', 'Custom URL must contain only alphanumeric characters, dashes, and underscores.').matches(
    /^[A-Za-z0-9_-]*$/,
  ),
  body('shortId', `Custom URL may not be longer than 100 characters.`).isLength({
    min: 0,
    max: 100,
  }),
  body('shortId', 'Custom URL may not use profanity.').custom((value) => !util.hasProfanity(value)),
  jsonValidationErrors,
  util.wrapAsyncApi(async (req, res) => {
    const updatedCube = req.body;

    const cube = await Cube.getById(updatedCube.id);
    const { user } = req;

    if (!isCubeViewable(cube, user)) {
      return res.status(404).send({
        success: 'false',
        message: 'Cube Not Found',
      });
    }

    if (cube.owner !== user.id) {
      return res.status(403).send({
        success: 'false',
        message: 'Unauthorized',
      });
    }

    if (updatedCube.shortId !== cube.shortId) {
      const taken = await CubeHash.getSortedByName(`shortid:${updatedCube.shortId.toLowerCase()}`);

      if (taken.items.length === 1 && taken.items[0].cube !== cube.id) {
        return res.status(400).send({
          success: 'false',
          message: 'Custom URL is already taken',
        });
      }
      if (taken.items.length > 1) {
        return res.status(400).send({
          success: 'false',
          message: 'Custom URL already taken.',
        });
      }

      cube.shortId = updatedCube.shortId;
    }

    cube.name = updatedCube.name;
    cube.imageName = updatedCube.imageName;

    if (updatedCube.description !== null) {
      cube.description = updatedCube.description;
    }
    cube.date = Date.now().valueOf();

    // cube category override
    if (updatedCube.categoryOverride != null) {
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
    } else {
      cube.categoryOverride = null;
      cube.categoryPrefixes = [];
    }

    // cube tags
    cube.tags = updatedCube.tags.filter((tag) => tag && tag.length > 0).map((tag) => tag.toLowerCase());

    await Cube.update(cube);
    return res.status(200).send({
      success: 'true',
    });
  }),
);

router.post(
  '/settings/:id',
  ensureAuth,
  body('priceVisibility', 'Invalid Price visibility').isIn(
    Object.entries(Cube.PRICE_VISIBLITY).map((entry) => entry[1]),
  ),
  body('disableAlerts').toBoolean(),
  body('defaultStatus', 'status must be valid.').isIn(['Owned', 'Not Owned']),
  body('defaultPrinting', 'Printing must be valid.').isIn(['recent', 'first']),
  body('visibility', 'visibility must be valid').isIn(Object.entries(Cube.VISIBILITY).map((entry) => entry[1])),
  jsonValidationErrors,
  util.wrapAsyncApi(async (req, res) => {
    const cube = await Cube.getById(req.params.id);

    if (!isCubeViewable(cube, req.user)) {
      return res.status(404).send({
        success: 'false',
        message: 'Cube Not Found',
      });
    }

    if (cube.owner !== req.user.id) {
      return res.status(403).send({
        success: 'false',
        message: 'Unauthorized',
      });
    }

    const update = req.body;
    for (const field of ['visibility', 'priceVisibility', 'disableAlerts', 'defaultStatus', 'defaultPrinting']) {
      if (update[field] !== undefined) {
        cube[field] = update[field];
      }
    }

    await Cube.update(cube);
    return res.status(200).send({
      success: 'true',
    });
  }),
);

router.get('/imagedict', (_, res) => {
  res.status(200).send({
    success: 'true',
    dict: carddb.imagedict,
  });
});

router.get('/fullnames', (_, res) => {
  res.status(200).send({
    success: 'true',
    cardnames: carddb.full_names,
  });
});

router.get('/usercubes/:id', async (req, res) => {
  const cubes = await Cube.getByOwner(req.params.id);

  res.status(200).send({
    success: 'true',
    cubes: cubes.items.filter((cube) => isCubeViewable(cube, req.user)),
  });
});

router.get(
  '/cubecardnames/:id',
  util.wrapAsyncApi(async (req, res) => {
    const cube = await Cube.getById(req.params.id);

    if (!isCubeViewable(cube, req.user)) {
      return res.status(404).send({
        success: 'false',
        message: 'Not found',
      });
    }

    const cubeCards = await Cube.getCards(cube.id);

    const cardnames = [];
    for (const [boardname, list] of Object.entries(cubeCards)) {
      if (boardname !== 'id') {
        for (const card of list) {
          util.binaryInsert(carddb.cardFromId(card.cardID).name, cardnames);
        }
      }
    }

    const result = util.turnToTree(cardnames);
    return res.status(200).send({
      success: 'true',
      cardnames: result,
    });
  }),
);

router.get(
  '/cubecardtags/:id',
  util.wrapAsyncApi(async (req, res) => {
    const cube = await Cube.getById(req.params.id);

    if (!isCubeViewable(cube, req.user)) {
      return res.status(404).send({
        success: 'false',
        message: 'Not Found',
      });
    }

    const cubeCards = await Cube.getCards(cube.id);
    const tags = cubeCardTags(cubeCards);

    return res.status(200).send({
      success: 'true',
      tags: util.turnToTree(tags),
    });
  }),
);

router.post(
  '/getdetailsforcards',
  util.wrapAsyncApi(async (req, res) => {
    return res.status(200).send({
      success: 'true',
      details: req.body.cards.map((id) => carddb.cardFromId(id)),
    });
  }),
);

router.post(
  '/saveshowtagcolors',
  ensureAuth,
  body('show_tag_colors').toBoolean(),
  jsonValidationErrors,
  util.wrapAsyncApi(async (req, res) => {
    const user = await User.getById(req.user.id);

    user.hideTagColors = !req.body.show_tag_colors;

    await User.update(user);
    return res.status(200).send({
      success: 'true',
    });
  }),
);

router.post(
  '/savetagcolors/:id',
  util.wrapAsyncApi(async (req, res) => {
    const cube = await Cube.getById(req.params.id);

    if (!isCubeViewable(cube, req.user)) {
      return res.status(404).send({
        success: 'false',
        message: 'Not Found',
      });
    }

    if (cube.owner !== req.user.id) {
      return res.status(401).send({
        success: 'false',
      });
    }

    cube.tagColors = req.body.tag_colors;

    await Cube.update(cube);
    return res.status(200).send({
      success: 'true',
    });
  }),
);

router.get(
  '/cubetagcolors/:id',
  util.wrapAsyncApi(async (req, res) => {
    const cube = await Cube.getById(req.params.id);

    if (!isCubeViewable(cube, req.user)) {
      return req.status(404).send({
        success: 'false',
        message: 'Not Found',
      });
    }

    const cubeCards = await Cube.getCards(cube.id);

    const tagColors = buildTagColors(cube, cubeCards);
    const tags = tagColors.map((item) => item.tag);

    if (req.query.b_id) {
      const cubeB = await Cube.getById(req.query.b_id);
      const cubeBCards = Cube.getCards(req.query.b_id);

      if (!isCubeViewable(cubeB, req.user)) {
        return res.status(404).send({
          success: 'false',
          message: 'Not Found',
        });
      }

      const bTagColors = buildTagColors(cubeB, cubeBCards);
      for (const bTag of bTagColors) {
        if (!tags.includes(bTag.tag)) {
          tagColors.push(bTag);
        }
      }
    }

    const showTagColors = req.user ? !req.user.hideTagColors : true;

    return res.status(200).send({
      success: 'true',
      tagColors,
      showTagColors,
    });
  }),
);

router.get(
  '/getcardfromcube/:id',
  util.wrapAsyncApi(async (req, res) => {
    const split = req.params.id.split(';');
    const cubeid = split[0];
    let cardname = split[1];
    cardname = cardutil.decodeName(cardname);
    cardname = cardutil.normalizeName(cardname);

    const cube = await Cube.getById(cubeid);

    if (!isCubeViewable(cube, req.user)) {
      return req.status(404).send({
        success: 'false',
        message: 'Not Found',
      });
    }

    const cubeCards = Cube.getCards(cubeid);

    for (const card of cubeCards) {
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
  '/cubelist/:id',
  util.wrapAsyncApi(async (req, res) => {
    const cube = await Cube.getById(req.params.id);

    if (!isCubeViewable(cube, req.status)) {
      return res.status(404).send('Cube not found.');
    }

    const cubeCards = await Cube.getCards(cube.id);

    const names = cubeCards.map((card) => carddb.cardFromId(card.cardID).name);
    res.contentType('text/plain');
    res.set('Access-Control-Allow-Origin', '*');
    return res.status(200).send(names.join('\n'));
  }),
);

router.get(
  '/cubeJSON/:id',
  util.wrapAsyncApi(async (req, res) => {
    const cube = await Cube.getById(req.params.id);

    if (!isCubeViewable(cube, req.user)) {
      return res.status(404).send('Cube not found.');
    }

    const cubeCards = await Cube.getCards(cube.id);

    res.contentType('application/json');
    return res.status(200).send(JSON.stringify({ ...cube, cards: cubeCards }));
  }),
);

router.post(
  '/updatebasics/:id',
  util.wrapAsyncApi(async (req, res) => {
    const cube = await Cube.getById(req.params.id);

    if (cube.owner !== req.user.id) {
      return res.status(403).send({
        success: 'false',
        message: 'Cube can only be updated by cube owner.',
      });
    }

    cube.basics = req.body;

    await Cube.update(cube);

    return res.status(200).send({
      success: 'true',
    });
  }),
);

router.post(
  '/getcardforcube',
  util.wrapAsyncApi(async (req, res) => {
    const { name, defaultPrinting } = req.body;

    const card = carddb.getMostReasonable(name, defaultPrinting);
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
  '/getimage/:name',
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
  '/getcardfromid/:id',
  util.wrapAsyncApi(async (req, res) => {
    const card = carddb.cardFromId(req.params.id);
    return res.status(200).send({
      success: 'true',
      card,
    });
  }),
);

router.get(
  '/getversions/:id',
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
  '/getversions',
  body([], 'body must be an array.').isArray(),
  body('*', 'Each ID must be a valid UUID.').matches(
    /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}2?$/,
  ),
  jsonValidationErrors,
  util.wrapAsyncApi(async (req, res) => {
    const allDetails = req.body.map((cardID) => carddb.cardFromId(cardID));
    const allIds = allDetails.map(({ name }) => carddb.getIdsFromName(name) || []);
    const allVersions = allIds.map((versions) =>
      versions.map((id) => carddb.cardFromId(id)).sort((a, b) => -a.released_at.localeCompare(b.released_at)),
    );

    const result = util.fromEntries(
      allVersions.map((versions, index) => [
        cardutil.normalizeName(allDetails[index].name),
        versions.map(({ _id, full_name, image_normal, image_flip, prices }) => ({
          _id,
          version: full_name.toUpperCase().substring(full_name.indexOf('[') + 1, full_name.indexOf(']')),
          image_normal,
          image_flip,
          prices,
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
  '/adds/:id',
  util.wrapAsyncApi(async (req, res) => {
    const response = await fetch(
      `${process.env.FLASKROOT}/?cube_name=${encodeURIComponent(
        req.params.id,
      )}&num_recs=${1000}&root=${encodeURIComponent(process.env.HOST)}`,
    );
    if (!response.ok) {
      req.logger.error({
        message: 'Flask server response not OK.',
      });
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
      result: {
        toAdd: addlist,
        toCut: cutlist,
      },
    });
  }),
);

router.post(
  '/addtocube/:id',
  ensureAuth,
  util.wrapAsyncApi(async (req, res) => {
    const cube = await Cube.getById(req.params.id);

    if (!isCubeViewable(cube, req.user)) {
      return res.status(400).send({
        success: 'false',
        message: 'Cube not found',
      });
    }

    if (!cube.owner.equals(req.user.id)) {
      return res.status(403).send({
        success: 'false',
        message: 'Cube can only be updated by cube owner.',
      });
    }

    const cubeCards = await Cube.getCards(req.params.id);
    const mainboard = cubeCards.Mainboard;

    let tag = null;
    if (req.body.packid) {
      const pack = await Package.getById(req.body.packid);
      if (pack) {
        tag = pack.title;
      }
    }

    const adds = req.body.cards.map((id) => {
      const c = util.newCard(carddb.cardFromId(id));
      c.tags = [tag];
      c.notes = `Added from package "${tag}": ${process.env.HOST}/packages/${req.body.packid}`;
      return c;
    });

    if (tag) {
      mainboard.push(...adds);
    } else {
      mainboard.push(...req.body.cards.map((id) => util.newCard(carddb.cardFromId(id))));
    }

    await Cube.updateCards(req.params.id, cubeCards);

    if (tag) {
      const changelist = await Changelog.put(
        {
          Mainboard: { adds },
        },
        cube.id,
      );

      const id = await Blog.put({
        body: `Add from the package [${tag}](/packages/${req.body.packid})`,
        owner: req.user.id,
        date: new Date().valueOf(),
        cube: cube.id,
        title: `Added Package "${tag}"`,
        changelist,
      });

      const followers = [...new Set([...req.user.following, ...cube.following])];

      const feedItems = followers.map((user) => ({
        id,
        to: user,
        date: new Date(),
        type: Feed.TYPES.BLOG,
      }));

      await Feed.put(feedItems);
    }

    return res.status(200).send({
      success: 'true',
    });
  }),
);

router.post(
  '/savesorts/:id',
  ensureAuth,
  util.wrapAsyncApi(async (req, res) => {
    const cube = await Cube.getById(req.params.id);
    const { sorts, showUnsorted } = req.body;

    if (!isCubeViewable(cube, req.user)) {
      return res.status(404).send({
        success: 'false',
        message: 'Cube not found',
      });
    }
    if (cube.owner !== req.user.id) {
      return res.status(403).send({
        success: 'false',
        message: 'Unauthorized',
      });
    }

    cube.defaultSorts = sorts || [];
    cube.showUnsorted = showUnsorted || false;
    await Cube.update(cube);

    return res.status(200).send({
      success: 'true',
    });
  }),
);

router.post('/submitdraft/:id', ensureAuth, async (req, res) => {
  const draft = await Draft.getById(req.body.id);

  if (!draft) {
    return res.status(404).send({
      success: 'false',
      message: 'Draft not found',
    });
  }

  const { seat } = req.body;

  const index = draft.seats.findIndex(({ owner }) => owner === req.body.owner);
  if (index === -1) {
    return res.status(403).send({
      success: 'false',
      message: 'Unauthorized',
    });
  }

  draft.seats[index].seat = seat;
  await Draft.put(draft);

  return res.status(200).send({
    success: 'true',
  });
});

router.get(
  '/p1p1/:id',
  util.wrapAsyncApi(async (req, res) => {
    const cube = await Cube.getById(req.params.id);

    if (!isCubeViewable(cube, req.user)) {
      return res.status(404).send({
        success: 'false',
        message: 'Cube not found',
      });
    }

    const cubeCards = await Cube.getCards(req.params.id);

    const result = await generatePack(cube, cubeCards, carddb, false);

    return res.status(200).send({
      seed: result.seed,
      pack: result.pack.map((card) => card.name),
    });
  }),
);

router.get(
  '/p1p1/:id/:seed',
  util.wrapAsyncApi(async (req, res) => {
    const cube = await Cube.getById(req.params.id);

    if (!isCubeViewable(cube, req.user)) {
      return res.status(404).send({
        success: 'false',
        message: 'Cube not found',
      });
    }

    const cubeCards = await Cube.getCards(req.params.id);

    const result = await generatePack(cube, cubeCards, carddb, req.params.seed);

    return res.status(200).send({
      seed: req.params.seed,
      pack: result.pack.map((card) => card.name),
    });
  }),
);

router.get(
  '/date_updated/:id',
  util.wrapAsyncApi(async (req, res) => {
    const result = await Cube.getById(req.params.id);

    if (!isCubeViewable(result, req.user)) {
      return res.status(404).send({
        success: 'false',
        message: 'No such cube.',
      });
    }
    return res.status(200).send({
      success: 'true',
      date_updated: result.date,
    });
  }),
);

router.post('/imagedata', async (req, res) => {
  const { cardname } = req.body;
  const data = util.getImageData(cardname);
  return res.status(200).send({
    success: 'true',
    data,
  });
});

router.post('/commit', async (req, res) => {
  const { id, changes, title, blog } = req.body;

  const cube = await Cube.getById(id);

  if (cube.owner !== req.user.id) {
    return res.status(403).send({
      success: 'false',
      message: 'Unauthorized',
    });
  }

  const changelogId = await Changelog.put(changes, cube.id);

  // TODO: blogpost
  if (title) {
    const blogId = await Blog.put({
      body: blog,
      owner: req.user.id,
      date: new Date().valueOf(),
      cube: cube.id,
      title,
      changelist: changelogId,
    });

    const followers = [...new Set([...req.user.following, ...cube.following])];

    const feedItems = followers.map((user) => ({
      id: blogId,
      to: user,
      date: new Date().valueOf(),
      type: Feed.TYPES.BLOG,
    }));

    await Feed.batchPut(feedItems);
  }

  const cards = await Cube.getCards(cube.id);

  for (const [board] of Object.entries(changes)) {
    // swaps
    if (changes[board].swaps) {
      for (const swap of changes[board].swaps) {
        cards[board][swap.index] = swap.card;
      }
    }
    // edits
    if (changes[board].edits) {
      for (const edit of changes[board].edits) {
        cards[board][edit.index] = {
          ...cards[board][edit.index],
          ...edit.newCard,
        };
      }
    }
    // removes
    if (changes[board].removes) {
      // sort removals desc
      const sorted = changes[board].removes.sort((a, b) => b.index - a.index);
      for (const remove of sorted) {
        cards[board].splice(remove.index, 1);
      }
    }
    // adds
    if (changes[board].adds) {
      for (const add of changes[board].adds) {
        cards[board].push({
          ...add,
        });
      }
    }
  }

  await Cube.updateCards(cube.id, cards);

  return res.status(200).send({
    success: 'true',
  });
});

module.exports = router;
