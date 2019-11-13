const shuffleSeed = require('shuffle-seed');

const adminname = 'Dekkaru';

function has_profanity(text) {
  if (!text) return false;

  const Filter = require('bad-words');
  let filter = new Filter();
  let removeWords = [
    'hell',
    'sadist',
    'God',
  ];
  filter.removeWords(...removeWords);

  return filter.isProfane(text.toLowerCase());
}

function generate_edit_token() {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
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
        '$': {}
      };
    } else {
      obj[word.charAt(0)]['$'] = {};
    }
  } else {
    character = word.charAt(0);
    word = word.substr(1, word.length)
    if (!obj[character]) {
      obj[character] = {};
    }
    addWordToTree(obj[character], word)
  }
}

function binaryInsert(value, array, startVal, endVal) {
  var length = array.length;
  var start = typeof(startVal) != 'undefined' ? startVal : 0;
  var end = typeof(endVal) != 'undefined' ? endVal : length - 1; //!! endVal could be 0 don't use || syntax
  var m = start + Math.floor((end - start) / 2);

  if (length == 0) {
    array.push(value);
    return;
  }

  if (value > array[end]) {
    array.splice(end + 1, 0, value);
    return;
  }

  if (value < array[start]) { //!!
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

function addCardToCube(cube, card_details, idOverride, addedTmspOverride) {
  cube.cards.push({
    tags: ['New'],
    status: "Not Owned",
    colors: card_details.color_identity,
    cmc: card_details.cmc,
    cardID: idOverride === undefined ? card_details._id : idOverride,
    type_line: card_details.type,
    addedTmsp: addedTmspOverride === undefined ? new Date() : addedTmspOverride,
    imgUrl: undefined
  });
}

function getCardImageURL(card) {
  return card.imgUrl !== undefined ? card.imgUrl : card.details.image_normal;
}

function fromEntries(entries) {
  const obj = {};
  for (const [k, v] of entries) {
    obj[k] = v;
  }
  return obj;
}

async function addNotification(user, from, url, text) {
  if (user._id == from._id) {
    return; //we don't need to give notifications to ourselves
  }
  user.notifications.push({
    user_from: from._id,
    user_from_name: from.username,
    url: url,
    date: new Date(),
    text: text
  });
  user.old_notifications.push({
    user_from: from._id,
    user_from_name: from.username,
    url: url,
    date: new Date(),
    text: text
  });
  if(user.old_notifications.length > 200)
  {
    user.old_notifications = user.old_notifications.slice(1);
  }
  await user.save();
}


var methods = {
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
  addNotification
}

module.exports = methods;