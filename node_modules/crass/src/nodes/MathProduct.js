const objects = require('../objects');
const unitTypes = require('./helpers/unitTypes');


module.exports = class MathProduct {
    /**
     * @constructor
     * @param {*} base
     * @param {string} operator
     * @param {Expression} term
     */
    constructor(base, operator, term) {
        this.base = base;
        this.operator = operator;
        this.term = term;
    }

    /**
     * @return {string}
     */
    toString() {
        let output = '';
        const base = this.base.toString();
        const term = this.term.toString();
        output += this.base instanceof objects.MathSum ? '(' + base + ')' : base;
        output += this.operator;
        output += this.term instanceof objects.MathSum ? '(' + term + ')' : term;
        return output;
    }

    /**
     * @return {string}
     */
    pretty() {
        let output = '';
        const base = this.base.pretty();
        const term = this.term.pretty();
        output += this.base instanceof objects.MathSum ? '(' + base + ')' : base;
        output += ' ';
        output += this.operator;
        output += ' ';
        output += this.term instanceof objects.MathSum ? '(' + term + ')' : term;
        return output;
    }

    /**
     * @param {object} kw
     * @return {MathProduct}
     */
    optimize(kw) {
        this.base = this.base.optimize(kw);
        this.term = this.term.optimize(kw);

        if (!this.base || !this.term) {
            return null;
        }

        // OPT: drop invalid calculations
        if (
            this.base instanceof objects.Dimension &&
            this.term instanceof objects.Dimension &&
            this.base.unit in unitTypes &&
            this.term.unit in unitTypes &&
            unitTypes[this.base.unit] !== unitTypes[this.term.unit]
        ) {
            return null;
        }
        if (this.operator === '/') {
            if (!(this.term instanceof objects.Number)) {
                return null;
            }
            if (this.term.asNumber() === 0) {
                return null;
            }
        }

        if (
            this.base instanceof objects.Dimension &&
            this.term instanceof objects.Dimension &&
            this.base.unit === '%' &&
            this.term.unit === '%'
        ) {
            if (this.operator === '*') {
                return new objects.Dimension(
                    new objects.Number(
                        this.base.asNumber() * this.term.asNumber() / 100
                    ),
                    '%'
                );
            } else if (this.operator === '/') {
                return new objects.Dimension(
                    new objects.Number(
                        this.base.asNumber() / this.term.asNumber() * 100
                    ),
                    '%'
                );
            }
        }

        if (
            this.base instanceof objects.Number &&
            this.term instanceof objects.Dimension &&
            this.operator === '*'
        ) {
            const val = new objects.Number(this.base.asNumber() * this.term.asNumber());
            return new objects.Dimension(val, this.term.unit);
        } else if (
            this.base instanceof objects.Dimension &&
            this.term instanceof objects.Number &&
            this.operator === '*'
        ) {
            const val = new objects.Number(this.term.asNumber() * this.base.asNumber());
            return new objects.Dimension(val, this.base.unit);
        } else if (
            this.base instanceof objects.Dimension &&
            this.term instanceof objects.Number &&
            this.base.asNumber() !== 0 &&
            this.operator === '/'
        ) {
            const val = new objects.Number(this.term.asNumber() / this.base.asNumber());
            return new objects.Dimension(val, this.base.unit);
        } else if (
            this.base instanceof objects.Number &&
            this.term instanceof objects.Number
        ) {
            if (this.operator === '*') {
                return new objects.Number(this.base.value * this.term.value);
            } else if (this.operator === '/' && this.term.value !== 0) {
                return new objects.Number(this.base.value / this.term.value);
            }
        }

        return this;
    }

};
