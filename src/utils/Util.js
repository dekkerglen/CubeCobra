export function arraysEqual(a, b) {
  if (a === b) return true;
  if (!Array.isArray(a) || !Array.isArray(b)) return false;
  if (a.length !== b.length) return false;

  for (let i = 0; i < a.length; ++i) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

export function arrayRotate(arr, reverse) {
  if (reverse) arr.unshift(arr.pop());
  else arr.push(arr.shift());
  return arr;
}

export function arrayShuffle(array) {
  let currentIndex = array.length;
  let temporaryValue;
  let randomIndex;

  // While there remain elements to shuffle...
  while (currentIndex !== 0) {
    // Pick a remaining element...
    randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex -= 1;

    // And swap it with the current element.
    temporaryValue = array[currentIndex];
    array[currentIndex] = array[randomIndex];
    array[randomIndex] = temporaryValue;
  }

  return array;
}

export function arrayMove(arr, oldIndex, newIndex) {
  const result = [...arr];
  const [element] = result.splice(oldIndex, 1);
  result.splice(newIndex, 0, element);
  return result;
}

export function arrayDelete(arr, index) {
  const result = [...arr];
  result.splice(index, 1);
  return result;
}

export function arrayIsSubset(needles, haystack, comparison) {
  if (comparison) {
    return needles.every((elem) => haystack.some((elem2) => comparison(elem, elem2)));
  }
  return needles.every((x) => haystack.includes(x));
}

export function arraysAreEqualSets(a1, a2, comparison) {
  if (a1.length !== a2.length) {
    return false;
  }
  if (comparison) {
    return (
      a1.every((elem) => a2.some((elem2) => comparison(elem, elem2))) &&
      a2.every((elem) => a1.some((elem2) => comparison(elem, elem2)))
    );
  }
  const set1 = new Set(a1);
  const set2 = new Set(a2);
  return a1.every((x) => set2.has(x)) && a2.every((x) => set1.has(x));
}

export function randomElement(array) {
  const randomIndex = Math.floor(Math.random() * array.length);
  return array[randomIndex];
}

export function fromEntries(entries) {
  const obj = {};
  for (const [k, v] of entries) {
    obj[k] = v;
  }
  return obj;
}

export function alphaCompare(a, b) {
  const textA = a.details.name.toUpperCase();
  const textB = b.details.name.toUpperCase();
  return textA.localeCompare(textB);
}

export function cmcColumn(card) {
  let cmc = Object.prototype.hasOwnProperty.call(card, 'cmc') ? card.cmc : card.details.cmc;
  // double equals also handles undefined
  if (cmc == null) {
    cmc = 0;
  }
  if (!Number.isFinite(cmc)) {
    cmc = cmc.indexOf('.') > -1 ? parseFloat(cmc) : parseInt(cmc, 10);
  }
  // Round to half-integer then take ceiling to support Little Girl
  const cmcDoubleInt = Math.round(cmc * 2);
  let cmcInt = Math.round((cmcDoubleInt + (cmcDoubleInt % 2)) / 2);
  if (cmcInt < 0) {
    cmcInt = 0;
  }
  if (cmcInt > 7) {
    cmcInt = 7;
  }
  return cmcInt;
}

function sortInto(card, result) {
  const typeLine = (card.type_line || card.details.type).toLowerCase();
  const row = typeLine.includes('creature') ? 0 : 1;
  const column = cmcColumn(card);
  if (result[row][column].length === 0) {
    result[row][column] = [card];
  } else {
    result[row][column].push(card);
  }
}

export function sortDeck(deck) {
  const result = [new Array(8).fill([]), new Array(8).fill([])];
  for (const item of deck) {
    if (Array.isArray(item)) {
      for (const card of item) {
        sortInto(card, result);
      }
    } else {
      sortInto(item, result);
    }
  }
  return result;
}

export const COLORS = [
  ['White', 'W'],
  ['Blue', 'U'],
  ['Black', 'B'],
  ['Red', 'R'],
  ['Green', 'G'],
];

export function isTouchDevice() {
  // https://stackoverflow.com/questions/4817029/whats-the-best-way-to-detect-a-touch-screen-device-using-javascript
  if (typeof window === 'undefined') {
    return false;
  }

  const prefixes = ' -webkit- -moz- -o- -ms- '.split(' ');

  const mq = (query) => window.matchMedia(query).matches;

  if (
    Object.prototype.hasOwnProperty.call(window, 'ontouchstart') ||
    // eslint-disable-next-line no-undef
    (window.DocumentTouch && document instanceof DocumentTouch)
  ) {
    return true;
  }

  // include the 'heartz' as a way to have a non matching MQ to help terminate the join
  // https://git.io/vznFH
  const query = ['(', prefixes.join('touch-enabled),('), 'heartz', ')'].join('');
  return mq(query);
}

export function getCubeId(cube) {
  return cube.shortId || cube.id;
}

export function getCubeDescription(cube, changedCards) {
  const overridePrefixes =
    cube.categoryPrefixes && cube.categoryPrefixes.length > 0 ? `${cube.categoryPrefixes.join(' ')} ` : '';

  const cardCount = changedCards && changedCards.mainboard ? changedCards.mainboard.length : cube.cardCount;

  if (cube.categoryOverride) {
    return `${cardCount} Card ${overridePrefixes}${cube.categoryOverride} Cube`;
  }

  return `${cardCount} Card ${overridePrefixes}Cube`;
}

export function userIsDocumentOwner(user, doc) {
  if (user && doc?.owner) {
    return doc.owner.id === user.id;
  }
  
  return false;
};
  
export function userIsDocumentCollaborator(user, doc) {
  if (user && doc?.collaborators) {
    return doc.collaborators.some((c) => c.id === user.id);
  }

  return false;
};

export function isInternalURL(to) {
  try {
    const url = new URL(to, window.location.origin);
    return url.hostname === window.location.hostname;
  } catch {
    return false;
  }
}
export function toNullableInt(str) {
  const val = parseInt(str, 10);
  return Number.isInteger(val) ? val : null;
}

export function isSamePageURL(to) {
  try {
    const url = new URL(to, window.location.href);
    return (
      url.hostname === window.location.hostname &&
      url.pathname === window.location.pathname &&
      url.search === window.location.search
    );
  } catch {
    return false;
  }
}
export function getCardColorClass(card) {
  if (!card) {
    return 'colorless';
  }

  const type = card.type_line || card.details.type;
  const colors = card.colors || card.details.color_identity;
  if (type.toLowerCase().includes('land')) {
    return 'lands';
  }
  if (colors.length === 0) {
    return 'colorless';
  }
  if (colors.length > 1) {
    return 'multi';
  }
  if (colors.length === 1 && [...'WUBRGC'].includes(colors[0])) {
    return {
      W: 'white',
      U: 'blue',
      B: 'black',
      R: 'red',
      G: 'green',
      C: 'colorless',
    }[colors[0]];
  }
  return 'colorless';
}

export function getCardTagColorClass(tagColors, card) {
  if (tagColors) {
    const tagColor = tagColors.find(({ tag }) => (card.tags || []).includes(tag));
    if (tagColor && tagColor.color && tagColor.color !== 'no-color' && tagColor.color !== 'None') {
      return `tag-color tag-${tagColor.color}`;
    }
  }
  return getCardColorClass(card);
}

export function getTagColorClass(tagColors, tag) {
  const tagColor = tagColors.find((tagColorB) => tag === tagColorB.tag);
  if (tagColor && tagColor.color && tagColor.color !== 'no-color') {
    return `tag-color tag-${tagColor.color}`;
  }
  return '';
}

export async function wait(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function xor(a, b) {
  let result = '';
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    result += String.fromCharCode(a.charCodeAt(i) ^ b.charCodeAt(i));
  }
  return result;
}

export function xorStrings(strings) {
  const nonNullStrings = strings.filter((str) => str != null);

  if (nonNullStrings.length === 0) {
    return '';
  }
  
  let result = nonNullStrings[0];
  for (let i = 1; i < nonNullStrings.length; i++) {
    result = xor(result, nonNullStrings[i]);
  }
  return result;
}

export default {
  arraysEqual,
  arrayRotate,
  arrayShuffle,
  arrayMove,
  arrayDelete,
  arrayIsSubset,
  arraysAreEqualSets,
  randomElement,
  fromEntries,
  alphaCompare,
  cmcColumn,
  sortDeck,
  COLORS,
  getCubeId,
  getCubeDescription,
  isInternalURL,
  toNullableInt,
  isSamePageURL,
  getCardColorClass,
  getCardTagColorClass,
  getTagColorClass,
  wait,
  xorStrings
};
