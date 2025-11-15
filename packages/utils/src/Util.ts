export function arraysEqual(a: any, b: any): boolean {
  if (a === b) return true;
  if (!Array.isArray(a) || !Array.isArray(b)) return false;
  if (a.length !== b.length) return false;

  for (let i = 0; i < a.length; ++i) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

export function arrayRotate<T>(arr: T[], reverse: boolean): T[] {
  if (reverse) arr.unshift(arr.pop()!);
  else arr.push(arr.shift()!);
  return arr;
}

export function arrayShuffle<T>(array: T[]): T[] {
  let currentIndex = array.length;
  let temporaryValue: T;
  let randomIndex: number;

  // While there remain elements to shuffle...
  while (currentIndex !== 0) {
    // Pick a remaining element...
    randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex -= 1;

    // And swap it with the current element.
    temporaryValue = array[currentIndex]!;
    array[currentIndex] = array[randomIndex]!;
    array[randomIndex] = temporaryValue;
  }

  return array;
}

export function arrayMove<T>(arr: T[], oldIndex: number, newIndex: number): T[] {
  const result = [...arr];
  const [element] = result.splice(oldIndex, 1);
  if (element !== undefined) {
    result.splice(newIndex, 0, element);
  }
  return result;
}

export function arrayDelete<T>(arr: T[], index: number): T[] {
  const result = [...arr];
  result.splice(index, 1);
  return result;
}

export function arrayIsSubset<T>(needles: T[], haystack: T[], comparison?: (a: T, b: T) => boolean): boolean {
  if (comparison) {
    return needles.every((elem) => haystack.some((elem2) => comparison(elem, elem2)));
  }
  return needles.every((x) => haystack.includes(x));
}

export function arraysAreEqualSets<T>(a1: T[], a2: T[], comparison?: (a: T, b: T) => boolean): boolean {
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

export function randomElement<T>(array: T[]): T {
  if (array.length === 0) {
    throw new Error('Cannot get random element from empty array');
  }
  const randomIndex = Math.floor(Math.random() * array.length);
  return array[randomIndex]!;
}

export function fromEntries<T>(entries: [string, T][]): { [key: string]: T } {
  const obj: { [key: string]: T } = {};
  for (const [k, v] of entries) {
    obj[k] = v;
  }
  return obj;
}

export function deepCopy<T>(x: T): T {
  return JSON.parse(JSON.stringify(x));
}

export const COLORS: [string, string][] = [
  ['White', 'W'],
  ['Blue', 'U'],
  ['Black', 'B'],
  ['Red', 'R'],
  ['Green', 'G'],
];

export function isTouchDevice(): boolean {
  // https://stackoverflow.com/questions/4817029/whats-the-best-way-to-detect-a-touch-screen-device-using-javascript
  if (typeof window === 'undefined') {
    return false;
  }

  const prefixes = ' -webkit- -moz- -o- -ms- '.split(' ');

  const mq = (query: string): boolean => window.matchMedia(query).matches;

  if (
    Object.prototype.hasOwnProperty.call(window, 'ontouchstart') ||
    // @ts-expect-error This will be tricky to typecheck
    (window.DocumentTouch && document instanceof window.DocumentTouch)
  ) {
    return true;
  }

  // include the 'heartz' as a way to have a non matching MQ to help terminate the join
  // https://git.io/vznFH
  const query = ['(', prefixes.join('touch-enabled),('), 'heartz', ')'].join('');
  return mq(query);
}

export function getCubeId(cube: { shortId?: string; id: string }): string {
  return cube.shortId || cube.id;
}

export function getCubeCardCountSnippet(
  cube: { categoryPrefixes?: string[]; categoryOverride?: string; cardCount?: number },
  changedCards?: { mainboard?: any[] },
): string {
  const cardCount =
    changedCards && changedCards.mainboard && changedCards.mainboard?.length > 0
      ? changedCards.mainboard.length
      : cube.cardCount;

  return `${cardCount} Card`;
}

export function getCubeCategoryDescriptionSnippet(cube: {
  categoryPrefixes?: string[];
  categoryOverride?: string;
  cardCount?: number;
}): string {
  const overridePrefixes =
    cube.categoryPrefixes && cube.categoryPrefixes.length > 0 ? `${cube.categoryPrefixes.join(' ')} ` : '';

  if (cube.categoryOverride) {
    return `${overridePrefixes}${cube.categoryOverride} Cube`;
  }

  return `${overridePrefixes}Cube`;
}

export function getCubeDescription(
  cube: { categoryPrefixes?: string[]; categoryOverride?: string; cardCount?: number },
  changedCards?: { mainboard?: any[] },
): string {
  return `${getCubeCardCountSnippet(cube, changedCards)} ${getCubeCategoryDescriptionSnippet(cube)}`;
}

export function isInternalURL(to: string): boolean {
  try {
    const url = new URL(to, window.location.origin);
    return url.hostname === window.location.hostname;
  } catch {
    return false;
  }
}
export function toNullableInt(str: string): number | null {
  const val = parseInt(str, 10);
  return Number.isInteger(val) ? val : null;
}

export function isSamePageURL(to: string): boolean {
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

export function getTagColorClass(tagColors: { tag: string; color: string | null }[], tag: string): string {
  const tagColor = tagColors.find((tagColorB) => tag === tagColorB.tag);
  if (tagColor && tagColor.color && tagColor.color !== 'no-color') {
    return `tag-color tag-${tagColor.color}`;
  }
  return '';
}

export async function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function xor(a: string, b: string): string {
  let result = '';
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    result += String.fromCharCode(a.charCodeAt(i) ^ b.charCodeAt(i));
  }
  return result;
}

export function xorStrings(strings: (string | null)[]): string {
  const nonNullStrings = strings.filter((str): str is string => str !== null);

  if (nonNullStrings.length === 0) {
    return '';
  }

  let result: string = nonNullStrings[0]!;
  for (let i = 1; i < nonNullStrings.length; i++) {
    const currentString = nonNullStrings[i];
    if (currentString !== undefined) {
      result = xor(result, currentString);
    }
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
  COLORS,
  getCubeId,
  getCubeDescription,
  isInternalURL,
  toNullableInt,
  isSamePageURL,
  getTagColorClass,
  wait,
  xorStrings,
};
