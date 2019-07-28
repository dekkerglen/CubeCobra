const colorConvert = require('color-convert');

const colorOptimizer = require('../optimizations/color');
const colors = require('../colors');


module.exports = class HexColor {
    /**
     * @constructor
     * @param {string} color
     */
    constructor(color) {
        this.color = color;
    }


    /**
     * @return {string}
     */
    toString() {
        return this.color;
    }

    /**
     * @return {string}
     */
    pretty() {
        return this.toString();
    }

    /**
     * @return {HexColor}
     */
    optimize(kw) {
        // OPT: Lowercase hex colors.
        this.color = this.color.toLowerCase();

        this.stripColorAlpha();

        if (this.color.length === 5 || this.color.length === 9) {
            const unalphaed = this.color.substr(1, this.color.length === 5 ? 3 : 6);
            const applier = funcName => colorConvert.hex[funcName](unalphaed);
            const alpha = this.color.length === 5 ? parseInt(this.color.substr(-1), 16) / 15 : parseInt(this.color.substr(-2), 16) / 255;
            return colorOptimizer(applier, alpha, kw);
        }

        // OPT: Shorten hex colors
        this.color = colorOptimizer.shortenHexColor(this.color);
        // OPT: Convert hex -> name when possible.
        if (this.color in colors.HEX_TO_COLOR) {
            return colors.HEX_TO_COLOR[this.color];
        }

        return this;
    }

    /**
     * @return {void}
     */
    stripColorAlpha() {
        if (this.color.length === 5 && this.color[4] === 'f') {
            this.color = this.color.substr(0, 4);
            return;
        }
        if (this.color.length === 9 && this.color[7] === 'f' && this.color[8] === 'f') {
            this.color = this.color.substr(0, 7);
            return;
        }
    }
};
