const optimization = require('../../optimization');


module.exports = function chainedSelectorFactory(name, operator) {
    const c = class {
        constructor(ancestor, descendant) {
            this.ancestor = ancestor;
            this.descendant = descendant;
        }

        /**
         * @return {string}
         */
        toString() {
            return `${this.ancestor}${this.operator}${this.descendant}`;
        }

        /**
         * @param {int} indent
         * @return {string}
         */
        pretty(indent) {
            const paddedType = this.operator === ' ' ? ' ' : ` ${this.operator} `;
            return this.ancestor.pretty(indent) + paddedType + this.descendant.pretty(indent);
        }

        /**
         * @param  {object} kw
         * @return {*}
         */
        optimize(kw) {
            this.ancestor = optimization.try_(this.ancestor, kw);
            this.descendant = optimization.try_(this.descendant, kw);

            if (!this.ancestor || !this.descendant) {
                return null;
            }

            return this;
        }
    };

    c.prototype.operator = operator;

    return c;
};
