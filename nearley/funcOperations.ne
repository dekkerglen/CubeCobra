@{%
import { arrayIsSubset, arraysAreEqualSets } from 'utils/Util';
%} # %}

@{%
const defaultOperation = (op, value) => {
  switch (op.toString()) {
  case ":":
  case "=":
    return (fieldValue) => fieldValue === value;
  case "!=":
  case "<>":
    return (fieldValue) => fieldValue !== value;
  case "<":
    return (fieldValue) => fieldValue < value;
  case "<=":
    return (fieldValue) => fieldValue <= value;
  case ">":
    return (fieldValue) => fieldValue > value;
  case ">=":
    return (fieldValue) => fieldValue >= value;
  default:
    throw new Error(`Unrecognized operator '${op}'`);
  }
};
%} # %}

@{%
const stringOperation = (op, value) => {
  value = value.toLowerCase();
  switch (op.toString()) {
  case ":":
    return (fieldValue) => fieldValue.toLowerCase().includes(value);
  case "=":
    return (fieldValue) => fieldValue.toLowerCase() === value;
  case "!=":
  case "<>":
    return (fieldValue) => fieldValue.toLowerCase() !== value;
  default:
    throw new Error(`Unrecognized operator '${op}'`);
  }
};
%} # %}

@{%
const equalityOperation = (op, value) => {
  switch (op.toString()) {
  case ":":
  case "=":
    return (fieldValue) => fieldValue === value;
  case "!=":
  case "<>":
    return (fieldValue) => fieldValue !== value;
  default:
    throw new Error(`Unrecognized operator '${op}'`);
  }
};
%} # %}

@{%
const setOperation = (op, value) => {
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
%} # %}

@{%
const rarityOperation = (op, value) => {
  const rarityMap = { 'c': 0, 'u': 1, 'r': 2, 'm': 3, 's': 4 };
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
%} # %}

@{%
const convertParsedCost = (parsedCost) => parsedCost.map((symbol) => symbol.toLowerCase().split('-'));
const manaCostOperation = (op, value) => {
  switch (op.toString()) {
  case ':':
  case '=':
    return (fieldValue) => arraysAreEqualSets(convertParsedCost(fieldValue), value, arraysAreEqualSets);
  case '!=':
  case '<>':
    return (fieldValue) => !arraysAreEqualSets(convertParsedCost(fieldValue), value, arraysAreEqualSets);
  default:
    throw new Error(`Unrecognized operator '${op}'`);
  }
};
%} # %}

@{%
const setElementOperation = (value) => (fieldValue) => fieldValue.some((elem) => elem?.toLowerCase() === value);
%} # %}
