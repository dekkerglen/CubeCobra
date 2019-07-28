const objects = require('../objects');
const optimization = require('../optimization');
const utils = require('../utils');


module.exports = class Page {
    /**
     * @constructor
     * @param {string} name
     * @param {*} content
     */
    constructor(name, content) {
        this.name = name;
        this.content = content;
    }

    /**
     * @return {string}
     */
    toString() {
        let output = '@page';
        if (this.name) {
            output += ' ' + this.name;
        }
        output += '{';
        output += this.content.map((content, i) => {
            const inst = content.toString();
            if (content instanceof objects.Declaration && i !== this.content.length - 1) {
                return inst + ';';
            }
            return inst;
        }).join('');
        output += '}';
        return output;
    }

    /**
     * @param {int} indent
     * @return {string}
     */
    pretty(indent) {
        let output = '';
        output += utils.indent('@page ' + (this.name ? this.name + ' ' : '') + '{') + '\n';
        output += this.content.map(line => utils.indent(line.pretty(indent + 1) + ';', indent + 1)).join('\n') + '\n';
        output += utils.indent('}', indent) + '\n';
        return output;
    }

    /**
     * @param {object} kw
     * @return {Page}
     */
    optimize(kw) {
        this.content = optimization.optimizeBlocks(this.content, kw);
        return this;
    }
};
