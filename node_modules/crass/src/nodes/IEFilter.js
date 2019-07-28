module.exports = class IEFilter {
    /**
     * @constructor
     * @param {string} blob
     */
    constructor(blob) {
        this.ident = 'filter'; // Hack so that we can duck-type this as a Declaration.
        if (blob[0] === '-') {
            this.ident = '-ms-filter';
        }
        this.blob = blob;
    }

    /**
     * @return {string}
     */
    toString() {
        return this.blob;
    }

    /**
     * @return {string}
     */
    pretty() {
        return this.toString();
    }

    /**
     * @param {object} kw
     * @return {IEFilter}
     */
    optimize(kw) {
        if (kw.browser_min && kw.browser_min.ie && kw.browser_min.ie > 9) {
            return null;
        }

        this.blob = this.ident + ':' + /(?:\-ms\-)?filter\s*:\s*(.+)/.exec(this.blob)[1];

        return this;
    }
};
