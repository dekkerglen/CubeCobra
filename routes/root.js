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

const { csrfProtection } = require('./middleware');

const router = express.Router();

router.use(csrfProtection);

// Home route
router.get('/', async (req, res) => (req.user ? res.redirect('/dashboard') : res.redirect('/landing')));

router.get('/explore', async (req, res) => {
  const userID = req.user ? req.user._id : '';

  const recentsq = Cube.find({
    $or: [
      {
        $and: [
          {
            card_count: {
              $gt: 200,
            },
          },
          {
            isListed: true,
          },
        ],
      },
      {
        owner: userID,
      },
    ],
  })
    .sort({
      date_updated: -1,
    })
    .limit(12)
    .exec();

  const featuredq = Cube.find({
    isFeatured: true,
  }).exec();

  const draftedq = Cube.find({
    $or: [
      {
        isListed: true,
      },
      {
        isListed: null,
      },
      {
        owner: userID,
      },
    ],
  })
    .sort({
      numDecks: -1,
    })
    .limit(12)
    .exec();

  const blogq = Blog.find({
    dev: 'true',
  })
    .sort({
      date: -1,
    })
    .exec();

  const decksq = Deck.find()
    .sort({
      date: -1,
    })
    .limit(10)
    .exec();

  const [recents, featured, drafted, blog, decks] = await Promise.all([recentsq, featuredq, draftedq, blogq, decksq]);

  res.render('index', {
    devblog: blog.length > 0 ? blog[0] : null,
    recents,
    drafted,
    decks,
    featured,
    loginCallback: '/explore',
  });
});

// format: {search};{search};{search}:{page}
// list like:
// {property}{symbol}{value};
// properties:
// name, owner
// symbols:
//= ,~(contains)
router.get('/advanced_search', (req, res) => {
  res.render('search/advanced_search', {
    loginCallback: '/advanced_search',
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
    if (!req.user) {
      return res.redirect('/landing');
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.redirect('/landing');
    }

    const cubesq = Cube.find(
      {
        owner: user._id,
      },
      '_id urlAlias shortId image_uri image_artist name owner owner_name type card_count overrideCategory categoryPrefixes categoryOverride',
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

    const decks = await Deck.find(
      {
        cube: {
          $in: cubeIds,
        },
      },
      '_id name owner username date',
    )
      .sort({
        date: -1,
      })
      .limit(13);

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
    console.error(err);
    return res.status(500).send(err);
  }
});

router.get('/dashboard/decks/:page', async (req, res) => {
  try {
    const pagesize = 30;
    const { page } = req.params;
    const user = await User.findById(req.user._id);
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
      .exec();
    const numDecks = await Deck.countDocuments({
      cube: {
        $in: cubeIds,
      },
    }).exec();

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
    console.error(err);
    return res.status(500).send(err);
  }
});

router.get('/landing', async (req, res) => {
  const cubeq = Cube.countDocuments().exec();
  const deckq = Deck.countDocuments().exec();
  const userq = User.countDocuments().exec();

  const [cube, deck, user] = await Promise.all([cubeq, deckq, userq]);

  // this regex add commas to the number
  res.render('landing', {
    numusers: user.toLocaleString('en-US'),
    numcubes: cube.toLocaleString('en-US'),
    numdrafts: deck.toLocaleString('en-US'),
    loginCallback: '/',
  });
});

router.post('/advanced_search', (req, res) => {
  let url = '/search/';
  if (req.body.name && req.body.name.length > 0) {
    url += `name${req.body.nameType}${req.body.name};`;
  }
  if (req.body.owner && req.body.owner.length > 0) {
    url += `owner_name${req.body.ownerType}${req.body.owner};`;
  }
  res.redirect(url);
});

router.post('/search', (req, res) => {
  if (!req.body.search || req.body.search.length === 0) {
    req.flash('danger', 'No Search Parameters');
    res.redirect('/advanced_search');
  } else {
    const query = req.body.search;
    if (query.includes(';')) {
      res.redirect(`/search/${query}`);
    } else {
      res.redirect(`/search/name~${query}`);
    }
  }
});

router.get('/search/:id', (req, res) => {
  const rawSplit = req.params.id.split(':');
  const rawQueries = rawSplit[0].split(';');
  let page = parseInt(rawSplit[1], 10);
  let query = {};
  const terms = [];
  rawQueries.forEach((searchExpression) => {
    let field;
    let filter;
    let searchRegex;
    let expressionTerm;

    if (searchExpression.includes('=')) {
      [field, filter] = searchExpression.split('=');
      searchRegex = new RegExp(`^${filter}$`, 'i');
      expressionTerm = 'is exactly';
    } else if (searchExpression.includes('~')) {
      [field, filter] = searchExpression.split('~');
      searchRegex = new RegExp(filter, 'i');
      expressionTerm = 'contains';
    }

    if (searchRegex) {
      query[field] = { $regex: searchRegex };
      terms.push(`${field.replace('owner_name', 'owner')} ${expressionTerm} ${filter.toLowerCase()}`);
    }
  });

  let userID = '';
  if (req.user) userID = req.user._id;
  query = {
    $and: [
      query,
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
    ],
  };

  Cube.find(query)
    .sort({
      date_updated: -1,
    })
    .exec((err, cubes) => {
      const pages = [];
      if (cubes.length > 12) {
        if (!page) {
          page = 0;
        }
        for (let i = 0; i < cubes.length / 12; i++) {
          if (page === i) {
            pages.push({
              url: `${rawSplit[0]}:${i}`,
              content: i + 1,
              active: true,
            });
          } else {
            pages.push({
              url: `${rawSplit[0]}:${i}`,
              content: i + 1,
            });
          }
        }
        const cubePage = [];
        for (let i = 0; i < 12; i++) {
          if (cubes[i + page * 12]) {
            cubePage.push(cubes[i + page * 12]);
          }
        }
        res.render('search', {
          results: cubePage,
          search: req.params.id,
          terms,
          pages,
          numresults: cubes.length,
          loginCallback: `/search/${req.params.id}`,
        });
      } else {
        res.render('search', {
          results: cubes,
          search: req.params.id,
          terms,
          numresults: cubes.length,
          loginCallback: `/search/${req.params.id}`,
        });
      }
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
