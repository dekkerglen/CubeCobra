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
    parse(ctx) {
      return this.filter(ctx.children.filter[0]);
    }

    filter(ctx) {
      if (ctx.children.clause.length > 0) {
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
        const fieldValue = field.split('.').reduce((obj, fieldName) => obj[fieldName], card);
        const result = value(operator, fieldValue);
        if (negated) {
          return !result;
        }
        return result;
      };
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
