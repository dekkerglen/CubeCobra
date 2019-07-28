module.exports =  class ElementSelector {
    /**
     * @constructor
     * @param {string} ident
     * @param {string} ns
     */
    constructor(ident, ns) {
        this.ident = ident;
        this.ns = ns;
    }

    /**
     * @return {string}
     */
    toString() {
        if (this.ident && this.ns) {
            return this.ident + '|' + this.ns;
        } else if (this.ns) {
            return '|' + this.ns;
        } else {
            return this.ident;
        }
    }

    /**
     * @return {string}
     */
    pretty() {
        return this.toString();
    }

    /**
     * @return {ElementSelector}
     */
    optimize() {
        // OPT: Lowercase element names.
        this.ident = this.ident.toLowerCase();
        if (this.ns) {
            this.ns = this.ns.toLowerCase();
        }
        return this;
    }
};
