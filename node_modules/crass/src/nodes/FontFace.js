const optimization = require('../optimization');
const utils = require('../utils');


module.exports = class FontFace {
    /**
     * @constructor
     * @param {*} content
     */
    constructor(content) {
        this.content = content;
    }

    /**
     * @return {string}
     */
    toString() {
        return '@font-face{' + utils.joinAll(this.content, ';') + '}';
    }

    /**
     * @param {int} indent
     * @return {string}
     */
    pretty(indent) {
        let output = '';
        output += utils.indent('@font-face {') + '\n';
        output += this.content.map(line => utils.indent(line.pretty(indent + 1) + ';', indent + 1)).join('\n') + '\n';
        output += utils.indent('}', indent) + '\n';
        return output;
    }

    /**
     * @param {object} kw
     * @return {FontFace}
     */
    optimize(kw) {
        this.content = optimization.optimizeDeclarations(this.content, kw);
        if (!this.content.length) {
            return null;
        }
        return this;
    }
};
