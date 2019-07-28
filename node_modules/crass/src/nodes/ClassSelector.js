module.exports = class ClassSelector {
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
        return '.' + this.ident;
    }

    /**
     * @return {string}
     */
    pretty() {
        return this.toString();
    }

    /**
     * @return {ClassSelector}
     */
    optimize() {
        return this;
    }
};
