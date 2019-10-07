var draft = JSON.parse(document.getElementById("draftraw").value);
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
}

$('#passpack').click(function(e) {
  passPack();
});

function arrayRotate(arr, reverse) {
  if (reverse) arr.unshift(arr.pop());
  else arr.push(arr.shift());
  return arr;
}

function botPicks() {
  //make bots take a pick out of active activepacks
  for (i = 1; i < draft.packs.length; i++) {
    var bot = draft.bots[i - 1];
    var taken = false;
    //bot has 2 colors, let's try to take a card with one of those colors or colorless, otherwise take a random card
    //try to take card with exactly our two colors
    var ratedpicks = [];
    var unratedpicks = [];
    for (var j = 0; j < draft.packs[i][0].length; j++) {
      if (draft.ratings[draft.packs[i][0][j].details.name]) {
        ratedpicks.push(j);
      } else {
        unratedpicks.push(j)
      }
    }

    ratedpicks.sort(function(x, y) {
      if (draft.ratings[draft.packs[i][0][x].details.name] < draft.ratings[draft.packs[i][0][y].details.name]) {
        return -1;
      }
      if (draft.ratings[draft.packs[i][0][x].details.name] > draft.ratings[draft.packs[i][0][y].details.name]) {
        return 1;
      }
      return 0;
    });
    shuffle(unratedpicks);
    var picknums = ratedpicks.concat(unratedpicks);
    //try to take card that contains one of our colors, or is colorless
    for (j = 0; j < draft.packs[i][0].length; j++) {
      if (!taken) {
        var colors = draft.packs[i][0][picknums[j]].colors;
        if ((colors.length == 2 && colors.includes(bot[0]) && colors.includes(bot[1])) ||
          (colors.length == 2 && (colors.includes(bot[0]) || colors.includes(bot[1]))) ||
          colors.length == 0) {
          pick = draft.packs[i][0].splice(picknums[j], 1);
          draft.picks[i].push(pick[0]);
          taken = true;
        }
      }
    }
    //take a random card
    if (!taken) {
      pick = draft.packs[i][0].splice(Math.floor(Math.random() * draft.packs[i][0].length), 1);
      draft.picks[i].push(pick[0]);
    }
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

function submitDraft() {
  saveDraft(function() {
    console.log('callback');
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
    console.log('pack is done');
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
      console.log('Draft is over!')
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
    x /= (cardWidth + 4);
    x = Math.floor(x);
  }
  if (x < 0) {
    x = 0;
  }
  if (x > (numCols / 2) - 1) {
    x = (numCols / 2) - 1;
  }
  if (cmccol) {
    if (!card.details.type.toLowerCase().includes('creature')) {
      x += (numCols / 2);
    }
  } else {
    if (y > rect.bottom - getRowHeight()) {
      x += (numCols / 2);
    }
  }
  if (!draft.picks[0][x]) {
    draft.picks[0][x] = [];
  }
  draft.picks[0][x].push(card);
  console.log(draft);
  if (frompack && $('#autopass').prop('checked')) {
    passPack();
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
  csrfFetch("/cube/api/draftpick/" + draft.cube, {
    method: "POST",
    body: JSON.stringify(temp),
    headers: {
      'Content-Type': 'application/json'
    }
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
    //fill upp pack
    var packhtml = "";
    draft.packs[0][0].forEach(function(card, index) {
      if (card.details.card_flip) {
        packhtml += '<a class="autocard" card="' + card.details.display_image + '" card_flip="' + card.details.image_flip + '" href="#"><img class="packcard" data-id="' + index + '" src="' + card.details.display_image + '" width="' + cardWidth + '" height="' + cardHeight + '"/></a>';
      } else {
        packhtml += '<a class="autocard" card="' + card.details.display_image + '" href="#"><img class="packcard" data-id="' + index + '" src="' + card.details.display_image + '" width="' + cardWidth + '" height="' + cardHeight + '"/></a>';
      }
    });
    $('#packarea').html(packhtml);
  }
  //fill up picks
  draft.picks[0].forEach(function(col, index) {
    var pickshtml = "";
    col.forEach(function(card, index2) {
      if (card.details.card_flip) {
        pickshtml += '<a style="z-index:' + index2 + '; position: relative; top:-' + 155 * (index2) + 'px;" class="autocard" card="' + card.details.display_image + '" card_flip="' + card.details.image_flip + '" href="#"><img class="pickscard" data-id="' + index2 + '" data-col="' + index + '" src="' + card.details.display_image + '" width="' + cardWidth + '" height="' + cardHeight + '"/></a>';
      } else {
        pickshtml += '<a style="z-index:' + index2 + '; position: relative; top:-' + 155 * (index2) + 'px;" class="autocard" card="' + card.details.display_image + '" href="#"><img class="pickscard" data-id="' + index2 + '" data-col="' + index + '" src="' + card.details.display_image + '" width="' + cardWidth + '" height="' + cardHeight + '"/></a>';
      }
    });
    $('#picksColumn' + index).html(pickshtml);
  });

  autocard_init('autocard');
  var elements = document.getElementsByClassName("packcard");
  for (i = 0; i < elements.length; i++) {
    setupDrag(elements[i], true);
  }
  elements = document.getElementsByClassName("pickscard");
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

function drawHover(e) {
  var elements = document.getElementsByClassName("card-hover");
  for (i = 0; i < elements.length; i++) {
    if (elementHovered(elements[i], e.clientX, e.clientY)) {
      elements[i].setAttribute('style', 'box-shadow: 0px 0px 15px 0px rgb(89, 155, 255);');
    } else {
      elements[i].setAttribute('style', '');
    }
  }
  elements = document.getElementsByClassName("pickscol");
  var found = false;
  for (i = 0; i < elements.length; i++) {
    if (elementHovered(elements[i], e.clientX, e.clientY)) {
      found = true;
      elements[i].setAttribute('style', 'box-shadow: 0px 0px 15px 0px rgb(89, 155, 255); height:' + (cardHeight + 20 * draft.picks[0][i].length) + 'px;');
    } else {
      elements[i].setAttribute('style', 'height:' + (cardHeight + 20 * draft.picks[0][i].length) + 'px;');
    }
  }
  if (!found && elementHovered(document.getElementById('pickshover'), e.clientX, e.clientY)) {
    var area = document.getElementById('picksarea');
    var rect = area.getBoundingClientRect();
    var x = e.clientX;
    x -= rect.left;
    x /= (cardWidth + 4);
    x = Math.floor(x);
    if (x < 0) {
      x = 0;
    }
    if (x > (numCols / 2) - 1) {
      x = (numCols / 2) - 1;
    }
    if (e.clientY > rect.bottom - getRowHeight()) {
      x += (numCols / 2);
    }
    document.getElementById('picksColumn' + x).setAttribute('style', 'box-shadow: 0px 0px 15px 0px rgb(89, 155, 255); height:' + (cardHeight + 20 * draft.picks[0][x].length) + 'px;');
  }
}

function removeHover() {
  var elements = document.getElementsByClassName("card-hover");
  for (i = 0; i < elements.length; i++) {
    elements[i].setAttribute('style', '')
  }
  elements = document.getElementsByClassName("pickscol");
  for (i = 0; i < elements.length; i++) {
    elements[i].setAttribute('style', 'height:' + (cardHeight + 20 * draft.picks[0][i].length) + 'px;');
  }
}

function setupPickColumns() {
  var area = document.getElementById('picksarea');
  var rect = area.getBoundingClientRect();
  numCols = Math.floor(rect.width / (cardWidth + 4)) * 2;

  var res = '<div class="row even-cols">';

  for (i = 0; i < numCols; i++) {
    if (!draft.picks[0][i]) {
      draft.picks[0][i] = [];
    }
    res += '<div style="height:' + (cardHeight + 20 * draft.picks[0][i].length) + 'px" id="picksColumn' + i + '" data-id="' + i + '" class="col-even pickscol"></div>'
  }
  res += '</div>';

  area.innerHTML = res;
}

// Make the DIV element draggable:
function setupDrag(elmnt, frompack) {
  var x = 0;
  var y = 0;
  var dist = 0;
  var finalx = 0;
  var finaly = 0;
  elmnt.onmousedown = dragMouseDown;

  function dragMouseDown(e) {
    stopAutocard = true;
    e = e || window.event;
    e.preventDefault();
    // get the mouse cursor position at startup:
    document.onmouseup = closeDragElement;
    // call a function whenever the cursor moves:
    document.onmousemove = elementDrag;

    x = e.clientX;
    y = e.clientY;
    finalx = e.clientX;
    finaly = e.clientY;

    //get card
    if (frompack) {
      dragCard = draft.packs[0][0].splice(e.target.getAttribute('data-id'), 1)[0];
    } else {
      dragCard = draft.picks[0][e.target.getAttribute('data-col')].splice(e.target.getAttribute('data-id'), 1)[0];
    }
    //set drag element's inner html
    dragElement.innerHTML = '<img src="' + dragCard.details.display_image + '" width="' + cardWidth + '" height="' + cardHeight + '"/></a>';
    dragElement.style.top = (e.clientY - cardHeight / 2 + self.pageYOffset) + "px";
    dragElement.style.left = (e.clientX - cardWidth / 2 + self.pageXOffset) + "px";
    autocard_hide_card();
    renderDraft();
    drawHover(e);
  }

  function elementDrag(e) {
    e = e || window.event;
    e.preventDefault();
    drawHover(e);
    //update vars
    finalx = e.clientX;
    finaly = e.clientY;
    // set the element's new position:
    dragElement.style.top = (e.clientY - cardHeight / 2 + self.pageYOffset) + "px";
    dragElement.style.left = (e.clientX - cardWidth / 2 + self.pageXOffset) + "px";
  }

  function closeDragElement() {
    stopAutocard = false;
    // stop moving when mouse button is released:
    document.onmouseup = null;
    document.onmousemove = null;
    dragElement.innerHTML = "";
    var dist = getDistance(x, y, finalx, finaly);
    if (dist < 5) {
      //move to other
      if (frompack) {
        addToPicks(dragCard, finalx, finaly, true, frompack);
      } else {
        addToPack(dragCard);
      }
    } else if (elementHovered(document.getElementById('packhover'), finalx, finaly)) {
      //move to pack
      addToPack(dragCard);
    } else if (elementHovered(document.getElementById('pickshover'), finalx, finaly)) {
      //move to picks
      addToPicks(dragCard, finalx, finaly, false, frompack);
    } else {
      //return to original
      if (!frompack) {
        addToPicks(dragCard, finalx, finaly, true, frompack);
      } else {
        addToPack(dragCard);
      }
    }

    removeHover();
    renderDraft();
  }
}

function elementHovered(element, x, y) {
  var rect = element.getBoundingClientRect();
  return x < rect.right && x > rect.left && y < rect.bottom && y > rect.top;
}

function getDistance(x1, y1, x2, y2) {
  var a = x1 - x2;
  var b = y1 - y2;
  return Math.sqrt(a * a + b * b);
}