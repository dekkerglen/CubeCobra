const objects = require('../objects');


module.exports = class SupportsCondition {
    /**
     * @constructor
     * @param {Declaration} condition
     */
    constructor(condition) {
        this.condition = condition;
        this.negated = false;
    }

    /**
     * Negates the condition
     * @return {void}
     */
    negate() {
    	this.negated = !this.negated;
    }

    /**
     * @return {string}
     */
    toString() {
        let output = '';
        if (this.negated) {
            output = 'not ';
        }
        output += '(';
        output += this.condition;
        output += ')';
        return output;
    }

    /**
     * @return {string}
     */
    pretty() {
    	return this.toString();
    }

    /**
     * @param {object} kw
     * @return {SupportsCondition}
     */
    optimize(kw) {
        this.condition = this.condition.optimize(kw);
        // OPT: not(not(foo:bar)) -> (foo:bar)
        if (this.condition instanceof objects.SupportsCondition &&
            this.negated && this.condition.negated) {
            this.condition.negate();
            return this.condition;
        }
        return this;
    }
};
