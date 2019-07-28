const optimization = require('../optimization');


module.exports = class MediaExpression {
    /**
     * @constructor
     * @param {string} descriptor
     * @param {Expression} value
     * @param {object} ieCrap Flags for IE
     */
    constructor(descriptor, value, ieCrap) {
        this.descriptor = descriptor;
        this.value = value;
        this.ieCrap = ieCrap;
    }

    /**
     * @return {string}
     */
    toString() {
        const descriptor = this.descriptor.toString();
        const slashZero = this.ieCrap.slashZero ? '\\0' : '';
        if (this.value) {
            return '(' + descriptor + ':' + this.value.toString() + slashZero + ')';
        } else {
            return '(' + descriptor + slashZero + ')';
        }
    }

    /**
     * @return {string}
     */
    pretty(indent) {
        const descriptor = this.descriptor.toString();
        const slashZero = this.ieCrap.slashZero ? '\\0' : '';
        if (this.value) {
            return '(' + descriptor + ': ' + this.value.pretty(indent) + slashZero + ')';
        } else {
            return '(' + descriptor + slashZero + ')';
        }
    }

    /**
     * @param {object} kw
     * @return {MediaExpression}
     */
    optimize(kw) {
        this.value = optimization.try_(this.value, kw);
        return this;
    }
};
