import { FIELDS_MAP } from 'parsing/filterParser';
import { getOriginalString } from 'parsing/parsingHelpers';

function defaultValueOperatorFor(value) {
  return (operator, fieldValue) => {
    switch (operator) {
      case ':':
      case '=':
        return value === fieldValue;
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

export function getFilterVisitorFromParser(parser) {
  const BaseCstVisitor = parser.getBaseCstVisitorConstructorWithDefaults();
  class FilterVisitor extends BaseCstVisitor {
    constructor() {
      super();
      this.validateVisitor();
    }

    filter(ctx) {
      const filters = ctx.children.condition.map((condition) => {
        const rule = Object.values(condition.children)[0][0];

        const negation = rule.children.$negation[0].children;
        const fieldAbbrv = getOriginalString(rule.children.$field[0].children);
        const operator = getOriginalString(rule.children.$operator[0].children);
        const vChildren = rule.children.$value[0].children;

        const negated = Object.keys(negation).length !== 0;
        const field = FIELDS_MAP[fieldAbbrv];
        if (!field) {
          throw new Error(`No matching field for abbreviation ${fieldAbbrv}`);
        }
        const value = this.visit(Object.values(vChildren)[0]);
        if (!value) {
          throw new Error(`ValueType for ${field} not implemented yet`);
        }

        return (card) => {
          const fieldValue = field.split('.').reduce((obj, fieldName) => obj[fieldName], card);
          const result = value(operator, fieldValue);
          if (negated) {
            return !result;
          }
          return result;
        };
      });
      return (card) => filters.every((filter) => filter(card));
    }

    // eslint-disable-next-line class-methods-use-this
    positiveHalfIntegerValue(ctx) {
      const value = parseFloat(getOriginalString(ctx), 10);
      return defaultValueOperatorFor(value);
    }

    // eslint-disable-next-line class-methods-use-this
    halfIntegerValue(ctx) {
      const value = parseFloat(getOriginalString(ctx), 10);
      return defaultValueOperatorFor(value);
    }

    // eslint-disable-next-line class-methods-use-this
    integerValue(ctx) {
      const value = parseFloat(getOriginalString(ctx), 10);
      return defaultValueOperatorFor(value);
    }

    // eslint-disable-next-line class-methods-use-this
    dollarValue(ctx) {
      const originalString = getOriginalString(ctx).replace('$', '');
      const value = parseFloat(originalString, 10);
      return defaultValueOperatorFor(value);
    }

    // eslint-disable-next-line class-methods-use-this
    finishValue(ctx) {
      const originalString = getOriginalString(ctx);
      return defaultValueOperatorFor(originalString);
    }

    // eslint-disable-next-line class-methods-use-this
    statusValue(ctx) {
      const originalString = getOriginalString(ctx);
      return defaultValueOperatorFor(originalString);
    }

    // eslint-disable-next-line class-methods-use-this
    isValue(ctx) {}

    // eslint-disable-next-line class-methods-use-this
    colorCombinationValue(ctx) {}

    // eslint-disable-next-line class-methods-use-this
    manaCostValue(ctx) {}

    // eslint-disable-next-line class-methods-use-this
    setValue(ctx) {}

    // eslint-disable-next-line class-methods-use-this
    stringValue(ctx) {}
  }

  return new FilterVisitor();
}

export default getFilterVisitorFromParser;
