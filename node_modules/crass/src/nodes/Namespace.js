module.exports = class Namespace {
    /**
     * @constructor
     * @param {URL} namespaceURI
     * @param {string} prefix
     */
    constructor(namespaceURI, prefix) {
        this.namespaceURI = namespaceURI;
        this.prefix = prefix;
    }

    /**
     * @return {string}
     */
    toString() {
        if (this.prefix) {
            return '@namespace ' + this.prefix + ' ' + this.namespaceURI.toString() + ';';
        } else {
            return '@namespace ' + this.namespaceURI.toString() + ';';
        }
    }

    /**
     * @return {string}
     */
    pretty() {
        return this.toString() + '\n';
    }

    /**
     * @return {Namespace}
     */
    optimize() {
        return this;
    }
};
