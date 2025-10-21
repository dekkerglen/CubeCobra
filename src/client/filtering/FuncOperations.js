import { cardDevotion, cardLegalIn, cardRestrictedIn } from '../utils/cardutil';
import { arrayIsSubset, arraysAreEqualSets } from '../utils/Util';

export const defaultOperation = (op, value) => {
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

export const stringOperation = (op, value) => {
  value = value.toLowerCase();
  switch (op.toString()) {
    case ':':
      return (fieldValue) => fieldValue.toLowerCase().includes(value);
    case '=':
      return (fieldValue) => fieldValue.toLowerCase() === value;
    case '!=':
    case '<>':
      return (fieldValue) => fieldValue.toLowerCase() !== value;
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

const getShorthand = (details) => {
  if (SHORTHAND_OVERRIDES.includes(details.name)) {
    return details.name.split(' ')[0];
  }
  if (details.type.includes('Legendary') && details.name.includes(',')) {
    return details.name.split(',')[0];
  }
  return undefined;
};

export const nameStringOperation = (op, value) => {
  const strOp = stringOperation(op, value);
  return (fieldValue, card) => {
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

export const stringContainOperation = (op, value) => {
  value = value.toLowerCase();
  switch (op.toString()) {
    case ':':
    case '=':
      return (fieldValue) => fieldValue.toLowerCase().includes(value);
    case '!=':
      return (fieldValue) => !fieldValue.toLowerCase().includes(value);
    case '<>':
      return (fieldValue) => fieldValue.toLowerCase() !== value;
    default:
      throw new Error(`Unrecognized operator '${op}'`);
  }
};

export const equalityOperation = (op, value) => {
  switch (op.toString()) {
    case ':':
    case '=':
      return (fieldValue) => fieldValue === value;
    case '!=':
    case '<>':
      return (fieldValue) => fieldValue !== value;
    default:
      throw new Error(`Unrecognized operator '${op}'`);
  }
};

export const setOperation = (op, value) => {
  switch (op.toString()) {
    case ':':
    case '>=':
      return (fieldValue) => arrayIsSubset(value, fieldValue);
    case '=':
      return (fieldValue) => arraysAreEqualSets(value, fieldValue);
    case '!=':
    case '<>':
      return (fieldValue) => !arraysAreEqualSets(value, fieldValue);
    case '<':
      return (fieldValue) => arrayIsSubset(fieldValue, value) && !arraysAreEqualSets(value, fieldValue);
    case '<=':
      return (fieldValue) => arrayIsSubset(fieldValue, value);
    case '>':
      return (fieldValue) => !arraysAreEqualSets(fieldValue, value) && arrayIsSubset(value, fieldValue);
    default:
      throw new Error(`Unrecognized operator ${op}`);
  }
};

export const setContainsOperation = (op, value) => {
  switch (op.toString()) {
    case ':':
    case '=':
      return (fieldValue) => fieldValue.indexOf(value) !== -1;
    case '!=':
    case '<>':
      return (fieldValue) => fieldValue.indexOf(value) === -1;
    default:
      throw new Error(`Unrecognized operator ${op}`);
  }
};

export const rarityOperation = (op, value) => {
  const rarityMap = { c: 0, u: 1, r: 2, m: 3, s: 4 };
  const mappedRarity = rarityMap[value.charAt(0).toLowerCase()];
  switch (op.toString()) {
    case ':':
    case '=':
      return (fieldValue) => rarityMap[fieldValue.charAt(0).toLowerCase()] === mappedRarity;
    case '!=':
    case '<>':
      return (fieldValue) => rarityMap[fieldValue.charAt(0).toLowerCase()] !== mappedRarity;
    case '<':
      return (fieldValue) => rarityMap[fieldValue.charAt(0).toLowerCase()] < mappedRarity;
    case '<=':
      return (fieldValue) => rarityMap[fieldValue.charAt(0).toLowerCase()] <= mappedRarity;
    case '>':
      return (fieldValue) => rarityMap[fieldValue.charAt(0).toLowerCase()] > mappedRarity;
    case '>=':
      return (fieldValue) => rarityMap[fieldValue.charAt(0).toLowerCase()] >= mappedRarity;
    default:
      throw new Error(`Unrecognized operator '${op}'`);
  }
};

const convertParsedCost = (parsedCost) => parsedCost.map((symbol) => symbol.toLowerCase().split('-'));
export const manaCostOperation = (op, value) => {
  switch (op.toString()) {
    case ':':
      return (fieldValue) => arrayIsSubset(value, convertParsedCost(fieldValue), arraysAreEqualSets);
    case '=':
      return (fieldValue) => arraysAreEqualSets(convertParsedCost(fieldValue), value, arraysAreEqualSets);
    case '!=':
    case '<>':
      return (fieldValue) => !arraysAreEqualSets(convertParsedCost(fieldValue), value, arraysAreEqualSets);
    default:
      throw new Error(`Unrecognized operator '${op}'`);
  }
};

const subtractOutValue = (intValue, costValue, remainder, remove, replace, index) => {
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
const canCastWith = (mana, cost) => {
  cost = [...cost]
    .filter((symbol) => symbol[0] === 'x' || symbol[0] === 'y' || symbol[0] === 'z')
    .map((symbol) => {
      // eslint-disable-next-line no-console -- Debugging
      console.debug(symbol);
      if (symbol.length === 1) {
        const intValue = parseInt(symbol[0], 10);
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
    .sort((a, b) => b.length < a.length);
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
    // eslint-disable-next-line no-console -- Debugging
    console.debug(intValue);
    if (Number.isInteger(intValue)) {
      const remove = [];
      const replace = [];
      cost.forEach((costSymbol, index) => {
        if (intValue === 0 || costSymbol.length === 0) return;
        if (Number.isInteger(costSymbol[0])) {
          const [costValue, ...remainder] = costSymbol;
          intValue = subtractOutValue(intValue, costValue, remainder, remove, replace, index);
        }
        if (costSymbol.length === 2 && Number.isInteger(costSymbol[1])) {
          intValue = subtractOutValue(intValue, costSymbol[1], [costSymbol[0]], remove, replace);
        }
      });
      for (let i = remove.length - 1; i >= 0; i--) {
        if (Array.isArray(replace[i])) {
          cost[remove[i]] = replace[i];
        } else {
          cost.splice(remove[i], 1);
        }
      }
    }
  }
  return cost.length === 0;
};
const canCastWithInfinite = (mana, cost) => {
  cost = cost.filter((symbol) => {
    const intValue = parseInt(symbol[0], 10);
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
export const castableCostOperation = (op, value) => {
  switch (op.toString()) {
    case '=':
      return (fieldValue) => canCastWith(value, convertParsedCost(fieldValue));
    case '<>':
    case '!=':
      return (fieldValue) => !canCastWith(value, convertParsedCost(fieldValue));
    case ':':
    case '<=':
      return (fieldValue) => canCastWithInfinite(value, convertParsedCost(fieldValue));
    case '>':
      return (fieldValue) => !canCastWithInfinite(value, convertParsedCost(fieldValue));
    default:
      throw new Error(`Unrecognized operator '${op}'`);
  }
};

export const devotionOperation = (op, symbol, value) => {
  const operation = defaultOperation(op, value);
  return (card) => operation(cardDevotion(card, symbol));
};

export const setCountOperation = (op, value) => {
  const operation = defaultOperation(op, value);
  return (fieldValue) => operation(fieldValue.length);
};

export const setElementOperation = (op, value) => {
  switch (op.toString()) {
    case ':':
      return (fieldValue) => fieldValue?.some((elem) => elem?.toLowerCase().includes(value));
    case '=':
      return (fieldValue) => fieldValue?.some((elem) => elem?.toLowerCase() === value);
    case '<>':
    case '!=':
      return (fieldValue) => !(fieldValue ?? []).some((elem) => elem?.toLowerCase() === value);
    default:
      throw new Error(`Unrecognized operator '${op}'`);
  }
};

export const propertyComparisonOperation = (op) => {
  switch (op.toString()) {
    case ':':
    case '=':
      return (fieldValueOne, fieldValueTwo) => fieldValueOne === fieldValueTwo;
    case '!=':
    case '<>':
      return (fieldValueOne, fieldValueTwo) => fieldValueOne !== fieldValueTwo;
    case '<':
      return (fieldValueOne, fieldValueTwo) => fieldValueOne < fieldValueTwo;
    case '<=':
      return (fieldValueOne, fieldValueTwo) => fieldValueOne <= fieldValueTwo;
    case '>':
      return (fieldValueOne, fieldValueTwo) => fieldValueOne > fieldValueTwo;
    case '>=':
      return (fieldValueOne, fieldValueTwo) => fieldValueOne >= fieldValueTwo;
    default:
      throw new Error(`Unrecognized operator '${op}'`);
  }
};

export const genericCondition = (propertyName, propertyAccessor, valuePred) => {
  const result = (card) => valuePred(propertyAccessor(card), card);
  result.fieldsUsed = [propertyName];
  return result;
};

export const comparisonCondition = (
  valuePred,
  propertyName,
  propertyAccessor,
  otherPropertyName,
  otherPropertyAccessor,
) => {
  const result = (card) => valuePred(propertyAccessor(card), otherPropertyAccessor(card));
  result.fieldsUsed = [propertyName, otherPropertyName];
  return result;
};

export const legalitySuperCondition = (op, legality) => {
  const propertyName = 'legality';
  const target = legality.toLowerCase();

  if (target === 'vintage') {
    // Combine legal and restricted, lowercase all, then use setElementOperation
    const propertyAccessor = (card) => [...cardLegalIn(card), ...cardRestrictedIn(card)].map((s) => s.toLowerCase());

    return genericCondition(propertyName, propertyAccessor, setElementOperation(op, target));
  } else {
    return genericCondition(propertyName, cardLegalIn, setElementOperation(op, target));
  }
};
