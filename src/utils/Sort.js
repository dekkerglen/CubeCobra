import { alphaCompare, fromEntries } from 'utils/Util';
import { cardDevotion, cardPriceEur, cardTix, cardCmc } from 'utils/Card';

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
};

const ALL_CMCS = Array.from(Array(33).keys())
  .map((x) => (x / 2).toString())
  .concat(['1000000']);

const SINGLE_COLOR_AND_COLORLESS = ['White', 'Blue', 'Black', 'Red', 'Green', 'Colorless', 'Lands'];
const GUILDS = ['Azorius', 'Dimir', 'Rakdos', 'Gruul', 'Selesnya', 'Orzhov', 'Izzet', 'Golgari', 'Boros', 'Simic'];
const SHARDS = ['Bant', 'Esper', 'Grixis', 'Jund', 'Naya', 'Abzan', 'Jeskai', 'Sultai', 'Mardu', 'Temur'];
const FOUR_AND_FIVE_COLOR = ['4c', '5c'];

function ISODateToYYYYMMDD(dateString) {
  const locale = 'en-US';

  if (dateString === undefined) {
    return undefined;
  }

  return new Date(dateString).toLocaleDateString(locale);
}

function removeAdjacentDuplicates(arr) {
  return arr.filter((x, i) => i === 0 || x !== arr[i - 1]);
}

export function GetColorIdentity(colors) {
  if (colors.length === 0) {
    return 'Colorless';
  }
  if (colors.length === 1) {
    if (Object.keys(COLOR_MAP).includes(colors[0])) {
      return COLOR_MAP[colors[0]];
    }
    if (colors[0] === 'C') {
      return 'Colorless';
    }
    return 'None';
  }
  if (colors.length > 1) {
    return 'Multicolored';
  }
}

export function GetColorCategory(type, colors, full) {
  if (type.toLowerCase().includes('land')) {
    return 'Lands';
  }
  if (colors.length === 0) {
    return 'Colorless';
  }
  if (colors.length === 1) {
    if (Object.keys(COLOR_MAP).includes(colors[0])) {
      return COLOR_MAP[colors[0]];
    }
    if (colors[0] === 'C') {
      return 'Colorless';
    }
    return 'None';
  }
  if (colors.length > 1) {
    if (full) {
      const ordered = [...'WUBRG'].filter((c) => colors.includes(c)).join('');
      if (colors.length === 2) {
        return [GUILD_MAP[ordered]];
      }
      if (colors.length === 3) {
        return [WEDGE_MAP[ordered]];
      }
      if (colors.length === 4) {
        return '4c';
      }
      if (colors.length === 5) {
        return '5c';
      }
    } else {
      return 'Multicolored';
    }
  }
}

export function getSorts() {
  return [
    'Artist',
    'CMC',
    'Color Category',
    'Color Category Full',
    'Color Count',
    'Color Identity',
    'Color',
    'Creature/Non-Creature',
    'Date Added',
    'Elo',
    'Finish',
    'Guilds',
    'Legality',
    'Loyalty',
    'Manacost Type',
    'Power',
    'Price USD',
    'Price USD Foil',
    'Price EUR',
    'MTGO TIX',
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
    'Devotion to White',
    'Devotion to Blue',
    'Devotion to Black',
    'Devotion to Red',
    'Devotion to Green',
    'Unsorted',
  ];
}

const allDevotions = (cube, color) => {
  const counts = new Set();
  for (const card of cube) {
    counts.add(cardDevotion(card, color));
  }
  return [...counts].sort((a, b) => a - b);
};

const priceBuckets = [0.25, 0.5, 1, 2, 3, 4, 5, 7, 10, 15, 20, 25, 30, 40, 50, 75, 100];

// returns the price bucket label at the index designating the upper bound
// at index == 0, returns < lowest
// at index == length, returs >= highest
function priceBucketLabel(index, prefix) {
  if (index === 0) {
    return `< ${prefix}${priceBuckets[0]}`;
  }
  if (index === priceBuckets.length) {
    return `>= ${prefix}${priceBuckets[priceBuckets.length - 1]}`;
  }
  return `${prefix}${priceBuckets[index - 1]} - ${prefix}${priceBuckets[index] - 0.01}`;
}

function priceBucketIndex(price) {
  if (price < priceBuckets[0]) {
    return 0;
  }
  for (let i = 1; i < priceBuckets.length; i++) {
    if (price >= priceBuckets[i - 1] && price < priceBuckets[i]) {
      return i;
    }
  }
  // Last bucket catches any remaining prices
  return priceBuckets.length;
}

function getPriceBucket(price, prefix) {
  return priceBucketLabel(priceBucketIndex(price), prefix);
}

function getEloBucket(elo) {
  const bucketFloor = Math.floor(elo / 50) * 50;
  return `${bucketFloor}-${bucketFloor + 49}`;
}

function getLabelsRaw(cube, sort) {
  if (sort === 'Color Category') {
    return ['White', 'Blue', 'Black', 'Red', 'Green', 'Hybrid', 'Multicolored', 'Colorless', 'Lands'];
  }
  if (sort === 'Color Category Full') {
    return SINGLE_COLOR_AND_COLORLESS.concat(GUILDS).concat(SHARDS).concat(FOUR_AND_FIVE_COLOR);
  }
  if (sort === 'Color Identity') {
    return ['White', 'Blue', 'Black', 'Red', 'Green', 'Multicolored', 'Colorless'];
  }
  if (sort === 'CMC') {
    return ['0', '1', '2', '3', '4', '5', '6', '7', '8+'];
  }
  if (sort === 'CMC2') {
    return ['0-1', '2', '3', '4', '5', '6', '7+'];
  }
  if (sort === 'CMC-Full') {
    // All CMCs from 0-16, with halves included, plus Gleemax at 1,000,000.
    return ALL_CMCS;
  }
  if (sort === 'Color') {
    return ['White', 'Blue', 'Black', 'Red', 'Green', 'Colorless'];
  }
  if (sort === 'Type') {
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
  }
  if (sort === 'Supertype') {
    return ['Snow', 'Legendary', 'Tribal', 'Basic', 'Elite', 'Host', 'Ongoing', 'World'];
  }
  if (sort === 'Tags') {
    const tags = [];
    for (const card of cube) {
      for (const tag of card.tags) {
        if (tag.length > 0 && !tags.includes(tag)) {
          tags.push(tag);
        }
      }
    }
    return tags.sort();
  }
  if (sort === 'Date Added') {
    const dates = cube.map((card) => card.addedTmsp).sort();
    const days = dates.map((date) => ISODateToYYYYMMDD(date));
    return removeAdjacentDuplicates(days);
  }
  if (sort === 'Status') {
    return ['Not Owned', 'Ordered', 'Owned', 'Premium Owned', 'Proxied'];
  }
  if (sort === 'Finish') {
    return ['Non-foil', 'Foil'];
  }
  if (sort === 'Guilds') {
    return GUILDS;
  }
  if (sort === 'Shards / Wedges') {
    return SHARDS;
  }
  if (sort === 'Color Count') {
    return ['0', '1', '2', '3', '4', '5'];
  }
  if (sort === 'Set') {
    const sets = [];
    for (const card of cube) {
      if (!sets.includes(card.details.set.toUpperCase())) {
        sets.push(card.details.set.toUpperCase());
      }
    }
    return sets.sort();
  }
  if (sort === 'Artist') {
    const artists = [];
    for (const card of cube) {
      if (!artists.includes(card.details.artist)) {
        artists.push(card.details.artist);
      }
    }
    return artists.sort();
  }
  if (sort === 'Rarity') {
    return ['Common', 'Uncommon', 'Rare', 'Mythic', 'Special'];
  }
  if (sort === 'Unsorted') {
    return ['All'];
  }
  if (sort === 'Subtype') {
    const types = new Set();
    for (const card of cube) {
      const split = card.type_line.split(/[-–—]/);
      if (split.length > 1) {
        const subtypes = split[1].trim().split(' ');
        const nonemptySubtypes = subtypes.filter((x) => x.trim());
        for (const subtype of nonemptySubtypes) {
          types.add(subtype.trim());
        }
      }
    }
    return [...types];
  }
  if (sort === 'Types-Multicolor') {
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
  }
  if (sort === 'Legality') {
    return ['Standard', 'Modern', 'Legacy', 'Vintage', 'Pioneer', 'Brawl', 'Historic', 'Pauper', 'Penny', 'Commander'];
  }
  if (sort === 'Power') {
    const items = [];
    for (const card of cube) {
      if (card.details.power) {
        if (!items.includes(card.details.power)) {
          items.push(card.details.power);
        }
      }
    }
    return items.sort((x, y) => {
      if (!/^\d+$/.test(x) || !/^\d+$/.test(y)) {
        if (x > y) {
          return 1;
        }
        if (y > x) {
          return -1;
        }
        return 1;
      }
      if (parseInt(x, 10) > parseInt(y, 10)) {
        return 1;
      }
      if (parseInt(y, 10) > parseInt(x, 10)) {
        return -1;
      }
      return 1;
    });
  }
  if (sort === 'Toughness') {
    const items = [];
    for (const card of cube) {
      if (card.details.toughness) {
        if (!items.includes(card.details.toughness)) {
          items.push(card.details.toughness);
        }
      }
    }
    return items.sort((x, y) => {
      if (!/^\d+$/.test(x) || !/^\d+$/.test(y)) {
        if (x > y) {
          return 1;
        }
        if (y > x) {
          return -1;
        }
        return 1;
      }
      if (parseInt(x, 10) > parseInt(y, 10)) {
        return 1;
      }
      if (parseInt(y, 10) > parseInt(x, 10)) {
        return -1;
      }
      return 1;
    });
  }
  if (sort === 'Loyalty') {
    const items = [];
    for (const card of cube) {
      if (card.details.loyalty) {
        if (!items.includes(card.details.loyalty)) {
          items.push(card.details.loyalty);
        }
      }
    }
    return items.sort((x, y) => {
      if (!/^\d+$/.test(x) || !/^\d+$/.test(y)) {
        if (x > y) {
          return 1;
        }
        if (y > x) {
          return -1;
        }
        return 1;
      }
      if (parseInt(x, 10) > parseInt(y, 10)) {
        return 1;
      }
      if (parseInt(y, 10) > parseInt(x, 10)) {
        return -1;
      }
      return 1;
    });
  }
  if (sort === 'Manacost Type') {
    return ['Gold', 'Hybrid', 'Phyrexian'];
  }
  if (sort === 'Creature/Non-Creature') {
    return ['Creature', 'Non-Creature'];
  }
  if (['Price', 'Price USD', 'Price Foil', 'Price USD Foil'].includes(sort)) {
    const labels = [];
    for (let i = 0; i <= priceBuckets.length; i++) {
      labels.push(priceBucketLabel(i, '$'));
    }
    labels.push('No Price Available');
    return labels;
  }
  if (sort === 'Price EUR') {
    const labels = [];
    for (let i = 0; i <= priceBuckets.length; i++) {
      labels.push(priceBucketLabel(i, '€'));
    }
    labels.push('No Price Available');
    return labels;
  }
  if (sort === 'MTGO TIX') {
    const labels = [];
    for (let i = 0; i <= priceBuckets.length; i++) {
      labels.push(priceBucketLabel(i, ''));
    }
    labels.push('No Price Available');
    return labels;
  }
  if (sort === 'Devotion to White') {
    return allDevotions(cube, 'W');
  }
  if (sort === 'Devotion to Blue') {
    return allDevotions(cube, 'U');
  }
  if (sort === 'Devotion to Black') {
    return allDevotions(cube, 'B');
  }
  if (sort === 'Devotion to Red') {
    return allDevotions(cube, 'R');
  }
  if (sort === 'Devotion to Green') {
    return allDevotions(cube, 'G');
  }
  if (sort === 'Unsorted') {
    return ['All'];
  }
  if (sort === 'Elo') {
    let elos = [];
    for (const card of cube) {
      if (card.details.elo) {
        if (!elos.includes(card.details.elo)) {
          elos.push(card.details.elo);
        }
      }
    }
    elos = elos.sort((x, y) => {
      if (x - y > 0) {
        return 1;
      }
      if (y - x > 0) {
        return -1;
      }
      return 1;
    });
    const buckets = elos.map(getEloBucket);
    const res = [];
    for (const bucket of buckets) {
      if (!res.includes(bucket)) {
        res.push(bucket);
      }
    }
    return res;
  }
  // Unrecognized sort
  return [];
}

function cmcToNumber(card) {
  const cmc = cardCmc(card);
  if (typeof cmc !== 'number') {
    return cmc.indexOf('.') > -1 ? parseFloat(cmc) : parseInt(cmc, 10);
  }
  return cmc;
}

function colorIdentity(card) {
  return card.colors || card.details.color_identity;
}

function typeLine(card) {
  return card.type_line || card.details.type;
}

export function cardGetLabels(card, sort) {
  if (sort === 'Color Category') {
    if (card.colorCategory) return [card.colorCategory];
    return [GetColorCategory(typeLine(card), colorIdentity(card), false)];
  }
  if (sort === 'Color Category Full') {
    if (card.colorCategory) return [card.colorCategory];
    return [GetColorCategory(typeLine(card), colorIdentity(card), true)];
  }
  if (sort === 'Color Identity') {
    return [GetColorIdentity(colorIdentity(card))];
  }
  if (sort === 'Color') {
    if (card.details.colors.length === 0) {
      return ['Colorless'];
    }
    return card.details.colors.map((c) => COLOR_MAP[c]).filter((c) => c);
  }
  if (sort === '4+ Color') {
    if (colorIdentity(card).length < 4) {
      return [];
    }
    if (colorIdentity(card).length === 5) {
      return ['Five Color'];
    }
    return [...'WUBRG'].filter((c) => !colorIdentity(card).includes(c)).map((c) => `Non-${COLOR_MAP[c]}`);
  }
  if (sort === 'CMC') {
    // Sort by CMC, but collapse all >= 8 into '8+' category.
    const cmc = Math.round(cmcToNumber(card));
    if (cmc >= 8) {
      return ['8+'];
    }
    return [cmc.toString()];
  }
  if (sort === 'CMC2') {
    const cmc = Math.round(cmcToNumber(card));
    if (cmc >= 7) {
      return ['7+'];
    }
    if (cmc <= 1) {
      return ['0-1'];
    }
    return [cmc.toString()];
  }
  if (sort === 'CMC-Full') {
    // Round to half-integer.
    return [(Math.round(cmcToNumber(card) * 2) / 2).toString()];
  }
  if (sort === 'Supertype' || sort === 'Type') {
    const split = typeLine(card).split(/[-–—]/);
    let types = null;
    if (split.length > 1) {
      types = split[0]
        .trim()
        .split(' ')
        .map((x) => x.trim())
        .filter((x) => x);
    } else {
      types = typeLine(card)
        .trim()
        .split(' ')
        .map((x) => x.trim())
        .filter((x) => x);
    }
    if (types.includes('Contraption')) {
      return ['Contraption'];
    }
    if (types.includes('Plane')) {
      return ['Plane'];
    }
    const labels = getLabelsRaw(null, sort);
    return types.filter((t) => labels.includes(t));
  }
  if (sort === 'Tags') {
    return card.tags;
  }
  if (sort === 'Status') {
    return [card.status];
  }
  if (sort === 'Finish') {
    return [card.finish];
  }
  if (sort === 'Date Added') {
    return [ISODateToYYYYMMDD(card.addedTmsp)];
  }
  if (sort === 'Guilds') {
    if (colorIdentity(card).length !== 2) {
      return [];
    }
    const ordered = [...'WUBRG'].filter((c) => colorIdentity(card).includes(c)).join('');
    return [GUILD_MAP[ordered]];
  }
  if (sort === 'Shards / Wedges') {
    if (colorIdentity(card).length !== 3) {
      return [];
    }
    const ordered = [...'WUBRG'].filter((c) => colorIdentity(card).includes(c)).join('');
    return [WEDGE_MAP[ordered]];
  }
  if (sort === 'Color Count') {
    return [colorIdentity(card).length];
  }
  if (sort === 'Set') {
    return [card.details.set.toUpperCase()];
  }
  if (sort === 'Rarity') {
    let { rarity } = card.details;
    if (card.rarity) rarity = card.rarity;
    return [rarity[0].toUpperCase() + rarity.slice(1)];
  }
  if (sort === 'Subtype') {
    const split = typeLine(card).split(/[-–—]/);
    if (split.length > 1) {
      const subtypes = split[1].trim().split(' ');
      return subtypes.map((subtype) => subtype.trim()).filter((x) => x);
    }
    return [];
  }
  if (sort === 'Types-Multicolor') {
    if (colorIdentity(card).length <= 1) {
      const split = typeLine(card).split('—');
      const types = split[0].trim().split(' ');
      const type = types[types.length - 1];
      // check last type
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
      }
      return [type];
    }
    if (colorIdentity(card).length === 5) {
      return ['Five Color'];
    }
    return [
      ...cardGetLabels(card, 'Guilds'),
      ...cardGetLabels(card, 'Shards / Wedges'),
      ...cardGetLabels(card, '4+ Color'),
    ];
  }
  if (sort === 'Artist') {
    return [card.details.artist];
  }
  if (sort === 'Legality') {
    return Object.entries(card.details.legalities)
      .filter(([k, v]) => ['legal', 'banned'].includes(v)) // eslint-disable-line no-unused-vars
      .map(([k, v]) => k); // eslint-disable-line no-unused-vars
  }
  if (sort === 'Power') {
    if (card.details.power) {
      return [card.details.power];
    }
    return [];
  }
  if (sort === 'Toughness') {
    if (card.details.toughness) {
      return [card.details.toughness];
    }
    return [];
  }
  if (sort === 'Loyalty') {
    if (card.details.loyalty) {
      return [parseInt(card.details.loyalty, 10)];
    }
    return [];
  }
  if (sort === 'Manacost Type') {
    if (card.details.colors.length > 1 && card.details.parsed_cost.every((symbol) => !symbol.includes('-'))) {
      return ['Gold'];
    }
    if (
      card.details.colors.length > 1 &&
      card.details.parsed_cost.some((symbol) => symbol.includes('-') && !symbol.includes('-p'))
    ) {
      return ['Hybrid'];
    }
    if (card.details.parsed_cost.some((symbol) => symbol.includes('-p'))) {
      return ['Phyrexian'];
    }
    return [];
  }
  if (sort === 'Creature/Non-Creature') {
    return typeLine(card).toLowerCase().includes('creature') ? ['Creature'] : ['Non-Creature'];
  }
  if (sort === 'Price USD' || sort === 'Price') {
    const price = card.details.prices.usd ?? card.details.prices.usd_foil;
    if (price) {
      return [getPriceBucket(price, '$')];
    }
    return ['No Price Available'];
  }
  if (sort === 'Price USD Foil') {
    const price = card.details.prices.usd_foil;
    if (price) {
      return [getPriceBucket(price, '$')];
    }
    return ['No Price Available'];
  }
  if (sort === 'Price EUR') {
    const price = cardPriceEur(card);
    if (price) {
      return [getPriceBucket(price, '€')];
    }
    return ['No Price Available'];
  }
  if (sort === 'MTGO TIX') {
    const price = cardTix(card);
    if (price) {
      return [getPriceBucket(price, '')];
    }
    return ['No Price Available'];
  }
  if (sort === 'Devotion to White') {
    return [cardDevotion(card, 'w').toString()];
  }
  if (sort === 'Devotion to Blue') {
    return [cardDevotion(card, 'u').toString()];
  }
  if (sort === 'Devotion to Black') {
    return [cardDevotion(card, 'b').toString()];
  }
  if (sort === 'Devotion to Red') {
    return [cardDevotion(card, 'r').toString()];
  }
  if (sort === 'Devotion to Green') {
    return [cardDevotion(card, 'g').toString()];
  }
  if (sort === 'Unsorted') {
    return ['All'];
  }
  if (sort === 'Elo') {
    if (card.details.elo) {
      return [getEloBucket(card.details.elo)];
    }
    return [];
  }
  // Unrecognized sort
  return [];
}

export function cardCanBeSorted(card, sort) {
  return cardGetLabels(card, sort).length !== 0;
}

export function cardIsLabel(card, label, sort) {
  return cardGetLabels(card, sort).includes(label);
}

export function formatLabel(label) {
  if (label === undefined) {
    return 'unknown';
  }
  if (label instanceof Date) {
    return ISODateToYYYYMMDD(label);
  }
  return label;
}

// Get labels in string form.
export function getLabels(cube, sort) {
  return getLabelsRaw(cube, sort).map(formatLabel);
}

function sortGroupsOrdered(cards, sort) {
  const labels = getLabelsRaw(cards, sort);
  const allCardLabels = cards.map((card) => [card, cardGetLabels(card, sort)]);
  const compare = (x, y) => labels.indexOf(x) - labels.indexOf(y);
  const byLabel = {};
  for (const [card, cardLabels] of allCardLabels) {
    if (cardLabels && cardLabels.length > 0) {
      cardLabels.sort(compare);
      for (const label of cardLabels) {
        if (!byLabel[label]) {
          byLabel[label] = [];
        }
        byLabel[label].push(card);
      }
    }
  }
  return labels.filter((label) => byLabel[label]).map((label) => [formatLabel(label), byLabel[label]]);
}

export function sortIntoGroups(cards, sort) {
  return fromEntries(sortGroupsOrdered(cards, sort));
}

export function sortDeep(cards, ...sorts) {
  if (sorts.length === 0) {
    return [...cards].sort(alphaCompare);
  }
  const [first, ...rest] = sorts;
  const result = sortGroupsOrdered(cards, first);
  for (const labelGroup of result) {
    if (rest.length > 0) {
      labelGroup[1] = sortDeep(labelGroup[1], ...rest);
    } else {
      labelGroup[1].sort(alphaCompare);
    }
  }
  return result;
}

export function countGroup(group) {
  if (Array.isArray(group[0])) {
    const counts = group.map(([label, group2]) => countGroup(group2)); // eslint-disable-line no-unused-vars
    return counts.reduce((a, b) => a + b, 0);
  }
  return group.length;
}

export function sortForCSVDownload(cards, primary, secondary, tertiary) {
  const exportCards = [];
  cards = sortDeep(cards, primary, secondary, tertiary);
  for (const firstGroup of cards) {
    for (const secondGroup of firstGroup[1]) {
      for (const thirdGroup of secondGroup[1]) {
        for (const card of thirdGroup[1]) {
          exportCards.push(card);
        }
      }
    }
  }
  return exportCards;
}
