var deck = JSON.parse(document.getElementById('deckraw').value);
var basics = JSON.parse(document.getElementById('basicsraw').value);
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
deck.playerdeck.forEach(function(inner, index) {
  inner.forEach(function(card, index) {
    if (!hasCustomImages && card.imgUrl !== undefined) {
      hasCustomImages = true;
      $('#customImageDisplayToggle').prop('checked', true);
      $('#customImageDisplayMenuItem').show();
    }
  });
});

$('#addBasicsButton').click(function(e) {
  addCards(basics.Plains, $('#basicsWhite').val());
  addCards(basics.Island, $('#basicsBlue').val());
  addCards(basics.Mountain, $('#basicsRed').val());
  addCards(basics.Swamp, $('#basicsBlack').val());
  addCards(basics.Forest, $('#basicsGreen').val());

  renderDraft();

  $('#basicsWhite').val(0);
  $('#basicsBlue').val(0);
  $('#basicsRed').val(0);
  $('#basicsBlack').val(0);
  $('#basicsGreen').val(0);

  $('#basicsModal').modal('hide');
});

$('#saveDeckButton').click(function(e) {
  $('#deckraw').val(JSON.stringify(deck));
  $('#submitDeckForm').submit();
});

$('#customImageDisplayToggle').click(function(e) {
  var enabled = $(this).prop('checked'),
    display_image;
  deck.playerdeck.forEach(function(inner, index) {
    inner.forEach(function(card, index) {
      adjustDisplayImage(card, enabled);
    });
  });
  renderDraft();
});

function addCards(card, amount) {
  for (var i = 0; i < amount; i++) {
    deck.playerdeck[0].push(card);
  }
}

function addToSideboard(card, x, y, cmccol) {
  var area = document.getElementById('sideboardarea');
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
    if (y > rect.bottom - getSideboardRowHeight()) {
      x += numCols / 2;
    }
  }
  if (!deck.playersideboard[x]) {
    deck.playersideboard[x] = [];
  }
  deck.playersideboard[x].push(card);
}

function addToDeck(card, x, y, cmccol) {
  var area = document.getElementById('deckarea');
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
    if (y > rect.bottom - getDeckRowHeight()) {
      x += numCols / 2;
    }
  }
  if (!deck.playerdeck[x]) {
    deck.playerdeck[x] = [];
  }
  deck.playerdeck[x].push(card);
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
  setupColumns();

  //move cards over if they don't fit into columns
  for (var i = numCols; i < deck.playerdeck.length; i++) {
    deck.playerdeck[numCols - 1] = deck.playerdeck[numCols - 1].concat(
      deck.playerdeck[i].splice(0, deck.playerdeck[i].length),
    );
  }

  var lands = 0;
  var cards = 0;
  var creatures = 0;
  //fill up deck
  deck.playerdeck.forEach(function(col, index) {
    col.forEach(function(card, index2) {
      cards++;
      if (card.details.type.toLowerCase().includes('land')) {
        lands++;
      }
      if (card.details.type.toLowerCase().includes('creature')) {
        creatures++;
      }
    });

    $('#deckColumn' + index).html(getCardColumnHtml(col, index));
  });
  $('#deckName').text('Deck (' + cards + ' cards, ' + lands + ' lands, ' + creatures + ' creatures)');
  //fill up sideboard
  deck.playersideboard.forEach(function(col, index) {
    $('#sideboardColumn' + index).html(getCardColumnHtml(col, index, true));
  });

  autocard_init('autocard');
  var elements = document.getElementsByClassName('sideboardcard');
  for (i = 0; i < elements.length; i++) {
    setupDrag(elements[i], false);
  }
  elements = document.getElementsByClassName('deckcard');
  for (i = 0; i < elements.length; i++) {
    setupDrag(elements[i], true);
  }
}

function getDeckRowHeight() {
  var max = 0;
  for (i = numCols / 2; i < numCols; i++) {
    if (deck.playerdeck[i].length > max) {
      max = deck.playerdeck[i].length;
    }
  }
  return cardHeight + 20 * max;
}

function getSideboardRowHeight() {
  var max = 0;
  for (i = numCols / 2; i < numCols; i++) {
    if (deck.playersideboard[i].length > max) {
      max = deck.playersideboard[i].length;
    }
  }
  return cardHeight + 20 * max;
}

function drawHover(e) {
  var elements = document.getElementsByClassName('card-hover');
  for (i = 0; i < elements.length; i++) {
    if (elementHovered(elements[i], e.clientX, e.clientY)) {
      elements[i].setAttribute('style', 'box-shadow: 0px 0px 15px 0px rgb(89, 155, 255);');
    } else {
      elements[i].setAttribute('style', '');
    }
  }

  //for sideboard
  elements = document.getElementsByClassName('sideboardcol');
  var found = false;
  for (i = 0; i < elements.length; i++) {
    if (elementHovered(elements[i], e.clientX, e.clientY)) {
      found = true;
      elements[i].setAttribute(
        'style',
        'box-shadow: 0px 0px 15px 0px rgb(89, 155, 255); height:' +
          (cardHeight + 20 * deck.playersideboard[i].length) +
          'px;',
      );
    } else {
      elements[i].setAttribute('style', 'height:' + (cardHeight + 20 * deck.playersideboard[i].length) + 'px;');
    }
  }
  if (!found && elementHovered(document.getElementById('sideboardhover'), e.clientX, e.clientY)) {
    var area = document.getElementById('sideboardarea');
    var rect = area.getBoundingClientRect();
    var x = e.clientX;
    x -= rect.left;
    x /= cardWidth + 4;
    x = Math.floor(x);
    if (x < 0) {
      x = 0;
    }
    if (x > numCols / 2 - 1) {
      x = numCols / 2 - 1;
    }
    if (e.clientY > rect.bottom - getSideboardRowHeight()) {
      x += numCols / 2;
    }
    document
      .getElementById('sideboardColumn' + x)
      .setAttribute(
        'style',
        'box-shadow: 0px 0px 15px 0px rgb(89, 155, 255); height:' +
          (cardHeight + 20 * deck.playersideboard[x].length) +
          'px;',
      );
  }

  //for deck
  elements = document.getElementsByClassName('deckcol');
  var found = false;
  for (i = 0; i < elements.length; i++) {
    if (elementHovered(elements[i], e.clientX, e.clientY)) {
      found = true;
      elements[i].setAttribute(
        'style',
        'box-shadow: 0px 0px 15px 0px rgb(89, 155, 255); height:' +
          (cardHeight + 20 * deck.playerdeck[i].length) +
          'px;',
      );
    } else {
      elements[i].setAttribute('style', 'height:' + (cardHeight + 20 * deck.playerdeck[i].length) + 'px;');
    }
  }
  if (!found && elementHovered(document.getElementById('deckhover'), e.clientX, e.clientY)) {
    var area = document.getElementById('deckarea');
    var rect = area.getBoundingClientRect();
    var x = e.clientX;
    x -= rect.left;
    x /= cardWidth + 4;
    x = Math.floor(x);
    if (x < 0) {
      x = 0;
    }
    if (x > numCols / 2 - 1) {
      x = numCols / 2 - 1;
    }
    if (e.clientY > rect.bottom - getDeckRowHeight()) {
      x += numCols / 2;
    }
    document
      .getElementById('deckColumn' + x)
      .setAttribute(
        'style',
        'box-shadow: 0px 0px 15px 0px rgb(89, 155, 255); height:' +
          (cardHeight + 20 * deck.playerdeck[x].length) +
          'px;',
      );
  }
}

function getCardColumnHtml(col, index, isSideboard = false) {
  var colhtml = '';
  var imageClass = '';

  if (isSideboard) {
    imageClass = 'sideboardcard';
  } else {
    imageClass = 'deckcard defaultCardImage';
  }

  col.forEach(function(card, index2) {
    colhtml +=
      '<a style="z-index:' +
      index2 +
      '; position: relative; top:-' +
      155 * index2 +
      'px;" class="autocard" card="' +
      card.details.display_image;
    if (card.details.card_flip) {
      colhtml += '" card_flip="' + card.details.image_flip;
    }
    colhtml +=
      '" href="#"><img class="' +
      imageClass +
      '" data-id="' +
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
  });

  if (col.length > 0) {
    colhtml = '<p style=text-align:center;margin:0>' + col.length.toString() + '</p>' + colhtml;
  }
  return colhtml;
}

function removeHover() {
  ['card-hover', 'deckcol', 'sideboardcol'].forEach(function(label, index) {
    var elements = document.getElementsByClassName(label);
    for (i = 0; i < elements.length; i++) {
      elements[i].setAttribute('style', '');
    }
  });
}

function setupColumns() {
  var area = document.getElementById('deckarea');
  var rect = area.getBoundingClientRect();
  numCols = Math.floor((rect.width + 40) / (cardWidth + 4)) * 2;

  var deckhtml = '<div class="row even-cols">';
  var sideboardhtml = '<div class="row even-cols">';

  for (i = 0; i < numCols; i++) {
    if (!deck.playerdeck[i]) {
      deck.playerdeck[i] = [];
    }
    deckhtml +=
      '<div style="height:' +
      (cardHeight + 20 * deck.playerdeck[i].length) +
      'px" id="deckColumn' +
      i +
      '" data-id="' +
      i +
      '" class="col-even deckcol"></div>';
    if (!deck.playersideboard[i]) {
      deck.playersideboard[i] = [];
    }
    sideboardhtml +=
      '<div style="height:' +
      (cardHeight + 20 * deck.playersideboard[i].length) +
      'px" id="sideboardColumn' +
      i +
      '" data-id="' +
      i +
      '" class="col-even sideboardcol"></div>';
  }
  deckhtml += '</div>';
  sideboardhtml += '</div>';

  area.innerHTML = deckhtml;
  document.getElementById('sideboardarea').innerHTML = sideboardhtml;
}

// Make the DIV element draggable:
function setupDrag(elmnt, fromdeck) {
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
    if (fromdeck) {
      dragCard = deck.playerdeck[e.target.getAttribute('data-col')].splice(e.target.getAttribute('data-id'), 1)[0];
    } else {
      dragCard = deck.playersideboard[e.target.getAttribute('data-col')].splice(e.target.getAttribute('data-id'), 1)[0];
    }
    //set drag element's inner html
    dragElement.innerHTML =
      '<img src="' + dragCard.details.display_image + '" width="' + cardWidth + '" height="' + cardHeight + '"/></a>';
    dragElement.style.top = e.clientY - cardHeight / 2 + self.pageYOffset + 'px';
    dragElement.style.left = e.clientX - cardWidth / 2 + self.pageXOffset + 'px';
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
    dragElement.style.top = e.clientY - cardHeight / 2 + self.pageYOffset + 'px';
    dragElement.style.left = e.clientX - cardWidth / 2 + self.pageXOffset + 'px';
  }

  function closeDragElement() {
    stopAutocard = false;
    // stop moving when mouse button is released:
    document.onmouseup = null;
    document.onmousemove = null;
    dragElement.innerHTML = '';
    var dist = getDistance(x, y, finalx, finaly);
    if (dist < 5) {
      //move to other
      if (fromdeck) {
        addToSideboard(dragCard, finalx, finaly, true, fromdeck);
      } else {
        addToDeck(dragCard, finalx, finaly, true, fromdeck);
      }
    } else if (elementHovered(document.getElementById('deckhover'), finalx, finaly)) {
      //move to pack
      addToDeck(dragCard, finalx, finaly, false, fromdeck);
    } else if (elementHovered(document.getElementById('sideboardhover'), finalx, finaly)) {
      //move to picks
      addToSideboard(dragCard, finalx, finaly, false, fromdeck);
    } else {
      //return to original
      if (!fromdeck) {
        addToSideboard(dragCard, finalx, finaly, true, fromdeck);
      } else {
        addToDeck(dragCard, finalx, finaly, true, fromdeck);
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
