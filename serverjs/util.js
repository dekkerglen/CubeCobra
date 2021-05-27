const shuffleSeed = require('shuffle-seed');
const { winston } = require('./cloudwatch');

function hasProfanity(text) {
  if (!text) return false;

  const Filter = require('bad-words');
  const filter = new Filter();
  const removeWords = ['hell', 'sadist', 'God'];
  filter.removeWords(...removeWords);

  return filter.isProfane(text.toLowerCase());
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
    cardID: cardDetails._id,
    type_line: cardDetails.type,
    addedTmsp: new Date(),
    finish: 'Non-foil',
  };
}

function addCardToCube(cube, cardDetails, tags) {
  if (cardDetails.error) {
    winston.error('Attempted to add invalid card to cube.');
    return;
  }

  const card = newCard(cardDetails, tags, cube.defaultStatus || 'Owned');
  cube.cards.push(card);
}

function fromEntries(entries) {
  const obj = {};
  for (const [k, v] of entries) {
    obj[k] = v;
  }
  return obj;
}

async function addNotification(user, from, url, text) {
  if (user.username === from.username) {
    return; // we don't need to give notifications to ourselves
  }

  user.notifications.push({
    user_from: from._id,
    user_from_name: from.username,
    url,
    date: new Date(),
    text,
  });
  user.old_notifications.push({
    user_from: from._id,
    user_from_name: from.username,
    url,
    date: new Date(),
    text,
  });
  while (user.old_notifications.length > 200) {
    user.old_notifications = user.old_notifications.slice(1);
  }
  await user.save();
}

async function addMultipleNotifications(users, from, url, text) {
  for await (const user of users) {
    await addNotification(user, from, url, text);
  }
}

function wrapAsyncApi(route) {
  return (req, res, next) => {
    try {
      return route(req, res, next);
    } catch (err) {
      req.logger.error(err);
      return res.status(500).send({
        success: 'false',
        message: 'Internal server error',
      });
    }
  };
}

function handleRouteError(req, res, err, reroute) {
  req.logger.error(err);
  req.flash('danger', err.message);
  res.redirect(reroute);
}

function toNonNullArray(arr) {
  if (!arr) return [];
  if (!Array.isArray(arr)) {
    if (typeof arr === 'object') {
      return Object.values(arr);
    }
    return [];
  }
  return arr;
}

function mapNonNull(arr, f) {
  return toNonNullArray(arr).map(f);
}

function flatten(arr, n) {
  if (n <= 1) return toNonNullArray(arr);
  return toNonNullArray([].concat(...mapNonNull(arr, (a) => flatten(a, n - 1))));
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
  addCardToCube,
  arraysEqual(a, b) {
    if (a === b) return true;
    if (a == null || b == null) return false;
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
    return user && user.roles.includes('Admin');
  },
  addNotification,
  addMultipleNotifications,
  wrapAsyncApi,
  handleRouteError,
  toNonNullArray,
  flatten,
  mapNonNull,
};
