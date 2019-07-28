const colorConvert = require('color-convert');

const colors = require('../colors');
const objects = require('../objects');


module.exports = function(applier, alpha, kw) {
    const func = require('../utils').func;

    const choices = [];

    if (alpha > 1) {
        alpha = 1;
    } else if (alpha < 0) {
        alpha = 0;
    }

    if (alpha === 0) {
        applier = fn => fn === 'rgb' ? [0, 0, 0] : colorConvert.rgb[fn]([0, 0, 0]);
    }

    const hsl = applier('hsl');
    const hwb = applier('hwb');
    const lab = applier('lab');
    const lch = applier('lch');
    const rgb = applier('rgb');
    const grayVal = minimizeNum((rgb[0] / 255 * 100).toFixed(2));

    if (alpha === 1) {
        choices.push(
            [
                `rgb(${rgb.map(minimizeNum).join(',')})`,
                () => func('rgb', rgb),
            ]
        );
        choices.push(
            [
                // NOTE: This isn't "correct" but it gives the correct length, which is what matters
                `hsl(${rgb.map(minimizeNum).join('%,')})`,
                () => func('hsl', [hsl[0], percentify(hsl[1]), percentify(hsl[2])]),
            ]
        );
        if (kw.css4) {
            choices.push(
                [
                    `hwb(${hwb.map(minimizeNum).join(' ')})`,
                    () => func('hwb', [hwb[0], percentify(hwb[1]), percentify(hwb[2])], null),
                ]
            );
            choices.push(
                [
                    `lab(${lab.map(minimizeNum).join(' ')})`,
                    () => func('lab', [lab[0], lab[1], lab[2]], null),
                ]
            );
            choices.push(
                [
                    `lch(${lch.map(minimizeNum).join(' ')})`,
                    () => func('lch', [lch[0], lch[1], lch[2]], null),
                ]
            );
        }

        const hex = shortenHexColor(makeHex(rgb)).toLowerCase();
        choices.push([hex, () => new objects.HexColor(hex)]);

        // OPT: Return the color name instead of hex value when shorter.
        if (hex in colors.HEX_TO_COLOR) {
            choices.push(
                [colors.HEX_TO_COLOR[hex], () => colors.HEX_TO_COLOR[hex]]
            );
        }

        if (
            kw.css4 &&
            rgb[0] === rgb[1] &&
            rgb[1] === rgb[2]
        ) {
            choices.push(
                [
                    `gray(${minimizeNum(grayVal)}%)`,
                    () => func('gray', [percentify(grayVal)]),
                ]
            );
        }
    } else {
        const alphaNum = minimizeNum(alpha);

        choices.push(
            [
                `rgba(${rgb.map(minimizeNum).join(',')},${alphaNum})`,
                () => func('rgba', rgb.concat([alpha])),
            ]
        );
        choices.push(
            [
                // NOTE: This isn't "correct" but it gives the correct length, which is what matters
                `hsla(${hsl.map(minimizeNum).join('%,')},${alphaNum})`,
                () => func('hsla', hslArgs(hsl).concat([alpha])),
            ]
        );
        if (kw.css4) {
            choices.push(
                [
                    `hwb(${hwb.map(minimizeNum).join(' ')}/${alphaNum})`,
                    () => func(
                        'hwb',
                        [hwb[0], percentify(hwb[1]), percentify(hwb[2]), alpha],
                        i => i === 3 ? '/' : null
                    ),
                ]
            );
            choices.push(
                [
                    `lab(${lab.map(minimizeNum).join(' ')}/${alphaNum})`,
                    () => func(
                        'lab', [lab[0], lab[1], lab[2], alpha], i => i === 3 ? '/' : null
                    ),
                ]
            );
            choices.push(
                [
                    `lch(${lch.map(minimizeNum).join(' ')}/${alphaNum})`,
                    () => func(
                        'lch', [lch[0], lch[1], lch[2], alpha], i => i === 3 ? '/' : null
                    ),
                ]
            );

            const hexVariant = '#' + colorConvert.rgb.hex(rgb).toLowerCase();
            const hexAlphaV = ('00' + (alpha * 255).toString(16)).substr(-2);
            if (hexAlphaV.indexOf('.') === -1) {
                const canShortenHexVariant = (
                    hexVariant.length !== shortenHexColor(hexVariant).length &&
                    hexAlphaV[0] === hexAlphaV[1]
                );
                if (canShortenHexVariant) {
                    const shortenHexColorVariant = shortenHexColor(hexVariant);
                    choices.push(
                        [
                            shortenHexColorVariant + hexAlphaV,
                            () => new objects.HexColor(shortenHexColorVariant + hexAlphaV[0]),
                        ]
                    );
                } else {
                    choices.push(
                        [
                            hexVariant + hexAlphaV,
                            () => new objects.HexColor(hexVariant + hexAlphaV),
                        ]
                    );
                }
            }
        }

        if (
            kw.css4 &&
            rgb[0] === rgb[1] &&
            rgb[1] === rgb[2]
        ) {
            choices.push(
                [
                    `gray(${grayVal}%/${alphaNum})`,
                    () => func('gray', [percentify(grayVal), alpha], '/'),
                ]
            );
        }

        if (alpha === 0) {
            choices.push(['transparent', () => 'transparent']);
        }
    }

    return choices.reduce((acc, cur) => cur[0].length < acc[0].length ? cur : acc)[1]();
};
module.exports.shortenHexColor = shortenHexColor;

function shortenHexColor(hex) {
    if (hex[1] === hex[2] &&
        hex[3] === hex[4] &&
        hex[5] === hex[6]) {
        return '#' + hex[1] + hex[3] + hex[5];
    }
    return hex;
}


function minimizeNum(n) {
    return (new objects.Number(n)).toString();
}

function percentify(x) {
    return new objects.Dimension(new objects.Number(x), '%')
}
function hslArgs(args) {
    args[1] = percentify(args[1]);
    args[2] = percentify(args[2]);
    return args;
}

function makeHex(rgb) {
    return '#' + rgb.map(c => {
        const str = c.toString(16);
        return str.length === 1 ? `0${str}` : str;
    }).join('');
}
