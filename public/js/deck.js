var deck = JSON.parse(document.getElementById("deckraw").value);

var cardWidth = 125;
var cardHeight = 175;
var numCols = 0;

var prev_handler = window.onload;

window.onload = function () {
    if (prev_handler) {
        prev_handler();
    }
    renderDraft();
};

window.onresize = function () {
  renderDraft();
}


function renderDraft()
{
  setupColumns();

  //move cards over if they don't fit into columns
  for(var i = numCols; i < deck.length; i++)
  {
    deck[numCols-1] = deck[numCols-1].concat(deck[i].splice(0,deck[i].length));
  }

  var lands = 0;
  var cards = 0;
  //fill up deck
  deck.forEach(function(col, index)
  {
    var colhtml = "";
    col.forEach(function(card, index2)
    {
      cards++;
      if(card.details.type.toLowerCase().includes('land'))
      {
        lands++;
      }
      if(card.details.card_flip)
      {
        colhtml += '<a style="z-index:'+index2+'; position: relative; top:-'+155*(index2)+'px;" class="autocard" card="'+card.details.image_normal+'" card_flip="'+card.details.image_flip+'"><img class="deckcard" data-id="'+index2+'" data-col="'+index+'" src="'+card.details.image_normal+'" width="'+cardWidth+'" height="'+cardHeight+'"/></a>';
      }
      else
      {
        colhtml += '<a style="z-index:'+index2+'; position: relative; top:-'+155*(index2)+'px;" class="autocard" card="'+card.details.image_normal+'"><img class="deckcard" data-id="'+index2+'" data-col="'+index+'" src="'+card.details.image_normal+'" width="'+cardWidth+'" height="'+cardHeight+'"/></a>';
      }
    });
    $('#deckColumn'+index).html(colhtml);
  });
  $('#deckName').text('Deck ('+cards+' cards, '+ lands +' lands)')


  autocard_init('autocard');
}

function getDeckRowHeight()
{
  var max = 0;
  for(i = numCols/2; i < numCols; i++)
  {
    if(deck[i].length > max)
    {
      max = deck[i].length;
    }
  }
  return cardHeight+20*max;
}

function setupColumns()
{
  var area = document.getElementById('deckarea');
  var rect = area.getBoundingClientRect();
  numCols = Math.floor((rect.width+40)/(cardWidth+4))*2;

  var deckhtml = '<div class="row even-cols">';

  for(i = 0; i < numCols; i++)
  {
    if(!deck[i])
    {
      deck[i] = [];
    }
    deckhtml += '<div style="height:'+(cardHeight+20*deck[i].length)+'px" id="deckColumn'+i+'" data-id="'+i+'" class="col-even deckcol"></div>'
  }
  deckhtml+= '</div>';

  area.innerHTML = deckhtml;
}
