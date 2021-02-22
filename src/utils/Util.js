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
  return cube.urlAlias || cube.shortID || cube._id;
}

export function getCubeDescription(cube) {
  if (cube.overrideCategory) {
    const overridePrefixes =
      cube.categoryPrefixes && cube.categoryPrefixes.length > 0 ? `${cube.categoryPrefixes.join(' ')} ` : '';
    return `${cube.card_count} Card ${overridePrefixes}${cube.categoryOverride} Cube`;
  }

  return `${cube.card_count} Card ${cube.type} Cube`;
}

export function isInternalURL(to) {
  try {
    const url = new URL(to, window.location.origin);
    return url.hostname === window.location.hostname;
  } catch {
    return false;
  }
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
  isSamePageURL,
};
