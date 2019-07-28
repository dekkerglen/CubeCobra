const optimization = require('../optimization');
const utils = require('../utils');


module.exports = class Keyframe {
    /**
     * @constructor
     * @param {string} stop
     * @param {*} content
     */
    constructor(stop, content) {
        this.stop = stop;
        this.content = content;
    }

    /**
     * @return {string}
     */
    toString() {
        return utils.joinAll(this.stop, ',') + '{' + this.toStringBody() + '}';
    }

    /**
     * @return {string}
     */
    toStringBody() {
        return utils.joinAll(this.content, ';');
    }

    /**
     * @param {int} indent
     * @return {string}
     */
    pretty(indent) {
        let output = '';
        output += utils.indent(
            utils.joinAll(
                this.stop, ', ',
                function(x) {return x.pretty(indent);}
            ) + ' {',
            indent) + '\n';
        output += this.content.map(line => utils.indent(line.pretty(indent + 1) + ';', indent + 1)).join('\n') + '\n';
        output += utils.indent('}', indent) + '\n';
        return output;
    }

    /**
     * @param {object} kw
     * @return {Keyframe}
     */
    optimize(kw) {
        this.stop = optimization.optimizeList(this.stop, kw);
        this.content = optimization.optimizeDeclarations(this.content, kw);
        return this;
    }
};
