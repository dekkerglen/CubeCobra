const express = require('express');
const router = express.Router();

const Blog = require('../models/blog');
const Cube = require('../models/cube');
const Deck = require('../models/deck');

const {
  csrfProtection,
} = require('./middleware');

router.use(csrfProtection);

// Home route
router.get('/', function (req, res) {
  const routeReady = () => {
    if (recents && drafted && blog && decks) {
      decklinks = decks.splice(Math.max(decks.length - 10, 0), decks.length);
      res.render('index', {
        devblog: blog.length > 0 ? blog[0] : null,
        recents: recents,
        drafted: drafted,
        decks: decklinks
      });
    }
  };

  var user_id = '';
  var recents, drafted, blog, decks;

  if (req.user) user_id = req.user._id;
  Cube.find({
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
  }).limit(12).exec(function (err, result) {
    if (err) {
      recents = [];
      console.log('recents failed to load');
    }

    if (result) {
      recents = result;
    }

    routeReady();
  });

  Cube.find({
    $or: [{
      'isListed': true
    }, {
      'isListed': null
    }, {
      'owner': user_id
    }]
  }).sort({
    'numDecks': -1
  }).limit(12).exec(function (err, result) {
    if (err) {
      drafted = [];
      console.log('drafted failed to load');
    }

    if (result) {
      drafted = result;
    }

    routeReady();
  });

  Blog.find({
    dev: 'true'
  }).sort({
    'date': -1
  }).exec(function (err, result) {
    if (err) {
      blog = [];
      console.log('blog failed to load');
    }

    if (result) {
      blog = result;
    }

    routeReady();
  });

  Deck.find().sort({
    'date': -1
  }).limit(10).exec(function (err, result) {
    if (err) {
      decks = [];
      console.log('decks failed to load');
    }

    if (result) {
      decks = result;
    }

    routeReady();
  });
});


//format: {search};{search};{search}:{page}
//list like:
//{property}{symbol}{value};
//properties:
//name, owner
//symbols:
//=,~(contains)
router.get('/advanced_search', function (req, res) {
  res.render('search/advanced_search', {
    loginCallback: '/advanced_search'
  });
});

router.post('/advanced_search', function (req, res) {
  var url = '/search/';
  if (req.body.name && req.body.name.length > 0) {
    url += 'name' + req.body.nameType + req.body.name + ';';
  }
  if (req.body.owner && req.body.owner.length > 0) {
    url += 'owner_name' + req.body.ownerType + req.body.owner + ';';
  }
  res.redirect(url)
});

router.post('/search', function (req, res) {
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

router.get('/search/:id', function (req, res) {
  var raw_split = req.params.id.split(':');
  var raw_queries = raw_split[0].split(';');
  var page = parseInt(raw_split[1]);
  var query = {};
  var terms = [];
  raw_queries.forEach(function (val, index) {
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
  }).exec(function (err, cubes) {
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

router.get('/contact', function (req, res) {
  res.render('info/contact', {
    loginCallback: '/contact'
  });
});

router.get('/tos', function (req, res) {
  res.render('info/tos', {
    loginCallback: '/tos'
  });
});

router.get('/filters', function (req, res) {
  res.render('info/filters', {
    loginCallback: '/filters'
  });
});

router.get('/privacy', function (req, res) {
  res.render('info/privacy_policy', {
    loginCallback: '/privacy'
  });
});

router.get('/cookies', function (req, res) {
  res.render('info/cookies', {
    loginCallback: '/cookies'
  });
});

router.get('/ourstory', function (req, res) {
  res.render('info/ourstory', {
    loginCallback: '/ourstory'
  });
});

router.get('/faq', function (req, res) {
  res.render('info/faq', {
    loginCallback: '/faq'
  });
});

router.get('/donate', function (req, res) {
  res.render('info/donate', {
    loginCallback: '/donate'
  });
});

router.get('/c/:id', function (req, res) {
  res.redirect('/cube/list/' + req.params.id);
});

module.exports = router;