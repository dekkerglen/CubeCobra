var draft = JSON.parse(document.getElementById('draftraw').value);
if (draft.ratings === undefined) draft.ratings = {};

var dragElement = document.getElementById('dragelement');
var dragCard = null;

var cardWidth = 125;
var cardHeight = 175;
var numCols = 0;
var stopAutocard = false;

var prev_handler = window.onload;

window.onload = function() {
  if (prev_handler) {
    prev_handler();
  }
  renderDraft();
};

window.onresize = function() {
  renderDraft();
};

var hasCustomImages = false;
$('#customImageDisplayMenuItem').hide();
draft.packs.forEach(function(pack, index) {
  pack.forEach(function(inner, index) {
    inner.forEach(function(card, index) {
      if (!hasCustomImages && card.imgUrl !== undefined) {
        hasCustomImages = true;
        $('#customImageDisplayToggle').prop('checked', true);
        $('#customImageDisplayMenuItem').show();
      }
    });
  });
});

$('#passpack').click(function(e) {
  passPack();
});

$('#customImageDisplayToggle').click(function(e) {
  var enabled = $(this).prop('checked'),
    display_image;
  draft.packs.forEach(function(pack, index) {
    pack.forEach(function(inner, index) {
      inner.forEach(function(card, index) {
        adjustDisplayImage(card, enabled);
      });
    });
  });
  draft.picks[0].forEach(function(slot, index) {
    slot.forEach(function(card, index) {
      adjustDisplayImage(card, enabled);
    });
  });
  renderDraft();
});

function arrayRotate(arr, reverse) {
  if (reverse) arr.unshift(arr.pop());
  else arr.push(arr.shift());
  return arr;
}

<<<<<<< HEAD
function botPicks(draft) {
  //make bots take a pick out of active activepacks
  for (i = 1; i < draft.packs.length; i++) {
    const bot = draft.bots[i - 1];
    const pack = draft.packs[i][0];
    const picks = draft.picks[i];
    let taken = false;
    //bot has 2 colors, let's try to take a card with one of those colors or colorless, otherwise take a random card
    //try to take card with exactly our two colors
    const ratedPicks = [];
    const unratedPicks = [];
    for (const [index, card] of draft.packs[i][0]) {
      if (draft.ratings[card.details.name]) {
        ratedPicks.push([index, card]);
      } else {
        unratedPicks.push([index, card])
      }
    }

    ratedPicks.sort(([i, x], [j, y]) => draft.ratings[x.details.name] - draft.ratings[y.details.name]);
    shuffle(unratedPicks);
    var allPicks = [...ratedPicks, ...unratedPicks];
    // try to take card that contains exactly <= our colors
    for (const [index, card] of allPicks) {
      if (!taken) {
        const colors = card.colors;
        if (bot[0] == bot[1]) {
          if ((colors.length == 1 && colors.includes(bot[0])) ||
            colors.length == 0) {
            const [pick] = pack.splice(index, 1);
            picks.push(pick.cardID);
            taken = true;
          }
        } else {
          if ((colors.length == 2 && colors.includes(bot[0]) && colors.includes(bot[1])) ||
            (colors.length == 1 && (colors.includes(bot[0]) || colors.includes(bot[1]))) ||
            colors.length == 0) {
            const [pick] = pack.splice(index, 1);
            picks.push(pick.cardID);
            taken = true;
          }
        }
      }
    }
    //try to take card that at least has one of our colors
    for (const [index, card] of allPicks) {
      if (!taken) {
        const colors = card.colors;
        if (colors.includes(bot[0]) || colors.includes(bot[1])) {
          const [pick] = pack.splice(index, 1);
          picks.push(pick.cardID);
          taken = true;
        }
      }
    }
    //take a random card
    if (!taken) {
      const [pick] = pack.splice(Math.floor(Math.random() * pack.length), 1);
      picks.push(pick.cardID);
    }
  }
}

=======
function arrayIsSubset(needles, haystack) {
  return needles.every((x) => haystack.includes(x));
}

const fetchLands = [
  'Arid Mesa',
  'Bloodstained Mire',
  'Flooded Strand',
  'Marsh Flats',
  'Misty Rainforest',
  'Polluted Delta',
  'Scalding Tarn',
  'Verdant Catacombs',
  'Windswept Heath',
  'Wooded Foothills',
];

function botRating(botColors, card) {
  let rating = draft.ratings[card.details.name];
  const colors = card.colors || card.details.color_identity;
  const subset = arrayIsSubset(colors, botColors);
  const overlap = botColors.some((c) => colors.includes(c));
  const typeLine = card.type_line || card.details.type;
  const isLand = typeLine.indexOf('Land') > -1;
  const isFetch = fetchLands.includes(card.details.name);

  // Prioritize on-color or overlapping fetches.
  // Then overlapping lands, then overlapping spells.
  if (subset || (isFetch && overlap)) {
    rating -= 0.4;
  } else if (isLand && overlap) {
    rating -= 0.3;
  } else if (overlap) {
    rating -= 0.2;
  }
  return rating;
}

function botPicks() {
  // make bots take one pick out of active packs
  for (botIndex = 1; botIndex < draft.packs.length; botIndex++) {
    const pack = draft.packs[botIndex][0];
    const botColors = draft.bots[botIndex - 1];
    const ratedPicks = [];
    const unratedPicks = [];
    for (let cardIndex = 0; cardIndex < pack.length; cardIndex++) {
      if (draft.ratings[pack[cardIndex].details.name]) {
        ratedPicks.push(cardIndex);
      } else {
        unratedPicks.push(cardIndex);
      }
    }

    ratedPicks.sort((x, y) => {
      return botRating(botColors, pack[x]) - botRating(botColors, pack[y]);
    });
    shuffle(unratedPicks);

    const pickOrder = ratedPicks.concat(unratedPicks);
    pick = pack.splice(pickOrder[0], 1);
    draft.picks[botIndex].push(pick[0].cardID);
  }
}

var shuffle = function(array) {
  var currentIndex = array.length;
  var temporaryValue, randomIndex;

  // While there remain elements to shuffle...
  while (0 !== currentIndex) {
    // Pick a remaining element...
    randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex -= 1;

    // And swap it with the current element.
    temporaryValue = array[currentIndex];
    array[currentIndex] = array[randomIndex];
    array[randomIndex] = temporaryValue;
  }

  return array;
};

>>>>>>> master
function submitDraft() {
  saveDraft(function() {
    $('#submitDeckHidden').val(draft._id);
    $('#submitDeckForm').submit();
  });
}

function passPack() {
  draft.pickNumber += 1;
  botPicks();
  //check if pack is done
  var done = true;
  for (i = 0; i < draft.packs.length; i++) {
    if (draft.packs[i][0].length > 0) {
      done = false;
    }
  }
  if (done) {
    draft.packNumber += 1;
    draft.pickNumber = 1;
    //splice the first pack out
    for (i = 0; i < draft.packs.length; i++) {
      draft.packs[i].splice(0, 1);
    }
    //check if draft is done
    done = true;
    for (i = 0; i < draft.packs.length; i++) {
      if (draft.packs[i].length > 0) {
        done = false;
      }
    }
    if (done) {
      renderDraft();
      submitDraft();
    } else {
      saveDraft();
      renderDraft();
    }
  } else {
    if (draft.packs[0].length % 2 == 0) {
      //pass left
      arrayRotate(draft.packs, false);
    } else {
      //pass right
      arrayRotate(draft.packs, true);
    }
    saveDraft();
    renderDraft();
  }
}

function addToPack(card) {
  draft.packs[0][0].push(card);
}

function addToPicks(card, x, y, cmccol, frompack) {
  var area = document.getElementById('picksarea');
  var rect = area.getBoundingClientRect();
  if (cmccol) {
    x = card.details.cmc;
  } else {
    x -= rect.left;
    x /= cardWidth + 4;
    x = Math.floor(x);
  }
  if (x < 0) {
    x = 0;
  }
  if (x > numCols / 2 - 1) {
    x = numCols / 2 - 1;
  }
  if (cmccol) {
    if (!card.details.type.toLowerCase().includes('creature')) {
      x += numCols / 2;
    }
  } else {
    if (y > rect.bottom - getRowHeight()) {
      x += numCols / 2;
    }
  }
  if (!draft.picks[0][x]) {
    draft.picks[0][x] = [];
  }
  draft.picks[0][x].push(card);
  draft.pickOrder.push(card.cardID);
  if (frompack) {
    passPack();
    csrfFetch('/cube/api/draftpickcard/' + draft.cube, {
      method: 'POST',
      body: JSON.stringify({
        draft_id: draft._id,
        card,
      }),
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }
}

function saveDraft(callback) {
  var temp = JSON.parse(JSON.stringify(draft));
  temp.packs.forEach(function(seat, index) {
    seat.forEach(function(pack, index2) {
      pack.forEach(function(card, index3) {
        delete card.details;
      });
    });
  });
  temp.picks.forEach(function(card, index) {
    if (Array.isArray(card)) {
      card.forEach(function(item, index2) {
        if (item) {
          delete item.details;
        }
      });
    } else {
      delete card.details;
    }
  });
  //save draft, if we fail, we fail
  csrfFetch('/cube/api/draftpick/' + draft.cube, {
    method: 'POST',
    body: JSON.stringify(temp),
    headers: {
      'Content-Type': 'application/json',
    },
  }).then(function() {
    if (callback) {
      callback();
    }
  });
}

function renderDraft() {
  if (draft.packs[0].length > 0) {
    $('#packTitle').text('Pack ' + draft.packNumber + ', Pick ' + draft.pickNumber);
    $('#packSubtitle').text(draft.packs[0].length - 1 + ' unopened packs left');
    setupPickColumns();

    //move cards over if they don't fit into columns
    for (var i = numCols; i < draft.picks[0].length; i++) {
      draft.picks[0][numCols - 1] = draft.picks[0][numCols - 1].concat(
        draft.picks[0][i].splice(0, draft.picks[0][i].length),
      );
    }

    //fill upp pack
    var packhtml = '';
    draft.packs[0][0].forEach(function(card, index) {
      if (card.details.card_flip) {
        packhtml +=
          '<a class="autocard" card="' +
          card.details.display_image +
          '" card_flip="' +
          card.details.image_flip +
          '" href="#"><img class="packcard defaultCardImage" data-id="' +
          index +
          '" src="' +
          card.details.display_image +
          '" width="' +
          cardWidth +
          '" height="' +
          cardHeight +
          '"/></a>';
      } else {
        packhtml +=
          '<a class="autocard" card="' +
          card.details.display_image +
          '" href="#"><img class="packcard defaultCardImage" data-id="' +
          index +
          '" src="' +
          card.details.display_image +
          '" width="' +
          cardWidth +
          '" height="' +
          cardHeight +
          '"/></a>';
      }
    });
    $('#packarea').html(packhtml);
  }
  //fill up picks
  draft.picks[0].forEach(function(col, index) {
    var pickshtml = '';
    col.forEach(function(card, index2) {
      if (card.details.card_flip) {
        pickshtml +=
          '<a style="z-index:' +
          index2 +
          '; position: relative; top:-' +
          155 * index2 +
          'px;" class="autocard" card="' +
          card.details.display_image +
          '" card_flip="' +
          card.details.image_flip +
          '" href="#"><img class="pickscard defaultCardImage" data-id="' +
          index2 +
          '" data-col="' +
          index +
          '" src="' +
          card.details.display_image +
          '" width="' +
          cardWidth +
          '" height="' +
          cardHeight +
          '"/></a>';
      } else {
        pickshtml +=
          '<a style="z-index:' +
          index2 +
          '; position: relative; top:-' +
          155 * index2 +
          'px;" class="autocard" card="' +
          card.details.display_image +
          '" href="#"><img class="pickscard defaultCardImage" data-id="' +
          index2 +
          '" data-col="' +
          index +
          '" src="' +
          card.details.display_image +
          '" width="' +
          cardWidth +
          '" height="' +
          cardHeight +
          '"/></a>';
      }
    });
    $('#picksColumn' + index).html(pickshtml);
  });

  autocard_init('autocard');
  var elements = document.getElementsByClassName('packcard');
  for (i = 0; i < elements.length; i++) {
    setupDrag(elements[i], true);
  }
  elements = document.getElementsByClassName('pickscard');
  for (i = 0; i < elements.length; i++) {
    setupDrag(elements[i], false);
  }
}

function getRowHeight() {
  var max = 0;
  for (i = numCols / 2; i < numCols; i++) {
    if (draft.picks[0][i].length > max) {
      max = draft.picks[0][i].length;
    }
  }
  return cardHeight + 20 * max;
}

function setupPickColumns() {
  var area = document.getElementById('picksarea');
  var rect = area.getBoundingClientRect();
  numCols = Math.floor((rect.width + 40) / (cardWidth + 4)) * 2;

  var res = '<div class="row even-cols">';

  for (i = 0; i < numCols; i++) {
    if (!draft.picks[0][i]) {
      draft.picks[0][i] = [];
    }
    res +=
      '<div style="height:' +
      (cardHeight + 20 * draft.picks[0][i].length) +
      'px" id="picksColumn' +
      i +
      '" data-id="' +
      i +
      '" class="col-even pickscol"></div>';
  }
  res += '</div>';

  area.innerHTML = res;
}
