const objects = require('../objects');
const utils = require('../utils');


module.exports = class SupportsConditionList {
    /**
     * @constructor
     * @param {string} combinator
     * @param {array} conditions
     */
    constructor(combinator, conditions) {
        this.combinator = combinator;
        this.conditions = conditions;
    }

    /**
     * Adds an item to the head of the condition list
     * @param  {*} item
     * @return {void}
     */
    unshift(item) {
        this.conditions.unshift(item);
    }

    /**
     * @return {string}
     */
    toString() {
        return utils.joinAll(
            this.conditions,
            ' ' + this.combinator + ' ',
            item => {
                const output = item.toString();
                return (item instanceof objects.SupportsConditionList && item.combinator !== this.combinator ||
                        item instanceof objects.Declaration) ? '(' + output + ')' : output;
            }
        );
    }

    /**
     * @return {string}
     */
    pretty() {
        return this.toString();
    }

    /**
     * @param {object} kw
     * @return {SupportsConditionList}
     */
    optimize(kw) {
        this.conditions = this.conditions.map(function(condition) {
            return condition.optimize(kw);
        });

        // OPT: Remove duplicate delcarations in @supports condition lists
        this.conditions = utils.uniq(null, this.conditions);

        // OPT: not(x) and not(y) and not(z) -> not(x or y or z)
        if (this.conditions.every(cond => cond instanceof objects.SupportsCondition && cond.negated)) {
            const cond = new objects.SupportsCondition(new objects.SupportsConditionList(
                this.combinator === 'and' ? 'or' : 'and',
                this.conditions.map(condition => condition.condition)
            ));
            cond.negate();
            return cond;
        }

        return this;
    }
};
