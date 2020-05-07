import { arrayIsSubset, arraysAreEqualSets } from 'utils/Util';

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

export const rarityOperation = (op, value) => {
  const rarityMap = { c: 0, u: 1, r: 2, m: 3, s: 4 };
  const mappedRarity = rarityMap[value.charAt(0)];
  switch (op.toString()) {
    case ':':
    case '=':
      return (fieldValue) => fieldValue === value;
    case '!=':
    case '<>':
      return (fieldValue) => fieldValue !== value;
    case '<':
      return (fieldValue) => rarityMap[fieldValue.charAt(0)] < mappedRarity;
    case '<=':
      return (fieldValue) => rarityMap[fieldValue.charAt(0)] <= mappedRarity;
    case '>':
      return (fieldValue) => rarityMap[fieldValue.charAt(0)] > mappedRarity;
    case '>=':
      return (fieldValue) => rarityMap[fieldValue.charAt(0)] >= mappedRarity;
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
  console.log(cost.map((c) => c.join('/')).join('|'), mana.join('|'));
  for (const symbol of mana) {
    let intValue = parseInt(symbol, 10);
    if (!Number.isInteger(intValue)) {
      const index = cost.findIndex((costSymbol) => costSymbol.indexOf(symbol) >= 0);
      console.log(index, symbol);
      if (index >= 0) {
        cost.splice(index, 1);
      } else {
        intValue = 1;
      }
    }
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
  console.log(cost);
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
  console.log(cost.join('|'));
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

export const setElementOperation = (op, value) => {
  switch (op.toString()) {
    case ':':
    case '=':
      return (fieldValue) => fieldValue?.some((elem) => elem?.toLowerCase() === value);
    case '<>':
    case '!=':
      return (fieldValue) => !(fieldValue ?? []).some((elem) => elem?.toLowerCase() === value);
    default:
      throw new Error(`Unrecognized operator '${op}'`);
  }
};
