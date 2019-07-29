var sanitizeHtml = require('sanitize-html');

function intToLegality (val) {
  switch(val)
  {
    case 0:
      return 'Vintage';
    case 1:
      return 'Legacy';
    case 2:
      return 'Modern';
    case 3:
      return 'Standard';
  }
  return cube;
}
function legalityToInt (legality) {
  switch(legality)
  {
    case 'Vintage':
      return 0;
    case 'Legacy':
      return 1;
    case 'Modern':
      return 2;
    case 'Standard':
      return 3;
  }
}

var methods =
{
  getBasics: function(carddb) {
    var names = ['Plains','Mountain','Forest','Swamp','Island'];
    var set = 'unh';
    var res = {};
    names.forEach(function(name,index)
    {
      var found = false;
      var options = carddb.nameToId[name.toLowerCase()];
      options.forEach(function(option, index2)
      {
        var card = carddb.carddict[option];
        if(!found && card.set.toLowerCase() == set)
        {
          found = true;
          res[name] = {
            details: card
          };
        }
      });
    });
    return res;
  },
  cardsAreEquivalent: function(card, details) {
    if(card.cardID != details.cardID)
    {
      return false;
    }
    if(card.status != details.status)
    {
      return false;
    }
    if(card.cmc != details.cmc)
    {
      return false;
    }
    if(!util.arraysEqual(card.tags,details.tags))
    {
      return false;
    }
    if(!util.arraysEqual(card.colors,details.colors))
    {
      return false;
    }

    return true;
  },
  setCubeType: function(cube, carddb) {
    var pauper = true;
    var type = legalityToInt('Standard');
    cube.cards.forEach(function(card, index)
    {
      if(pauper && !carddb.carddict[card.cardID].legalities.Pauper)
      {
        pauper = false;
      }
      while(type>0 && !carddb.carddict[card.cardID].legalities[intToLegality(type)])
      {
        type -= 1;
      }
    });

    cube.type = intToLegality(type);
    if(pauper)
    {
      cube.type += ' Pauper';
    }
    cube.card_count = cube.cards.length;
    return cube;
  },
  sanitize: function (html) {
    return sanitizeHtml(html, {
      allowedTags: [ 'div','p','strike','strong','b', 'i', 'em', 'u', 'a', 'h5','h6','ul','ol','li','span'],
      selfClosing: [ 'br']
    });
  },
  addAutocard: function(src, carddb) {
    while(src.includes('[[') && src.includes(']]') && src.indexOf('[[') < src.indexOf(']]'))
    {
      var cardname = src.substring(src.indexOf('[[')+2,src.indexOf(']]'));
      var mid = cardname;
      if(carddb.nameToId[cardname.toLowerCase()])
      {
        var card = carddb.carddict[carddb.nameToId[cardname.toLowerCase()][0]];
        if(card.image_flip)
        {
          mid = '<a class="autocard" card="'+ card.image_normal + '" card_flip="'+ card.image_flip + '">' +  card.name + '</a>';
        }
        else
        {
          mid = '<a class="autocard" card="'+ card.image_normal + '">' +  card.name + '</a>';
        }
      }
      //front + autocard + back
      src = src.substring(0,src.indexOf('[['))
        + mid
        + src.substring(src.indexOf(']]')+2);
    }
    return src;
  }
};

module.exports = methods;
