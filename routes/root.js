const express = require('express');
const router = express.Router();

const Blog = require('../models/blog');
const Cube = require('../models/cube');
const Deck = require('../models/deck');
const User = require('../models/user');

const {
  csrfProtection,
} = require('./middleware');

router.use(csrfProtection);

// Home route
router.get('/', async (req, res) => {
  req.user ? res.redirect('/dashboard') : res.redirect('/landing');
});

router.get('/explore', async (req, res) => {
  const user_id = req.user ? req.user._id : '';

  const recentsq = Cube.find({
    $or: [{
        $and: [{
          'card_count': {
            $gt: 200
          }
        }, {
          'isListed': true
        }]
      },
      {
        'owner': user_id
      }
    ]
  }).sort({
    'date_updated': -1
  }).limit(12).exec();

  const featuredq = Cube.find({
    isFeatured: true
  }).exec();

  const draftedq = Cube.find({
    $or: [{
      'isListed': true
    }, {
      'isListed': null
    }, {
      'owner': user_id
    }]
  }).sort({
    'numDecks': -1
  }).limit(12).exec();

  const blogq = Blog.find({
    dev: 'true'
  }).sort({
    'date': -1
  }).exec();

  const decksq = Deck.find().sort({
    'date': -1
  }).limit(10).exec();

  const [recents, featured, drafted, blog, decks] = await Promise.all([recentsq, featuredq, draftedq, blogq, decksq]);

  res.render('index', {
    devblog: blog.length > 0 ? blog[0] : null,
    recents: recents,
    drafted: drafted,
    decks: decks,
    featured: featured,
    loginCallback: '/explore'
  });
});

//format: {search};{search};{search}:{page}
//list like:
//{property}{symbol}{value};
//properties:
//name, owner
//symbols:
//=,~(contains)
router.get('/advanced_search', function(req, res) {
  res.render('search/advanced_search', {
    loginCallback: '/advanced_search'
  });
});

router.get('/random', async (req, res) => {
  const count = await Cube.count();
  var random = Math.floor(Math.random() * count);
  const cube = await Cube.findOne().skip(random);
  res.redirect('/cube/overview/' + (cube.urlAlias ? cube.urlAlias : cube.shortID));
})

router.get('/dashboard', async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.redirect('/landing');
    }

    const cubesq = Cube.find({
      owner: user._id
    }).sort({
      'date_updated': -1
    });
    const blogsq = Blog.find({
      $or: [{
          cube: {
            $in: user.followed_cubes
          }
        },
        {
          owner: {
            $in: user.followed_users
          }
        },
        {
          dev: 'true'
        }
      ]
    }).sort({
      'date': -1
    }).limit(50);


    //We can do these queries in parallel
    const [cubes, blogs] = await Promise.all([cubesq, blogsq]);
    const cubeIds = cubes.map(cube => cube._id);

    const decks = await Deck.find({
      cube: {
        $in: cubeIds
      }
    }).sort({
      'date': -1
    }).limit(13);

    return res.render('dashboard', {
      posts: blogs,
      cubes: cubes,
      decks: decks,
      loginCallback: '/'
    });
  } catch (err) {
    console.log(err);
    return res.status(500).send(err);
  }
});

router.get('/dashboard/decks/:page', async (req, res) => {
  try {
    const pagesize = 30;
    const page = req.params.page;
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.redirect('/landing');
    }

    const cubes = await Cube.find({
      owner: user._id
    }).sort({
      'date_updated': -1
    }).select({
      '_id': 1
    }).exec();

    const cubeIds = cubes.map(cube => cube._id);

    const decks = await Deck.find({
      cube: {
        $in: cubeIds
      }
    }).sort({
      'date': -1
    }).skip(pagesize * page).limit(pagesize).exec();
    const numDecks = await Deck.countDocuments({
      cube: {
        $in: cubeIds
      }
    }).exec();

    var pages = [];
    for (i = 0; i < numDecks / pagesize; i++) {
      if (page == i) {
        pages.push({
          url: '/dashboard/decks/' + i,
          content: (i + 1),
          active: true
        });
      } else {
        pages.push({
          url: '/dashboard/decks/' + i,
          content: (i + 1),
        });
      }
    }

    return res.render('dashboard_decks', {
      decks: decks,
      pages: pages,
      loginCallback: '/'
    });
  } catch (err) {
    console.log(err);
    return res.status(500).send(err);
  }
});

router.get('/landing', async (req, res) => {

  const cubeq = Cube.countDocuments().exec();
  const deckq = Deck.countDocuments().exec();
  const userq = User.countDocuments().exec();

  const [cube, deck, user] = await Promise.all([cubeq, deckq, userq]);

  //this regex add commas to the number
  res.render('landing', {
    numusers: user.toLocaleString('en-US'),
    numcubes: cube.toLocaleString('en-US'),
    numdrafts: deck.toLocaleString('en-US'),
    loginCallback: '/'
  });
});

router.post('/advanced_search', function(req, res) {
  var url = '/search/';
  if (req.body.name && req.body.name.length > 0) {
    url += 'name' + req.body.nameType + req.body.name + ';';
  }
  if (req.body.owner && req.body.owner.length > 0) {
    url += 'owner_name' + req.body.ownerType + req.body.owner + ';';
  }
  res.redirect(url)
});

router.post('/search', function(req, res) {
  if (!req.body.search || req.body.search.length == 0) {
    req.flash('danger', 'No Search Parameters');
    res.redirect('/advanced_search');
  } else {
    var query = req.body.search;
    if (query.includes(';')) {
      res.redirect('/search/' + query)
    } else {
      res.redirect('/search/name~' + query);
    }
  }
});

router.get('/search/:id', function(req, res) {
  var raw_split = req.params.id.split(':');
  var raw_queries = raw_split[0].split(';');
  var page = parseInt(raw_split[1]);
  var query = {};
  var terms = [];
  raw_queries.forEach(function(val, index) {
    if (val.includes('=')) {
      var split = val.split('=');
      query[split[0]] = split[1];
      terms.push(split[0].replace('owner_name', 'owner') + ' is exactly ' + split[1]);
    } else if (val.includes('~')) {
      var split = val.split('~');
      query[split[0]] = {
        "$regex": split[1],
        "$options": "i"
      };
      terms.push(split[0].replace('owner_name', 'owner') + ' contains ' + split[1]);
    }
  });

  var user_id = '';
  if (req.user) user_id = req.user._id;
  query = {
    $and: [query,
      {
        $or: [{
            'isListed': true
          },
          {
            'owner': user_id
          }
        ]
      }
    ]
  };

  Cube.find(query).sort({
    'date_updated': -1
  }).exec(function(err, cubes) {
    var pages = [];
    if (cubes.length > 12) {
      if (!page) {
        page = 0;
      }
      for (i = 0; i < cubes.length / 12; i++) {
        if (page == i) {
          pages.push({
            url: raw_split[0] + ':' + i,
            content: (i + 1),
            active: true
          });
        } else {
          pages.push({
            url: raw_split[0] + ':' + i,
            content: (i + 1)
          });
        }
      }
      cube_page = [];
      for (i = 0; i < 12; i++) {
        if (cubes[i + page * 12]) {
          cube_page.push(cubes[i + page * 12]);
        }
      }
      res.render('search', {
        results: cube_page,
        search: req.params.id,
        terms: terms,
        pages: pages,
        numresults: cubes.length,
        loginCallback: '/search/' + req.params.id
      });
    } else {
      res.render('search', {
        results: cubes,
        search: req.params.id,
        terms: terms,
        numresults: cubes.length,
        loginCallback: '/search/' + req.params.id
      });
    }
  });
});

router.get('/contact', function(req, res) {
  res.render('info/contact', {
    loginCallback: '/contact'
  });
});

router.get('/tos', function(req, res) {
  res.render('info/tos', {
    loginCallback: '/tos'
  });
});

router.get('/filters', function(req, res) {
  res.render('info/filters', {
    loginCallback: '/filters'
  });
});

router.get('/privacy', function(req, res) {
  res.render('info/privacy_policy', {
    loginCallback: '/privacy'
  });
});

router.get('/cookies', function(req, res) {
  res.render('info/cookies', {
    loginCallback: '/cookies'
  });
});

router.get('/ourstory', function(req, res) {
  res.render('info/ourstory', {
    loginCallback: '/ourstory'
  });
});

router.get('/faq', function(req, res) {
  res.render('info/faq', {
    loginCallback: '/faq'
  });
});

router.get('/donate', function(req, res) {
  res.render('info/donate', {
    loginCallback: '/donate'
  });
});

router.get('/c/:id', function(req, res) {
  res.redirect('/cube/list/' + req.params.id);
});

module.exports = router;