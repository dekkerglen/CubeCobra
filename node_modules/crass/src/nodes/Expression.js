const colors = require('../colors');
const objects = require('../objects');
const optimization = require('../optimization');

/**
 * @param {array[][]} list
 * @return {array[][]}
 */
function processQuadList(list) {
    const keys = list.map(v => v[1].toString());
    if (
        keys.length === 4 &&
        keys[0] == keys[1] &&
        keys[1] === keys[2] &&
        keys[2] === keys[3]
    ) {
        return [list[0]];
    }
    if (keys.length === 4 && keys[0] === keys[2] && keys[1] === keys[3]) {
        return processQuadList([list[0], list[1]]);
    } else if (keys.length === 4 && keys[1] === keys[3]) {
        return processQuadList(list.slice(0, 3));
    }
    if (keys.length === 3 && keys[0] === keys[2]) {
        return processQuadList(list.slice(0, 2));
    }
    if (keys.length === 2 && keys[0] === keys[1]) {
        return list.slice(0, 1);
    }

    return list;
}

module.exports = class Expression {
    /**
     * @constructor
     * @param {array[]} chain
     */
    constructor(chain) {
        this.chain = chain;
    }

    /**
     * @return {string}
     */
    toString() {
        return this.chain.reduce((acc, cur, i) => {
            if (i) {
                acc += cur[0] || ' ';
            }
            acc += cur[1].toString();
            return acc;
        }, '');
    }

    /**
     * @param {int} indent
     * @return {string}
     */
    pretty(indent) {
        return this.chain.reduce((acc, cur, i) => {
            if (i) {
                if (cur[0] === ',') {
                    acc += ', ';
                } else if (!cur[0]) {
                    acc += ' ';
                } else {
                    acc += cur[0];
                }
            }
            const val = cur[1];
            return acc + (val.pretty ? val.pretty(indent) : val.toString());
        }, '');
    }

    /**
     * @param {object} kw
     * @return {Expression}
     */
    optimize(kw) {
        this.chain = this.chain.map(v => [v[0], optimization.try_(v[1], kw)]).filter(v => !!v[1]);
        if (!this.chain.length) {
            return null;
        }

        if (!kw.declarationName) return this;

        // OPT: Try to minify lists of lengths.
        // e.g.: `margin:0 0 0 0` -> `margin:0`
        if (
            kw.declarationName in optimization.quadLists &&
            this.chain.length > 1 &&
            this.chain.length < 5 &&
            this.chain.every(c => c[0] !== '/')
        ) {
            this.chain = processQuadList(this.chain);

        } else if (
            kw.declarationName === 'border-radius' &&
            this.chain.some(x => x[0] === '/')
        ) {
            const slashIdx = this.findSlash();
            const leftChain = optimization.expandQuadList(this.chain.slice(0, slashIdx));
            const rightChain = optimization.expandQuadList(this.chain.slice(slashIdx).map(x => [null, x[1]]));

            if (leftChain.every((x, i) => x[1].toString() === rightChain[i][1].toString())) {
                this.chain = processQuadList(leftChain);
            } else {
                const pLeftChain = processQuadList(leftChain);
                const pRightChain = processQuadList(rightChain);

                pRightChain[0][0] = '/';
                this.chain = pLeftChain.concat(pRightChain);
            }

        } else if (
            kw.declarationName === 'font-weight' ||
            kw.declarationName === 'font'
        ) {
            this.chain = this.chain.map(chunk => {
                // OPT: font/font-weight: normal -> 400
                if (chunk[1].toString() === 'normal') {
                    return [chunk[0], '400'];
                }
                // OPT: font/font-weight: bold -> 700
                else if (chunk[1].toString() === 'bold') {
                    return [chunk[0], '700'];
                } else {
                    return chunk;
                }
            });

        } else if (
            kw.o1 && kw.declarationName === 'content' &&
            this.chain[0][1] === 'none'
        ) {
            // OPT: `content:none` -> `content:""`
            this.chain[0][1] = new objects.String('');

        } else if (kw.declarationName === 'display' && this.chain.length > 1) {
            const sec = this.chain[1][1];
            switch (this.chain[0][1]) {
                case 'block':
                    if (sec === 'flow') {
                        this.chain.splice(1, 1);
                    } else if (sec === 'flow-root') {
                        this.chain = [[null, 'flow-root']];
                    } else if (sec === 'flex') {
                        this.chain = [[null, 'flex']];
                    } else if (sec === 'grid') {
                        this.chain = [[null, 'grid']];
                    } else if (sec === 'table') {
                        this.chain = [[null, 'table']];
                    }
                    break;
                case 'inline':
                    if (sec === 'flow') {
                        this.chain.splice(1, 1);
                    } else if (sec === 'flow-root') {
                        this.chain = [[null, 'inline-block']];
                    } else if (sec === 'flex') {
                        this.chain = [[null, 'inline-flex']];
                    } else if (sec === 'grid') {
                        this.chain = [[null, 'inline-grid']];
                    } else if (sec === 'ruby') {
                        this.chain = [[null, 'ruby']];
                    } else if (sec === 'table') {
                        this.chain = [[null, 'inline-table']];
                    }
                    break;
                case 'run-in':
                    if (sec === 'flow') {
                        this.chain.splice(1, 1);
                    }
                    break;
                case 'list-item':
                    if (this.chain.length === 3 && this.chain[2][1] === 'flow') {
                        if (sec === 'block') {
                            this.chain = [[null, 'list-item']];
                        } else if (sec === 'inline') {
                            this.chain = [[null, 'inline-list-item']];
                        }
                    }
                    break;
                case 'table-cell':
                case 'table-caption':
                case 'ruby-base':
                case 'ruby-text':
                    if (sec === 'flow') {
                        this.chain.splice(1, 1);
                    }
            }
        }

        if (
            kw.declarationName in optimization.noneables &&
            this.chain.length === 1 &&
            this.chain[0][1].toString() === 'none'
        ) {
            // OPT: none -> 0 where possible.
            this.chain[0][1] = '0';
        }

        // OPT: Convert color names to hex when possible.
        this.chain.forEach(term => {
            if (typeof term[1] === 'string' && term[1] in colors.COLOR_TO_HEX) {
                term[1] = new objects.HexColor(colors.COLOR_TO_HEX[term[1]]);
            }
        });

        if (!this.chain.length) {
            return null;
        }

        return this;
    }

    /**
     * @return {int}
     */
    findSlash() {
        return this.chain.findIndex(x => x[0] === '/');
    }
};
