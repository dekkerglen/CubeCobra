module.exports = class PseudoElementSelector {
    /**
     * @constructor
     * @param {string} ident
     */
    constructor(ident) {
        this.ident = ident;
    }

    /**
     * @return {string}
     */
    toString() {
        if (this.ident === 'before' || this.ident === 'after') {
            return ':' + this.ident;
        }
        return '::' + this.ident;
    };

    /**
     * @return {string}
     */
    pretty() {
        return '::' + this.ident;
    };

    /**
     * @return {PseudoElementSelector}
     */
    optimize() {
        // OPT: Lowercase pseudo element names.
        this.ident = this.ident.toLowerCase();
        return this;
    }
};
