const optimization = require('../optimization');
const utils = require('../utils');


module.exports = class SimpleSelector {
    /**
     * @constructor
     * @param {array} conditions
     */
    constructor(conditions) {
        this.conditions = conditions;
    }

    /**
     * @return {string}
     */
    toString() {
        return utils.joinAll(this.conditions);
    }

    /**
     * @param {int} indent
     * @return {string}
     */
    pretty(indent) {
        return utils.joinAll(this.conditions, null, utils.prettyMap(indent));
    }

    /**
     * @param {object} kw
     * @return {SimpleSelector}
     */
    optimize(kw) {
        this.conditions = optimization.optimizeList(this.conditions, kw);

        if (!this.conditions.length || this.conditions.some(x => x === null)) {
            return null;
        }

        // OPT: Remove duplicate conditions from a simple selector.
        this.conditions = utils.uniq(null, this.conditions);

        // OPT(O1): Remove unnecessary wildcard selectors
        if (kw.o1 && this.conditions.length > 1) {
            this.conditions = this.conditions.filter(i => i.toString() !== '*');
        }
        return this;
    }
};
