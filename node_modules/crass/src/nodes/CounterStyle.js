const optimization = require('../optimization');
const utils = require('../utils');


module.exports = class CounterStyle {
    /**
     * @constructor
     * @param {string} name
     * @param {array} content
     */
    constructor(name, content) {
        this.name = name;
        this.content = content;
    }

    /**
     * @return {string}
     */
    toString() {
        let output = '@counter-style ' + this.name;
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
        output += utils.indent('@counter-style ' + this.name + ' {') + '\n';
        output += this.content.map(line => utils.indent(line.pretty(indent + 1), indent)).join(';\n') + '\n';
        output += utils.indent('}', indent) + '\n';
        return output;
    }

    /**
     * @param {object} kw
     * @return {CounterStyle}
     */
    optimize(kw) {
        this.content = optimization.optimizeDeclarations(this.content, kw);
        if (!this.content.length) {
            return null;
        }
        return this;
    }
};
