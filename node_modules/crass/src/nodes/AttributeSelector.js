const optimization = require('../optimization');


module.exports = class AttributeSelector {
    /**
     * @constructor
     * @param {string} ident
     * @param {string} comparison
     * @param {string} value
     */
    constructor(ident, comparison, value) {
        this.ident = ident;
        this.comparison = comparison;
        this.value = value;
    }

    /**
     * @return {string}
     */
    toString() {
        // TODO: Handle quoting/unquoting
        if (this.value) {
            let value = this.value.toString();
            if (this.value.asString) {
                const rawValue = this.value.asString(true);
                const newValue = rawValue.match(/^[a-z][\w\\]*$/i) ? rawValue : this.value.asString(false);
                if (newValue.length <= value.length) {
                    value = newValue;
                }
            }
            return '[' + this.ident + this.comparison + value + ']';
        } else {
            return '[' + this.ident + ']';
        }
    }

    /**
     * @return {string}
     */
    pretty() {
        return this.toString();
    }

    /**
     * @param {object} kw
     * @return {AttributeSelector}
     */
    optimize(kw) {
        // OPT: Lowercase attribute names.
        this.ident = optimization.try_(this.ident, kw);
        this.value = optimization.try_(this.value, kw);

        if (!this.ident) {
            return null;
        }

        return this;
    }
};
