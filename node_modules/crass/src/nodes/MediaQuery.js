const optimization = require('../optimization');
const utils = require('../utils');


module.exports = class MediaQuery {
    /**
     * @constructor
     * @param {string} type
     * @param {string} prefix
     * @param {MediaExpression} expression
     */
    constructor(type, prefix, expression) {
        this.type = type;
        this.prefix = prefix;
        this.expression = expression || [];
    }

    /**
     * @return {string}
     */
    toString() {
        const output = [];
        if (this.type) {
            if (this.prefix) {
                output.push(this.prefix);
            }
            output.push(this.type);
        }
        if (this.type && this.expression.length) {
            output.push('and');
        }
        if (this.expression.length) {
            output.push(utils.joinAll(this.expression, ' and '));
        }
        return output.join(' ');
    }

    /**
     * @return {string}
     */
    pretty(indent) {
        const output = [];
        if (this.type) {
            if (this.prefix) {
                output.push(this.prefix);
            }
            output.push(this.type);
        }
        if (this.type && this.expression.length) {
            output.push('and');
        }
        if (this.expression.length) {
            output.push(utils.joinAll(this.expression, ' and ', utils.prettyMap(indent)));
        }
        return output.join(' ');
    }

    /**
     * @param {object} kw
     * @return {MediaQuery}
     */
    optimize(kw) {
        // TODO(opt): sort expressions
        // TODO(opt): filter bunk expressions
        // OPT: Remove duplicate media expressions
        this.expression = utils.uniq(null, this.expression);
        this.expression = optimization.optimizeList(this.expression, kw);

        // OPT: Remove unsupported media queries.
        if (kw.browser_min && kw.browser_min.ie >= 10) {
            this.expression = this.expression.filter(expr => !expr.ieCrap.slashZero);
            if (!this.expression.length) {
                return null;
            }
        }

        return this;
    }
};
