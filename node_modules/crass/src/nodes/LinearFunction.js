const optimization = require('../optimization');


module.exports = class LinearFunction {
    /**
     * @constructor
     * @param {NValue} nValue
     * @param {Number} offset
     */
    constructor(nValue, offset) {
        this.nValue = nValue;
        this.offset = offset;
    }

    /**
     * @return {string}
     */
    toString() {
        if (this.nValue) {
            const operator = this.offset.value < 0 ? '-' : '+';
            return this.nValue.toString() + operator + this.offset.asUnsigned().toString();
        } else {
            return this.offset.toString();
        }
    };

    /**
     * @return {string}
     */
    pretty() {
        if (this.nValue) {
            const operator = this.offset.value < 0 ? ' - ' : ' + ';
            return this.nValue.toString() + operator + this.offset.asUnsigned().toString();
        } else {
            return this.offset.toString();
        }
    };

    /**
     * @param {object} kw
     * @return {LinearFunction}
     */
    optimize(kw) {
        this.nValue = optimization.try_(this.nValue, kw);
        return this;
    }
};
