const shuffleSeed = require('shuffle-seed');
const Notification = require('../dynamo/models/notification');
const cardutil = require('../dist/utils/Card');
const { redirect } = require('./render');
const carddb = require('./carddb');

function hasProfanity(text) {
  if (!text) return false;

  const Filter = require('bad-words');
  const filter = new Filter();
  const removeWords = ['hell', 'sadist', 'God'];
  filter.removeWords(...removeWords);
  const addWords = [
    'dhabi',
    'dubai',
    'persian',
    'escort',
    'call girl',
    'scandal',
    'onlyfans',
    'leaked',
    'pdf',
    'download',
    'xbox',
    'gift card',
    'vbucks',
    'v-bucks',
    'streaming',
    'bitcoin',
    'cryptocurrency',
    'crypto',
    'nft',
    'coinbase',
    'ozempic',
    'xanax',
    'viagra',
    'tramadol',
    'adderall',
    'percocet',
    'oxycontin',
    'vicodin',
    'hydrocodone',
    'codeine',
    'morphine',
    'fentanyl',
    'ambien',
    'valium',
    'ativan',
    'dilaudid',
    'alprazolam',
    'meridia',
    'phentermine',
    'fioricet',
    'google play',
    'coin master',
    'robux',
    'roblox',
    'monopoly go',
    'monopoly-go',
    'fullmovie',
    'ultimate guide',
    'v bucks',
    'nude',
    'deepnude',
    'undress',
    'deepfake',    
  ];
  filter.addWords(...addWords);

  return filter.isProfane(text.toLowerCase());
}

function validateEmail(email) {
  if (email.includes('+')) {
    throw new Error('CubeCobra does not support plus email addressing, please remove the "+descriptor" from your email and try again.');
  }

  const bannedDomains = [
    'evusd.com',
    'yomail.edu.pl',
    'munik.edu.pl',
    'thetechnext.net',
    'mailmagnet.co',
    'cctoolz.com',
    'chosenx.com',
    'mowline.com',
    'greatphone.co.uk',
    'azuretechtalk.net',
    'kisoq.com',
    'myfxspot.com',
    'teleg.eu',
    'ronete.com',
    'rabitex.com',
    'polkaroad.net',
    'kelenson.com',
    'owube.com',
    'jxpomup.com',
    'datquynhon.net',
    'finestudio.org',
    'myfxspot.com',
    'inboxorigin.com',
    'allfreemail.net',
    'gufum.com',
    'surveyees.com',
    'rabitex.com',
    'horizonspost.com',
    'moonapps.org',
    'freesourcecodes.com',
    'fast.edu.pl',
    'ronete.com',
    'wanadoo.fr',
    'astmemail.com',
    'wmail.cam',
    'crowfiles.shop',
    'reduceness.com',
    'web.de',
    'adminzoom.com',
    'starmail.net',
    'diginey.com',
    'somelora.com',
    'qacmjeq.com',
    'qejjyl.com',
    'jxpomup.com',
    'zlorkun.com',
    'gufum.com'
  ]

  const domain = email.split('@')[1];

  if (bannedDomains.includes(domain)) {
    throw new Error('CubeCobra does not support email addresses from this domain, please use a different email address.');
  }

  return true;
}

function generateEditToken() {
  // Not sure if this function is actually used anywhere.
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

function toBase36(num) {
  return num.toString(36);
}

function fromBase36(str) {
  if (!str) return 0;
  return parseInt(str, 36);
}

function addWordToTree(obj, word) {
  if (word.length <= 0) {
    return;
  }
  if (word.length === 1) {
    if (!obj[word.charAt(0)]) {
      obj[word.charAt(0)] = {
        $: {},
      };
    } else {
      obj[word.charAt(0)].$ = {};
    }
  } else {
    const character = word.charAt(0);
    word = word.substr(1, word.length);
    if (!obj[character]) {
      obj[character] = {};
    }
    addWordToTree(obj[character], word);
  }
}

function binaryInsert(value, array, startVal, endVal) {
  const { length } = array;
  const start = typeof startVal !== 'undefined' ? startVal : 0;
  const end = typeof endVal !== 'undefined' ? endVal : length - 1; //! ! endVal could be 0 don't use || syntax
  const m = start + Math.floor((end - start) / 2);

  if (length === 0) {
    array.push(value);
    return;
  }

  if (value > array[end]) {
    array.splice(end + 1, 0, value);
    return;
  }

  if (value < array[start]) {
    array.splice(start, 0, value);
    return;
  }

  if (start >= end) {
    return;
  }

  if (value < array[m]) {
    binaryInsert(value, array, start, m - 1);
    return;
  }

  if (value > array[m]) {
    binaryInsert(value, array, m + 1, end);
  }
}

function newCard(cardDetails, tags, defaultStatus = 'Owned') {
  return {
    tags: Array.isArray(tags) ? tags : [],
    status: defaultStatus,
    colors: cardDetails.color_identity,
    cmc: cardDetails.cmc,
    cardID: cardDetails.scryfall_id,
    type_line: cardDetails.type,
    addedTmsp: new Date(),
    finish: 'Non-foil',
  };
}

function addCardToBoard(board, cube, cardDetails, tags) {
  if (cardDetails.error) {
    return;
  }

  const card = newCard(cardDetails, tags, cube.defaultStatus || 'Owned');
  board.push(card);
}

function fromEntries(entries) {
  const obj = {};
  for (const [k, v] of entries) {
    obj[k] = v;
  }
  return obj;
}

async function addNotification(to, from, url, text) {
  if (to.username === from.username) {
    return; // we don't need to give notifications to ourselves
  }

  await Notification.put({
    date: new Date().valueOf(),
    to: `${to.id}`,
    from: `${from.id}`,
    fromUsername: from.username,
    url,
    body: text,
  });
}

function wrapAsyncApi(route) {
  return (req, res, next) => {
    try {
      return route(req, res, next);
    } catch (err) {
      req.logger.error(err.message, err.stack);
      return res.status(500).send({
        success: 'false',
        message: 'Internal server error',
      });
    }
  };
}

function handleRouteError(req, res, err, reroute) {
  req.logger.error(err.message, err.stack);
  req.flash('danger', err.message);
  redirect(req, res, reroute);
}

function toNonNullArray(arr) {
  if (!arr) return [];
  if (!Array.isArray(arr)) return typeof arr === 'object' ? Object.values(arr) : [];
  return arr;
}

function mapNonNull(arr, f) {
  return toNonNullArray(arr).map(f);
}

function flatten(arr, n) {
  if (n <= 1) return toNonNullArray(arr);
  return toNonNullArray([].concat(...mapNonNull(arr, (a) => flatten(a, n - 1))));
}

// uri
// artist
// id
function getImageData(imagename) {
  const exact = carddb.imagedict[imagename.toLowerCase()];

  if (exact) {
    return exact;
  }

  const name = cardutil.normalizeName(imagename);
  const ids = carddb.nameToId[name];
  if (ids) {
    const byName = carddb.cardFromId(ids[0]);
    if (byName.scryfall_id) {
      return {
        uri: byName.art_crop,
        artist: byName.artist,
        id: byName.scryfall_id,
        imageName: imagename,
      };
    }
  }

  return carddb.imagedict['doubling cube [10e-321]'];
}

module.exports = {
  shuffle(array, seed) {
    if (!seed) {
      seed = Date.now();
    }
    return shuffleSeed.shuffle(array, seed);
  },
  turnToTree(arr) {
    const res = {};
    arr.forEach((item) => {
      addWordToTree(res, item);
    });
    return res;
  },
  binaryInsert,
  newCard,
  addCardToCube: addCardToBoard,
  arraysEqual(a, b) {
    if (a === b) return true;
    if (a === null || b === null) return false;
    if (a.length !== b.length) return false;

    for (let i = 0; i < a.length; ++i) {
      if (a[i] !== b[i]) return false;
    }
    return true;
  },
  generateEditToken,
  toBase36,
  fromBase36,
  hasProfanity,
  fromEntries,
  isAdmin(user) {
    return user && user.roles && user.roles.includes('Admin');
  },
  addNotification,
  wrapAsyncApi,
  handleRouteError,
  toNonNullArray,
  flatten,
  mapNonNull,
  getImageData,
  validateEmail
};
