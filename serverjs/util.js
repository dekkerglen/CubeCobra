const shuffleSeed = require('shuffle-seed');

const adminname = 'Dekkaru';

function has_profanity(text) {
  if (!text) return false;

  const Filter = require('bad-words');
  let filter = new Filter();
  let removeWords = ['hell', 'sadist', 'God'];
  filter.removeWords(...removeWords);

  return filter.isProfane(text.toLowerCase());
}

function generate_edit_token() {
  return (
    Math.random()
      .toString(36)
      .substring(2, 15) +
    Math.random()
      .toString(36)
      .substring(2, 15)
  );
}

function to_base_36(num) {
  return num.toString(36);
}

function from_base_36(str) {
  if (!str) return 0;
  return parseInt(str, 36);
}

function addWordToTree(obj, word) {
  if (word.length <= 0) {
    return;
  } else if (word.length == 1) {
    if (!obj[word.charAt(0)]) {
      obj[word.charAt(0)] = {
        $: {},
      };
    } else {
      obj[word.charAt(0)]['$'] = {};
    }
  } else {
    let character = word.charAt(0);
    word = word.substr(1, word.length);
    if (!obj[character]) {
      obj[character] = {};
    }
    addWordToTree(obj[character], word);
  }
}

function binaryInsert(value, array, startVal, endVal) {
  var length = array.length;
  var start = typeof startVal != 'undefined' ? startVal : 0;
  var end = typeof endVal != 'undefined' ? endVal : length - 1; //!! endVal could be 0 don't use || syntax
  var m = start + Math.floor((end - start) / 2);

  if (length == 0) {
    array.push(value);
    return;
  }

  if (value > array[end]) {
    array.splice(end + 1, 0, value);
    return;
  }

  if (value < array[start]) {
    //!!
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
    return;
  }
}

function newCard(card_details, tags) {
  return {
    tags: Array.isArray(tags) ? tags : [],
    status: 'Owned',
    colors: card_details.color_identity,
    cmc: card_details.cmc,
    cardID: card_details._id,
    type_line: card_details.type,
    addedTmsp: new Date(),
    finish: 'Non-foil',
  };
}

function addCardToCube(cube, card_details, tags) {
  const card = newCard(card_details, tags);
  card.status = cube.defaultStatus || 'Owned';
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
  if (user.username == from.username) {
    return; //we don't need to give notifications to ourselves
  }

  user.notifications.push({
    user_from: from._id,
    user_from_name: from.username,
    url: url,
    date: new Date(),
    text: text,
  });
  user.old_notifications.push({
    user_from: from._id,
    user_from_name: from.username,
    url: url,
    date: new Date(),
    text: text,
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
      req.logger.error(`Error handling ${req.path}.`, { error: err });
      res.status(500).send({
        success: 'false',
        message: 'Internal server error',
      });
    }
  };
}

function handleRouteError(req, res, err, reroute) {
  req.logger.error(`Error handling ${req.path}.`, { error: err });
  req.flash('danger', err.message);
  res.redirect(reroute);
}

var exports = {
  shuffle: function(array, seed) {
    if (!seed) {
      seed = Date.now();
    }
    return shuffleSeed.shuffle(array, seed);
  },
  turnToTree: function(arr) {
    var res = {};
    arr.forEach(function(item, index) {
      addWordToTree(res, item);
    });
    return res;
  },
  binaryInsert,
  newCard,
  addCardToCube,
  getCardImageURL,
  arraysEqual: function(a, b) {
    if (a === b) return true;
    if (a == null || b == null) return false;
    if (a.length != b.length) return false;

    for (var i = 0; i < a.length; ++i) {
      if (a[i] !== b[i]) return false;
    }
    return true;
  },
  CSVtoArray: function(text) {
    let ret = [''],
      i = 0,
      p = '',
      s = true;
    for (let l in text) {
      l = text[l];
      if ('"' === l) {
        s = !s;
        if ('"' === p) {
          ret[i] += '"';
          l = '-';
        } else if ('' === p) {
          l = '-';
        }
      } else if (s && ',' === l) {
        l = ret[++i] = '';
      } else {
        ret[i] += l;
      }
      p = l;
    }
    return ret;
  },
  generate_edit_token,
  to_base_36,
  from_base_36,
  has_profanity,
  fromEntries,
  isAdmin: function(user) {
    return user && user.username == adminname;
  },
  addNotification,
  wrapAsyncApi,
  handleRouteError,
};

module.exports = exports;
