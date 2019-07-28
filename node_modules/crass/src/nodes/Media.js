const optimization = require('../optimization');
const utils = require('../utils');



module.exports = class Media {
    /**
     * @constructor
     * @param {MediaQuery[]} media
     * @param {*} content
     */
    constructor(media, content) {
        this.media = media;
        this.content = content;
    }

    /**
     * @return {string}
     */
    mediaQueriesToString() {
        return utils.joinAll(this.media, ',');
    }

    /**
     * @return {string}
     */
    toString() {
        const queryString = this.mediaQueriesToString();
        return `@media${queryString[0] === '(' ? '' : ' '}${queryString}{${utils.joinAll(this.content)}}`;
    }

    /**
     * @return {string}
     */
    pretty(indent) {
        let output = '';
        output += utils.indent('@media ' + utils.joinAll(this.media, ', ', utils.prettyMap(indent)) + ' {') + '\n';
        output += this.content.map(line => utils.indent(line.pretty(indent + 1), indent)).join('\n') + '\n';
        output += utils.indent('}', indent) + '\n';
        return output;
    }

    /**
     * @param {object} kw
     * @return {Media}
     */
    optimize(kw) {
        this.media = optimization.optimizeList(this.media, kw);

        // OPT: Remove duplicate media queries.
        this.media = utils.uniq(null, this.media);

        if (!this.media.length) {
            return null;
        }

        return this.optimizeContent(kw);
    }

    /**
     * @param {object} kw
     * @return {Media}
     */
    optimizeContent(kw) {
        this.content = optimization.optimizeBlocks(this.content, kw);
        if (!this.content.length) {
            return null;
        }

        return this;
    }
};
