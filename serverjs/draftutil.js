function shuffle(array) {
  var currentIndex = array.length;
  var temporaryValue, randomIndex;
  while (0 !== currentIndex) {
    randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex -= 1;
    temporaryValue = array[currentIndex];
    array[currentIndex] = array[randomIndex];
    array[randomIndex] = temporaryValue;
  }

  return array;

}

var methods = {
  getDraftBots: function(params) {
    var botcolors = Math.ceil((params.seats - 1) * 2 / 5);
    var draftbots = [];
    var colors = [];
    for (i = 0; i < botcolors; i++) {
      colors.push('W');
      colors.push('U');
      colors.push('B');
      colors.push('R');
      colors.push('G');
    }
    shuffle(colors);
    for (i = 0; i < params.seats - 1; i++) {
      var colorcombo = [colors.pop(), colors.pop()];
      draftbots.push(colorcombo);
    }
    return draftbots;
  },
  indexOfTag: function(cards, tag) {
    tag = tag.toLowerCase();
    for (var i = 0; i < cards.length; i++) {
      if (cards[i].tags && cards[i].tags.length > 0) {
        for (var j = 0; j < cards[i].tags.length; j++) {
          if (tag == cards[i].tags[j].toLowerCase()) {
            return i;
          }
        }
      }
    }
    return -1;
  },
  getCardRatings: function(names, CardRating, callback) {
    CardRating.find({
      'name': {
        $in: names
      }
    }, function(err, ratings) {
      var dict = {};
      if (ratings) {
        ratings.forEach(function(rating, index) {
          dict[rating.name] = rating.value;
        });
      }
      callback(dict);
    });
  }
};

module.exports = methods;