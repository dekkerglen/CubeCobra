const colorConvert = require('color-convert');

const colorOptimizer = require('../optimizations/color');
const Dimension = require('./Dimension');
const Expression = require('./Expression');
const objects = require('../objects');
const optimization = require('../optimization');
const utils = require('../utils');


const recognizedColorFuncs = {
    'rgb': {minArgs: 3, maxArgs: 3},
    'hsl': {minArgs: 3, maxArgs: 3},
    'rgba': {minArgs: 4, maxArgs: 4},
    'hsla': {minArgs: 4, maxArgs: 4},
    'gray': {minArgs: 1, maxArgs: 2},
    'hwb': {minArgs: 3, maxArgs: 4},
    'lab': {minArgs: 3, maxArgs: 4},
    'lch': {minArgs: 3, maxArgs: 4},
};
const ALPHA_INDEX = {
    'gray': 1,
    'rgba': 3,
    'hsla': 3,
    'hwb': 3,
    'lab': 3,
    'lch': 3,
};

const GRADIENT_ANGLES = {
    top: () => new objects.Number(0),
    right: () => new Dimension(new objects.Number(90), 'deg'),
    bottom: () => new Dimension(new objects.Number(180), 'deg'),
    left: () => new Dimension(new objects.Number(270), 'deg'),
};

/**
 * Converts Number to JS number
 * @param  {Number} num
 * @return {number}
 */
function asRealNum(num) {
    if (num.unit && num.unit === '%') return asRealNum(num.number);
    if (num.unit && num.unit === 'deg') return num.number.asNumber() % 360 / 360 * 255;
    if (num.unit && num.unit === 'grad') return num.number.asNumber() % 400 / 400 * 255;
    if (num.unit && num.unit === 'rad') return num.number.asNumber() % (2 * Math.PI) / (2 * Math.PI) * 255;
    if (num.unit && num.unit === 'turn') return num.number.asNumber() % 1 * 255;
    return num.asNumber();
}


module.exports = class Func {
    /**
     * @constructor
     * @param {string} name
     * @param {Expressino} content
     */
    constructor(name, content) {
        this.name = name;
        this.content = content;
    }

    /**
     * @return {string}
     */
    toString() {
        return `${this.name}(${this.content ? this.content.toString() : ''})`;
    }

    /**
     * @param {int} indent
     * @return {string}
     */
    pretty(indent) {
        return `${this.name}(${this.content ? this.content.pretty(indent) : ''})`;
    }

    /**
     * @param {object} kw
     * @return {Func}
     */
    optimize(kw) {
        // OPT: Lowercase function names.
        this.name = this.name.toLowerCase();

        const oldkwf = kw.func;
        kw.func = this.name;
        if (this.content) {
            this.content = optimization.try_(this.content, kw);
        } else if (this.name.indexOf('linear-gradient') !== -1) {
            return null;
        }

        if (
            this.isCalc() &&
            !(
                this.content instanceof objects.MathSum ||
                this.content instanceof objects.MathProduct
            )
        ) {
            return this.content;
        }

        let self = this.optimizeColor(kw);
        if (!self || !(self instanceof Func)) {
            kw.func = oldkwf;
            return self;
        }

        self = self.optimizeLinearGradient(kw);
        if (!self || !self.content) {
            kw.func = oldkwf;
            return null;
        }

        self = self.optimizeRadialGradient(kw);
        if (!self || !self.content) {
            kw.func = oldkwf;
            return null;
        }

        if (this.isCalc()) {
            self = self.optimizeCalc(kw);
        }

        kw.func = oldkwf;
        return self;
    }

    /**
     * @return {bool} Whether the function is calc or not.
     */
    isCalc() {
        return Boolean(/^(\-[a-z]+\-)?calc$/i.exec(this.name));
    }

    /**
     * @param {object} kw
     * @return {Func}
     */
    optimizeColor(kw) {
        if (!(this.name in recognizedColorFuncs)) {
            return this;
        }

        const spec = recognizedColorFuncs[this.name];
        if (this.content.chain.length < spec.minArgs || this.content.chain.length > spec.maxArgs) {
            return null;
        }

        if (
            !this.content ||
            !this.content.chain ||
            !this.content.chain.every((x, i) => {
                if (ALPHA_INDEX[this.name] && i === ALPHA_INDEX[this.name]) {
                    return utils.isNum(x[1]);
                }
                if (
                    (
                        i === 0 && (this.name === 'hsl' || this.name === 'hsla' || this.name === 'hwb') ||
                        i === 2 && (this.name === 'lch')
                    ) &&
                    x[1] instanceof Dimension
                ) {
                    return true;
                }
                if (
                    i === 1 && this.name === 'hwb' ||
                    i === 2 && this.name === 'hwb'
                ) {
                    return x[1] instanceof Dimension;
                }
                return utils.isNum(x[1]);
            })
        ) {
            return null;
        }

        // OPT: Convert color functions to shortest variants
        const chainLength = this.content.chain.length;
        switch(this.name) {
            case 'rgb':
            case 'hsl':
                if (chainLength !== 3) return this;
                break;
            case 'rgba':
            case 'hsla':
                if (chainLength !== 4) return this;
                break;
            case 'gray':
                if (chainLength < 1 || chainLength > 2) return this;
                break;
            case 'hwb':
            case 'lab':
            case 'lch':
                if (chainLength < 3 || chainLength > 4) return this;
                break;
            default:
                return this;
        }

        let applier;
        let alpha = 1;

        const components = this.content.chain.map(v => asRealNum(v[1])).map(v => Math.max(v, 0));

        switch (this.name) {
            case 'rgba':
            case 'hsla':
                alpha = components[3];
                applier = funcName => {
                    const name = this.name.substr(0, 3);
                    if (funcName === name) {
                        return components.slice(0, 3);
                    }
                    return colorConvert[name][funcName](components[0], components[1], components[2]);
                };
                break;
            case 'rgb':
            case 'hsl':
                applier = funcName => {
                    if (funcName === this.name) {
                        return components.slice(0, 3);
                    }
                    return colorConvert[this.name][funcName](components[0], components[1], components[2]);
                };
                break;
            case 'gray':
                if (components.length > 1) {
                    alpha = components[1];
                }
                applier = funcName => colorConvert.gray[funcName](components[0]);
                break;
            case 'hwb':
            case 'lab':
            case 'lch':
                if (components.length > 3) {
                    alpha = components[3];
                }
                applier = funcName => {
                    if (funcName === this.name) {
                        return components.slice(0, 3);
                    }
                    return colorConvert[this.name][funcName](components[0], components[1], components[2]);
                };
                break;
            default:
                return this;
        }

        return colorOptimizer(applier, alpha, kw);
    }


    /**
     * @param {object} kw
     * @return {Func}
     */
    optimizeLinearGradient(kw) {
        if (
            !(
                this.name === 'linear-gradient' ||
                this.name === 'repeating-linear-gradient' ||
                this.name === '-webkit-linear-gradient' ||
                this.name === '-webkit-repeating-linear-gradient'
            ) ||
            !this.content ||
            !this.content.chain
        ) {
            return this;
        }

        let chain = this.content.chain;

        if (
            chain.length > 2 &&
            chain[2][0] !== null &&
            chain[0][1] === 'to' &&
            chain[1][1] in GRADIENT_ANGLES
        ) {
            const val = chain[1][1];
            chain = chain.slice(1);
            chain[0] = [null, GRADIENT_ANGLES[val]()];
        }

        const segments = chain.reduce((acc, cur) => {
            if (cur[0] !== null) {
                acc.push([]);
            }
            acc[acc.length - 1].push(cur);
            return acc;
        }, [[]]);
        let lastStop = null;
        segments.forEach((group, idx) => {
            if (group.length !== 2 || !(group[1][1] instanceof Dimension || group[1][1] instanceof objects.Number)) {
                return;
            }
            const isFinal = idx === segments.length - 1;
            if (!lastStop) {
                lastStop = group[1][1];
                if (isFinal) {
                    return;
                }
                if (lastStop instanceof Dimension && (lastStop.asNumber() !== 0 || lastStop.unit !== '%')) {
                    return;
                }
                if (lastStop instanceof objects.Number && lastStop.asNumber() !== 0) {
                    return;
                }
                group[1][1] = null;
                return;
            }

            // TODO: This should consider the units and transform to px if possible
            if (lastStop.unit === group[1][1].unit && lastStop.asNumber() >= group[1][1].asNumber()) {
                group[1][1] = new objects.Number(0);
            }
            lastStop = group[1][1];
            if (isFinal && group[1][1].unit === '%' && group[1][1].asNumber() === 100) {
                group[1][1] = null;
            }
        });

        chain = chain.filter(x => x[1]);
        this.content = (new Expression(chain)).optimize(kw);
        return this;
    }

    /**
     * @param {object} kw
     * @return {Func}
     */
    optimizeRadialGradient(kw) {
        if (
            this.name !== 'radial-gradient' &&
            this.name !== 'repeating-radial-gradient' &&
            this.name !== '-webkit-radial-gradient' &&
            this.name !== '-webkit-repeating-radial-gradient' ||
            !this.content ||
            !this.content.chain ||
            !this.content.chain.length
        ) {
            return this;
        }

        const chain = this.content.chain;
        const segments = chain.reduce((acc, cur) => {
            if (cur[0] !== null) {
                acc.push([]);
            }
            acc[acc.length - 1].push(cur);
            return acc;
        }, [[]]);
        let lastStop = null;
        segments.forEach((group, idx) => {
            if (group.length !== 2 || !(group[1][1] instanceof Dimension || group[1][1] instanceof objects.Number)) {
                return;
            }
            var isFinal = idx === segments.length - 1;
            if (!lastStop) {
                lastStop = group[1][1];
                if (isFinal) {
                    return;
                }
                if (lastStop instanceof Dimension && (lastStop.asNumber() !== 0 || lastStop.unit !== '%')) {
                    return;
                }
                if (lastStop instanceof objects.Number && lastStop.asNumber() !== 0) {
                    return;
                }
                group[1][1] = null;
                return;
            }

            // TODO: This should consider the units and transform to px if possible
            if (lastStop.unit === group[1][1].unit && lastStop.asNumber() >= group[1][1].asNumber()) {
                group[1][1] = new objects.Number(0);
            }
            lastStop = group[1][1];
            if (isFinal && group[1][1].unit === '%' && group[1][1].asNumber() === 100) {
                group[1][1] = null;
            }
        });

        this.content = (new Expression(chain)).optimize(kw);
        return this;
    }

    /**
     * @param {object} kw
     * @return {Func}
     */
    optimizeCalc(kw) {
        this.content = this.content.optimize(kw);
        if (!this.content) {
            return null;
        }
        return this;
    }
};
