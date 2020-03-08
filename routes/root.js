const serialize = require('serialize-javascript');
const express = require('express');

const React = require('react');
const ReactDOMServer = require('react-dom/server');

const Blog = require('../models/blog');
const Cube = require('../models/cube');
const Deck = require('../models/deck');
const User = require('../models/user');
const Draft = require('../models/draft');

const { getElo } = require('../serverjs/cubefn.js');

const { NODE_ENV } = process.env;

let DashboardPage = null;
if (NODE_ENV === 'production') {
  DashboardPage = require('../dist/pages/DashboardPage').default;
}

const carddb = require('../serverjs/cards.js');

const { addAutocard } = require('../serverjs/cubefn.js');
const { csrfProtection } = require('./middleware');

const router = express.Router();

router.use(csrfProtection);

const fetchLands = {
  'Arid Mesa': ['W', 'R'],
  'Bloodstained Mire': ['B', 'R'],
  'Flooded Strand': ['W', 'U'],
  'Marsh Flats': ['W', 'B'],
  'Misty Rainforest': ['U', 'G'],
  'Polluted Delta': ['U', 'B'],
  'Scalding Tarn': ['U', 'R'],
  'Verdant Catacombs': ['B', 'G'],
  'Windswept Heath': ['W', 'G'],
  'Wooded Foothills': ['R', 'G'],
};

function arrayIsSubset(needles, haystack) {
  return needles.every((x) => haystack.includes(x));
}

function botRating(botColors, card, rating) {
  const colors = card.colors || card.details.color_identity;
  const subset = arrayIsSubset(colors, botColors) && colors.length > 0;
  const overlap = botColors.some((c) => colors.includes(c));
  const typeLine = card.type_line || card.details.type;
  const isLand = typeLine.indexOf('Land') > -1;
  const isFetch = fetchLands.includes(card.details.name);

  if (isLand) {
    if (subset) {
      // if fetches don't have the color identity override, they get lumped into this category
      rating *= 1.4;
    } else if (overlap || isFetch) {
      rating *= 1.2;
    } else {
      rating *= 1.1;
    }
  } else if (subset) {
    rating *= 1.3;
  } else if (overlap) {
    rating *= 1.1;
  }

  return rating;
}

function convertCard(card) {
  if (Array.isArray(card)) {
    return card.map(convertCard);
  }
  if (typeof card === 'string' || card instanceof String) {
    const details = carddb.cardFromId(card);
    return {
      tags: [],
      colors: details.colors,
      cardID: details._id,
      cmc: details.cmc,
      type_line: details.type,
    };
  }
  return card;
}

// temprorary draft and deck conversion functions
async function updateDraft(draft) {
  try {
    if (draft.seats && draft.seats.length > 0) {
      return draft;
    }

    draft.seats = [];
    draft.unopenedPacks = [];

    // add player
    const playerSeat = {
      bot: null,
      userid: draft.owner,
      name: draft.username,
      pickorder: draft.pickOrder ? draft.pickOrder.map(convertCard) : [],
      drafted: draft.picks[0].map(convertCard),
      packbacklog: draft.packs[0] && draft.packs[0][0] ? [draft.packs[0][0]] : [],
    };

    draft.seats.push(playerSeat);
    draft.unopenedPacks.push(draft.packs[0] ? draft.packs[0].slice(1) : []);

    // add bots
    for (let i = 1; i < draft.picks.length; i++) {
      const bot = {
        bot: draft.bots[i - 1],
        name: `Bot ${i}: ${draft.bots[i - 1][0]}, ${draft.bots[i - 1][1]}`,
        pickorder: draft.picks[i].map(convertCard),
        drafted: [],
        packbacklog: draft.packs[i] && draft.packs[i][0] ? [draft.packs[i][0]] : [],
      };

      // now we need to build picks from the pickorder ids
      for (let j = 0; j < 16; j++) {
        bot.drafted.push([]);
      }

      bot.pickorder.forEach((cardid) => {
        if (cardid) {
          // inconsistent formats... find the card id
          if (cardid[0] && cardid[0].cardID) {
            cardid = cardid[0].cardID;
          } else if (cardid.cardID) {
            cardid = cardid.cardID;
          }
          // insert basic card object into correct cmc column
          const card = {
            cardId: cardid,
            details: carddb.cardFromId(cardid),
          };
          const col = Math.min(7, card.details.cmc) + (card.details.type.toLowerCase().includes('creature') ? 0 : 8);
          bot.drafted[col].push(card);
        }
      });

      draft.seats.push(bot);
      draft.unopenedPacks.push(draft.packs[i] ? draft.packs[i].slice(1) : []);
    }
    return draft;
  } catch (err) {
    return async () => {};
  }
}

async function buildDeck(cards, bot) {
  try {
    // cards will be a list of cardids

    cards = cards.map((id) => {
      if (Array.isArray(id)) {
        if (id.length <= 0) {
          const details = carddb.getPlaceholderCard('');
          return {
            tags: [],
            colors: details.colors,
            cardID: details._id,
            cmc: details.cmc,
            type_line: details.type,
            details,
          };
        }
        if (id[0].cardID) {
          id = id[0].cardID;
        } else {
          // eslint-disable-next-line prefer-destructuring
          id = id[0];
        }
      } else if (id.cardID) {
        id = id.cardID;
      }
      const details = carddb.cardFromId(id);
      return {
        tags: [],
        colors: details.colors,
        cardID: details._id,
        cmc: details.cmc,
        type_line: details.type,
        details,
      };
    });

    const elos = await getElo(cards.map((card) => card.details.name));
    const nonlands = cards.filter((card) => !card.type_line.toLowerCase().includes('land'));
    const lands = cards.filter((card) => card.type_line.toLowerCase().includes('land'));

    const sortFn = (a, b) => {
      if (bot) {
        return botRating(b, bot, elos[b.details.name]) - botRating(a, bot, elos[a.details.name]);
      }
      return elos[b.details.name] - elos[a.details.name];
    };

    nonlands.sort(sortFn);
    lands.sort(sortFn);

    const main = nonlands.slice(0, 23).concat(lands.slice(0, 17));
    const side = nonlands.slice(23).concat(lands.slice(17));

    const deck = [];
    const sideboard = [];
    for (let i = 0; i < 16; i += 1) {
      deck.push([]);
      if (i < 8) {
        sideboard.push([]);
      }
    }

    for (const card of main) {
      let index = Math.min(card.cmc || 0, 7);
      if (!card.type_line.toLowerCase().includes('creature')) {
        index += 8;
      }
      deck[index].push(card);
    }
    for (const card of side) {
      sideboard[Math.min(card.cmc || 0, 7)].push(card);
    }
    return {
      deck,
      sideboard,
    };
  } catch (err) {
    return { deck: [], sideboard: [] };
  }
}
async function updateDeck(deck) {
  if (deck.seats && deck.seats.length > 0) {
    return deck;
  }

  const draft = deck.draft ? await updateDraft(await Draft.findById(deck.draft).lean()) : null;

  if (
    deck.newformat === false &&
    deck.cards[deck.cards.length - 1] &&
    typeof deck.cards[deck.cards.length - 1][0] === 'object'
  ) {
    // old format
    deck.seats = [];

    const playerdeck = await buildDeck(deck.cards[0]);

    const playerSeat = {
      bot: null,
      userid: deck.owner,
      username: deck.username,
      pickorder: deck.cards[0],
      name: deck.name,
      description: deck.description,
      cols: 16,
      deck: playerdeck.deck,
      sideboard: playerdeck.sideboard,
    };

    deck.seats.push(playerSeat);

    // add bots
    for (let i = 1; i < deck.cards.length; i += 1) {
      // need to build a deck with this pool...
      // eslint-disable-next-line no-await-in-loop
      const botdeck = await buildDeck(deck.cards[i]);
      const bot = {
        bot: deck.bots[i - 1],
        pickorder: deck.cards[i].map((id) => {
          if (typeof id === 'string' || id instanceof String) {
            const details = carddb.cardFromId(id);
            return {
              tags: [],
              colors: details.colors,
              cardID: details._id,
              cmc: details.cmc,
              type_line: details.type,
            };
          }
          return id;
        }),
        name: `Bot ${i}: ${deck.bots[i][0]}, ${deck.bots[i][1]}`,
        description: `This deck was drafted by a bot with color preference for ${deck.bots[i][0]} and ${deck.bots[i][1]}.`,
        cols: 16,
        deck: botdeck.deck,
        sideboard: botdeck.sideboard,
      };
      deck.seats.push(bot);
    }
  } else {
    // new format
    deck.seats = [];

    const playerSeat = {
      bot: null,
      userid: deck.owner,
      username: deck.username,
      pickorder: draft ? draft.seats[0].pickorder : [],
      name: deck.name,
      description: deck.description,
      cols: 16,
      deck: deck.playerdeck,
      sideboard: deck.playersideboard,
    };

    deck.seats.push(playerSeat);

    // add bots
    for (let i = 0; i < deck.cards.length; i += 1) {
      // need to build a deck with this pool...
      // eslint-disable-next-line no-await-in-loop
      const botdeck = await buildDeck(deck.cards[i]);
      const bot = {
        bot: deck.bots[i],
        pickorder: deck.cards[i].map((id) => {
          if (typeof id === 'string' || id instanceof String) {
            const details = carddb.cardFromId(id);
            return {
              tags: [],
              colors: details.colors,
              cardID: details._id,
              cmc: details.cmc,
              type_line: details.type,
            };
          }
          return id;
        }),
        name: `Bot ${i}: ${deck.bots[i][0]}, ${deck.bots[i][1]}`,
        description: `This deck was drafted by a bot with color preference for ${deck.bots[i][0]} and ${deck.bots[i][1]}.`,
        cols: 16,
        deck: botdeck.deck,
        sideboard: botdeck.sideboard,
      };
      deck.seats.push(bot);
    }
  }

  return deck;
}

// Home route
router.get('/', async (req, res) => (req.user ? res.redirect('/dashboard') : res.redirect('/landing')));

router.get('/explore', async (req, res) => {
  const userID = req.user ? req.user._id : '';

  const recentsq = Cube.find({
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
    .lean()
    .exec();

  const [recents, featured, drafted, blog] = await Promise.all([recentsq, featuredq, draftedq, blogq]);
  let decks = await decksq();

  decks = await Promise.all(decks.map(async (deck) => updateDeck(deck)));

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
    const { user } = req;
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

    let decks = await Deck.find({
      cube: {
        $in: cubeIds,
      },
    })
      .sort({
        date: -1,
      })
      .lean()
      .limit(13);

    decks = await Promise.all(decks.map(async (deck) => updateDeck(deck)));

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

    let decks = await Deck.find({
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

    decks = await Promise.all(decks.map(async (deck) => updateDeck(deck)));

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
    loginCallback: '/',
  });
});

router.post('/advanced_search', (req, res) => {
  let url = '/search/';
  if (req.body.name && req.body.name.length > 0) {
    const encoded = encodeURIComponent(req.body.name);
    url += `name${req.body.nameType}${encoded};`;
  }
  if (req.body.owner && req.body.owner.length > 0) {
    const encoded = encodeURIComponent(req.body.owner);
    url += `owner_name${req.body.ownerType}${encoded};`;
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

  // input is the search string from a user -- should be treated as a string literal, rather than
  // a regex with special characters.  This method escapes any characters which could be considered
  // special characters by the regex, like . and *
  function escapeRegexLiteral(input) {
    return input.replace(/[-[\]/{}()*+?.\\^$|]/g, '\\$&');
  }
  rawQueries.forEach((searchExpression) => {
    let field;
    let filter;
    let searchRegex;
    let expressionTerm;

    if (searchExpression.includes('=')) {
      [field, filter] = searchExpression.split('=');
      const escapedFilter = escapeRegexLiteral(filter);
      searchRegex = new RegExp(`^${escapedFilter}$`, 'i');
      expressionTerm = 'is exactly';
    } else if (searchExpression.includes('~')) {
      [field, filter] = searchExpression.split('~');
      searchRegex = new RegExp(escapeRegexLiteral(filter), 'i');
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
