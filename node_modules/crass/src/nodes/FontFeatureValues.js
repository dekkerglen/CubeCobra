const optimization = require('../optimization');
const utils = require('../utils');


module.exports = class FontFeatureValues {
    /**
     * @constructor
     * @param {string} fontName
     * @param {*} content
     */
    constructor(fontName, content) {
        this.fontName = fontName;
        this.content = content;
    }

    /**
     * @return {string}
     */
    toString() {
        return '@font-feature-values ' + this.fontName + '{' + utils.joinAll(this.content) + '}';
    }

    /**
     * @param {int} indent
     * @return {string}
     */
    pretty(indent) {
        let output = '';
        output += utils.indent('@font-feature-values ' + this.fontName + ' {') + '\n';
        output += this.content.map(line => utils.indent(line.pretty(indent + 1), indent + 1)).join('\n') + '\n';
        output += utils.indent('}', indent) + '\n';
        return output;
    }

    /**
     * @param {object} kw
     * @return {FontFeatureValues}
     */
    optimize(kw) {
        this.content = optimization.optimizeBlocks(this.content, kw);
        if (!this.content.length) {
            return null;
        }
        return this;
    }
};
