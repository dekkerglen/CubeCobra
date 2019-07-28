const objects = require('../objects');
const optimization = require('../optimization');
const utils = require('../utils');



module.exports = class Ruleset {
    /**
     * @constructor
     * @param {SelectorList} selector
     * @param {Declaration[]} content
     */
    constructor(selector, content) {
        this.selector = selector;
        this.content = content;
    }

    /**
     * Returns the declaration content of the ruleset.
     * @return {string}
     */
    contentToString() {
        return utils.joinAll(this.content, ';');
    }

    /**
     * Finds the intersection of declarations between this ruleset and the set of
     * declarations for a provided ruleset.
     * @param  {Ruleset} ruleset
     * @return {Declaration[]}
     */
    declarationIntersections(ruleset) {
        const localDeclarations = this.content.reduce((acc, cur) => {
            acc[cur.ident] = cur;
            return acc;
        }, {});
        const intersection = [];
        for (let i = 0; i < ruleset.content.length; i++) {
            const foreignDecl = ruleset.content[i];
            if (localDeclarations.hasOwnProperty(foreignDecl.ident)) {
                const localDecl = localDeclarations[foreignDecl.ident];
                if (localDecl.important === foreignDecl.important) {
                    intersection.push(foreignDecl.ident);
                }
            }
        }
        return intersection;
    }

    /**
     * Removes a declaration with the provided name from the ruleset
     * @param  {string} name
     * @return {void}
     */
    removeDeclaration(name) {
        this.content = this.content.filter(decl => decl.ident !== name);
    }

    /**
     * @return {string}
     */
    toString() {
        return this.selector.toString() + '{' + this.contentToString() + '}';
    }

    /**
     * @param {int} indent
     * @return {string}
     */
    pretty(indent) {
        let output = '';
        output += utils.indent(this.selector.pretty(indent) + ' {', indent) + '\n';
        output += this.content.map(line => utils.indent(line.pretty(indent + 1) + ';', indent + 1)).join('\n') + '\n';
        output += utils.indent('}', indent) + '\n';
        return output;
    }

    /**
     * Optimizes the declarations within this ruleset
     * @param  {object} kw
     * @return {void}
     */
    optimizeContent(kw) {
        this.content = optimization.optimizeDeclarations(this.content, kw);
    }

    /**
     * @param {object} kw
     * @return {Ruleset}
     */
    optimize(kw) {
        // OPT: Ignore `* html` hacks from IE6
        if (!kw.saveie &&
            // Ignore selector lists, which handle this case separately
            !(this.selector instanceof objects.SelectorList) &&
            /\* html($| .+)/.exec(this.selector.toString())) {
            return null;
        }

        this.selector = optimization.try_(this.selector, kw);
        if (!this.selector) {
            return null;
        }

        this.optimizeContent(kw);

        // OPT: Remove empty rulsets.
        if (!this.content.length) {
            return null;
        }
        return this;
    }
};
