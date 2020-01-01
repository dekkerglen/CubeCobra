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

const ALL_CMCS = Array.from(Array(33).keys()).map((x) => (x / 2).toString()).concat(['1000000']);

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
    return ALL_CMCS;
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
    const types = new Set();
    for (const card of cube) {
      const split = card.type_line.split(/[-–—]/);
      if (split.length > 1) {
        const subtypes = split[1].trim().split(' ');
        subtypes.filter(x => x.trim()).forEach(subtype => types.add(subtype.trim()));
      }
    }
    return [...types];
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
    const labels = [];
    for (let i = 0; i <= price_buckets.length; i++) {
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
    return '$' + price_buckets[index - 1] + ' - $' + (price_buckets[index] - 0.01);
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

const COLOR_MAP = {
  W: 'White',
  U: 'Blue',
  B: 'Black',
  R: 'Red',
  G: 'Green',
};
const GUILD_MAP = {
  WU: 'Azorius',
  UB: 'Dimir',
  BR: 'Rakdos',
  RG: 'Gruul',
  WG: 'Selesnya',
  WB: 'Orzhov',
  UR: 'Izzet',
  BG: 'Golgari',
  WR: 'Boros',
  UG: 'Simic',
};
const WEDGE_MAP = {
  WUG: 'Bant',
  WUB: 'Esper',
  UBR: 'Grixis',
  BRG: 'Jund',
  WRG: 'Naya',
  WBG: 'Abzan',
  WUR: 'Jeskai',
  UBG: 'Sultai',
  WBR: 'Mardu',
  URG: 'Temur',
}

export function cardGetLabels(card, sort) {
  if (sort == 'Color Category') {
    return [GetColorCategory(card.type_line, card.colors)];
  } else if (sort == 'Color Identity') {
    return [GetColorIdentity(card.colors)];
  } else if (sort == 'Color') {
    if (card.details.colors.length === 0) {
      return ['Colorless'];
    } else {
      return card.details.colors.map(c => COLOR_MAP[c]).filter(c => c);
    }
  } else if (sort == '4+ Color') {
    if (card.colors.length < 4) {
      return [];
    } else if (card.colors.length === 5) {
      return ['Five-Color'];
    } else {
      return [...'WUBRG'].filter(c => !card.colors.includes(c)).map(c => `Non-${COLOR_MAP[c]}`);
    }
  } else if (sort == 'CMC') {
    // Sort by CMC, but collapse all >= 8 into '8+' category.
    const cmc = Math.round(cmcToNumber(card));
    if (cmc >= 8) {
      return ['8+'];
    } else {
      return [cmc.toString()];
    }
  } else if (sort == 'CMC2') {
    const cmc = Math.round(cmcToNumber(card));
    if (cmc >= 7) {
      return ['7+'];
    } else if (cmc <= 1) {
      return ['0-1'];
    } else {
      return [cmc.toString()];
    }
  } else if (sort == 'CMC-Full') {
    // Round to half-integer.
    return [(Math.round(cmcToNumber(card) * 2) / 2).toString()];
  } else if (sort == 'Supertype' || sort == 'Type') {
    const split = card.type_line.split(/[-–—]/);
    let types = null;
    if (split.length > 1) {
      types = split[0].trim().split(' ').map(x => x.trim()).filter(x => x);
    } else {
      types = card.type_line.trim().split(' ').map(x => x.trim()).filter(x => x);
    }
    if (types.includes('Contraption')) {
      return ['Contraption'];
    } else if (types.includes('Plane')) {
      return ['Plane'];
    } else {
      const labels = getLabels(null, sort);
      return types.filter(t => labels.includes(t));
    }
  } else if (sort == 'Tags') {
    return card.tags;
  } else if (sort == 'Status') {
    return [card.status];
  } else if (sort == 'Finish') {
    return [card.finish];
  } else if (sort == 'Date Added') {
    var day = ISODateToYYYYMMDD(card.addedTmsp);
    if (day === undefined) {
      day = 'unknown';
    }
    return [day];
  } else if (sort == 'Guilds') {
    if (card.colors.length != 2) {
      return [];
    } else {
      const ordered = [...'WUBRG'].filter(c => card.colors.includes(c)).join('');
      return [GUILD_MAP[ordered]];
    }
  } else if (sort == 'Shards / Wedges') {
    if (card.colors.length != 3) {
      return [];
    } else {
      const ordered = [...'WUBRG'].filter(c => card.colors.includes(c)).join('');
      return [WEDGE_MAP[ordered]];
    }
  } else if (sort == 'Color Count') {
    return [card.colors.length];
  } else if (sort == 'Set') {
    return [card.details.set.toUpperCase()];
  } else if (sort == 'Rarity') {
    return [card.details.rarity[0].toUpperCase() + card.details.rarity.slice(1)];
  } else if (sort == 'Subtype') {
    const split = card.type_line.split(/[-–—]/);
    if (split.length > 1) {
      const subtypes = split[1].trim().split(' ');
      return subtypes.map(subtype => subtype.trim()).filter(x => x);
    } else {
      return [];
    }
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
        return ['Other'];
      } else {
        return [type];
      }
    } else {
      return [...cardGetLabels(card, 'Guilds'), ...cardGetLabels(card, 'Shards / Wedges'), ...cardGetLabels(card, '4+ Color')];
    }
  } else if (sort == 'Artist') {
    return [card.details.artist];
  } else if (sort == 'Legality') {
    return Object.entries(card.details.legalities).filter(([k, v]) => v).map(([k, v]) => k);
  } else if (sort == 'Power') {
    if (card.details.power) {
      return [parseInt(card.details.power)]
    }
    return [];
  } else if (sort == 'Toughness') {
    if (card.details.toughness) {
      return [parseInt(card.details.toughness)]
    }
    return [];
  } else if (sort == 'Loyalty') {
    if (card.details.loyalty) {
      return [parseInt(card.details.loyalty)]
    }
    return [];
  } else if (sort == 'Manacost Type') {
    if (card.details.colors.length > 1 && card.details.parsed_cost.every(symbol => !symbol.includes('-'))) {
      return ['Gold'];
    } else if (card.details.colors.length > 1 && card.details.parsed_cost.some(symbol => symbol.includes('-') && !symbol.includes('-p'))) {
      return ['Hybrid'];
    } else if (card.details.parsed_cost.some(symbol => symbol.includes('-p'))) {
      return ['Phyrexian'];
    }
  } else if (sort == 'CNC') {
    return card.type_line.toLowerCase().includes('creature') ? 'Creature' : 'Non-Creature';
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
        return [price_bucket_label(0)];
      } else if (price >= price_buckets[price_buckets.length - 1]) {
        return [price_bucket_label(price_buckets.length)];
      } else {
        for (i = 1; i < price_buckets.length; i++) {
          if (price >= price_buckets[i - 1] && price < price_buckets[i]) {
            return [price_bucket_label(i)];
          }
        }
      }
    } else {
      return ['No Price Available'];
    }
  } else if (sort == 'Price Foil') {
    if (card.details.price_foil) {
      //fence post first and last term
      if (card.details.price_foil < price_buckets[0]) {
        return [price_bucket_label(0)];
      } else if (card.details.price_foil >= price_buckets[price_buckets.length - 1]) {
        return [price_bucket_label(price_buckets.length)];
      } else {
        for (i = 1; i < price_buckets.length; i++) {
          if (card.details.price_foil >= price_buckets[i - 1] && card.details.price_foil < price_buckets[i]) {
            return [price_bucket_label(i)];
          }
        }
      }
    } else {
      return ['No Price Available'];
    }
  } else if (sort == 'Unsorted') {
    return ['All'];
  }
}

export function cardIsLabel(card, label, sort) {
  return cardGetLabels(card, sort).includes(label);
}

export function sortIntoGroups(cards, sort) {
  return Object.fromEntries(sortGroupsOrdered(cards, sort));
}

function sortGroupsOrdered(cards, sort) {
  const labels = getLabels(cards, sort);
  const allCardLabels = cards.map(card => [card, cardGetLabels(card, sort)]);
  const compare = (x, y) => labels.indexOf(x) - labels.indexOf(y);
  const byLabel = {};
  for (const [card, cardLabels] of allCardLabels) {
    if (cardLabels.length > 0) {
      cardLabels.sort(compare);
      const label = cardLabels[0];
      if (!byLabel[label]) {
        byLabel[label] = [];
      }
      byLabel[label].push(card);
    }
  }
  return labels.filter(label => byLabel[label]).map(label => [label, byLabel[label]]);
}

export function sortDeep(cards, ...sorts) {
  if (sorts.length === 0) {
    return cards.sort(alphaCompare);
  } else {
    const [first, ...rest] = sorts;
    const result = sortGroupsOrdered(cards, first);
    if (rest.length > 0) {
      for (const labelGroup of result) {
        labelGroup[1] = sortDeep(labelGroup[1], rest);
      }
    }
    return result;
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
