const optimization = require('../optimization');
const utils = require('../utils');


module.exports = class PageMargin {
    /**
     * @constructor
     * @param {string} margin
     * @param {array} content
     */
    constructor(margin, content) {
        this.margin = margin;
        this.content = content;
    }


    /**
     * @return {string}
     */
    toString() {
        return '@' + this.margin + '{' + utils.joinAll(this.content) + '}';
    }

    /**
     * @param {int} indent
     * @return {string}
     */
    pretty(indent) {
        let output = '';
        output += utils.indent('@' + this.margin + ' {') + '\n';
        output += this.content.map(line => utils.indent(line.pretty(indent + 1) + ';', indent + 1)).join('\n') + '\n';
        output += utils.indent('}', indent) + '\n';
        return output;
    }

    /**
     * @param {object} kw
     * @return {PageMargin}
     */
    optimize(kw) {
        this.content = optimization.optimizeDeclarations(this.content, kw);
        return this;
    }
};
