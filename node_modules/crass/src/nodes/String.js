const keywords = [
    'cursive',
    'fantasy',
    'monospace',
    'sans-serif',
    'serif',
];


module.exports = class String {
    /**
     * @constructor
     * @param {string} value
     */
    constructor(value) {
        this.value = value.toString().replace(/\\(['"])/g, '$1');

        this._noQuotes = false;
    }

    /**
     * @param {bool} raw Whether to output the raw string
     * @return {string}
     */
    asString(raw) {
        if (raw) {
            return this.value.replace(/(\s)/g, '\\$1');
        }
        return this.toString();
    }

    /**
     * @return {string}
     */
    toString() {
        if (this._noQuotes) {
            return this.value;
        }
        const single_ = "'" + this.value.replace(/'/g, "\\'") + "'";
        const double_ = '"' + this.value.replace(/"/g, '\\"') + '"';
        // OPT: Choose the shortest string variation
        return (single_.length < double_.length) ? single_ : double_;
    }

    /**
     * @return {string}
     */
    pretty() {
        return this.toString();
    }

    /**
     * @return {String}
     */
    optimize(kw) {
        if (
            kw.declarationName === 'font-family' && /[\w ]/.exec(this.value) &&
            keywords.every(keyword => this.value.toLowerCase().indexOf(keyword) === -1)
        ) {
            const newValue = this.value.trim().replace(/ (?=\d+\b)/g, '\\ ');
            if (newValue.length <= this.value.length + 2) {
                this._noQuotes = true;
                this.value = newValue;
            }
        }
        return this;
    }
};
