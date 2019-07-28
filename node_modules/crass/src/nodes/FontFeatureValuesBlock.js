const optimization = require('../optimization');
const utils = require('../utils');


module.exports = class FontFeatureValuesBlock {
    /**
     * @constructor
     * @param {string} blockName
     * @param {*} content
     */
    constructor(blockName, content) {
        this.blockName = blockName;
        this.content = content;
    }

    /**
     * @return {string}
     */
    toString() {
        return this.blockName + '{' + utils.joinAll(this.content, ';') + '}';
    }

    /**
     * @param {int} indent
     * @return {string}
     */
    pretty(indent) {
        let output = '';
        output += utils.indent(this.blockName + ' {') + '\n';
        output += this.content.map(line => utils.indent(line.pretty(indent + 1) + ';', indent + 1)).join('\n') + '\n';
        output += utils.indent('}', indent) + '\n';
        return output;
    }

    /**
     * @param {object} kw
     * @return {FontFeatureValuesBlock}
     */
    optimize(kw) {
        this.content = optimization.optimizeDeclarations(this.content, kw);
        return this;
    }
};
