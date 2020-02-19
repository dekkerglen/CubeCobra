function getOriginalString(ctx) {
  const tokens = [];
  for (const unorderedTokens of Object.values(ctx)) {
    tokens.push(...unorderedTokens);
  }
  tokens.sort((a, b) => a.startOffset - b.startOffset);
  console.log(tokens);
  return tokens.map((token) => token.image).join('');
}

export function getVisitorFromParser(parser) {
  const BaseCstVisitor = parser.getBaseCstVisitorConstructorWithDefaults();
  class FilterVisitor extends BaseCstVisitor {
    constructor() {
      super();
      this.validateVisitor();
    }

    filter(ctx) {
      const { children } = ctx.children.$condition[0];
      const filters = children.$value.map((valueCtx, i) => {
        const negation = children.$negation[i].children;
        const negated = Object.keys(negation).length !== 0;
        const field = getOriginalString(children.$field[i].children);
        const operation = getOriginalString(children.$operation[i].children);
        const vChildren = valueCtx.children;
        const value = this.visit(Object.values(vChildren)[0]);
        console.log(negated, value, operation, field);
        // TODO: Correctly lookup field
        return (card) => (negated ? !value(operation, card[field]) : value(operation, card[field]));
      });
      return (card) => filters.every((filter) => filter(card));
    }

    // eslint-disable-next-line class-methods-use-this
    positiveHalfIntegerValue(ctx) {
      const value = parseFloat(getOriginalString(ctx), 10);
      console.log('Value is: ', value);
      return (operator, fieldValue) => {
        switch (operator) {
          case ':':
            return value === fieldValue;
          default:
            throw new Error(`Unrecognized operator ${operator}`);
        }
      };
    }
  }

  return new FilterVisitor();
}

export default getVisitorFromParser;
