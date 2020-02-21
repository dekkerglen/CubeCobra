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
      const { children } = ctx;
      const filters = [];
      for (const ruleName of Object.keys(children)) {
        if (ruleName !== 'EOF') {
          const rules = children[ruleName];
          filters.push(...rules.map((rule) => {
            const negation = rule.children.$negation[0].children;
            const negated = Object.keys(negation).length !== 0;
            const field = getOriginalString(rule.children.$field[0].children);
            const operation = getOriginalString(rule.children.$operation[0].children);
            const vChildren = rule.children.$value[0].children;
            const value = this.visit(Object.values(vChildren)[0]);
            // TODO: Correctly lookup field
            return (card) => (negated ? !value(operation, card[field]) : value(operation, card[field]));
          }));
        }
      }
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
  }

  return new FilterVisitor();
}

export default getFilterVisitorFromParser;
