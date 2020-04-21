const OPERATOR_MAP = {
  '>': '$gt',
  '<': '$lt',
  '>=': '$gte',
  '<=': '$lte',
  '=': '$eq',
  ':': '$eq',
  '!=': '$ne',
  '<>': '$ne',
};
const defaultOperation = (op, value) => ({ [OPERATOR_MAP[op]]: value });

const stringOperation = (op, value) => {
  value = value.toLowerCase();
  switch (op.toString()) {
    case ':':
      return { $regex: value, $options: 'i' };
    case '=':
      return { $eq: value };
    case '!=':
    case '<>':
      return { $ne: value };
    default:
      throw new Error(`Unrecognized operator '${op}'`);
  }
};

const stringContainOperation = (op, value) => {
  value = value.toLowerCase();
  switch (op.toString()) {
    case ':':
    case '=':
      return { $regex: value, $options: 'i' };
    case '!=':
      return { $not: { $regex: value, $options: 'i' } };
    case '<>':
      return { $ne: value };
    default:
      throw new Error(`Unrecognized operator '${op}'`);
  }
};

const equalityOperation = (op, value) => {
  switch (op.toString()) {
    case ':':
    case '=':
      return { $eq: value };
    case '!=':
    case '<>':
      return { $ne: value };
    default:
      throw new Error(`Unrecognized operator '${op}'`);
  }
};

const setOperation = (op, value) => {
  switch (op.toString()) {
    case ':':
    case '>=':
      return { $all: value };
    case '=':
      return { $and: [{ $all: value }, { $not: { $elemMatch: { $nin: value } } }] };
    case '!=':
      return { $or: [{ $not: { $all: value } }, { $elemMatch: { $nin: value } }] };
    case '<':
      return { $and: [{ $not: { $elemMatch: { $nin: value } } }, { $not: { $all: value } }] };
    case '<=':
      return { $not: { $elemMatch: { $nin: value } } };
    case '>':
      return { $and: [{ $elemMatch: { $nin: value } }, { $all: value }] };
    default:
      throw new Error(`Unrecognized operator ${op}`);
  }
};

const rarityOperation = (op, value) => {
  switch (op.toString()) {
    case ':':
    case '=':
      return { $eq: value };
    case '!=':
    case '<>':
      return { $ne: value };
    default:
      throw new Error(`Unrecognized operator '${op}'`);
  }
};

const convertParsedCost = (parsedCost) => parsedCost.map((symbol) => symbol.toLowerCase().split('-'));
const manaCostOperation = (op, value) => {
  switch (op.toString()) {
    case ':':
    case '=':
      return { $eq: value.join('') };
    case '!=':
    case '<>':
      return { $ne: value.join('') };
    default:
      throw new Error(`Unrecognized operator '${op}'`);
  }
};

const setElementOperation = (value) => value;

module.exports = {
  defaultOperation,
  stringOperation,
  stringContainOperation,
  equalityOperation,
  setOperation,
  rarityOperation,
  convertParsedCost,
  manaCostOperation,
  setElementOperation,
};
