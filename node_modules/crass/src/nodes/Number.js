const origNumber = Number;

/**
 * Post-processes a number
 * @param  {string} str The string representation of a number
 * @return {string}
 */
function postProcess(str) {
    if (str.length === 1) {
        return str;
    }
    if (str[0] === '0' && str[1] === '.') {
        str = str.substr(1);
    } else if (str[0] === '-' && str[1] === '0' && str[2] === '.') {
        str = '-' + str.substr(2);
    }
    return str;
}

/**
 * Truncates a number to four decimal places
 * @param  {number} num
 * @return {string}
 */
function truncate(num) {
    if (!(num % 1)) {
        return num.toString();
    }
    if (Math.abs(Math.round(num) - num) < 0.00001) {
        return Math.round(num).toString();
    }

    let decimal = num.toString();
    const decimalPos = decimal.indexOf('.');
    decimal = decimal.substr(decimalPos);

    let integer = Math.abs(num) | 0;

    if (decimal !== decimal.substr(0, 5)) {
        decimal = decimal.substr(0, 5);
    }
    // Trim trailing zeroes
    while (decimal[decimal.length - 1] === '0') {
        decimal = decimal.substr(0, decimal.length - 1);
    }
    if (decimal !== '.') {
        integer += decimal;
    }
    if (num < 0) {
        integer = '-' + integer;
    }
    return integer;
}


module.exports = class Number {
    /**
     * @constructor
     * @param {number} value
     */
    constructor(value) {
        this.value = origNumber(value);
        if (origNumber.isNaN(this.value)) {
            this.value = 0;
        }
    }

    /**
     * Changes the sign of the number based on a unary operator
     * @param  {string} sign
     * @return {void}
     */
    applySign(sign) {
        if (sign === '-') {
            this.value *= -1;
        }
    }

    /**
     * @return {number}
     */
    asNumber() {
        return this.value;
    }

    /**
     * @return {number}
     */
    asUnsigned() {
        return new Number(Math.abs(this.value));
    }

    /**
     * @return {string}
     */
    toString() {
        return postProcess(truncate(this.value));
    }

    /**
     * @return {Number}
     */
    pretty() {
        return this.value.toString();
    }

    /**
     * @return {Number}
     */
    optimize() {
        // TODO(opt): rounding and stuff
        return this;
    }
};
