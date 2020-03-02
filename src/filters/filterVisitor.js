import FilterParser, { COLOR_COMBINATION_NAMES, FIELDS_MAP } from 'filters/filterParser';
import { getOriginalString } from 'parsing/parsingHelpers';

import { CARD_CATEGORY_DETECTORS } from 'utils/Card';
import { arrayIsSubset, arraysAreEqualSets } from 'utils/Util';

function defaultOperationsFor(value) {
  return (operator, fieldValue) => {
    console.log(fieldValue);
    switch (operator) {
      case ':':
      case '=':
        return value === fieldValue;
      case '!=':
        return value !== fieldValue;
      case '<':
        return fieldValue < value;
      case '<=':
        return fieldValue <= value;
      case '>':
        return fieldValue > value;
      case '>=':
        return fieldValue >= value;
      default:
        throw new Error(`Unrecognized operator ${operator}`);
    }
  };
}

function defaultOperationsForString(value) {
  return (operator, fieldValue) => {
    fieldValue = fieldValue.toLowerCase();
    switch (operator) {
      case ':':
        return fieldValue.indexOf(value) !== -1;
      case '=':
        return value === fieldValue;
      case '!=':
        return value !== fieldValue;
      case '<':
        return fieldValue < value;
      case '<=':
        return fieldValue <= value;
      case '>':
        return fieldValue > value;
      case '>=':
        return fieldValue >= value;
      default:
        throw new Error(`Unrecognized operator ${operator}`);
    }
  };
}

function defaultOperationsForSetElement(recognizer) {
  return (operator, fieldValue) => {
    if (operator === ':') {
      return fieldValue.findIndex(recognizer) !== -1;
    }
    throw new Error(`Unrecognized operator ${operator}`);
  };
}

function defaultOperationsForSet(value) {
  return (operator, fieldValue) => {
    switch (operator) {
      case ':':
      case '>=':
        return arrayIsSubset(value, fieldValue);
      case '=':
        return arraysAreEqualSets(value, fieldValue);
      case '!=':
        return !arraysAreEqualSets(value, fieldValue);
      case '<':
        return arrayIsSubset(fieldValue, value) && !arrayIsSubset(value, fieldValue);
      case '<=':
        return arrayIsSubset(fieldValue, value);
      case '>':
        return !arrayIsSubset(fieldValue, value) && arrayIsSubset(value, fieldValue);
      default:
        throw new Error(`Unrecognized operator ${operator}`);
    }
  };
}

function getStringFromEscaped(ctx) {
  let escapedString = getOriginalString(ctx);
  if (escapedString.startsWith("'") || escapedString.startsWith('"')) {
    escapedString = escapedString.slice(1, -1);
  }
  return escapedString
    .replace(/\\\\/g, '\\b')
    .replace(/\\'/g, "'")
    .replace(/\\"/g, '"')
    .replace(/\\n/g, '\n')
    .replace(/\\b/g, '\\');
}

export function getFilterVisitorFromParser(parser) {
  const BaseCstVisitor = parser.getBaseCstVisitorConstructorWithDefaults();
  class FilterVisitor extends BaseCstVisitor {
    parse(ctx) {
      return this.filter(ctx.children.filter[0]);
    }

    filter(ctx) {
      if (ctx && ctx.children && ctx.children.clause && ctx.children.clause.length > 0) {
        let prevClause = this.clause(ctx.children.clause[0]);
        for (let i = 1; i < ctx.children.clause.length; i++) {
          const clause = ctx.children.clause[i];
          const curClause = this.clause(clause);
          const connector = getOriginalString(ctx.children.$connector[i - 1].children);
          if (connector === 'and' || connector === '') {
            prevClause = ((pClause) => (card) => pClause(card) && curClause(card))(prevClause);
          } else if (connector === 'or') {
            prevClause = ((pClause) => (card) => pClause(card) || curClause(card))(prevClause);
          } else {
            throw new Error(`Unrecognized connector '${connector}'`);
          }
        }
        return prevClause;
      }
      return () => true;
    }

    clause(ctx) {
      const negation = ctx.children.$negation[0].children;
      const negated = Object.keys(negation).length !== 0;
      if (ctx.children.filter) {
        const nested = this.filter(ctx.children.filter[0]);
        if (negated) {
          return (card) => !nested(card);
        }
        return nested;
      }
      const condition = Object.values(ctx.children.$condition[0].children)[0][0].children;

      const fieldAbbrv = getOriginalString(condition.$field[0].children);
      const operator = getOriginalString(condition.$operator[0].children);
      const vChildren = condition.$value[0].children;

      const field = FIELDS_MAP[fieldAbbrv];
      if (!field) {
        throw new Error(`No matching field for abbreviation ${fieldAbbrv}`);
      }
      const value = this.visit(Object.values(vChildren)[0]);
      if (!value) {
        throw new Error(`ValueType for ${field} not implemented yet`);
      }

      return (card) => {
        if (!card) {
          return false;
        }
        const fieldValue = field.split('.').reduce((obj, fieldName) => obj[fieldName], card);
        const result = value(operator, fieldValue);
        if (negated) {
          return !result;
        }
        return result;
      };
    }

    // We have to disable these because the methods need to be class members
    // for visit to work correctly, but this is a stateless class so the
    // value methods won't have any need for the this variable.
    // eslint-disable-next-line class-methods-use-this
    positiveHalfIntegerValue(ctx) {
      const value = parseFloat(getOriginalString(ctx), 10);
      return defaultOperationsFor(value);
    }

    // eslint-disable-next-line class-methods-use-this
    halfIntegerValue(ctx) {
      const value = getOriginalString(ctx);
      return defaultOperationsFor(value);
    }

    // eslint-disable-next-line class-methods-use-this
    integerValue(ctx) {
      const value = parseInt(getOriginalString(ctx), 10);
      return defaultOperationsFor(value);
    }

    // eslint-disable-next-line class-methods-use-this
    dollarValue(ctx) {
      const costString = getOriginalString(ctx).replace('$', '');
      const cost = parseFloat(costString, 10);
      return defaultOperationsFor(cost);
    }

    // eslint-disable-next-line class-methods-use-this
    finishValue(ctx) {
      const finish = getOriginalString(ctx);
      const operations = defaultOperationsFor(finish);
      return (operator, fieldValue) => operations(operator, fieldValue.toLowerCase());
    }

    // eslint-disable-next-line class-methods-use-this
    statusValue(ctx) {
      const statusString = getOriginalString(ctx);
      const operations = defaultOperationsFor(statusString);
      return (operator, fieldValue) => operations(operator, fieldValue.toLowerCase());
    }

    // eslint-disable-next-line class-methods-use-this
    rarityValue(ctx) {
      const rarity = getOriginalString(ctx);
      const operations = defaultOperationsFor(rarity);
      return (operator, fieldValue) => operations(operator, fieldValue.toLowerCase()[0]);
    }

    // eslint-disable-next-line class-methods-use-this
    isValue(ctx) {
      const category = getOriginalString(ctx);
      return (operator, fieldValue) => {
        if (operator === ':') {
          return CARD_CATEGORY_DETECTORS[category](fieldValue);
        }
        throw new Error(`Unrecognized operator ${operator}`);
      };
    }

    // eslint-disable-next-line class-methods-use-this
    colorCombinationValue(ctx) {
      const colorCombinationString = getOriginalString(ctx);
      if (/\d+/.test(colorCombinationString)) {
        const operations = defaultOperationsFor(parseInt(colorCombinationString, 10));
        return (operator, fieldValue) => operations(operator, fieldValue.length);
      }
      const colorCombination = (COLOR_COMBINATION_NAMES[colorCombinationString] ?? colorCombinationString)
        .toUpperCase()
        .split('');
      return defaultOperationsForSet(colorCombination);
    }

    // TODO: Implement
    // eslint-disable-next-line class-methods-use-this
    manaCostValue(ctx) {
      const manaCost = getOriginalString(ctx);
      return defaultOperationsForString(manaCost);
    }

    // TODO: Support ordering by release date
    // eslint-disable-next-line class-methods-use-this
    setValue(ctx) {
      const setCode = getOriginalString(ctx);
      return defaultOperationsFor(setCode);
    }

    // eslint-disable-next-line class-methods-use-this
    stringValue(ctx) {
      const unescapedString = getStringFromEscaped(ctx);
      return defaultOperationsForString(unescapedString);
    }

    // eslint-disable-next-line class-methods-use-this
    stringSetValue(ctx) {
      const unescapedString = getStringFromEscaped(ctx.stringValue[0].children);
      return defaultOperationsForSetElement((element) => element && element.toLowerCase() === unescapedString);
    }
  }

  return new FilterVisitor();
}

const FilterVisitor = getFilterVisitorFromParser(FilterParser);

export default FilterVisitor;
