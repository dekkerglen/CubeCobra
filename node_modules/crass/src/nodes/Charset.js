module.exports = class Charset {
    /**
     * @constructor
     * @param {string} charset Charset for the stylesheet
     */
    constructor(charset) {
        this.charset = charset;
    }

    /**
     * @return {string}
     */
    toString() {
        return '@charset ' + this.charset.toString() + ';';
    }

    /**
     * @return {string}
     */
    pretty() {
        return this.toString() + '\n';
    }

    /**
     * @return {Charset}
     */
    optimize() {
        return this;
    }
};
