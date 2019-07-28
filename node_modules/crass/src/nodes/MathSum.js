const objects = require('../objects');
const unitTypes = require('./helpers/unitTypes');


const flipSignFlag = Symbol();

class MathSum {
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
     * @param {Symbol} flipSign Flips the sign of the operation
     * @return {string}
     */
    toString(flipSign) {
        let output = '';
        const base = this.base.toString();
        output += base;
        output += ' ';
        if (flipSign !== flipSignFlag) {
            output += this.operator;
        } else if (this.operator === '+') {
            output += '-';
        } else {
            output += '+';
        }
        output += ' ';

        if (this.term instanceof MathSum) {
            output += this.term.toString(this.operator === '-' ? flipSignFlag : null);
        } else {
            output += this.term.toString();
        }

        return output;
    }

    /**
     * @param {Symbol} flipSign Flips the sign of the operation
     * @return {string}
     */
    pretty(flipSign) {
        let output = '';
        output += this.base.pretty();
        output += ' ';
        if (flipSign !== flipSignFlag) {
            output += this.operator;
        } else if (this.operator === '+') {
            output += '-';
        } else {
            output += '+';
        }
        output += ' ';

        if (this.term instanceof MathSum) {
            output += this.term.pretty(this.operator === '-' ? flipSignFlag : null);
        } else {
            output += this.term.pretty();
        }
        return output;
    }

    /**
     * @param {object} kw
     * @return {MathSum}
     */
    optimize(kw) {
        this.base = this.base.optimize(kw);
        this.term = this.term.optimize(kw);

        if (!this.base || !this.term) {
            return null;
        }

        // OPT: Try to collapse MathSum expressions
        if (this.base instanceof MathSum && this.term instanceof objects.Dimension) {
            if (this.base.base instanceof objects.Dimension && this.base.base.unit === this.term.unit) {
                if (this.operator === '+') {
                    return new MathSum(
                        new objects.Dimension(
                            new objects.Number(this.base.base.asNumber() + this.term.asNumber()),
                            this.term.unit
                        ),
                        this.base.operator,
                        this.base.term
                    );
                } else {
                    return new MathSum(
                        new objects.Dimension(
                            new objects.Number(this.base.base.asNumber() - this.term.asNumber()),
                            this.term.unit
                        ),
                        this.base.operator,
                        this.base.term
                    );
                }
            } else if (this.base.term instanceof objects.Dimension && this.base.term.unit === this.term.unit) {
                if (this.operator === '+') {
                    return new MathSum(
                        this.base.base,
                        this.base.operator,
                        new objects.Dimension(
                            new objects.Number(
                                this.base.operator === '+' ?
                                    this.base.term.asNumber() + this.term.asNumber() :
                                    this.base.term.asNumber() - this.term.asNumber()
                            ),
                            this.term.unit
                        )
                    );
                } else {
                    return new MathSum(
                        this.base.base,
                        this.base.operator,
                        new objects.Dimension(
                            new objects.Number(
                                this.base.operator === '+' ?
                                    this.base.term.asNumber() - this.term.asNumber() :
                                    this.base.term.asNumber() + this.term.asNumber()
                            ),
                            this.term.unit
                        )
                    );
                }
            }
        } else if (this.term instanceof MathSum && this.base instanceof objects.Dimension) {
            if (this.term.base instanceof objects.Dimension && this.term.base.unit === this.base.unit) {
                if (this.operator === '+') {
                    return new MathSum(
                        new objects.Dimension(
                            new objects.Number(this.base.asNumber() + this.term.base.asNumber()),
                            this.base.unit
                        ),
                        this.term.operator,
                        this.term.term
                    );
                } else {
                    return new MathSum(
                        new objects.Dimension(
                            new objects.Number(this.base.asNumber() - this.term.base.asNumber()),
                            this.base.unit
                        ),
                        this.term.operator === '+' ? '-' : '+',
                        this.term.term
                    );
                }
            } else if (this.term.term instanceof objects.Dimension && this.term.term.unit === this.base.unit) {
                if (this.operator === '+') {
                    return new MathSum(
                        new objects.Dimension(
                            new objects.Number(
                                this.term.operator === '+' ?
                                    this.base.asNumber() + this.term.term.asNumber() :
                                    this.base.asNumber() - this.term.term.asNumber()
                            ),
                            this.base.unit
                        ),
                        this.operator,
                        this.term.base
                    );
                } else {
                    return new MathSum(
                        new objects.Dimension(
                            new objects.Number(
                                this.term.operator === '+' ?
                                    this.base.asNumber() - this.term.term.asNumber() :
                                    this.base.asNumber() + this.term.term.asNumber()
                            ),
                            this.base.unit
                        ),
                        this.operator,
                        this.term.base
                    );
                }
            }
        }

        // OPT: Handle zero gracefully
        if (
            this.base instanceof objects.Dimension &&
            (this.term instanceof objects.Dimension || this.term instanceof objects.Number) &&
            this.term.asNumber() === 0
        ) {
            return this.base;

        } else if (
            this.term instanceof objects.Dimension &&
            (this.base instanceof objects.Dimension || this.base instanceof objects.Number) &&
            this.base.asNumber() === 0
        ) {
            if (this.operator === '+') {
                return this.term;
            }

            return new objects.Dimension(
                new objects.Number(this.term.asNumber() * -1),
                this.term.unit
            );
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
        if (
            (
                this.base instanceof objects.Dimension &&
                this.term instanceof objects.Number
            ) ||
            (
                this.base instanceof objects.Number &&
                this.term instanceof objects.Dimension
            )
        ) {
            return null;
        }

        if (
            this.base instanceof objects.Dimension &&
            this.term instanceof objects.Dimension &&
            this.base.unit === this.term.unit
        ) {
            let val;
            if (this.operator === '+') {
                val = this.base.asNumber() + this.term.asNumber();
            } else if (this.operator === '-') {
                val = this.base.asNumber() - this.term.asNumber();
            } else {
                return this;
            }
            return new objects.Dimension(new objects.Number(val), this.base.unit);

        } else if (
            this.base instanceof objects.Number &&
            this.term instanceof objects.Number
        ) {
            if (this.operator === '+') {
                return new objects.Number(this.base.value + this.term.value);
            } else if (this.operator === '-') {
                return new objects.Number(this.base.value - this.term.value);
            }

        }

        return this;
    }

}

module.exports = MathSum;
