module.exports = class NValue {
    /**
     * @constructor
     * @param {Number} coefficient
     */
    constructor(coefficient) {
        this.coefficient = coefficient;
    }

    /**
     * @return {string}
     */
    toString() {
        const coef = this.coefficient.asNumber ? this.coefficient.asNumber() : this.coefficient;
        if (coef === 1) {
            return 'n';
        } else if (!coef) {
            return '0';
        } else {
            return coef.toString() + 'n';
        }
    }

    /**
     * @return {string}
     */
    pretty() {
        return this.toString();
    };

    /**
     * @return {NValue}
     */
    optimize() {
        return this;
    }
};
