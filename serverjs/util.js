const shuffleSeed = require('shuffle-seed');
const winston = require('winston');

const adminname = 'Dekkaru';

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
  return (
    Math.random()
      .toString(36)
      .substring(2, 15) +
    Math.random()
      .toString(36)
      .substring(2, 15)
  );
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

function getCardImageURL(card) {
  return card.imgUrl || card.details.image_normal;
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

function wrapAsyncApi(route) {
  return (req, res, next) => {
    try {
      return route(req, res, next);
    } catch (err) {
      req.logger.error(null, { error: err });
      return res.status(500).send({
        success: 'false',
        message: 'Internal server error',
      });
    }
  };
}

function handleRouteError(req, res, err, reroute) {
  req.logger.error(null, { error: err });
  req.flash('danger', err.message);
  res.redirect(reroute);
}

const toExport = {
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
  getCardImageURL,
  arraysEqual(a, b) {
    if (a === b) return true;
    if (a == null || b == null) return false;
    if (a.length !== b.length) return false;

    for (let i = 0; i < a.length; ++i) {
      if (a[i] !== b[i]) return false;
    }
    return true;
  },
  CSVtoArray(text) {
    const ret = [''];
    let i = 0;
    let p = '';
    let s = true;
    for (let character of text) {
      if (character === '"') {
        s = !s;
        if (p === '"') {
          ret[i] += '"';
          character = '-';
        } else if (p === '') {
          character = '-';
        }
      } else if (s && character === ',') {
        // not sure what's going on here...
        // eslint-disable-next-line
        character = ret[++i] = '';
      } else {
        ret[i] += character;
      }
      p = character;
    }
    return ret;
  },
  generateEditToken,
  toBase36,
  fromBase36,
  hasProfanity,
  fromEntries,
  isAdmin(user) {
    return user && user.username === adminname;
  },
  addNotification,
  wrapAsyncApi,
  handleRouteError,
};

module.exports = toExport;
