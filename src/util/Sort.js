import { alphaCompare } from './Util';

function ISODateToYYYYMMDD(dateString) {
  const locale = 'en-US';

  if (dateString === undefined) {
    return undefined;
  }

  return new Date(dateString).toLocaleDateString(locale);
}

function GetColorIdentity(colors) {
  if (colors.length == 0) {
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

export function getSorts() {
  return [
    'Artist',
    'CMC',
    'Color Category',
    'Color Count',
    'Color Identity',
    'Color',
    'Date Added',
    'Finish',
    'Guilds',
    'Legality',
    'Loyalty',
    'Manacost Type',
    'Power',
    'Price',
    'Price Foil',
    'Rarity',
    'Set',
    'Shards / Wedges',
    'Status',
    'Subtype',
    'Supertype',
    'Tags',
    'Toughness',
    'Type',
    'Types-Multicolor',
    'Unsorted',
  ];
}

export function getLabels(cube, sort) {
  if (sort == 'Color Category') {
    return ['White', 'Blue', 'Black', 'Red', 'Green', 'Multicolored', 'Colorless', 'Lands'];
  } else if (sort == 'Color Identity') {
    return ['White', 'Blue', 'Black', 'Red', 'Green', 'Multicolored', 'Colorless'];
  } else if (sort == 'CMC') {
    return ['0', '1', '2', '3', '4', '5', '6', '7', '8+'];
  } else if (sort == 'CMC2') {
    return ['0-1', '2', '3', '4', '5', '6', '7+'];
  } else if (sort == 'CMC-Full') {
    // All CMCs from 0-16, with halves included, plus Gleemax at 1,000,000.
    return Array.from(Array(33).keys())
      .map((x) => (x / 2).toString())
      .concat(['1000000']);
  } else if (sort == 'Color') {
    return ['White', 'Blue', 'Black', 'Red', 'Green', 'Colorless'];
  } else if (sort == 'Type') {
    return [
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
      'Other',
    ];
  } else if (sort == 'Supertype') {
    return ['Snow', 'Legendary', 'Tribal', 'Basic', 'Elite', 'Host', 'Ongoing', 'World'];
  } else if (sort == 'Tags') {
    var tags = [];
    cube.forEach(function(card, index) {
      card.tags.forEach(function(tag, index2) {
        if (tag.length > 0 && !tags.includes(tag)) {
          tags.push(tag);
        }
      });
    });
    return tags.sort();
  } else if (sort == 'Date Added') {
    var days = [],
      formattedDay;
    cube.forEach(function(card, index) {
      formattedDay = ISODateToYYYYMMDD(card.addedTmsp);
      if (formattedDay === undefined) {
        formattedDay = 'unknown';
      }
      if (!days.includes(formattedDay)) {
        days.push(formattedDay);
      }
    });
    return days.sort();
  } else if (sort == 'Status') {
    return ['Not Owned', 'Ordered', 'Owned', 'Premium Owned'];
  } else if (sort == 'Finish') {
    return ['Non-foil', 'Foil'];
  } else if (sort == 'Guilds') {
    return ['Azorius', 'Dimir', 'Rakdos', 'Gruul', 'Selesnya', 'Orzhov', 'Golgari', 'Simic', 'Izzet', 'Boros'];
  } else if (sort == 'Shards / Wedges') {
    return ['Bant', 'Esper', 'Grixis', 'Jund', 'Naya', 'Abzan', 'Jeskai', 'Sultai', 'Mardu', 'Temur'];
  } else if (sort == 'Color Count') {
    return ['0', '1', '2', '3', '4', '5'];
  } else if (sort == 'Set') {
    var sets = [];
    cube.forEach(function(card, index) {
      if (!sets.includes(card.details.set.toUpperCase())) {
        sets.push(card.details.set.toUpperCase());
      }
    });
    return sets.sort();
  } else if (sort == 'Artist') {
    var artists = [];
    cube.forEach(function(card, index) {
      if (!artists.includes(card.details.artist)) {
        artists.push(card.details.artist);
      }
    });
    return artists.sort();
  } else if (sort == 'Rarity') {
    return ['Common', 'Uncommon', 'Rare', 'Mythic'];
  } else if (sort == 'Unsorted') {
    return ['All'];
  } else if (sort == 'Subtype') {
    var types = [];
    cube.forEach(function(card, index) {
      if (card.type_line.includes('—')) {
        var subtypes = card.type_line.substr(card.type_line.indexOf('—') + 1).split(' ');
        subtypes.forEach(function(subtype, index) {
          if (!types.includes(subtype.trim()) && subtype.trim().length > 0) {
            types.push(subtype.trim());
          }
        });
      }
    });
    return types.sort();
  } else if (sort == 'Types-Multicolor') {
    return [
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
      'Azorius',
      'Dimir',
      'Rakdos',
      'Gruul',
      'Selesnya',
      'Orzhov',
      'Golgari',
      'Simic',
      'Izzet',
      'Boros',
      'Bant',
      'Esper',
      'Grixis',
      'Jund',
      'Naya',
      'Abzan',
      'Jeskai',
      'Sultai',
      'Mardu',
      'Temur',
      'Non-White',
      'Non-Blue',
      'Non-Black',
      'Non-Red',
      'Non-Green',
      'Five Color',
      'Land',
      'Other',
    ];
  } else if (sort == 'Legality') {
    return ['Standard', 'Modern', 'Legacy', 'Vintage', 'Pauper'];
  } else if (sort == 'Power') {
    var items = [];
    cube.forEach(function(card, index) {
      if (card.details.power) {
        if (!items.includes(card.details.power)) {
          items.push(card.details.power);
        }
      }
    });
    return items.sort(function(x, y) {
      if (!/^\d+$/.test(x) || !/^\d+$/.test(y)) {
        if (x > y) {
          return 1;
        } else if (y > x) {
          return -1;
        }
        return 1;
      }
      if (parseInt(x) > parseInt(y)) {
        return 1;
      } else if (parseInt(y) > parseInt(x)) {
        return -1;
      }
      return 1;
    });
  } else if (sort == 'Toughness') {
    var items = [];
    cube.forEach(function(card, index) {
      if (card.details.toughness) {
        if (!items.includes(card.details.toughness)) {
          items.push(card.details.toughness);
        }
      }
    });
    return items.sort(function(x, y) {
      if (!/^\d+$/.test(x) || !/^\d+$/.test(y)) {
        if (x > y) {
          return 1;
        } else if (y > x) {
          return -1;
        }
        return 1;
      }
      if (parseInt(x) > parseInt(y)) {
        return 1;
      } else if (parseInt(y) > parseInt(x)) {
        return -1;
      }
      return 1;
    });
  } else if (sort == 'Loyalty') {
    var items = [];
    cube.forEach(function(card, index) {
      if (card.details.loyalty) {
        if (!items.includes(card.details.loyalty)) {
          items.push(card.details.loyalty);
        }
      }
    });
    return items.sort(function(x, y) {
      if (!/^\d+$/.test(x) || !/^\d+$/.test(y)) {
        if (x > y) {
          return 1;
        } else if (y > x) {
          return -1;
        }
        return 1;
      }
      if (parseInt(x) > parseInt(y)) {
        return 1;
      } else if (parseInt(y) > parseInt(x)) {
        return -1;
      }
      return 1;
    });
  } else if (sort == 'Manacost Type') {
    return ['Gold', 'Hybrid', 'Phyrexian'];
  } else if (sort == 'CNC') {
    return ['Creature', 'Non-Creature'];
  } else if (sort == 'Price' || sort == 'Price Foil') {
    var labels = [];
    for (i = 0; i <= price_buckets.length; i++) {
      labels.push(price_bucket_label(i));
    }
    labels.push('No Price Available');
    return labels;
  } else if (sort == 'Unsorted') {
    return ['All'];
  }
}

var price_buckets = [0.25, 0.5, 1, 2, 3, 4, 5, 7, 10, 15, 20, 25, 30, 40, 50, 75, 100];

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

export function cardIsLabel(card, label, sort) {
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

export function sortIntoGroups(cards, sort) {
  const groups = {};
  const labels = getLabels(cards, sort);
  for (const label of labels) {
    const group = cards.filter(card => cardIsLabel(card, label, sort));

    if (group.length > 0) {
      groups[label] = group;
    }
  }
  return groups;
}

function sortGroupsOrdered(cards, sort) {
  return getLabels(cards, sort).map(label => [label, cards.filter(card => cardIsLabel(card, label, sort))]).filter(([label, group]) => group.length > 0);
}

export function sortDeep(cards, ...sorts) {
  if (sorts.length === 0) {
    return cards.sort(alphaCompare);
  } else {
    const [first, ...rest] = sorts;
    return getLabels(cards, first).map(label => [label, sortDeep(cards.filter(card => cardIsLabel(card, label, first)), ...rest)]).filter(([label, group]) => group.length > 0);
  }
}

export function countGroup(group) {
  if (Array.isArray(group[0])) {
    const counts = group.map(([label, group2]) => countGroup(group2));
    return counts.reduce((a, b) => a + b, 0);
  } else {
    return group.length;
  }
}
