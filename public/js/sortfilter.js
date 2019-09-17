

var price_buckets = [.25, .5, 1, 2, 3, 4, 5, 7, 10, 15, 20, 25, 30, 40, 50, 75, 100];
var rarity_order = ['common', 'uncommon', 'rare', 'mythic'];

function GetColorCategory(type, colors) {
  if (type.toLowerCase().includes('land')) {
    return 'Lands';
  } else if (colors.length == 0) {
    return 'Colorless';
  } else if (colors.length > 1) {
    return 'Multicolored';
  } else if (colors.length == 1) {
    switch (colors[0]) {
      case "W":
        return 'White';
        break;
      case "U":
        return 'Blue';
        break;
      case "B":
        return 'Black';
        break;
      case "R":
        return 'Red';
        break;
      case "G":
        return 'Green';
        break;
      case "C":
        return 'Colorless';
        break;
    }
  }
}

function filterCard(card, filters) {
  
  if(filters.length == 1) {
    if(filters[0].type == 'token') {
      return filterApply(card, filters[0]);
    } else {
      return filterCard(card, filters[0]);
    }
  } else {
    if(filters.type == 'or') {
      return (filters[0].type == 'token' ? filterApply(card, filters[0]) : filterCard(card, filters[0])) || (filters[1].type == 'token' ? filterApply(card, filters[1]) : filterCard(card, filters[1]))
    } else {
      return (filters[0].type == 'token' ? filterApply(card, filters[0]) : filterCard(card, filters[0])) && (filters[1].type == 'token' ? filterApply(card, filters[1]) : filterCard(card, filters[1]))
    }
  }

}

function areArraysEqualSets(a1, a2) {
    if(a1.length != a2.length) return false;
    let superSet = {};
    for (let i = 0; i < a1.length; i++) {
          const e = a1[i] + typeof a1[i];
          superSet[e] = 1;
        }

    for (let i = 0; i < a2.length; i++) {
          const e = a2[i] + typeof a2[i];
          if (!superSet[e]) {
                  return false;
                }
          superSet[e] = 2;
        }

    for (let e in superSet) {
          if (superSet[e] === 1) {
                  return false;
                }
        }

    return true;
}

function arrayContainsOtherArray (arr1, arr2) {
  return arr2.every(v => arr1.includes(v));
}


function filterApply(card, filter) {
  let res = null;
  if (filter.category == 'name') {
    res = card.details.name_lower.indexOf(filter.arg) > -1;
  }
  if (filter.category == 'oracle' && card.details.oracle_text) {
    res = card.details.oracle_text.toLowerCase().indexOf(filter.arg) > -1;
  }
  if (filter.category == 'color' && card.details.colors) {
    switch (filter.operand) {
      case ':':
      case '=':
        if (filter.arg.length == 1 && filter.arg[0] == 'C') {
          res = !card.details.colors.length;
        } else {
          res = areArraysEqualSets(card.details.colors, filter.arg);
        }
        break;
      case '<':
        res = arrayContainsOtherArray(filter.arg, card.details.colors) && card.details.colors.length < filter.arg.length;
        break;
      case '>':
        res = arrayContainsOtherArray(card.details.colors, filter.arg) && card.details.colors.length > filter.arg.length;
        break;
      case '<=':
        res = arrayContainsOtherArray(filter.arg, card.details.colors) && card.details.colors.length <= filter.arg.length;
        break;
      case '>=':
        res = arrayContainsOtherArray(card.details.colors, filter.arg) && card.details.colors.length >= filter.arg.length;
        break;
    }
  }
  if (filter.category == 'identity' && card.colors) {
    switch (filter.operand) {
      case ':':
      case '=':
        if (filter.arg.length == 1 && filter.arg[0] == 'C') {
          res = !card.details.colors.length;
        } else {
          res = areArraysEqualSets(card.colors, filter.arg);
        }
        break;
      case '<':
        res = arrayContainsOtherArray(filter.arg, card.colors) && card.details.color_identity.length < filter.arg.length;
        break;
      case '>':
        res = arrayContainsOtherArray(card.colors, filter.arg) && card.details.color_identity.length > filter.arg.length;
        break;
      case '<=':
        res = arrayContainsOtherArray(filter.arg, card.colors) && card.details.color_identity.length <= filter.arg.length;
        break;
      case '>=':
        res = arrayContainsOtherArray(card.colors, filter.arg) && card.details.color_identity.length >= filter.arg.length;
        break;
    }
  }
  if (filter.category == 'mana' && card.details.parsed_cost) {
    res = areArraysEqualSets(card.details.parsed_cost, filter.arg);
  }
  if (filter.category == 'cmc' && card.cmc) {
    switch (filter.operand) {
      case ':':
      case '=':
        res = filter.arg == card.cmc;
        break;
      case '<':
        res = card.cmc < filter.arg;
        break;
      case '>':
        res = card.cmc > filter.arg;
        break;
      case '<=':
        res = card.cmc <= filter.arg;
        break;
      case '>=':
        res = card.cmc >= filter.arg;
        break;
    }
  }
  if (filter.category == 'type' && card.details.type) {
    if (card.details.type.toLowerCase().indexOf(filter.arg) > -1) {
      res = true;
    }
  }
  if (filter.category == 'power') {
    if (card.details.power) {
      switch (filter.operand) {
        case ':':
        case '=':
          res = filter.arg == card.details.power;
          break;
        case '<':
          res = card.details.power < filter.arg;
          break;
        case '>':
          res = card.details.power > filter.arg;
          break;
        case '<=':
          res = card.details.power <= filter.arg;
          break;
        case '>=':
          res = card.details.power >= filter.arg;
          break;
      }
    }
  }
  if (filter.category == 'toughness') {
    if (card.details.toughness) {
      switch (filter.operand) {
        case ':':
        case '=':
          res = filter.arg == card.details.toughness;
          break;
        case '<':
          res = card.details.toughness < filter.arg;
          break;
        case '>':
          res = card.details.toughness > filter.arg;
          break;
        case '<=':
          res = card.details.toughness <= filter.arg;
          break;
        case '>=':
          res = card.details.toughness >= filter.arg;
          break;
      }
    }
  }
  if(filter.category == 'tag') {
    res = card.tags.some(element => {
      return element.toLowerCase() == filter.arg;
    });
  }
  if(filter.category == 'status') {
    if(card.status.toLowerCase() == filter.arg)
    {
      res = true;
    }
  }

  if(filter.category == 'price')
  {    
    var price = null;
    if (card.details.price) {
      price = card.details.price;
    } else if (card.details.price_foil) {
      price = card.details.price_foil;
    }
    if (price) {
      switch(filter.operand)
      {
        case ':':
        case '=':
          res = filter.arg == price;
          break;
        case '<':
          res = price < filter.arg;
          break;
        case '>':
          res = price > filter.arg;
          break;
        case '<=':
          res = price <= filter.arg;
          break;
        case '>=':
          res = price >= filter.arg;
          break;
      }
    }
  }
  if(filter.category == 'pricefoil')
  {    
    var price = card.details.price_foil || null
    if (price) {
      switch(filter.operand)
      {
        case ':':
        case '=':
          res = filter.arg == price;
          break;
        case '<':
          res = price < filter.arg;
          break;
        case '>':
          res = price > filter.arg;
          break;
        case '<=':
          res = price <= filter.arg;
          break;
        case '>=':
          res = price >= filter.arg;
          break;
      }
    }
  }
  if(filter.category == 'rarity')
  {
    let rarity = card.details.rarity;
    switch(filter.operand)
    {
      case ':':
      case '=':
        res = rarity == filter.arg;
        break;
      case '<':
        res = rarity_order.indexOf(rarity) < rarity_order.indexOf(filter.arg);
        break;
      case '>':
        res = rarity_order.indexOf(rarity) > rarity_order.indexOf(filter.arg);
        break;
      case '<=':
        res = rarity_order.indexOf(rarity) <= rarity_order.indexOf(filter.arg);
        break;
      case '>=':
        res = rarity_order.indexOf(rarity) >= rarity_order.indexOf(filter.arg);
        break;
    }
  }

  if(filter.not) {
    return !res;
  } else {
    return res;
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
    return '$' + price_buckets[i - 1] + ' - $' + (price_buckets[i] - .01);
  }
}

function cardIsLabel(card, label, sort) {
  if (sort == 'Color Category') {
    return GetColorCategory(card.type_line, card.colors) == label;
  } else if (sort == 'Color Identity') {
    return GetColorIdentity(card.colors) == label;
  } else if (sort == 'Color') {
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
    if (card.cmc >= 8) {
      return label == '8+';
    }
    return card.cmc == label;
  } else if (sort == 'CMC2') {
    if (card.cmc >= 7) {
      return label == '7+';
    } else if (card.cmc <= 1) {
      return label == '0-1';
    }
    return card.cmc == label;
  } else if (sort == 'Supertype' || sort == 'Type') {
    if (card.type_line.includes('Contraption')) {
      return label == 'Contraption';
    } else if (label == 'Plane') {
      return card.type_line.includes(label) && !card.type_line.includes('Planeswalker');
    }
    return card.type_line.includes(label);
  } else if (sort == 'Tags') {
    if (label == "") {
      return false;
    }
    return card.tags.includes(label);
  } else if (sort == 'Status') {
    return card.status == label;
  } else if (sort == 'Date Added') {
    var day = ISODateToYYYYMMDD(card.addedTmsp);
    if (day === undefined) {
      day = "unknown";
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
      if (!['Creature', 'Planeswalker', 'Instant', 'Sorcery', 'Artifact', 'Enchantment', 'Conspiracy', 'Contraption', 'Phenomenon', 'Plane', 'Scheme', 'Vanguard', 'Land'].includes(type)) {
        return label == 'Other';
      }
      return label == type;
    } else {
      return cardIsLabel(card, label, 'Guilds') || cardIsLabel(card, label, 'Shards / Wedges') || cardIsLabel(card, label, '4+ Color');
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
      return label == "No Price Available";
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
      return label == "No Price Available";
    }
  }
}

try {
  module.exports = {
    cardIsLabel: cardIsLabel,
    filterCard: filterCard,
    price_buckets: price_buckets
  };
} catch (err) {
  //probably running client side, ignore
}
