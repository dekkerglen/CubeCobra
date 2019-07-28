const optimization = require('../optimization');


module.exports = class PseudoSelectorFunction {
    /**
     * @constructor
     * @param {string} funcName
     * @param {Expression} expr
     */
    constructor(funcName, expr) {
        this.funcName = funcName;
        this.expr = expr;
    }

    /**
     * @return {string}
     */
    toString() {
        return ':' + this.funcName + '(' + this.expr.toString() + ')';
    }

    /**
     * @param {int} ident
     * @return {string}
     */
    pretty(indent) {
        return ':' + this.funcName + '(' + this.expr.pretty(indent) + ')';
    }

    /**
     * @param {object} kw
     * @return {PseudoSelectorFunction}
     */
    optimize(kw) {
        // OPT: Lowercase pseudo function names.
        this.funcName = this.funcName.toLowerCase();
        this.expr = optimization.try_(this.expr, kw);
        return this;
    }
};
