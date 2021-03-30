import { alphaCompare, arrayIsSubset, fromEntries } from 'utils/Util';
import {
  cardColorIdentity,
  cardDevotion,
  cardPriceEur,
  cardPrice,
  cardTix,
  cardType,
  cardCmc,
  COLOR_COMBINATIONS,
} from 'utils/Card';

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

const SHARD_AND_WEDGE_MAP = {
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

const FOUR_COLOR_MAP = {
  UBRG: 'Non-White',
  WBRG: 'Non-Blue',
  WURG: 'Non-Black',
  WUBG: 'Non-Red',
  WUBR: 'Non-Green',
};

const ALL_CMCS = Array.from(Array(33).keys())
  .map((x) => (x / 2).toString())
  .concat(['1000000']);

const CARD_TYPES = [
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
];

const SINGLE_COLOR = ['White', 'Blue', 'Black', 'Red', 'Green'];
const GUILDS = ['Azorius', 'Dimir', 'Rakdos', 'Gruul', 'Selesnya', 'Orzhov', 'Izzet', 'Golgari', 'Boros', 'Simic'];
const SHARDS_AND_WEDGES = ['Bant', 'Esper', 'Grixis', 'Jund', 'Naya', 'Mardu', 'Temur', 'Abzan', 'Jeskai', 'Sultai'];
const FOUR_AND_FIVE_COLOR = ['Non-White', 'Non-Blue', 'Non-Black', 'Non-Red', 'Non-Green', 'Five Color'];

const ELO_DEFAULT = 1200;

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

function defaultSort(x, y) {
  if (!/^\d+$/.test(x) || !/^\d+$/.test(y)) {
    return x < y ? -1 : 1;
  }
  return parseInt(x, 10) < parseInt(y, 10) ? -1 : 1;
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

export function getColorCombination(colors) {
  if (colors.length < 2) {
    return GetColorIdentity(colors);
  }
  const ordered = [...'WUBRG'].filter((c) => colors.includes(c)).join('');
  if (colors.length === 2) {
    return GUILD_MAP[ordered];
  }
  if (colors.length === 3) {
    return SHARD_AND_WEDGE_MAP[ordered];
  }
  if (colors.length === 4) {
    return FOUR_COLOR_MAP[ordered];
  }
  return 'Five Color';
}

export function GetColorCategory(type, colors) {
  if (type.toLowerCase().includes('land')) {
    return 'Lands';
  }
  return GetColorIdentity(colors);
}

export const SORTS = [
  'Artist',
  'CMC',
  'CMC2',
  'Color Category',
  'Color Category Full',
  'Color Count',
  'Color Identity',
  'Color Identity Full',
  'Color Combination Includes',
  'Includes Color Combination',
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
  'Tags Full',
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

export const ORDERED_SORTS = ['Alphabetical', 'CMC', 'Price'];

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

function getLabelsRaw(cube, sort, showOther) {
  let ret = [];
  if (sort === 'Color Category') {
    ret = ['White', 'Blue', 'Black', 'Red', 'Green', 'Hybrid', 'Multicolored', 'Colorless', 'Lands'];
  }
  if (sort === 'Color Category Full') {
    ret = SINGLE_COLOR.concat(['Colorless'])
      .concat(GUILDS)
      .concat(SHARDS_AND_WEDGES)
      .concat(FOUR_AND_FIVE_COLOR)
      .concat(['Lands']);
  }
  if (sort === 'Color Identity') {
    ret = ['White', 'Blue', 'Black', 'Red', 'Green', 'Multicolored', 'Colorless'];
  }
  if (sort === 'Color Identity Full') {
    ret = SINGLE_COLOR.concat(['Colorless']).concat(GUILDS).concat(SHARDS_AND_WEDGES).concat(FOUR_AND_FIVE_COLOR);
  }
  if (sort === 'Color Combination Includes' || sort === 'Includes Color Combination') {
    ret = ['Colorless'].concat(SINGLE_COLOR).concat(GUILDS).concat(SHARDS_AND_WEDGES).concat(FOUR_AND_FIVE_COLOR);
  }
  if (sort === 'CMC') {
    ret = ['0', '1', '2', '3', '4', '5', '6', '7', '8+'];
  }
  if (sort === 'CMC2') {
    ret = ['0-1', '2', '3', '4', '5', '6', '7+'];
  }
  if (sort === 'CMC-Full') {
    // All CMCs from 0-16, with halves included, plus Gleemax at 1,000,000.
    ret = ALL_CMCS;
  }
  if (sort === 'Color') {
    ret = ['White', 'Blue', 'Black', 'Red', 'Green', 'Colorless'];
  }
  if (sort === 'Type') {
    ret = CARD_TYPES.concat(['Other']);
  }
  if (sort === 'Supertype') {
    ret = ['Snow', 'Legendary', 'Tribal', 'Basic', 'Elite', 'Host', 'Ongoing', 'World'];
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
    ret = tags.sort();
  }
  if (sort === 'Tags Full') {
    // whitespace around ' Untagged ' to prevent collisions
    ret = [...getLabelsRaw(cube, 'Tags'), ' Untagged '];
  }
  if (sort === 'Date Added') {
    const dates = cube.map((card) => card.addedTmsp).sort((a, b) => a - b);
    const days = dates.map((date) => ISODateToYYYYMMDD(date));
    ret = removeAdjacentDuplicates(days);
  }
  if (sort === 'Status') {
    ret = ['Not Owned', 'Ordered', 'Owned', 'Premium Owned', 'Proxied'];
  }
  if (sort === 'Finish') {
    ret = ['Non-foil', 'Foil'];
  }
  if (sort === 'Guilds') {
    ret = GUILDS;
  }
  if (sort === 'Shards / Wedges') {
    ret = SHARDS_AND_WEDGES;
  }
  if (sort === 'Color Count') {
    ret = ['0', '1', '2', '3', '4', '5'];
  }
  if (sort === 'Set') {
    const sets = [];
    for (const card of cube) {
      if (!sets.includes(card.details.set.toUpperCase())) {
        sets.push(card.details.set.toUpperCase());
      }
    }
    ret = sets.sort();
  }
  if (sort === 'Artist') {
    const artists = [];
    for (const card of cube) {
      if (!artists.includes(card.details.artist)) {
        artists.push(card.details.artist);
      }
    }
    ret = artists.sort();
  }
  if (sort === 'Rarity') {
    ret = ['Common', 'Uncommon', 'Rare', 'Mythic', 'Special'];
  }
  if (sort === 'Unsorted') {
    ret = ['All'];
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
    ret = [...types];
  }
  if (sort === 'Types-Multicolor') {
    ret = CARD_TYPES.slice(0, -1)
      .concat(GUILDS)
      .concat(SHARDS_AND_WEDGES)
      .concat(FOUR_AND_FIVE_COLOR)
      .concat(['Land', 'Other']);
  }
  if (sort === 'Legality') {
    ret = ['Standard', 'Modern', 'Legacy', 'Vintage', 'Pioneer', 'Brawl', 'Historic', 'Pauper', 'Penny', 'Commander'];
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
    ret = items.sort(defaultSort);
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
    ret = items.sort(defaultSort);
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
    ret = items.sort(defaultSort);
  }
  if (sort === 'Manacost Type') {
    ret = ['Gold', 'Hybrid', 'Phyrexian'];
  }
  if (sort === 'Creature/Non-Creature') {
    ret = ['Creature', 'Non-Creature'];
  }
  if (['Price', 'Price USD', 'Price Foil', 'Price USD Foil'].includes(sort)) {
    const labels = [];
    for (let i = 0; i <= priceBuckets.length; i++) {
      labels.push(priceBucketLabel(i, '$'));
    }
    labels.push('No Price Available');
    ret = labels;
  }
  if (sort === 'Price EUR') {
    const labels = [];
    for (let i = 0; i <= priceBuckets.length; i++) {
      labels.push(priceBucketLabel(i, '€'));
    }
    labels.push('No Price Available');
    ret = labels;
  }
  if (sort === 'MTGO TIX') {
    const labels = [];
    for (let i = 0; i <= priceBuckets.length; i++) {
      labels.push(priceBucketLabel(i, ''));
    }
    labels.push('No Price Available');
    ret = labels;
  }
  if (sort === 'Devotion to White') {
    ret = allDevotions(cube, 'W');
  }
  if (sort === 'Devotion to Blue') {
    ret = allDevotions(cube, 'U');
  }
  if (sort === 'Devotion to Black') {
    ret = allDevotions(cube, 'B');
  }
  if (sort === 'Devotion to Red') {
    ret = allDevotions(cube, 'R');
  }
  if (sort === 'Devotion to Green') {
    ret = allDevotions(cube, 'G');
  }
  if (sort === 'Unsorted') {
    ret = ['All'];
  }
  if (sort === 'Elo') {
    let elos = [];
    for (const card of cube) {
      const elo = card.details.elo ?? ELO_DEFAULT;
      if (!elos.includes(elo)) {
        elos.push(elo);
      }
    }
    elos = elos.sort((x, y) => (x < y ? -1 : 1));
    const buckets = elos.map(getEloBucket);
    const res = [];
    for (const bucket of buckets) {
      if (!res.includes(bucket)) {
        res.push(bucket);
      }
    }
    ret = res;
  }

  if (showOther) {
    ret.push(' Other ');
  }

  return ret;
}

function cmcToNumber(card) {
  const cmc = cardCmc(card);
  if (typeof cmc !== 'number') {
    return cmc.indexOf('.') > -1 ? parseFloat(cmc) : parseInt(cmc, 10);
  }
  return cmc;
}

export function cardGetLabels(card, sort, showOther) {
  let ret = [];
  if (sort === 'Color Category') {
    ret = [card.colorCategory ?? GetColorCategory(cardType(card), cardColorIdentity(card))];
  }
  if (sort === 'Color Category Full') {
    const colorCategory = card.colorCategory ?? GetColorCategory(cardType(card), cardColorIdentity(card));
    if (colorCategory === 'Multicolored') {
      ret = [getColorCombination(cardColorIdentity(card))];
    }
    ret = [colorCategory];
  }
  if (sort === 'Color Identity') {
    ret = [GetColorIdentity(cardColorIdentity(card))];
  }
  if (sort === 'Color Identity Full') {
    ret = [getColorCombination(cardColorIdentity(card))];
  }
  if (sort === 'Color Combination Includes') {
    ret = COLOR_COMBINATIONS.filter((comb) => arrayIsSubset(cardColorIdentity(card), comb)).map(getColorCombination);
  }
  if (sort === 'Includes Color Combination') {
    ret = COLOR_COMBINATIONS.filter((comb) => arrayIsSubset(comb, cardColorIdentity(card))).map(getColorCombination);
  }
  if (sort === 'Color') {
    if (card.details.colors.length === 0) {
      ret = ['Colorless'];
    }
    ret = card.details.colors.map((c) => COLOR_MAP[c]).filter((c) => c);
  }
  if (sort === '4+ Color') {
    if (cardColorIdentity(card).length < 4) {
      ret = [];
    }
    if (cardColorIdentity(card).length === 5) {
      ret = ['Five Color'];
    }
    ret = [...'WUBRG'].filter((c) => !cardColorIdentity(card).includes(c)).map((c) => `Non-${COLOR_MAP[c]}`);
  }
  if (sort === 'CMC') {
    // Sort by CMC, but collapse all >= 8 into '8+' category.
    const cmc = Math.round(cmcToNumber(card));
    if (cmc >= 8) {
      ret = ['8+'];
    }
    ret = [cmc.toString()];
  }
  if (sort === 'CMC2') {
    const cmc = Math.round(cmcToNumber(card));
    if (cmc >= 7) {
      ret = ['7+'];
    }
    if (cmc <= 1) {
      ret = ['0-1'];
    }
    ret = [cmc.toString()];
  }
  if (sort === 'CMC-Full') {
    // Round to half-integer.
    ret = [(Math.round(cmcToNumber(card) * 2) / 2).toString()];
  }
  if (sort === 'Supertype' || sort === 'Type') {
    const split = cardType(card).split(/[-–—]/);
    let types;
    if (split.length > 1) {
      types = split[0]
        .trim()
        .split(' ')
        .map((x) => x.trim())
        .filter((x) => x);
    } else {
      types = cardType(card)
        .trim()
        .split(' ')
        .map((x) => x.trim())
        .filter((x) => x);
    }
    if (types.includes('Contraption')) {
      ret = ['Contraption'];
    }
    if (types.includes('Plane')) {
      ret = ['Plane'];
    }
    const labels = getLabelsRaw(null, sort);
    ret = types.filter((t) => labels.includes(t));
  }
  if (sort === 'Tags') {
    ret = card.tags;
  }
  if (sort === 'Tags Full') {
    // whitespace around ' Untagged ' to prevent collisions
    ret = card.tags.length === 0 ? [' Untagged '] : card.tags;
  }
  if (sort === 'Status') {
    ret = [card.status];
  }
  if (sort === 'Finish') {
    ret = [card.finish];
  }
  if (sort === 'Date Added') {
    ret = [ISODateToYYYYMMDD(card.addedTmsp)];
  }
  if (sort === 'Guilds') {
    if (cardColorIdentity(card).length !== 2) {
      ret = [];
    }
    const ordered = [...'WUBRG'].filter((c) => cardColorIdentity(card).includes(c)).join('');
    ret = [GUILD_MAP[ordered]];
  }
  if (sort === 'Shards / Wedges') {
    if (cardColorIdentity(card).length !== 3) {
      ret = [];
    }
    const ordered = [...'WUBRG'].filter((c) => cardColorIdentity(card).includes(c)).join('');
    ret = [SHARD_AND_WEDGE_MAP[ordered]];
  }
  if (sort === 'Color Count') {
    ret = [cardColorIdentity(card).length];
  }
  if (sort === 'Set') {
    ret = [card.details.set.toUpperCase()];
  }
  if (sort === 'Rarity') {
    let { rarity } = card.details;
    if (card.rarity) rarity = card.rarity;
    ret = [rarity[0].toUpperCase() + rarity.slice(1)];
  }
  if (sort === 'Subtype') {
    const split = cardType(card).split(/[-–—]/);
    if (split.length > 1) {
      const subtypes = split[1].trim().split(' ');
      ret = subtypes.map((subtype) => subtype.trim()).filter((x) => x);
    }
    ret = [];
  }
  if (sort === 'Types-Multicolor') {
    if (cardColorIdentity(card).length <= 1) {
      const split = cardType(card).split('—');
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
        ret = ['Other'];
      }
      ret = [type];
    }
    if (cardColorIdentity(card).length === 5) {
      ret = ['Five Color'];
    }
    ret = [
      ...cardGetLabels(card, 'Guilds'),
      ...cardGetLabels(card, 'Shards / Wedges'),
      ...cardGetLabels(card, '4+ Color'),
    ];
  }
  if (sort === 'Artist') {
    ret = [card.details.artist];
  }
  if (sort === 'Legality') {
    ret = Object.entries(card.details.legalities)
      .filter(([, v]) => ['legal', 'banned'].includes(v)) // eslint-disable-line no-unused-vars
      .map(([k]) => k); // eslint-disable-line no-unused-vars
  }
  if (sort === 'Power') {
    if (card.details.power) {
      ret = [card.details.power];
    }
    ret = [];
  }
  if (sort === 'Toughness') {
    if (card.details.toughness) {
      ret = [card.details.toughness];
    }
    ret = [];
  }
  if (sort === 'Loyalty') {
    if (card.details.loyalty) {
      ret = [parseInt(card.details.loyalty, 10)];
    }
    ret = [];
  }
  if (sort === 'Manacost Type') {
    if (card.details.colors.length > 1 && card.details.parsed_cost.every((symbol) => !symbol.includes('-'))) {
      ret = ['Gold'];
    }
    if (
      card.details.colors.length > 1 &&
      card.details.parsed_cost.some((symbol) => symbol.includes('-') && !symbol.includes('-p'))
    ) {
      ret = ['Hybrid'];
    }
    if (card.details.parsed_cost.some((symbol) => symbol.includes('-p'))) {
      ret = ['Phyrexian'];
    }
    ret = [];
  }
  if (sort === 'Creature/Non-Creature') {
    ret = cardType(card).toLowerCase().includes('creature') ? ['Creature'] : ['Non-Creature'];
  }
  if (sort === 'Price USD' || sort === 'Price') {
    const price = card.details.prices.usd ?? card.details.prices.usd_foil;
    if (price) {
      ret = [getPriceBucket(price, '$')];
    }
    ret = ['No Price Available'];
  }
  if (sort === 'Price USD Foil') {
    const price = card.details.prices.usd_foil;
    if (price) {
      ret = [getPriceBucket(price, '$')];
    }
    ret = ['No Price Available'];
  }
  if (sort === 'Price EUR') {
    const price = cardPriceEur(card);
    if (price) {
      ret = [getPriceBucket(price, '€')];
    }
    ret = ['No Price Available'];
  }
  if (sort === 'MTGO TIX') {
    const price = cardTix(card);
    if (price) {
      ret = [getPriceBucket(price, '')];
    }
    ret = ['No Price Available'];
  }
  if (sort === 'Devotion to White') {
    ret = [cardDevotion(card, 'w').toString()];
  }
  if (sort === 'Devotion to Blue') {
    ret = [cardDevotion(card, 'u').toString()];
  }
  if (sort === 'Devotion to Black') {
    ret = [cardDevotion(card, 'b').toString()];
  }
  if (sort === 'Devotion to Red') {
    ret = [cardDevotion(card, 'r').toString()];
  }
  if (sort === 'Devotion to Green') {
    ret = [cardDevotion(card, 'g').toString()];
  }
  if (sort === 'Unsorted') {
    ret = ['All'];
  }
  if (sort === 'Elo') {
    ret = [getEloBucket(card.details.elo ?? ELO_DEFAULT)];
  }

  if (showOther && ret === []) ret = [' Other '];
  return ret;
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
export function getLabels(cube, sort, showOther) {
  return getLabelsRaw(cube, sort, showOther).map(formatLabel);
}

export function sortGroupsOrdered(cards, sort, showOther) {
  const labels = getLabelsRaw(cards, sort, showOther);
  const allCardLabels = cards.map((card) => [card, cardGetLabels(card, sort, showOther)]);
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

const OrderSortMap = {
  Alphabetical: alphaCompare,
  CMC: (a, b) => cardCmc(a) - cardCmc(b),
  Price: (a, b) => cardPrice(a) - cardPrice(b),
};

export function sortDeep(cards, showOther, last, ...sorts) {
  if (sorts.length === 0) {
    return [...cards].sort(OrderSortMap[last]);
  }
  const [first, ...rest] = sorts;
  const result = sortGroupsOrdered(cards, first ?? 'Unsorted', showOther);
  for (const labelGroup of result) {
    if (rest.length > 0) {
      labelGroup[1] = sortDeep(labelGroup[1], showOther, last, ...rest);
    } else {
      labelGroup[1].sort(OrderSortMap[last]);
    }
  }
  return result;
}

export function countGroup(group) {
  if (Array.isArray(group[0])) {
    const counts = group.map(([, group2]) => countGroup(group2)); // eslint-disable-line no-unused-vars
    return counts.reduce((a, b) => a + b, 0);
  }
  return group.length;
}

export function sortForCSVDownload(
  cards,
  primary = 'Color Category',
  secondary = 'Types-Multicolor',
  tertiary = 'CMC',
  quaternary = 'Alphabetical',
  showOther = false,
) {
  const exportCards = [];
  cards = sortDeep(cards, showOther, quaternary, primary, secondary, tertiary);
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
