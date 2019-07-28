const objects = require('../objects');
const optimization = require('../optimization');


module.exports = class NthSelector {
    /**
     * @constructor
     * @param {string} funcName
     * @param {LinearFunction} linearFunc
     */
    constructor(funcName, linearFunc) {
        this.funcName = funcName;
        this.linearFunc = linearFunc;
    }

    /**
     * @return {string}
     */
    toString() {
        return ':' + this.funcName + '(' + this.linearFunc.toString() + ')';
    }

    /**
     * @param {int} indent
     * @return {string}
     */
    pretty(indent) {
        const lfPretty = this.linearFunc.pretty ? this.linearFunc.pretty(indent) : this.linearFunc.toString();
        return ':' + this.funcName + '(' + lfPretty + ')';
    }

    /**
     * @param {object} kw
     * @return {NthSelector}
     */
    optimize(kw) {
        this.linearFunc = optimization.try_(this.linearFunc, kw);

        // OPT: nth-selectors (2n+1) to (odd)
        if (this.linearFunc.toString() === '2n+1') {
            return new objects.NthSelector(this.funcName, 'odd');
        }

        return this;
    }
};
