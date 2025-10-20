require('dotenv').config();
const express = require('express');
const { body } = require('express-validator');

const { makeFilter } = require('../../client/filtering/FilterCards');
const cardutil = require('../../client/utils/cardutil');
import carddb, {
  cardFromId,
  getAllMostReasonable,
  getAllVersionIds,
  getMostReasonable,
  getReasonableCardByOracleWithPrintingPreference,
} from '../../util/carddb';
const { ensureAuth, jsonValidationErrors } = require('../middleware');
const util = require('../../util/util');
const { deckbuild, calculateBasics } = require('../../util/draftbots');

const { recommend } = require('../../util/ml');
const { isValidUUID } = require('../../util/validation');
const { generatePack, buildTagColors, cubeCardTags, isCubeViewable } = require('../../util/cubefn');

// Bring in models
const Cube = require('../../dynamo/models/cube');
const Draft = require('../../dynamo/models/draft');
import Package from '../../dynamo/models/package';
const Blog = require('../../dynamo/models/blog');
const Changelog = require('../../dynamo/models/changelog');
const Feed = require('../../dynamo/models/feed');
const User = require('../../dynamo/models/user');

import { FeedTypes } from '../../datatypes/Feed';

const router = express.Router();

// API routes
router.get('/cardnames', (_, res) =>
  res.status(200).send({
    success: 'true',
    cardnames: carddb.cardtree,
  }),
);

// Get the full card images including image_normal and image_flip
router.get('/cardimages', (_, res) =>
  res.status(200).send({
    success: 'true',
    cardimages: carddb.cardimages,
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
  '/cubecardnames/:id/:board',
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

    for (const card of cubeCards[req.params.board]) {
      util.binaryInsert(cardFromId(card.cardID).name, cardnames);
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
    const tags = cubeCardTags([...cubeCards.mainboard, ...cubeCards.maybeboard]);

    return res.status(200).send({
      success: 'true',
      tags: util.turnToTree(tags),
    });
  }),
);

router.post(
  '/getdetailsforcards',
  util.wrapAsyncApi(async (req, res) =>
    res.status(200).send({
      success: 'true',
      details: req.body.cards.map((id) => cardFromId(id)),
    }),
  ),
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

    if (cube.owner.id !== req.user.id) {
      return res.status(401).send({
        success: 'false',
      });
    }

    // filter out tags that don't exist on any cards
    const cubeCards = await Cube.getCards(cube.id);
    const tags = new Set();

    for (const [board, list] of Object.entries(cubeCards)) {
      if (board !== 'id') {
        for (const card of list) {
          for (const tag of card.tags || []) {
            tags.add(tag);
          }
        }
      }
    }

    const allTags = [...tags];

    cube.tagColors = req.body.tag_colors.filter((tagColor) => allTags.includes(tagColor.tag));

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
      const cubeBCards = await Cube.getCards(req.query.b_id);

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
  '/cubelist/:id',
  util.wrapAsyncApi(async (req, res) => {
    const cube = await Cube.getById(req.params.id);

    if (!isCubeViewable(cube, req.status)) {
      return res.status(404).send('Cube not found.');
    }

    const cubeCards = await Cube.getCards(cube.id);

    const names = cubeCards.mainboard.map((card) => cardFromId(card.cardID).name);
    res.contentType('text/plain');
    res.set('Access-Control-Allow-Origin', '*');
    return res.status(200).send(names.join('\n'));
  }),
);

router.post(
  '/cubemetadata/:id',
  util.wrapAsyncApi(async (req, res) => {
    const cube = await Cube.getById(req.params.id);

    if (!isCubeViewable(cube, req.status)) {
      return res.status(404).send('Cube not found.');
    }

    return res.status(200).send({
      success: 'true',
      cube,
    });
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

    if (cube.owner.id !== req.user.id) {
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

    const card = getMostReasonable(name, defaultPrinting);
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
  '/getcardfromid/:id',
  util.wrapAsyncApi(async (req, res) => {
    const card = cardFromId(req.params.id);
    return res.status(200).send({
      success: 'true',
      card,
    });
  }),
);

router.get(
  '/getversions/:id',
  util.wrapAsyncApi(async (req, res) => {
    const cardIds = getAllVersionIds(cardFromId(req.params.id));

    const cards = cardIds.map((id) => Object.assign({}, cardFromId(id)));
    return res.status(200).send({
      success: 'true',
      cards,
    });
  }),
);

router.post(
  '/getversions',
  body('', 'body must be an array.').isArray(),
  body('*')
    .custom((value) => {
      if (!(isValidUUID(value) || value === 'custom-card')) {
        throw new Error('body must contain uuids or custom-card');
      }
      return true;
    })
    .withMessage('Each ID must be a valid UUID or custom-card.'),
  jsonValidationErrors,
  util.wrapAsyncApi(async (req, res) => {
    const allDetails = req.body.map((cardID) => cardFromId(cardID));
    const allIds = allDetails.map((cardDetails) => getAllVersionIds(cardDetails));
    const allVersions = allIds.map((versions) =>
      versions.map((id) => cardFromId(id)).sort((a, b) => -a.released_at.localeCompare(b.released_at)),
    );

    /* Build a map where every name from every version is a key. Necessary because now with printed name changes,
     * there can be multiple names across the versions of a card (when grouping by oracle id).
     */
    const result = {};
    allVersions.forEach((versions) => {
      const versionDetails = versions.map(
        ({ name, scryfall_id, oracle_id, full_name: fullName, image_normal, image_flip, prices, isExtra }) => ({
          scryfall_id,
          oracle_id,
          name,
          version: fullName.toUpperCase().substring(fullName.indexOf('[') + 1, fullName.indexOf(']')),
          image_normal,
          image_flip,
          prices,
          isExtra,
        }),
      );
      versions.forEach((card) => {
        const normalized = cardutil.normalizeName(card.name);
        // Filter based on isExtra which is true if this is the backside of a card.
        // Fixes duplicate versions listed in both the front and backsides
        result[normalized] = versionDetails
          .filter((c) => c.isExtra === card.isExtra)
          .map(({ isExtra, ...rest }) => rest); // remove isExtra from the response objects
      });
    });

    return res.status(200).send({
      success: 'true',
      dict: result,
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

    if (cube.owner.id !== req.user.id) {
      return res.status(403).send({
        success: 'false',
        message: 'Cube can only be updated by cube owner.',
      });
    }
    const cubeCards = await Cube.getCards(req.params.id, true);

    let tag = null;
    if (req.body.packid) {
      const pack = await Package.getById(req.body.packid);
      if (pack) {
        tag = pack.title;
      }
    }

    const adds = req.body.cards.map((id) => {
      const c = util.newCard(cardFromId(id));
      c.tags = [tag];
      c.notes = `Added from package "${tag}": ${process.env.DOMAIN}/packages/${req.body.packid}`;
      return c;
    });

    if (!['mainboard', 'maybeboard'].includes(req.body.board)) {
      return res.status(400).send({
        success: 'false',
        message: 'Invalid board',
      });
    }

    if (!cubeCards[req.body.board]) {
      cubeCards[req.body.board] = [];
    }

    if (tag) {
      cubeCards[req.body.board].push(...adds);
    } else {
      cubeCards[req.body.board].push(...req.body.cards.map((id) => util.newCard(cardFromId(id))));
    }

    await Cube.updateCards(req.params.id, cubeCards);

    const changelist = await Changelog.put(
      {
        [req.body.board]: { adds },
      },
      cube.id,
    );

    if (tag) {
      const id = await Blog.put({
        body: `Add from the package [${tag}](/packages/${req.body.packid})`,
        owner: req.user.id,
        date: new Date().valueOf(),
        cube: cube.id,
        title: `Added Package "${tag}"`,
        changelist,
      });

      const followers = [...new Set([...(req.user.following || []), ...cube.following])];

      const feedItems = followers.map((user) => ({
        id,
        to: user,
        date: new Date().valueOf(),
        type: FeedTypes.BLOG,
      }));

      await Feed.batchPut(feedItems);
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
    if (cube.owner.id !== req.user.id) {
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

router.post('/submitgriddraft/:id', ensureAuth, async (req, res) => {
  const draft = await Draft.getById(req.body.id);

  if (!draft) {
    return res.status(404).send({
      success: 'false',
      message: 'Draft not found',
    });
  }

  if (draft.type !== Draft.TYPES.GRID) {
    return res.status(400).send({
      success: 'false',
      message: 'Draft is not a grid draft',
    });
  }

  const { seats } = req.body;

  draft.seats = seats;
  draft.complete = true;

  await Draft.put(draft);

  return res.status(200).send({
    success: 'true',
  });
});

router.post('/submitdraft/:id', ensureAuth, async (req, res) => {
  const draft = await Draft.getById(req.body.id);

  if (!draft) {
    return res.status(404).send({
      success: 'false',
      message: 'Draft not found',
    });
  }

  const { seat } = req.body;

  const index = draft.seats.findIndex(({ owner }) => owner.id === req.body.owner);
  if (index === -1) {
    return res.status(403).send({
      success: 'false',
      message: 'Unauthorized',
    });
  }

  draft.seats[index].seat = seat;
  draft.complete = true;

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

router.post('/commit', async (req, res) => {
  try {
    const { id, changes, title, blog, useBlog, expectedVersion } = req.body;

    let changeCount = 0;

    for (const [board] of Object.entries(changes)) {
      if (changes[board].swaps) {
        changeCount += changes[board].swaps.length;
      }
      if (changes[board].adds) {
        changeCount += changes[board].adds.length;
      }
      if (changes[board].removes) {
        changeCount += changes[board].removes.length;
      }
      if (changes[board].edits) {
        changeCount += changes[board].edits.length;
      }
    }

    if (changeCount <= 0) {
      return res.status(400).send({
        success: 'false',
        message: 'No changes',
      });
    }

    const cube = await Cube.getById(id);

    if (cube.owner.id !== req.user.id) {
      return res.status(403).send({
        success: 'false',
        message: 'Unauthorized',
      });
    }

    if (cube.version !== expectedVersion) {
      return res.status(409).send({
        success: 'false',
        message: 'Cube has been updated since changes were made.',
      });
    }

    const cards = await Cube.getCards(cube.id, true);

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
    try {
      const changelogId = await Changelog.put(changes, cube.id);

      if (useBlog) {
        const blogId = await Blog.put({
          body: blog,
          owner: req.user.id,
          date: new Date().valueOf(),
          cube: cube.id,
          title,
          changelist: changelogId,
        });

        const followers = [...new Set([...(req.user.following || []), ...cube.following])];

        const feedItems = followers.map((user) => ({
          id: blogId,
          to: user,
          date: new Date().valueOf(),
          type: FeedTypes.BLOG,
        }));

        await Feed.batchPut(feedItems);
      }

      return res.status(200).send({
        success: 'true',
        updateApplied: true,
      });
    } catch (err) {
      req.logger.error(err.message, err.stack);
      return res.status(500).send({
        success: 'false',
        message: `Changes applied succesfully, but encountered an error creating history/blog/feed items: ${err.message}\n${err.stack}`,
        updateApplied: true,
      });
    }
  } catch (err) {
    req.logger.error(err.message, err.stack);
    return res.status(500).send({
      success: 'false',
      message: `Failed to commit cube changes. ${err.message}\n${err.stack}`,
      updateApplied: true,
    });
  }
});

router.post('/deckbuild', async (req, res) => {
  try {
    const { pool, basics } = req.body;

    const { mainboard, sideboard } = await deckbuild(pool, basics);

    return res.status(200).send({
      success: 'true',
      mainboard,
      sideboard,
    });
  } catch (err) {
    req.logger.error(err.message, err.stack);
    return res.status(500).send({
      success: 'false',
    });
  }
});

router.post('/calculatebasics', async (req, res) => {
  try {
    const { mainboard, basics } = req.body;

    return res.status(200).send({
      success: 'true',
      basics: await calculateBasics(mainboard, basics),
    });
  } catch (err) {
    req.logger.error(err.message, err.stack);
    return res.status(500).send({
      success: 'false',
    });
  }
});

router.post('/adds', async (req, res) => {
  let { skip, limit } = req.body;
  const { cubeID, filterText, printingPreference } = req.body;

  limit = parseInt(limit, 10);
  skip = parseInt(skip, 10);

  const cards = await Cube.getCards(cubeID);

  const { adds } = recommend(cards.mainboard.map((card) => card.details.oracle_id));

  let slice;
  let { length } = adds;

  if (filterText && filterText.length > 0) {
    const { err, filter } = makeFilter(`${filterText}`);

    if (err) {
      return res.status(400).send({
        success: 'false',
        adds: [],
        hasMoreAdds: false,
      });
    }

    const eligible = getAllMostReasonable(filter, printingPreference);
    length = eligible.length;

    const oracleToEligible = Object.fromEntries(eligible.map((card) => [card.oracle_id, true]));

    slice = adds.filter((item) => oracleToEligible[item.oracle]).slice(skip, skip + limit);
  } else {
    slice = adds.slice(skip, skip + limit);
  }

  return res.status(200).send({
    adds: slice.map((item) => {
      const card = getReasonableCardByOracleWithPrintingPreference(item.oracle, printingPreference);
      return {
        details: card,
        cardID: card.scryfall_id,
      };
    }),
    hasMoreAdds: length > skip + limit,
  });
});

router.post('/cuts', async (req, res) => {
  const { cubeID, filterText, printingPreference } = req.body;

  const cards = await Cube.getCards(cubeID);

  const { cuts } = recommend(cards.mainboard.map((card) => card.details.oracle_id));

  let slice = cuts;

  if (filterText && filterText.length > 0) {
    const { err, filter } = makeFilter(`${filterText}`);

    if (err) {
      return res.status(400).send({
        success: 'false',
        cuts: [],
      });
    }

    const eligible = getAllMostReasonable(filter, printingPreference);

    const oracleToEligible = Object.fromEntries(eligible.map((card) => [card.oracle_id, true]));

    slice = cuts.filter((item) => oracleToEligible[item.oracle]);
  }

  return res.status(200).send({
    cuts: slice.map((item) => {
      const card = getReasonableCardByOracleWithPrintingPreference(item.oracle, printingPreference);
      return {
        details: card,
        cardID: card.scryfall_id,
      };
    }),
  });
});

module.exports = router;
