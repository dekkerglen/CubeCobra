const objects = require('../objects');
const optimization = require('../optimization');
const utils = require('../utils');


module.exports = class Stylesheet {
    /**
     * @constructor
     * @param {Charset} charset
     * @param {Import[]} imports
     * @param {Namespace[]} namespaces
     * @param {*} content
     */
    constructor(charset, imports, namespaces, content) {
        this.charset = charset;
        this.imports = imports;
        this.namespaces = namespaces;
        this.content = content;
    }

    /**
     * @return {string}
     */
    toString() {
        let output = '';
        if (this.charset) {
            output += this.charset.toString();
        }
        if (this.imports.length) {
            output += utils.joinAll(this.imports);
        }
        if (this.namespaces.length) {
            output += utils.joinAll(this.namespaces);
        }
        if (this.content.length) {
            output += utils.joinAll(this.content);
        }
        return output;
    };

    /**
     * @return {string}
     */
    pretty(indent = 0) {
        let output = '';
        if (this.charset) {
            output += this.charset.pretty(indent);
        }
        if (this.imports.length) {
            output += utils.joinAll(this.imports, null, utils.prettyMap(indent));
        }
        if (this.namespaces.length) {
            output += utils.joinAll(this.namespaces, null, utils.prettyMap(indent));
        }
        if (this.content.length) {
            output += utils.joinAll(this.content, null, utils.prettyMap(indent));
        }
        return output;
    };

    /**
     * @param {object} kw
     * @return {Stylesheet}
     */
    optimize(kw = {}) {
        if (this.charset) {
            this.charset = optimization.try_(this.charset, kw);
        }
        if (this.imports.length) {
            this.imports = optimization.optimizeList(this.imports, kw);
        }
        if (this.namespaces.length) {
            this.namespaces = optimization.optimizeList(this.namespaces, kw);
        }

        // OPT: Remove overridden keyframe blocks
        const keyframeMap = {};
        const toRemove = new Set();
        this.content.forEach((x, i) => {
            if (!(x instanceof objects.Keyframes)) {
                return;
            }
            const prefix = x.vendorPrefix || '--';
            if (!(prefix in keyframeMap)) {
                keyframeMap[prefix] = {};
            }
            if (x.name in keyframeMap[prefix]) {
                toRemove.add(keyframeMap[prefix][x.name]);
            }
            keyframeMap[prefix][x.name] = i;
        });
        if (toRemove.size) {
            const ordered = Array.from(toRemove.values()).sort((a, b) => b - a);
            for (let i of ordered) {
                this.content.splice(i, 1);
            }
        }

        const kwKFM = {};
        Object.keys(keyframeMap).forEach(prefix => {
            const m = {};
            Object.keys(keyframeMap[prefix]).forEach(name => {
                m[name] = this.content[keyframeMap[prefix][name]];
            });
            kwKFM[prefix] = m;
        });
        kw.keyframeMap = kwKFM;

        this.content = optimization.optimizeBlocks(this.content, kw);

        return this;
    }
};
