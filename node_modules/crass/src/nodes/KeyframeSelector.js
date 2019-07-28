module.exports = class KeyframeSelector {
    /**
     * @constructor
     * @param {string} stop
     */
    constructor(stop) {
        this.stop = stop;
    }

    /**
     * @return {string}
     */
    toString() {
        return this.stop;
    }

    /**
     * @return {string}
     */
    pretty() {
        return this.toString();
    }

    /**
     * @return {KeyframeSelector}
     */
    optimize() {
        // OPT: Convert 'from' to 0%
        if (this.stop === 'from') {
            this.stop = '0%';
        } else if (this.stop === '100%') {
            this.stop = 'to';
        }
        return this;
    }
};
