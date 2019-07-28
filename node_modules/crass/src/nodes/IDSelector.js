module.exports = class IDSelector {
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
        return '#' + this.ident;
    }

    /**
     * @return {string}
     */
    pretty() {
        return this.toString();
    }

    /**
     * @param {object} kw
     * @return {IDSelector}
     */
    optimize(kw) {
        if (!kw.saveie && this.ident.indexOf('#') !== -1) {
            return null;
        }
        return this;
    }
};
