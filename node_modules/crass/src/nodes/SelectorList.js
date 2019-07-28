const objects = require('../objects');
const optimization = require('../optimization');
const utils = require('../utils');


module.exports = class SelectorList {
    /**
     * @constructor
     * @param {array} selectors
     */
    constructor(selectors) {
        this.selectors = selectors;
    }

    /**
     * Adds a selector to the list
     * @param  {*} selector
     * @return {void}
     */
    push(selector) {
        this.selectors.push(selector);
    }

    /**
     * @return {string}
     */
    toString() {
        return utils.joinAll(this.selectors, ',');
    }

    /**
     * @return {string}
     */
    pretty(indent) {
        const separator = this.toString().length < 80 ? ', ' : ',\n' + utils.indent(' ', indent).substr(1);
        return utils.joinAll(this.selectors, separator, utils.prettyMap(indent));
    }

    /**
     * @param {object} kw
     * @return {SelectorList}
     */
    optimize(kw) {
        this.selectors = optimization.optimizeList(this.selectors, kw);

        // OPT: Ignore `* html` hacks from IE6
        if (!kw.saveie) {
            this.selectors = this.selectors.filter(s => !/\* html($| .+)/.exec(s.toString()));
        }

        // OPT: Sort selector lists.
        this.selectors = this.selectors.sort((a, b) => a.toString() < b.toString() ? -1 : 1);
        // OPT: Remove duplicate selectors in a selector list.
        this.selectors = utils.uniq(null, this.selectors);

        this.selectors = this.selectors.filter(x => x);
        if (!this.selectors.length) {
            return null;
        }

        // TODO(opt): Merge selectors.
        return this;
    }
};
