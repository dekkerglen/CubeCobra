const optimization = require('../optimization');
const utils = require('../utils');


module.exports = class Viewport {
    /**
     * @constructor
     * @param {array} content
     * @param {string} vendorPrefix
     */
    constructor(content, vendorPrefix) {
        this.content = content;
        this.vendorPrefix = vendorPrefix;
    }

    /**
     * @return {string}
     */
    getBlockHeader() {
        return this.vendorPrefix ? '@' + this.vendorPrefix + 'viewport' : '@viewport';
    }

    /**
     * @return {string}
     */
    toString() {
        let output = this.getBlockHeader();
        output += '{';
        output += utils.joinAll(this.content, ';');
        output += '}';
        return output;
    }

    /**
     * @param {int} indent
     * @return {string}
     */
    pretty(indent) {
        let output = '';
        output += utils.indent(this.getBlockHeader() + ' {') + '\n';
        output += this.content.map(line => utils.indent(line.pretty(indent + 1), indent)).join(';\n') + '\n';
        output += utils.indent('}', indent) + '\n';
        return output;
    }

    /**
     * @param {object} kw
     * @return {Viewport}
     */
    optimize(kw) {
        let oldPrefix;
        if (this.vendorPrefix) {
            oldPrefix = kw.vendorPrefix;
            kw.vendorPrefix = this.vendorPrefix;
        }

        this.content = optimization.optimizeDeclarations(this.content, kw);
        kw.vendorPrefix = oldPrefix;

        if (!this.content.length) return null;

        return this;
    }
};
