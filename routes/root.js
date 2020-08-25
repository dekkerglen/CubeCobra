const serialize = require('serialize-javascript');
const express = require('express');

const util = require('../serverjs/util.js');

const Blog = require('../models/blog');
const Cube = require('../models/cube');
const Deck = require('../models/deck');
const User = require('../models/user');

const carddb = require('../serverjs/cards');
const { makeFilter } = require('../serverjs/filterCubes');
const { addAutocard } = require('../serverjs/cubefn');
const { render } = require('../serverjs/render');
const { csrfProtection } = require('./middleware');

const router = express.Router();

router.use(csrfProtection);

const CUBE_PREVIEW_FIELDS =
  '_id urlAlias shortId image_uri image_name image_artist name owner owner_name type card_count overrideCategory categoryPrefixes categoryOverride';

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
  const count = await Cube.estimatedDocumentCount();
  const random = Math.floor(Math.random() * count);
  const cube = await Cube.findOne().skip(random).lean();
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
    )
      .lean()
      .sort({
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
      .limit(200);

    // We can do these queries in parallel
    const [cubes, posts] = await Promise.all([cubesq, postsq]);

    const decks = await Deck.find({
      cubeOwner: user._id,
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

    return render(req, res, 'DashboardPage', { posts, cubes, decks });
  } catch (err) {
    return util.handleRouteError(req, res, err, '/landing');
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

    const decks = await Deck.find({
      cubeOwner: user._id,
    })
      .sort({
        date: -1,
      })
      .skip(pagesize * page)
      .limit(pagesize)
      .lean()
      .exec();

    const numDecks = await Deck.countDocuments({
      cubeOwner: user._id,
    })
      .lean()
      .exec();

    const reactProps = {
      decks,
      currentPage: parseInt(page, 10),
      totalPages: Math.ceil(numDecks / pagesize),
      count: numDecks,
    };

    return res.render('recent_drafts', {
      reactProps: serialize(reactProps),
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
    return util.handleRouteError(req, res, err, `/landing`);
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

router.get('/search/:query/:page', async (req, res) => {
  try {
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

    const count = await Cube.countDocuments(query);

    const cubes = await Cube.find(query, CUBE_PREVIEW_FIELDS)
      .lean()
      .sort(sort)
      .skip(perPage * page)
      .limit(perPage);

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
  } catch (err) {
    const reactProps = {
      query: req.params.query,
      cubes: [],
      count: 0,
      perPage: 0,
      page: 0,
    };

    req.logger.error(err);
    req.flash('danger', 'Invalid Search Syntax');

    return res.render('search', {
      reactProps: serialize(reactProps),
      loginCallback: `/search/${req.params.id}`,
    });
  }
});

router.get('/contact', (req, res) => {
  return render(req, res, 'ContactPage');
});

router.get('/tos', (req, res) => {
  res.render('info/tos', {
    loginCallback: '/tos',
  });
});

router.get('/filters', (req, res) => {
  return render(req, res, 'FiltersPage');
});

router.get('/privacy', (req, res) => {
  res.render('info/privacy_policy', {
    loginCallback: '/privacy',
  });
});

router.get('/cookies', (req, res) => {
  return render(req, res, 'InfoPage', {
    title: 'Cookies Policy',
    content: [
      {
        label: "Do we use 'cookies'?",
        text:
          "Yes. Cookies are small files that a site or its service provider transfers to your computer's hard drive through your Web browser (if you allow)" +
          " that enables the site's or service provider's systems to recognize your browser and capture and remember certain information. For instance, we use" +
          ' cookies to maintan login sessions. They are also used to help us understand your preferences based on previous or' +
          ' current site activity, which enables us to provide you with improved services. We also use cookies to help us compile aggregate data about site traffic' +
          ' and site interaction so that we can offer better site experiences and tools in the future.',
      },
      {
        label: 'We use cookies to:',
        text:
          "Understand and save user's preferences for future visits, Compile aggregate data about site traffic and site interactions in order to offer better site" +
          ' experiences and tools in the future. We may also use trusted third' +
          ' party services that track this information on our behalf.' +
          ' You can choose to have your computer warn you each time a cookie is being sent, or you can choose to turn off all cookies. You do this through your browser (like Internet Explorer) settings.' +
          " Each browser is a little different, so look at your browser's Help menu to learn the correct way to modify your cookies.",
      },
      {
        label: 'If users disable cookies in their browser',
        text:
          'If you turn cookies off, some features will be disabled. It will turn off some of the features that make your site experience more efficient and some of our services will' +
          ' not function properly, including but not limited to Persistent Login.',
      },
    ],
  });
});

router.get('/ourstory', (req, res) => {
  res.render('info/ourstory', {
    loginCallback: '/ourstory',
  });
});

router.get('/faq', (req, res) => {
  return render(req, res, 'InfoPage', {
    title: 'Frequently Asked Questions',
    content: [
      {
        label: 'What does Cube Cobra provide that other tools do not?',
        text:
          'Cube Cobra offers the most tools catered specifically towards cube construction. The website is powered by Scryfall,' +
          ' which means that newly spoiled cards will be available to use up to 48 hours after being spoiled. The biggest advantage' +
          ' Cube Cobra has right now is a more modern and maintainable technology stack compared to other tools. This means Cube' +
          ' Cobra is updated frequently and is committed to adding features that the community asks for. ',
      },
      {
        label: 'What tech stack does Cube Cobra use?',
        text: 'Cube Cobra used NodeJS with MongoDB for server side, and React front end with Bootstrap for CSS.',
      },
      {
        label: 'Is Cube Cobra Open Source?',
        text:
          "Yes! Given the goals of Cube Cobra, we've felt the best way to give the community the tool that they want is to make it a collaborative project. For the community, by the community. If you're interested in contributing, feel free to reach out and we will help you get started.",
      },
      {
        label: 'I am not a developer, can I still help improve Cube Cobra?',
        text:
          'Yes! Even if you are not a developer, you can still get involved in helping Cube Cobra become a better platform for everyone! If you want to be more involved in the community, join the discord linked under contact. You can submit bug reports, make feature requests, and talk to the developers directly there.',
      },
      {
        label: "I'm having trouble building my cube, where can I go for help?",
        text:
          'Head on over to our Discord! You can find the link under our contact page! We have an avid cubing community that would be more than happy to help you build your cube!',
      },
      {
        label: 'How can I put my lands into my guild sections?',
        text:
          'From your cube list page, click "Sort", set your primary sort to "Color Identity", and hit "Save as Default Sort". We highly recommend trying out different sorts, as they provide flexible and powerful ways to view your cube.',
      },
    ],
  });
});

router.get('/donate', (req, res) => {
  return render(req, res, 'DonatePage');
});

router.get('/c/:id', (req, res) => {
  res.redirect(`/cube/list/${req.params.id}`);
});

module.exports = router;
