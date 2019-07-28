const browserSupport = require('../browser_support');
const objects = require('../objects');
const optimization = require('../optimization');
const utils = require('../utils');


module.exports = class Keyframes {
    /**
     * @constructor
     * @param {string} name
     * @param {*} content
     * @param {string} vendorPrefix
     */
    constructor(name, content, vendorPrefix) {
        this.name = name;
        this.content = content;
        this.vendorPrefix = vendorPrefix;
    }

    /**
     * @return {string}
     */
    getBlockHeader() {
        return this.vendorPrefix ? '@' + this.vendorPrefix + 'keyframes ' : '@keyframes ';
    }

    /**
     * @return {string}
     */
    toString() {
        let output = this.getBlockHeader();
        output += this.name;
        output += '{';
        output += utils.joinAll(this.content);
        output += '}';
        return output;
    }

    /**
     * @param {int} indent
     * @return {string}
     */
    pretty(indent) {
        let output = '';
        output += utils.indent(this.getBlockHeader() + this.name + ' {') + '\n';
        output += this.content
            .map(line => utils.indent(line.pretty(indent + 1), indent))
            .join('\n') + '\n';
        output += utils.indent('}', indent) + '\n';
        return output;
    }

    /**
     * @param {object} kw
     * @return {Keyframes}
     */
    optimize(kw) {
        // OPT: Remove unsupported keyframes blocks.
        if (!browserSupport.supportsKeyframe(this.vendorPrefix, kw)) {
            return null;
        }

        kw.insideKeyframes = this.name;

        if (this.vendorPrefix) {
            kw.vendorPrefix = this.vendorPrefix;
        }

        // OPT: Combine keyframes with identical stops.
        this.content = optimization.combineList(
            item => item.stop.toString(),
            (a, b) => new objects.Keyframe(a.stop, a.content.concat(b.content)),
            this.content
        );
        // OPT: Sort keyframes.
        this.content = this.content.sort(function(a, b) {
            return a.stop.toString().localeCompare(b.stop.toString());
        });

        this.content = optimization.optimizeList(this.content, kw);

        // OPT: Combine duplicate keyframes
        const cache = {};
        this.content = this.content.reduce((a, b) => {
            const content = b.content.toString();
            if (content in cache) {
                cache[content].stop = cache[content].stop.concat(b.stop);
                return a;
            }
            cache[content] = b;
            a.push(b);
            return a;
        }, []);

        delete kw.vendorPrefix;
        delete kw.insideKeyframes;

        return this;
    }
};
