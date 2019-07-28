const optimization = require('../optimization');
const utils = require('../utils');


module.exports = class Supports {
    /**
     * @constructor
     * @param {SupportsConditionList} conditionList
     * @param {*} blocks
     */
    constructor(conditionList, blocks) {
        this.conditionList = conditionList;
        this.blocks = blocks;
    }

    /**
     * @return {string}
     */
    toString() {
        let output = '@supports ';
        output += this.conditionList.toString();
        output += '{' + utils.joinAll(this.blocks) + '}';
        return output;
    }

    /**
     * @return {string}
     */
    pretty(indent) {
        const conditionList = this.conditionList.pretty(indent);
        let output = utils.indent(
            '@supports ' + conditionList + ' {',
            indent
        ) + '\n';
        output += this.blocks.map(line => utils.indent(line.pretty(indent + 1), indent)).join('\n');
        output += utils.indent('}', indent) + '\n';
        return output;
    }

    /**
     * @param {object} kw
     * @return {Supports}
     */
    optimize(kw) {
        this.conditionList = this.conditionList.optimize(kw);
        this.blocks = optimization.optimizeBlocks(this.blocks, kw);
        return this;
    }
};
