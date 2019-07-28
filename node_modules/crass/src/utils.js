const objects = require('./objects');


const opts = module.exports.opts = function opts(opts, defaults) {
    if (!opts) {
        opts = process.argv;
    }

    const out = defaults || {};
    let last;
    for (let i = 0; i < opts.length; i++) {
        const is_flag = opts[i].substr(0, 1) === '-';
        if (is_flag && last) {
            out[last] = true;
        } else if (!is_flag && last) {
            out[last] = opts[i];
        }
        last = is_flag ? opts[i].replace(/^\-+/, '') : null;
    }
    if (last) out[last] = true;
    return out;
};

const stringIdentity = module.exports.stringIdentity = x => x.toString();

module.exports.joinAll = function joinAll(list, joiner, mapper) {
    if (!list) return '';
    return list.map(mapper ||stringIdentity).join(joiner || '');
};

module.exports.uniq = function uniq(lambda, list) {
    lambda = lambda || stringIdentity;
    const values = {};
    for (let i = 0; i < list.length; i++) {
        values[lambda(list[i])] = i;
    }
    return Object.keys(values).map(key => list[values[key]]);
};

const isNum = module.exports.isNum = obj => obj && obj.asNumber;

module.exports.isPositiveNum = obj => isNum(obj) && obj.asNumber() >= 0;

module.exports.indent = function indent(value, indent) {
    if (!value) return '';
    return (new Array((indent || 0) + 1)).join('  ') + value;
};

module.exports.prettyMap = indent => x => x.pretty ? x.pretty(indent) : x.toString();


module.exports.func = function func(name, values, sep = ',') {
    return new objects.Func(
        name,
        new objects.Expression(
            values.map((v, index) => {
                if (typeof v === 'number') {
                    v = new objects.Number(v);
                }
                if (typeof sep === 'function') {
                    return [sep(index), v];
                } else {
                    return [index ? sep : null, v];
                }
            })
        )
    );
};
