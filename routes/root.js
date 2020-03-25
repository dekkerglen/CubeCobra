const serialize = require('serialize-javascript');
const express = require('express');

const React = require('react');
const ReactDOMServer = require('react-dom/server');

const Blog = require('../models/blog');
const Cube = require('../models/cube');
const Deck = require('../models/deck');
const User = require('../models/user');

const { NODE_ENV } = process.env;

let DashboardPage = null;
if (NODE_ENV === 'production') {
  DashboardPage = require('../dist/pages/DashboardPage').default;
}

const carddb = require('../serverjs/cards');
const { makeFilter } = require('../serverjs/filterCubes');
const { addAutocard } = require('../serverjs/cubefn');
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

router.get('/random', async (_, res) => {
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
          ? ReactDOMServer.renderToString(React.createElement(DashboardPage, reactProps))
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

router.get('/landing', async (_, res) => {
  const cubeq = Cube.estimatedDocumentCount().exec();
  const deckq = Deck.estimatedDocumentCount().exec();
  const userq = User.estimatedDocumentCount().exec();

  const [cube, deck, user] = await Promise.all([cubeq, deckq, userq]);

  // this regex add commas to the number
  res.render('landing', {
    numusers: user.toLocaleString('en-US'),
    numcubes: cube.toLocaleString('en-US'),
    numdrafts: deck.toLocaleString('en-US'),
    loginCallback: '/',
  });
});

router.get('/search', async (_, res) => {
  const reactProps = {
    query: '',
    cubes: [],
  };
  return res.render('search', {
    reactProps: serialize(reactProps),
    loginCallback: `/search`,
  });
});

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

  let {
    filter: { query },
  } = await makeFilter(req.params.query, carddb);
  const listedQuery = { isListed: true };
  if (query.$and) {
    query.$and.push(listedQuery);
  } else {
    query = { $and: [{ isListed: true }, query] };
  }

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

router.get('/contact', (_, res) => {
  res.render('info/contact', {
    loginCallback: '/contact',
  });
});

router.get('/tos', (_, res) => {
  res.render('info/tos', {
    loginCallback: '/tos',
  });
});

router.get('/filters', (_, res) => {
  res.render('info/filters', {
    loginCallback: '/filters',
  });
});

router.get('/privacy', (_, res) => {
  res.render('info/privacy_policy', {
    loginCallback: '/privacy',
  });
});

router.get('/cookies', (_, res) => {
  res.render('info/cookies', {
    loginCallback: '/cookies',
  });
});

router.get('/ourstory', (_, res) => {
  res.render('info/ourstory', {
    loginCallback: '/ourstory',
  });
});

router.get('/faq', (_, res) => {
  res.render('info/faq', {
    loginCallback: '/faq',
  });
});

router.get('/donate', (_, res) => {
  res.render('info/donate', {
    loginCallback: '/donate',
  });
});

router.get('/c/:id', (req, res) => {
  res.redirect(`/cube/list/${req.params.id}`);
});

module.exports = router;
