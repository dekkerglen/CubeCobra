import { cardDevotion, cardLegalIn, cardRestrictedIn } from '../cardutil';
import Card, { CardDetails } from '../datatypes/Card';
import { arrayIsSubset, arraysAreEqualSets } from '../Util';

type OperatorType = string;
type FilterFunction<T> = (value: T) => boolean;
type FilterFunctionWithCard<T> = (value: T, card: Card) => boolean;
type ComparisonFunction<T> = (fieldValueOne: T, fieldValueTwo: T) => boolean;

// --- Human-readable ("pseudo-English") description support -------------------
// The filter grammar compiles straight into predicate functions, so to explain a
// filter in plain English we attach a `.describe` fragment to every predicate and
// compose those fragments the same way `.fieldsUsed` is composed. Each fragment
// reads naturally after a field label, e.g. label "mana value" + "is 3 or more".

// Attach a description fragment to a predicate and return it (typed passthrough).
const described = <T extends (...args: any[]) => any>(fn: T, describe: string): T => {
  (fn as any).describe = describe;
  return fn;
};

export const titleCase = (value: string): string =>
  value.length === 0 ? value : `${value.charAt(0).toUpperCase()}${value.slice(1)}`;

// Phrasing shared by every numeric comparison (mana value, price, loyalty, ...).
export const numericPhrase = (op: OperatorType, value: number | string): string => {
  switch (op.toString()) {
    case ':':
    case '=':
      return `is ${value}`;
    case '!=':
    case '<>':
      return `is not ${value}`;
    case '<':
      return `is less than ${value}`;
    case '<=':
      return `is ${value} or less`;
    case '>':
      return `is more than ${value}`;
    case '>=':
      return `is ${value} or more`;
    default:
      return `${op} ${value}`;
  }
};

const COLOR_NAMES: Record<string, string> = {
  w: 'White',
  u: 'Blue',
  b: 'Black',
  r: 'Red',
  g: 'Green',
  c: 'Colorless',
};

// Render a color array (e.g. ['w','u']) as "White and Blue"; empty is "colorless".
export const describeColors = (colors: string[]): string => {
  if (!colors || colors.length === 0) {
    return 'colorless';
  }
  const names = colors.map((c) => COLOR_NAMES[c.toLowerCase()] ?? c.toUpperCase());
  if (names.length === 1) {
    return names[0];
  }
  if (names.length === 2) {
    return `${names[0]} and ${names[1]}`;
  }
  return `${names.slice(0, -1).join(', ')}, and ${names[names.length - 1]}`;
};

// Render parsed mana (array of symbols, each a string/number or hybrid array) as
// "{2}{W}{U/R}".
export const describeMana = (symbols: any[]): string =>
  symbols.map((symbol) => `{${(Array.isArray(symbol) ? symbol : [symbol]).join('/').toUpperCase()}}`).join('');

// Internal propertyName (as passed to genericCondition in the grammar) -> label.
export const FIELD_LABELS: Record<string, string> = {
  cmc: 'mana value',
  colors: 'color',
  color_identity: 'color identity',
  colorcategory: 'color category',
  type_line: 'type',
  oracle_text: 'oracle text',
  set: 'set',
  power: 'power',
  toughness: 'toughness',
  pt: 'power + toughness',
  tags: 'tags',
  finish: 'finish',
  legality: 'legality',
  price: 'price (USD)',
  price_normal: 'non-foil price (USD)',
  price_foil: 'foil price (USD)',
  price_eur: 'price (EUR)',
  price_tix: 'price (MTGO tix)',
  status: 'status',
  rarity: 'rarity',
  loyalty: 'loyalty',
  artist: 'artist',
  layout: 'layout',
  elo: 'Elo rating',
  popularity: 'popularity',
  cubecount: 'cube count',
  pickcount: 'pick count',
  name_lower: 'name',
  parsed_cost: 'mana cost',
  collector_number: 'collector number',
  notes: 'notes',
  game: 'game availability',
  firstPrintYear: 'first printed',
  keywords: 'keywords',
  board: 'board',
};

export const fieldLabel = (propertyName: string): string => FIELD_LABELS[propertyName] ?? propertyName;

// `is:` / `not:` categories -> readable phrase (used as "is <phrase>").
export const CATEGORY_LABELS: Record<string, string> = {
  gold: 'gold (multicolored)',
  hybrid: 'hybrid',
  twobrid: 'twobrid',
  phyrexian: 'Phyrexian',
  promo: 'a promo',
  reprint: 'a reprint',
  firstprint: 'a first printing',
  firstprinting: 'a first printing',
  digital: 'digital-only',
  reasonable: 'a reasonable printing',
  default: 'the default printing',
  dfc: 'a double-faced card',
  mdfc: 'a modal double-faced card',
  tdfc: 'a transforming double-faced card',
  meld: 'a meld card',
  transform: 'a transform card',
  split: 'a split card',
  flip: 'a flip card',
  leveler: 'a leveler',
  commander: 'a commander',
  spell: 'a spell',
  permanent: 'a permanent',
  historic: 'historic',
  vanilla: 'a vanilla creature',
  modal: 'modal',
  fullart: 'full-art',
  foil: 'available in foil',
  nonfoil: 'available in non-foil',
  etched: 'available etched',
  altfoil: 'available in alternate foil',
  universesbeyond: 'a Universes Beyond card',
  ub: 'a Universes Beyond card',
  reserved: 'on the Reserved List',
  standard: 'a standard card',
  supplemental: 'a supplemental card',
  voucher: 'a voucher',
  // Land archetypes (is:fetchland, is:shockland, ...).
  bikeland: 'a cycling land',
  cycleland: 'a cycling land',
  bicycleland: 'a cycling land',
  bounceland: 'a bounce land',
  karoo: 'a bounce land',
  canopyland: 'a canopy land',
  canland: 'a canopy land',
  fetchland: 'a fetch land',
  checkland: 'a check land',
  dual: 'a dual land',
  fastland: 'a fast land',
  filterland: 'a filter land',
  gainland: 'a gain land',
  painland: 'a pain land',
  scryland: 'a scry land',
  shadowland: 'a shadow land',
  shockland: 'a shock land',
  storageland: 'a storage land',
  creatureland: 'a creature land',
  manland: 'a creature land',
  triland: 'a tri-land',
  tangoland: 'a battle land',
  battleland: 'a battle land',
  surveilland: 'a surveil land',
};

export const categoryLabel = (category: string): string => CATEGORY_LABELS[category] ?? category;

export const defaultOperation = (op: OperatorType, value: any): FilterFunction<any> => {
  const describe = numericPhrase(op, value);
  switch (op.toString()) {
    case ':':
    case '=':
      return described((fieldValue) => fieldValue === value, describe);
    case '!=':
    case '<>':
      return described((fieldValue) => fieldValue !== value, describe);
    case '<':
      return described((fieldValue) => fieldValue < value, describe);
    case '<=':
      return described((fieldValue) => fieldValue <= value, describe);
    case '>':
      return described((fieldValue) => fieldValue > value, describe);
    case '>=':
      return described((fieldValue) => fieldValue >= value, describe);
    default:
      throw new Error(`Unrecognized operator '${op}'`);
  }
};

export const stringOperation = (op: OperatorType, value: string): FilterFunction<string> => {
  value = value.toLowerCase();
  switch (op.toString()) {
    case ':':
      return described((fieldValue: string) => fieldValue.toLowerCase().includes(value), `contains "${value}"`);
    case '=':
      return described((fieldValue: string) => fieldValue.toLowerCase() === value, `is "${value}"`);
    case '!=':
    case '<>':
      return described((fieldValue: string) => fieldValue.toLowerCase() !== value, `is not "${value}"`);
    default:
      throw new Error(`Unrecognized operator '${op}'`);
  }
};

const NAME_PLACEHOLDER = '~';
const NAME_ALIAS = /\b[Tt]his spell\b/g;

const SHORTHAND_OVERRIDES = [
  'Crovax the Cursed',
  'Darigaaz Reincarnated',
  'Gorm the Great',
  'Haktos the Unscarred',
  'Hazoret the Fervent',
  'Phage the Untouchable',
  'Rakdos the Defiler',
  'Rashka the Slayer',
  'Rasputin Dreamweaver',
  'Rubinia Soulsinger',
];

const getShorthand = (details: CardDetails): string | undefined => {
  if (SHORTHAND_OVERRIDES.includes(details.name)) {
    return details.name.split(' ')[0];
  }
  if (details.type.includes('Legendary') && details.name.includes(',')) {
    return details.name.split(',')[0];
  }
  return undefined;
};

export const nameStringOperation = (op: OperatorType, value: string): ((fieldValue: string, card: Card) => boolean) => {
  const strOp = stringOperation(op, value);
  return described(
    (fieldValue: string, card: Card) => {
      if (!card.details) {
        return strOp(fieldValue);
      }
      let expandedValue = fieldValue
        .replace(new RegExp(card.details.name.replace(/\+/g, '\\+'), 'g'), NAME_PLACEHOLDER)
        .replace(NAME_ALIAS, NAME_PLACEHOLDER);
      const shorthand = getShorthand(card.details);
      if (shorthand) {
        expandedValue = expandedValue.replace(new RegExp(shorthand, 'g'), NAME_PLACEHOLDER);
      }
      return strOp(fieldValue) || strOp(expandedValue);
    },
    (strOp as any).describe,
  );
};

export const stringContainOperation = (op: OperatorType, value: string): FilterFunction<string> => {
  value = value.toLowerCase();
  switch (op.toString()) {
    case ':':
    case '=':
      return described((fieldValue: string) => fieldValue.toLowerCase().includes(value), `contains "${value}"`);
    case '!=':
      return described(
        (fieldValue: string) => !fieldValue.toLowerCase().includes(value),
        `does not contain "${value}"`,
      );
    case '<>':
      return described((fieldValue: string) => fieldValue.toLowerCase() !== value, `is not exactly "${value}"`);
    default:
      throw new Error(`Unrecognized operator '${op}'`);
  }
};

export const equalityOperation = (op: OperatorType, value: any): FilterFunction<any> => {
  switch (op.toString()) {
    case ':':
    case '=':
      return described((fieldValue: any) => fieldValue === value, `is "${value}"`);
    case '!=':
    case '<>':
      return described((fieldValue: any) => fieldValue !== value, `is not "${value}"`);
    default:
      throw new Error(`Unrecognized operator '${op}'`);
  }
};

export const setOperation = (op: OperatorType, value: any[]): FilterFunction<any[]> => {
  const colors = describeColors(value);
  switch (op.toString()) {
    case ':':
    case '>=':
      return described((fieldValue: any[]) => arrayIsSubset(value, fieldValue), `includes ${colors}`);
    case '=':
      return described((fieldValue: any[]) => arraysAreEqualSets(value, fieldValue), `is exactly ${colors}`);
    case '!=':
    case '<>':
      return described((fieldValue: any[]) => !arraysAreEqualSets(value, fieldValue), `is not exactly ${colors}`);
    case '<':
      return described(
        (fieldValue: any[]) => arrayIsSubset(fieldValue, value) && !arraysAreEqualSets(value, fieldValue),
        `is within but not all of ${colors}`,
      );
    case '<=':
      return described((fieldValue: any[]) => arrayIsSubset(fieldValue, value), `is within ${colors}`);
    case '>':
      return described(
        (fieldValue: any[]) => !arraysAreEqualSets(fieldValue, value) && arrayIsSubset(value, fieldValue),
        `includes more than ${colors}`,
      );
    default:
      throw new Error(`Unrecognized operator ${op}`);
  }
};

export const setContainsOperation = (op: OperatorType, value: any): FilterFunction<any[]> => {
  switch (op.toString()) {
    case ':':
    case '=':
      return described((fieldValue: any[]) => fieldValue.indexOf(value) !== -1, `includes ${titleCase(`${value}`)}`);
    case '!=':
    case '<>':
      return described(
        (fieldValue: any[]) => fieldValue.indexOf(value) === -1,
        `does not include ${titleCase(`${value}`)}`,
      );
    default:
      throw new Error(`Unrecognized operator ${op}`);
  }
};

export const rarityOperation = (op: OperatorType, value: string): FilterFunction<string> => {
  const rarityMap: Record<string, number> = { c: 0, u: 1, r: 2, m: 3, s: 4 };
  const rarityNames: Record<string, string> = {
    c: 'common',
    u: 'uncommon',
    r: 'rare',
    m: 'mythic',
    s: 'special',
  };
  const key = value.charAt(0).toLowerCase();
  const mappedRarity = rarityMap[key];
  if (mappedRarity === undefined) {
    throw new Error(`Invalid rarity value '${value}'`);
  }
  const name = rarityNames[key];
  switch (op.toString()) {
    case ':':
    case '=':
      return described(
        (fieldValue: string) => (rarityMap[fieldValue.charAt(0).toLowerCase()] ?? -1) === mappedRarity,
        `is ${name}`,
      );
    case '!=':
    case '<>':
      return described(
        (fieldValue: string) => (rarityMap[fieldValue.charAt(0).toLowerCase()] ?? -1) !== mappedRarity,
        `is not ${name}`,
      );
    case '<':
      return described(
        (fieldValue: string) => (rarityMap[fieldValue.charAt(0).toLowerCase()] ?? -1) < mappedRarity,
        `is lower than ${name}`,
      );
    case '<=':
      return described(
        (fieldValue: string) => (rarityMap[fieldValue.charAt(0).toLowerCase()] ?? -1) <= mappedRarity,
        `is ${name} or lower`,
      );
    case '>':
      return described(
        (fieldValue: string) => (rarityMap[fieldValue.charAt(0).toLowerCase()] ?? -1) > mappedRarity,
        `is higher than ${name}`,
      );
    case '>=':
      return described(
        (fieldValue: string) => (rarityMap[fieldValue.charAt(0).toLowerCase()] ?? -1) >= mappedRarity,
        `is ${name} or higher`,
      );
    default:
      throw new Error(`Unrecognized operator '${op}'`);
  }
};

export const colorCategoryOperation = (op: OperatorType, value: string): FilterFunction<string> => {
  // Map short forms and long forms to the canonical ColorCategory names
  const colorCategoryMap: Record<string, string> = {
    w: 'White',
    u: 'Blue',
    b: 'Black',
    r: 'Red',
    g: 'Green',
    c: 'Colorless',
    m: 'Multicolored',
    l: 'Lands',
    white: 'White',
    blue: 'Blue',
    black: 'Black',
    red: 'Red',
    green: 'Green',
    colorless: 'Colorless',
    multicolored: 'Multicolored',
    land: 'Lands',
  };

  const normalizedValue = colorCategoryMap[value.toLowerCase()];
  if (normalizedValue === undefined) {
    throw new Error(`Invalid color category value '${value}'`);
  }

  switch (op.toString()) {
    case ':':
    case '=':
      return described((fieldValue: string) => fieldValue === normalizedValue, `is ${normalizedValue}`);
    case '!=':
    case '<>':
      return described((fieldValue: string) => fieldValue !== normalizedValue, `is not ${normalizedValue}`);
    default:
      throw new Error(`Unrecognized operator '${op}' for color category`);
  }
};

export const convertParsedCost = (parsedCost: string[]): string[][] =>
  parsedCost.map((symbol: string) => symbol.toLowerCase().split('-'));

export const manaCostOperation = (op: OperatorType, value: string[][]): FilterFunction<string[]> => {
  const cost = describeMana(value);
  switch (op.toString()) {
    case ':':
      return described(
        (fieldValue: string[]) => arrayIsSubset(value, convertParsedCost(fieldValue), arraysAreEqualSets),
        `contains ${cost}`,
      );
    case '=':
      return described(
        (fieldValue: string[]) => arraysAreEqualSets(convertParsedCost(fieldValue), value, arraysAreEqualSets),
        `is exactly ${cost}`,
      );
    case '!=':
    case '<>':
      return described(
        (fieldValue: string[]) => !arraysAreEqualSets(convertParsedCost(fieldValue), value, arraysAreEqualSets),
        `is not exactly ${cost}`,
      );
    default:
      throw new Error(`Unrecognized operator '${op}'`);
  }
};

const subtractOutValue = (
  intValue: number,
  costValue: number,
  remainder: (string | number)[],
  remove: number[],
  replace: (null | (string | number)[])[],
  index: number,
): number => {
  if (intValue > costValue) {
    intValue -= costValue;
    remove.push(index);
    replace.push(null);
  } else if (intValue === costValue) {
    intValue = 0;
    remove.push(index);
    replace.push(null);
  } else if (intValue < costValue) {
    remove.push(index);
    replace.push([costValue - intValue, ...remainder]);
    intValue = 0;
  }
  return intValue;
};
const canCastWith = (mana: string[], cost: (string | number)[][]): boolean => {
  cost = [...cost]
    .filter((symbol) => symbol[0] === 'x' || symbol[0] === 'y' || symbol[0] === 'z')
    .map((symbol) => {
      console.debug(symbol);
      if (symbol.length === 1) {
        const intValue = parseInt(symbol[0] as string, 10);
        if (Number.isInteger(intValue)) {
          return [intValue];
        }
        return symbol;
      }
      if (symbol[0] === '2') {
        return [2, symbol[1]];
      }
      if (symbol[1] === '2') {
        return [symbol[0], 2];
      }
      return symbol;
    })
    .filter((symbol): symbol is (string | number)[] => symbol !== undefined)
    .sort((a, b) => (b.length < a.length ? 1 : -1));
  for (const symbol of mana) {
    let intValue = parseInt(symbol, 10);
    if (!Number.isInteger(intValue)) {
      const index = cost.findIndex((costSymbol) => costSymbol.indexOf(symbol) >= 0);
      if (index >= 0) {
        cost.splice(index, 1);
      } else {
        intValue = 1;
      }
    }

    console.debug(intValue);
    if (Number.isInteger(intValue)) {
      const remove: number[] = [];
      const replace: (null | (string | number)[])[] = [];
      cost.forEach((costSymbol, index) => {
        if (intValue === 0 || costSymbol.length === 0) return;
        if (Number.isInteger(costSymbol[0])) {
          const [costValue, ...remainder] = costSymbol;
          intValue = subtractOutValue(intValue, costValue as number, remainder, remove, replace, index);
        }
        if (costSymbol.length === 2 && Number.isInteger(costSymbol[1])) {
          const secondElement = costSymbol[1];
          if (typeof secondElement === 'number') {
            const firstElement = costSymbol[0];
            if (firstElement !== undefined) {
              intValue = subtractOutValue(intValue, secondElement, [firstElement], remove, replace, index);
            }
          }
        }
      });
      for (let i = remove.length - 1; i >= 0; i--) {
        const removeIndex = remove[i];
        const replaceValue = replace[i];
        if (removeIndex !== undefined) {
          if (Array.isArray(replaceValue)) {
            cost[removeIndex] = replaceValue;
          } else {
            cost.splice(removeIndex, 1);
          }
        }
      }
    }
  }
  return cost.length === 0;
};
const canCastWithInfinite = (mana: string[], cost: (string | number)[][]): boolean => {
  cost = cost.filter((symbol) => {
    const intValue = parseInt(symbol[0] as string, 10);
    return !(
      Number.isInteger(intValue) ||
      symbol[0] === 'x' ||
      symbol[0] === 'y' ||
      symbol[0] === 'z' ||
      symbol[1] === '2'
    );
  });
  for (const symbol of mana) {
    cost = cost.filter((costSymbol) => costSymbol.indexOf(symbol) < 0);
  }
  return cost.length === 0;
};

export const castableCostOperation = (op: OperatorType, value: string[]): FilterFunction<string[]> => {
  const cost = describeMana(value);
  switch (op.toString()) {
    case '=':
      return described(
        (fieldValue: string[]) => canCastWith(value, convertParsedCost(fieldValue)),
        `castable with ${cost}`,
      );
    case '<>':
    case '!=':
      return described(
        (fieldValue: string[]) => !canCastWith(value, convertParsedCost(fieldValue)),
        `not castable with ${cost}`,
      );
    case ':':
    case '<=':
      return described(
        (fieldValue: string[]) => canCastWithInfinite(value, convertParsedCost(fieldValue)),
        `castable with unlimited ${cost}`,
      );
    case '>':
      return described(
        (fieldValue: string[]) => !canCastWithInfinite(value, convertParsedCost(fieldValue)),
        `not castable with unlimited ${cost}`,
      );
    default:
      throw new Error(`Unrecognized operator '${op}'`);
  }
};

export const devotionOperation = (op: OperatorType, symbol: string, value: number) => {
  const operation = defaultOperation(op, value);
  const color = COLOR_NAMES[symbol.toLowerCase()] ?? symbol.toUpperCase();
  return described(
    (card: Card) => operation(cardDevotion(card, symbol)),
    `devotion to ${color} ${numericPhrase(op, value)}`,
  );
};

export const setCountOperation = (op: OperatorType, value: number): FilterFunction<any[]> => {
  const operation = defaultOperation(op, value);
  return described((fieldValue: any[]) => operation(fieldValue.length), `count ${numericPhrase(op, value)}`);
};

export const setElementOperation = (op: OperatorType, value: string): FilterFunction<string[] | undefined> => {
  // Expose the raw value so callers (e.g. banned/restricted) can craft their own phrasing.
  const withValue = (fn: FilterFunction<string[] | undefined>): FilterFunction<string[] | undefined> => {
    (fn as any).element = value;
    return fn;
  };
  switch (op.toString()) {
    case ':':
      return withValue(
        described(
          (fieldValue: string[] | undefined) =>
            fieldValue?.some((elem: string) => elem?.toLowerCase().includes(value)) ?? false,
          `contains "${value}"`,
        ),
      );
    case '=':
      return withValue(
        described(
          (fieldValue: string[] | undefined) =>
            fieldValue?.some((elem: string) => elem?.toLowerCase() === value) ?? false,
          `contains exactly "${value}"`,
        ),
      );
    case '<>':
    case '!=':
      return withValue(
        described(
          (fieldValue: string[] | undefined) =>
            !(fieldValue ?? []).some((elem: string) => elem?.toLowerCase() === value),
          `does not contain "${value}"`,
        ),
      );
    default:
      throw new Error(`Unrecognized operator '${op}'`);
  }
};

// Word used to describe a field-vs-field comparison, e.g. "power is greater than toughness".
const COMPARE_WORDS: Record<string, string> = {
  ':': 'equals',
  '=': 'equals',
  '!=': 'does not equal',
  '<>': 'does not equal',
  '<': 'is less than',
  '<=': 'is at most',
  '>': 'is greater than',
  '>=': 'is at least',
};

export const propertyComparisonOperation = (op: OperatorType): ComparisonFunction<any> => {
  const attach = (fn: ComparisonFunction<any>): ComparisonFunction<any> => {
    (fn as any).compareWord = COMPARE_WORDS[op.toString()] ?? op.toString();
    return fn;
  };
  switch (op.toString()) {
    case ':':
    case '=':
      return attach((fieldValueOne: any, fieldValueTwo: any) => fieldValueOne === fieldValueTwo);
    case '!=':
    case '<>':
      return attach((fieldValueOne: any, fieldValueTwo: any) => fieldValueOne !== fieldValueTwo);
    case '<':
      return attach((fieldValueOne: any, fieldValueTwo: any) => fieldValueOne < fieldValueTwo);
    case '<=':
      return attach((fieldValueOne: any, fieldValueTwo: any) => fieldValueOne <= fieldValueTwo);
    case '>':
      return attach((fieldValueOne: any, fieldValueTwo: any) => fieldValueOne > fieldValueTwo);
    case '>=':
      return attach((fieldValueOne: any, fieldValueTwo: any) => fieldValueOne >= fieldValueTwo);
    default:
      throw new Error(`Unrecognized operator '${op}'`);
  }
};

export const genericCondition = (
  propertyName: string,
  propertyAccessor: (card: Card) => any,
  valuePred: FilterFunctionWithCard<any>,
) => {
  const result = (card: Card) => valuePred(propertyAccessor(card), card);
  result.fieldsUsed = [propertyName];
  // Compose the clause description as "<field label> <value fragment>".
  const fragment = (valuePred as any).describe;
  (result as any).describe = fragment ? `${fieldLabel(propertyName)} ${fragment}` : fieldLabel(propertyName);
  return result;
};

export const comparisonCondition = (
  valuePred: ComparisonFunction<any>,
  propertyName: string,
  propertyAccessor: (card: Card) => any,
  otherPropertyName: string,
  otherPropertyAccessor: (card: Card) => any,
) => {
  const result = (card: Card) => valuePred(propertyAccessor(card), otherPropertyAccessor(card));
  result.fieldsUsed = [propertyName, otherPropertyName];
  const compareWord = (valuePred as any).compareWord ?? 'compared to';
  (result as any).describe = `${fieldLabel(propertyName)} ${compareWord} ${fieldLabel(otherPropertyName)}`;
  return result;
};

export const legalitySuperCondition = (op: OperatorType, legality: string) => {
  const propertyName = 'legality';
  const target = legality.toLowerCase();
  const negated = op.toString() === '!=' || op.toString() === '<>';
  const describe = `${negated ? 'is not legal in' : 'is legal in'} ${titleCase(target)}`;

  let result;
  if (target === 'vintage') {
    // Combine legal and restricted, lowercase all, then use setElementOperation
    const propertyAccessor = (card: Card) =>
      [...cardLegalIn(card), ...cardRestrictedIn(card)].map((s) => s.toLowerCase());

    result = genericCondition(propertyName, propertyAccessor, setElementOperation(op, target));
  } else {
    result = genericCondition(propertyName, cardLegalIn, setElementOperation(op, target));
  }
  (result as any).describe = describe;
  return result;
};
