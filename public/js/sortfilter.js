var price_buckets = [0.25, 0.5, 1, 2, 3, 4, 5, 7, 10, 15, 20, 25, 30, 40, 50, 75, 100];

function GetColorCategory(type, colors) {
  if (type.toLowerCase().includes('land')) {
    return 'Lands';
  } else if (colors.length == 0) {
    return 'Colorless';
  } else if (colors.length > 1) {
    return 'Multicolored';
  } else if (colors.length == 1) {
    switch (colors[0]) {
      case 'W':
        return 'White';
        break;
      case 'U':
        return 'Blue';
        break;
      case 'B':
        return 'Black';
        break;
      case 'R':
        return 'Red';
        break;
      case 'G':
        return 'Green';
        break;
      case 'C':
        return 'Colorless';
        break;
    }
  }
}

//returns the price bucket label at the index designating the upper bound
//at index == 0, returns < lowest
//at index == length, returs >= highest
function price_bucket_label(index) {
  if (index == 0) {
    return '< $' + price_buckets[0];
  } else if (index == price_buckets.length) {
    return '>= $' + price_buckets[price_buckets.length - 1];
  } else {
    return '$' + price_buckets[i - 1] + ' - $' + (price_buckets[i] - 0.01);
  }
}

function cmcToNumber(card) {
  const cmc = card.hasOwnProperty('cmc') ? card.cmc : card.details.cmc;
  if (isNaN(cmc)) {
    return cmc.indexOf('.') > -1 ? parseFloat(cmc) : parseInt(cmc);
  } else {
    return cmc;
  }
}

function cardIsLabel(card, label, sort) {
  if (sort == 'Color Category') {
    return GetColorCategory(card.type_line, card.colors) == label;
  } else if (sort == 'Color Identity') {
    return GetColorIdentity(card.colors) == label;
  } else if (sort == 'Color') {
    if (!card.details.colors) {
      return label == 'Colorless';
    }
    switch (label) {
      case 'White':
        return card.details.colors.includes('W');
      case 'Blue':
        return card.details.colors.includes('U');
      case 'Black':
        return card.details.colors.includes('B');
      case 'Green':
        return card.details.colors.includes('G');
      case 'Red':
        return card.details.colors.includes('R');
      case 'Colorless':
        return card.details.colors.length == 0;
    }
  } else if (sort == '4+ Color') {
    if (card.colors.length < 4) {
      return false;
    }
    switch (label) {
      case 'Non-White':
        return !card.colors.includes('W');
      case 'Non-Blue':
        return !card.colors.includes('U');
      case 'Non-Black':
        return !card.colors.includes('B');
      case 'Non-Green':
        return !card.colors.includes('G');
      case 'Non-Red':
        return !card.colors.includes('R');
      case 'Five Color':
        return card.colors.length == 5;
    }
  } else if (sort == 'CMC') {
    // Sort by CMC, but collapse all >= 8 into '8+' category.
    const cmc = Math.round(cmcToNumber(card));
    if (cmc >= 8) {
      return label == '8+';
    }
    return cmc == label;
  } else if (sort == 'CMC2') {
    const cmc = Math.round(cmcToNumber(card));
    if (cmc >= 7) {
      return label == '7+';
    } else if (cmc <= 1) {
      return label == '0-1';
    }
    return cmc == label;
  } else if (sort == 'CMC-Full') {
    // Round to half-integer.
    return Math.round(cmcToNumber(card) * 2) / 2 == label;
  } else if (sort == 'Supertype' || sort == 'Type') {
    if (card.type_line.includes('Contraption')) {
      return label == 'Contraption';
    } else if (label == 'Plane') {
      return card.type_line.includes(label) && !card.type_line.includes('Planeswalker');
    }
    return card.type_line.includes(label);
  } else if (sort == 'Tags') {
    if (label == '') {
      return false;
    }
    return card.tags.includes(label);
  } else if (sort == 'Status') {
    return card.status == label;
  } else if (sort == 'Finish') {
    return card.finish == label;
  } else if (sort == 'Date Added') {
    var day = ISODateToYYYYMMDD(card.addedTmsp);
    if (day === undefined) {
      day = 'unknown';
    }
    return label === day;
  } else if (sort == 'Guilds') {
    if (card.colors.length != 2) {
      return false;
    }
    switch (label) {
      case 'Azorius':
        return card.colors.includes('W') && card.colors.includes('U');
      case 'Dimir':
        return card.colors.includes('B') && card.colors.includes('U');
      case 'Rakdos':
        return card.colors.includes('B') && card.colors.includes('R');
      case 'Gruul':
        return card.colors.includes('G') && card.colors.includes('R');
      case 'Selesnya':
        return card.colors.includes('W') && card.colors.includes('G');
      case 'Orzhov':
        return card.colors.includes('W') && card.colors.includes('B');
      case 'Izzet':
        return card.colors.includes('R') && card.colors.includes('U');
      case 'Golgari':
        return card.colors.includes('G') && card.colors.includes('B');
      case 'Boros':
        return card.colors.includes('W') && card.colors.includes('R');
      case 'Simic':
        return card.colors.includes('G') && card.colors.includes('U');
    }
  } else if (sort == 'Shards / Wedges') {
    if (card.colors.length != 3) {
      return false;
    }
    switch (label) {
      case 'Bant':
        return card.colors.includes('W') && card.colors.includes('U') && card.colors.includes('G');
      case 'Esper':
        return card.colors.includes('B') && card.colors.includes('U') && card.colors.includes('W');
      case 'Grixis':
        return card.colors.includes('B') && card.colors.includes('R') && card.colors.includes('U');
      case 'Jund':
        return card.colors.includes('G') && card.colors.includes('R') && card.colors.includes('B');
      case 'Naya':
        return card.colors.includes('W') && card.colors.includes('G') && card.colors.includes('R');
      case 'Abzan':
        return card.colors.includes('W') && card.colors.includes('B') && card.colors.includes('G');
      case 'Jeskai':
        return card.colors.includes('R') && card.colors.includes('U') && card.colors.includes('W');
      case 'Sultai':
        return card.colors.includes('G') && card.colors.includes('B') && card.colors.includes('U');
      case 'Mardu':
        return card.colors.includes('W') && card.colors.includes('R') && card.colors.includes('B');
      case 'Temur':
        return card.colors.includes('G') && card.colors.includes('U') && card.colors.includes('R');
    }
  } else if (sort == 'Color Count') {
    return card.colors.length == parseInt(label);
  } else if (sort == 'Set') {
    return card.details.set.toUpperCase() == label;
  } else if (sort == 'Rarity') {
    return card.details.rarity.toLowerCase() == label.toLowerCase();
  } else if (sort == 'Unsorted') {
    return true;
  } else if (sort == 'Subtype') {
    if (card.type_line.includes('—')) {
      return card.type_line.includes(label);
    }
    return false;
  } else if (sort == 'Types-Multicolor') {
    if (card.colors.length <= 1) {
      var split = card.type_line.split('—');
      var types = split[0].trim().split(' ');
      var type = types[types.length - 1];
      //check last type
      if (
        ![
          'Creature',
          'Planeswalker',
          'Instant',
          'Sorcery',
          'Artifact',
          'Enchantment',
          'Conspiracy',
          'Contraption',
          'Phenomenon',
          'Plane',
          'Scheme',
          'Vanguard',
          'Land',
        ].includes(type)
      ) {
        return label == 'Other';
      }
      return label == type;
    } else {
      return (
        cardIsLabel(card, label, 'Guilds') ||
        cardIsLabel(card, label, 'Shards / Wedges') ||
        cardIsLabel(card, label, '4+ Color')
      );
    }
  } else if (sort == 'Artist') {
    return card.details.artist == label;
  } else if (sort == 'Legality') {
    if (label == 'Vintage') {
      return true;
    }
    return card.details.legalities[label];
  } else if (sort == 'Power') {
    if (card.details.power) {
      return card.details.power == label;
    }
    return false;
  } else if (sort == 'Toughness') {
    if (card.details.toughness) {
      return card.details.toughness == label;
    }
    return false;
  } else if (sort == 'Loyalty') {
    if (card.details.loyalty) {
      return card.details.loyalty == label;
    }
    return false;
  } else if (sort == 'Manacost Type') {
    switch (label) {
      case 'Gold':
        if (card.details.colors.length <= 1) {
          return false;
        }
        var res = true;
        card.details.parsed_cost.forEach(function(symbol, index) {
          if (symbol.includes('-')) {
            res = false;
          }
        });
        return res;
      case 'Hybrid':
        if (card.details.colors.length <= 1) {
          return false;
        }
        var res = false;
        card.details.parsed_cost.forEach(function(symbol, index) {
          if (symbol.includes('-') && !symbol.includes('-p')) {
            res = true;
          }
        });
        return res;
      case 'Phyrexian':
        var res = false;
        card.details.parsed_cost.forEach(function(symbol, index) {
          if (symbol.includes('-p')) {
            res = true;
          }
        });
        return res;
    }
  } else if (sort == 'CNC') {
    if (label == 'Creature') {
      return card.type_line.includes(label);
    }
    return !card.type_line.toLowerCase().includes('creature');
  } else if (sort == 'Price') {
    var price = null;
    if (card.details.price) {
      price = card.details.price;
    } else if (card.details.price_foil) {
      price = card.details.price_foil;
    }
    if (price) {
      //fence post first and last term
      if (price < price_buckets[0]) {
        return label == price_bucket_label(0);
      } else if (price >= price_buckets[price_buckets.length - 1]) {
        return label == price_bucket_label(price_buckets.length);
      } else {
        for (i = 1; i < price_buckets.length; i++) {
          if (price >= price_buckets[i - 1] && price < price_buckets[i]) {
            return label == price_bucket_label(i);
          }
        }
      }
    } else {
      return label == 'No Price Available';
    }
  } else if (sort == 'Price Foil') {
    if (card.details.price_foil) {
      //fence post first and last term
      if (card.details.price_foil < price_buckets[0]) {
        return label == price_bucket_label(0);
      } else if (card.details.price_foil >= price_buckets[price_buckets.length - 1]) {
        return label == price_bucket_label(price_buckets.length);
      } else {
        for (i = 1; i < price_buckets.length; i++) {
          if (card.details.price_foil >= price_buckets[i - 1] && card.details.price_foil < price_buckets[i]) {
            return label == price_bucket_label(i);
          }
        }
      }
    } else {
      return label == 'No Price Available';
    }
  } else if (sort == 'Unsorted') {
    return label == 'All';
  }
}

try {
  module.exports = {
    cardIsLabel: cardIsLabel,
    filterCard: filterCard,
    price_buckets: price_buckets,
  };
} catch (err) {
  //probably running client side, ignore
}
