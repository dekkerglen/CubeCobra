const optimization = require('../optimization');


module.exports = class NotSelector {
    /**
     * @constructor
     * @param {SelectorList} selector
     */
    constructor(selector) {
        this.selector = selector;
    }

    /**
     * @return {string}
     */
    toString() {
        return ':not(' + this.selector.toString() + ')';
    }

    /**
     * @param {int} indent
     * @return {string}
     */
    pretty(indent) {
        return ':not(' + this.selector.pretty(indent) + ')';
    }

    /**
     * @param {object} kw
     * @return {NotSelector}
     */
    optimize(kw) {
        this.selector = optimization.try_(this.selector, kw);
        return this;
    }
};
