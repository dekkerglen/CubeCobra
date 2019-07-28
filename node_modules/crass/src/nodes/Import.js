module.exports = class Import {
    /**
     * @constructor
     * @param {URL} href
     * @param {MediaList} media
     */
    constructor(href, media) {
        this.href = href;
        this.media = media;
    }

    /**
     * @return {string}
     */
    toString() {
        return `@import ${this.href.asString()}${this.media ? ` ${this.media.toString()}` : ''};`;
    }

    /**
     * @return {string}
     */
    pretty() {
        return this.toString() + '\n';
    }

    /**
     * @return {Import}
     */
    optimize() {
        return this;
    }
};
