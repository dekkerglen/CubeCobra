const browserSupport = require('../browser_support');
const optimization = require('../optimization');


module.exports = class Declaration {
    /**
     * @constructor
     * @param {string} ident
     * @param {Expression} expr
     */
    constructor(ident, expr) {
        this.ident = ident;
        this.expr = expr;
        this.important = false;
        this.slashNine = false;
        this.slashZero = false;
    }

    canOptimize() {
        return !(this.important && this.slashNine && this.slashZero);
    }

    /**
     * @return {string}
     */
    toString() {
        return this.ident + ':' +
            (this.expr === null ? '' : this.expr.toString()) +
            (this.important ? '!important' : '') +
            (this.slashZero ? '\\0' : '') +
            (this.slashNine ? '\\9' : '');
    }

    /**
     * @param {int} indent
     * @return {string}
     */
    pretty(indent) {
        return this.ident + ': ' +
            (this.expr === null ? '' : this.expr.pretty(indent)) +
            (this.important ? ' !important' : '') +
            (this.slashZero ? ' \\0' : '') +
            (this.slashNine ? ' \\9' : '');
    }

    /**
     * @param {object} kw
     * @return {Declaration}
     */
    optimize(kw) {
        if (!this.expr) {
            return null;
        }
        // OPT: Lowercase descriptor names.
        this.ident = this.ident.toLowerCase();

        // OPT: Ignore * declarations from old IE
        if (!kw.saveie && this.ident[0] === '*') {
            return null;
        }

        // OPT: Remove `transform` inside prefixed `@keyframes`
        if (kw.o1 && kw.insideKeyframes && kw.vendorPrefix && this.ident === 'transform') {
            return null;
        }

        // OPT: Remove `-webkit-transform` inside unprefixed `@keyframes` when a prefixed version exists
        if (
            kw.o1 &&
            kw.insideKeyframes &&
            !kw.vendorPrefix &&
            this.isPrefixed()
        ) {
            const prefix = this.getPrefix();
            if (prefix in kw.keyframeMap && kw.keyframeMap[prefix][kw.insideKeyframes]) {
                return null;
            }
        }

        // OPT: Ignore slash nine from old IE
        if (!kw.saveie && this.slashNine) {
            return null;
        }

        // OPT: Ignore slash zero from old IE
        if (!kw.saveie && this.slashZero) {
            return null;
        }

        // OPT: Remove unsupported declarations.
        if (!browserSupport.supportsDeclaration(this.ident, kw)) {
            return null;
        }

        // OPT: Remove unsupported flexbox properties
        if (
            kw.browser_min && kw.browser_min.ie && kw.browser_min.ie > 10 &&
            this.ident === 'display' &&
            this.expr &&
            (this.expr.toString() === '-ms-flexbox' || this.expr.toString() === '-ms-inline-flexbox')
        ) {
            return null;
        }

        kw.declarationName = this.ident.toLowerCase();

        this.expr = optimization.try_(this.expr, kw);
        if (!this.expr) {
            return null;
        }
        delete kw.declarationName;

        // OPT: Remove mismatched vendor prefixes in declarations.
        if (kw.vendorPrefix && this.isPrefixed()) {
            if (this.ident.substr(0, kw.vendorPrefix.length) !== kw.vendorPrefix) {
                return null;
            }
        }

        return this;
    }

    /**
     * @return {bool} Whether the declaration is prefixed
     */
    isPrefixed() {
        return this.ident.match(/\-[a-z]+\-.+/);
    }

    /**
     * @return {string} The declaration's prefix
     */
    getPrefix() {
        return /(\-[a-z]+\-).+/.exec(this.ident)[1];
    }
};
