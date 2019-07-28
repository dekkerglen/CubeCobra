module.exports = class PseudoClassSelector {
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
        return ':' + this.ident;
    }

    /**
     * @return {string}
     */
    pretty() {
        return this.toString();
    }

    /**
     * @return {PseudoClassSelector}
     */
    optimize() {
        // OPT: Lowercase pseudo element names.
        this.ident = this.ident.toLowerCase();
        return this;
    }
};
