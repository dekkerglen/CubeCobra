const grammar = require('./grammar');
const objects = require('./objects');

exports.parse = function parse(data) {
    const parser = new grammar.Parser();
    parser.lexer.options.ranges = true;
    parser.yy = objects;

    return parser.parse(data + '');
};

exports.objects = objects;
