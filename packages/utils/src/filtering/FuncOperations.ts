import { cardDevotion, cardLegalIn, cardRestrictedIn } from '../cardutil';
import Card, { CardDetails } from '../datatypes/Card';
import { arrayIsSubset, arraysAreEqualSets } from '../Util';

type OperatorType = string;
type FilterFunction<T> = (value: T) => boolean;
type FilterFunctionWithCard<T> = (value: T, card: Card) => boolean;
type ComparisonFunction<T> = (fieldValueOne: T, fieldValueTwo: T) => boolean;

export const defaultOperation = (op: OperatorType, value: any): FilterFunction<any> => {
  switch (op.toString()) {
    case ':':
    case '=':
      return (fieldValue) => fieldValue === value;
    case '!=':
    case '<>':
      return (fieldValue) => fieldValue !== value;
    case '<':
      return (fieldValue) => fieldValue < value;
    case '<=':
      return (fieldValue) => fieldValue <= value;
    case '>':
      return (fieldValue) => fieldValue > value;
    case '>=':
      return (fieldValue) => fieldValue >= value;
    default:
      throw new Error(`Unrecognized operator '${op}'`);
  }
};

export const stringOperation = (op: OperatorType, value: string): FilterFunction<string> => {
  value = value.toLowerCase();
  switch (op.toString()) {
    case ':':
      return (fieldValue: string) => fieldValue.toLowerCase().includes(value);
    case '=':
      return (fieldValue: string) => fieldValue.toLowerCase() === value;
    case '!=':
    case '<>':
      return (fieldValue: string) => fieldValue.toLowerCase() !== value;
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
  return (fieldValue: string, card: Card) => {
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
  };
};

export const stringContainOperation = (op: OperatorType, value: string): FilterFunction<string> => {
  value = value.toLowerCase();
  switch (op.toString()) {
    case ':':
    case '=':
      return (fieldValue: string) => fieldValue.toLowerCase().includes(value);
    case '!=':
      return (fieldValue: string) => !fieldValue.toLowerCase().includes(value);
    case '<>':
      return (fieldValue: string) => fieldValue.toLowerCase() !== value;
    default:
      throw new Error(`Unrecognized operator '${op}'`);
  }
};

export const equalityOperation = (op: OperatorType, value: any): FilterFunction<any> => {
  switch (op.toString()) {
    case ':':
    case '=':
      return (fieldValue: any) => fieldValue === value;
    case '!=':
    case '<>':
      return (fieldValue: any) => fieldValue !== value;
    default:
      throw new Error(`Unrecognized operator '${op}'`);
  }
};

export const setOperation = (op: OperatorType, value: any[]): FilterFunction<any[]> => {
  switch (op.toString()) {
    case ':':
    case '>=':
      return (fieldValue: any[]) => arrayIsSubset(value, fieldValue);
    case '=':
      return (fieldValue: any[]) => arraysAreEqualSets(value, fieldValue);
    case '!=':
    case '<>':
      return (fieldValue: any[]) => !arraysAreEqualSets(value, fieldValue);
    case '<':
      return (fieldValue: any[]) => arrayIsSubset(fieldValue, value) && !arraysAreEqualSets(value, fieldValue);
    case '<=':
      return (fieldValue: any[]) => arrayIsSubset(fieldValue, value);
    case '>':
      return (fieldValue: any[]) => !arraysAreEqualSets(fieldValue, value) && arrayIsSubset(value, fieldValue);
    default:
      throw new Error(`Unrecognized operator ${op}`);
  }
};

export const setContainsOperation = (op: OperatorType, value: any): FilterFunction<any[]> => {
  switch (op.toString()) {
    case ':':
    case '=':
      return (fieldValue: any[]) => fieldValue.indexOf(value) !== -1;
    case '!=':
    case '<>':
      return (fieldValue: any[]) => fieldValue.indexOf(value) === -1;
    default:
      throw new Error(`Unrecognized operator ${op}`);
  }
};

export const rarityOperation = (op: OperatorType, value: string): FilterFunction<string> => {
  const rarityMap: Record<string, number> = { c: 0, u: 1, r: 2, m: 3, s: 4 };
  const mappedRarity = rarityMap[value.charAt(0).toLowerCase()];
  if (mappedRarity === undefined) {
    throw new Error(`Invalid rarity value '${value}'`);
  }
  switch (op.toString()) {
    case ':':
    case '=':
      return (fieldValue: string) => (rarityMap[fieldValue.charAt(0).toLowerCase()] ?? -1) === mappedRarity;
    case '!=':
    case '<>':
      return (fieldValue: string) => (rarityMap[fieldValue.charAt(0).toLowerCase()] ?? -1) !== mappedRarity;
    case '<':
      return (fieldValue: string) => (rarityMap[fieldValue.charAt(0).toLowerCase()] ?? -1) < mappedRarity;
    case '<=':
      return (fieldValue: string) => (rarityMap[fieldValue.charAt(0).toLowerCase()] ?? -1) <= mappedRarity;
    case '>':
      return (fieldValue: string) => (rarityMap[fieldValue.charAt(0).toLowerCase()] ?? -1) > mappedRarity;
    case '>=':
      return (fieldValue: string) => (rarityMap[fieldValue.charAt(0).toLowerCase()] ?? -1) >= mappedRarity;
    default:
      throw new Error(`Unrecognized operator '${op}'`);
  }
};

const convertParsedCost = (parsedCost: string[]): string[][] =>
  parsedCost.map((symbol: string) => symbol.toLowerCase().split('-'));

export const manaCostOperation = (op: OperatorType, value: string[][]): FilterFunction<string[]> => {
  switch (op.toString()) {
    case ':':
      return (fieldValue: string[]) => arrayIsSubset(value, convertParsedCost(fieldValue), arraysAreEqualSets);
    case '=':
      return (fieldValue: string[]) => arraysAreEqualSets(convertParsedCost(fieldValue), value, arraysAreEqualSets);
    case '!=':
    case '<>':
      return (fieldValue: string[]) => !arraysAreEqualSets(convertParsedCost(fieldValue), value, arraysAreEqualSets);
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
  switch (op.toString()) {
    case '=':
      return (fieldValue: string[]) => canCastWith(value, convertParsedCost(fieldValue));
    case '<>':
    case '!=':
      return (fieldValue: string[]) => !canCastWith(value, convertParsedCost(fieldValue));
    case ':':
    case '<=':
      return (fieldValue: string[]) => canCastWithInfinite(value, convertParsedCost(fieldValue));
    case '>':
      return (fieldValue: string[]) => !canCastWithInfinite(value, convertParsedCost(fieldValue));
    default:
      throw new Error(`Unrecognized operator '${op}'`);
  }
};

export const devotionOperation = (op: OperatorType, symbol: string, value: number) => {
  const operation = defaultOperation(op, value);
  return (card: Card) => operation(cardDevotion(card, symbol));
};

export const setCountOperation = (op: OperatorType, value: number): FilterFunction<any[]> => {
  const operation = defaultOperation(op, value);
  return (fieldValue: any[]) => operation(fieldValue.length);
};

export const setElementOperation = (op: OperatorType, value: string): FilterFunction<string[] | undefined> => {
  switch (op.toString()) {
    case ':':
      return (fieldValue: string[] | undefined) =>
        fieldValue?.some((elem: string) => elem?.toLowerCase().includes(value)) ?? false;
    case '=':
      return (fieldValue: string[] | undefined) =>
        fieldValue?.some((elem: string) => elem?.toLowerCase() === value) ?? false;
    case '<>':
    case '!=':
      return (fieldValue: string[] | undefined) =>
        !(fieldValue ?? []).some((elem: string) => elem?.toLowerCase() === value);
    default:
      throw new Error(`Unrecognized operator '${op}'`);
  }
};

export const propertyComparisonOperation = (op: OperatorType): ComparisonFunction<any> => {
  switch (op.toString()) {
    case ':':
    case '=':
      return (fieldValueOne: any, fieldValueTwo: any) => fieldValueOne === fieldValueTwo;
    case '!=':
    case '<>':
      return (fieldValueOne: any, fieldValueTwo: any) => fieldValueOne !== fieldValueTwo;
    case '<':
      return (fieldValueOne: any, fieldValueTwo: any) => fieldValueOne < fieldValueTwo;
    case '<=':
      return (fieldValueOne: any, fieldValueTwo: any) => fieldValueOne <= fieldValueTwo;
    case '>':
      return (fieldValueOne: any, fieldValueTwo: any) => fieldValueOne > fieldValueTwo;
    case '>=':
      return (fieldValueOne: any, fieldValueTwo: any) => fieldValueOne >= fieldValueTwo;
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
  return result;
};

export const legalitySuperCondition = (op: OperatorType, legality: string) => {
  const propertyName = 'legality';
  const target = legality.toLowerCase();

  if (target === 'vintage') {
    // Combine legal and restricted, lowercase all, then use setElementOperation
    const propertyAccessor = (card: Card) =>
      [...cardLegalIn(card), ...cardRestrictedIn(card)].map((s) => s.toLowerCase());

    return genericCondition(propertyName, propertyAccessor, setElementOperation(op, target));
  } else {
    return genericCondition(propertyName, cardLegalIn, setElementOperation(op, target));
  }
};
