module.exports = class CustomIdent {
    /**
     * @constructor
     * @param {string[]} color
     */
    constructor(idents) {
        this.idents = idents;
    }

    /**
     * @return {string}
     */
    toString() {
        return '[' + this.idents.join(' ') + ']';
    }

    /**
     * @return {string}
     */
    pretty() {
        return this.toString();
    }

    /**
     * @return {CustomIdent}
     */
    optimize() {
        return this;
    }
};
