const serialize = require('serialize-javascript');
const express = require('express');

const React = require('react');
const ReactDOMServer = require('react-dom/server');

const Blog = require('../models/blog');
const Cube = require('../models/cube');
const Deck = require('../models/deck');
const User = require('../models/user');
const CardHistory = require('../models/cardHistory');

const { NODE_ENV } = process.env;

let DashboardPage = null;
if (NODE_ENV === 'production') {
  DashboardPage = require('../dist/pages/DashboardPage').default;
}

const carddb = require('../serverjs/cards');

const { addAutocard } = require('../serverjs/cubefn.js');
const { csrfProtection } = require('./middleware');

const router = express.Router();

router.use(csrfProtection);

const CUBE_PREVIEW_FIELDS =
  '_id urlAlias shortId image_uri image_artist name owner owner_name type card_count overrideCategory categoryPrefixes categoryOverride';

// Home route
router.get('/', async (req, res) => (req.user ? res.redirect('/dashboard') : res.redirect('/landing')));

router.get('/explore', async (req, res) => {
  const userID = req.user ? req.user._id : '';

  const recentsq = Cube.find(
    {
      $or: [
        {
          card_count: {
            $gt: 200,
          },
          isListed: true,
        },
        {
          owner: userID,
        },
      ],
    },
    CUBE_PREVIEW_FIELDS,
  )
    .lean()
    .sort({
      date_updated: -1,
    })
    .limit(12)
    .exec();

  const featuredq = Cube.find(
    {
      isFeatured: true,
    },
    CUBE_PREVIEW_FIELDS,
  )
    .lean()
    .exec();

  const draftedq = Cube.find(
    {
      $or: [
        {
          isListed: true,
        },
        {
          owner: userID,
        },
      ],
    },
    CUBE_PREVIEW_FIELDS,
  )
    .lean()
    .sort({
      numDecks: -1,
    })
    .limit(12)
    .exec();

  const decksq = Deck.find()
    .lean()
    .sort({
      date: -1,
    })
    .limit(10)
    .exec();

  const [recents, featured, drafted, decks] = await Promise.all([recentsq, featuredq, draftedq, decksq]);

  const recentlyDrafted = await Cube.find({ _id: { $in: decks.map((deck) => deck.cube) } }, CUBE_PREVIEW_FIELDS).lean();

  const reactProps = {
    recents,
    featured,
    drafted,
    recentlyDrafted,
  };

  res.render('explore', {
    reactProps: serialize(reactProps),
    loginCallback: '/explore',
  });
});

router.get('/random', async (req, res) => {
  const count = await Cube.count();
  const random = Math.floor(Math.random() * count);
  const cube = await Cube.findOne().skip(random);
  res.redirect(`/cube/overview/${cube.urlAlias ? cube.urlAlias : cube.shortID}`);
});

router.get('/dashboard', async (req, res) => {
  try {
    const { user } = req;
    if (!user) {
      return res.redirect('/landing');
    }

    const cubesq = Cube.find(
      {
        owner: user._id,
      },
      CUBE_PREVIEW_FIELDS,
    ).sort({
      date_updated: -1,
    });
    const postsq = Blog.find({
      $or: [
        {
          cube: {
            $in: user.followed_cubes,
          },
        },
        {
          owner: {
            $in: user.followed_users,
          },
        },
        {
          dev: 'true',
        },
      ],
    })
      .sort({
        date: -1,
      })
      .limit(50);

    // We can do these queries in parallel
    const [cubes, posts] = await Promise.all([cubesq, postsq]);
    const cubeIds = cubes.map((cube) => cube._id);

    const decks = await Deck.find({
      cube: {
        $in: cubeIds,
      },
    })
      .sort({
        date: -1,
      })
      .lean()
      .limit(13);

    // autocard the posts
    if (posts) {
      for (const post of posts) {
        if (post.html) {
          post.html = addAutocard(post.html, carddb);
        }
      }
    }

    const reactProps = { posts, cubes, decks, userId: user._id };

    return res.render('dashboard', {
      reactHTML:
        NODE_ENV === 'production'
          ? await ReactDOMServer.renderToString(React.createElement(DashboardPage, reactProps))
          : undefined,
      reactProps: serialize(reactProps),
      loginCallback: '/',
    });
  } catch (err) {
    req.logger.error(err);
    return res.status(500).send(err);
  }
});

router.get('/dashboard/decks/:page', async (req, res) => {
  try {
    const pagesize = 30;
    const { page } = req.params;
    const { user } = req;
    if (!user) {
      return res.redirect('/landing');
    }

    const cubes = await Cube.find({
      owner: user._id,
    })
      .sort({
        date_updated: -1,
      })
      .select({
        _id: 1,
      })
      .exec();

    const cubeIds = cubes.map((cube) => cube._id);

    const decks = await Deck.find({
      cube: {
        $in: cubeIds,
      },
    })
      .sort({
        date: -1,
      })
      .skip(pagesize * page)
      .limit(pagesize)
      .lean()
      .exec();

    const numDecks = await Deck.countDocuments({
      cube: {
        $in: cubeIds,
      },
    })
      .lean()
      .exec();

    const pages = [];
    for (let i = 0; i < numDecks / pagesize; i++) {
      if (page === i) {
        pages.push({
          url: `/dashboard/decks/${i}`,
          content: i + 1,
          active: true,
        });
      } else {
        pages.push({
          url: `/dashboard/decks/${i}`,
          content: i + 1,
        });
      }
    }

    return res.render('dashboard_decks', {
      decks,
      pages,
      loginCallback: '/',
    });
  } catch (err) {
    req.logger.error(err);
    return res.status(500).send(err);
  }
});

router.get('/landing', async (req, res) => {
  const cubeq = Cube.estimatedDocumentCount().exec();
  const deckq = Deck.estimatedDocumentCount().exec();
  const userq = User.estimatedDocumentCount().exec();

  const [cube, deck, user] = await Promise.all([cubeq, deckq, userq]);

  // this regex add commas to the number
  res.render('landing', {
    numusers: user.toLocaleString('en-US'),
    numcubes: cube.toLocaleString('en-US'),
    numdrafts: deck.toLocaleString('en-US'),
    version: process.env.CUBECOBRA_VERSION,
    loginCallback: '/',
  });
});

router.get('/version', async (req, res) => {
  try {
    const reactProps = { version: process.env.CUBECOBRA_VERSION, host: process.env.HOST };

    return res.render('version', {
      reactProps: serialize(reactProps),
      loginCallback: '/version',
    });
  } catch (err) {
    req.logger.error(err);
    return res.status(500).send(err);
  }
});

router.get('/search', async (req, res) => {
  const reactProps = {
    query: '',
    cubes: [],
  };
  return res.render('search', {
    reactProps: serialize(reactProps),
    loginCallback: `/search`,
  });
});

const queryMap = {
  owner_name: 'owner_name',
  owner: 'owner_name',
  name: 'name',
  numDecks: 'numDecks',
  decks: 'numDecks',
  card_count: 'card_count',
  cards: 'card_count',
  category: 'category',
  card: 'card',
};

const operatorMap = {
  '>': '$gt',
  '<': '$lt',
  '>=': '$gte',
  '<=': '$lte',
  '=': '$eq',
};

const delimiters = [':', '<=', '>=', '<', '>', '='];
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

async function getCardCubes(value) {
  const ids = carddb.getIdsFromName(value);
  if (ids) {
    return getCardCubes(carddb.getMostReasonable(value)._id);
  }

  // if id is a foreign cardname, redirect to english version
  const english = carddb.getEnglishVersion(value);
  if (english) {
    return getCardCubes(english);
  }

  // otherwise just go to this ID.
  const card = carddb.cardFromId(value);
  const data = await CardHistory.findOne({ cardName: card.name_lower });
  if (!data) {
    return { _id: { $in: [] } };
  }

  return { _id: { $in: data.cubes } };
}

async function buildQuery(key, value, delim) {
  if (!queryMap[key]) {
    return { name: { $regex: `${key}${delim}${value}`, $options: 'i' } };
  }

  key = queryMap[key];
  const query = {};
  if (delim === ':') {
    switch (key) {
      case 'owner_name':
      case 'name':
      case 'descriptionhtml':
        query[key] = { $regex: value, $options: 'i' };
        break;
      case 'category':
        if (prefixes.includes(value)) {
          query.categoryPrefixes = { $regex: `\\b${value}\\b`, $options: 'i' };
        } else {
          query.categoryOverride = { $regex: value, $options: 'i' };
        }
        break;
      case 'card':
        return getCardCubes(value);
      default:
        break;
    }
  } else {
    // relational
    switch (key) {
      case 'numDecks':
      case 'card_count':
        query[key] = {};
        query[key][operatorMap[delim]] = value;
        break;
      default:
        break;
    }
  }
  return query;
}

router.get('/search/:query/:page', async (req, res) => {
  const perPage = 36;
  const page = Math.max(0, req.params.page);

  const { order } = req.query;

  let sort = {
    date_updated: -1,
  };

  switch (order) {
    case 'pop':
      sort = {
        numDecks: -1,
      };
      break;
    case 'alpha':
      sort = {
        name: -1,
      };
      break;
    default:
      break;
  }

  // parse query object, this regex escapes quotes: https://stackoverflow.com/questions/16261635/javascript-split-string-by-space-but-ignore-space-in-quotes-notice-not-to-spli
  const split = req.params.query.match(/(?:[^\s"]+|"[^"]*")+/g);

  const query = {
    $and: await Promise.all(
      split.map(async (token) => {
        for (const delim of delimiters) {
          if (token.includes(delim)) {
            const splitToken = token.split(delim);
            // this regex strips quotes if visible
            return buildQuery(splitToken[0], splitToken[1].replace(/["]+/g, ''), delim);
          }
        }
        return { name: { $regex: token, $options: 'i' } };
      }),
    ),
  };

  query.$and.push({
    isListed: true,
  });

  const count = await Cube.count(query);

  const cubes = await Cube.find(query, CUBE_PREVIEW_FIELDS)
    .sort(sort)
    .skip(perPage * page)
    .limit(perPage)
    .lean();

  const reactProps = {
    query: req.params.query,
    cubes,
    count,
    perPage,
    page,
    order,
  };

  return res.render('search', {
    reactProps: serialize(reactProps),
    loginCallback: `/search/${req.params.id}`,
  });
});

router.get('/contact', (req, res) => {
  res.render('info/contact', {
    loginCallback: '/contact',
  });
});

router.get('/tos', (req, res) => {
  res.render('info/tos', {
    loginCallback: '/tos',
  });
});

router.get('/filters', (req, res) => {
  res.render('info/filters', {
    loginCallback: '/filters',
  });
});

router.get('/privacy', (req, res) => {
  res.render('info/privacy_policy', {
    loginCallback: '/privacy',
  });
});

router.get('/cookies', (req, res) => {
  res.render('info/cookies', {
    loginCallback: '/cookies',
  });
});

router.get('/ourstory', (req, res) => {
  res.render('info/ourstory', {
    loginCallback: '/ourstory',
  });
});

router.get('/faq', (req, res) => {
  res.render('info/faq', {
    loginCallback: '/faq',
  });
});

router.get('/donate', (req, res) => {
  res.render('info/donate', {
    loginCallback: '/donate',
  });
});

router.get('/c/:id', (req, res) => {
  res.redirect(`/cube/list/${req.params.id}`);
});

module.exports = router;
