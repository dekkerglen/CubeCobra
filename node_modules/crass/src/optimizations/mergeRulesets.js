/*

Merging Rulesets

Aside from simple adjacent combinations, it's sometimes possible to combine
sibling rulesets together (Nth into 1st). The rules for this are complicated,
however, because the ability to combine the rulesets is governed by many
different factors:

- Specificity of inner rulesets
- Use of !important
- The type of selectors for the rulesets being merged
- etc.

This file attempts to abstract those concepts into a single set of defined
rules.

*/

const objects = require('../objects');


function anyBetween(body, i, j, filter) {
    for (let x = i + 1; x < j; x++) {
        if (filter(body[x])) {
            return true;
        }
    }
    return false;
}

function manySome(arrX, arrY, func) {
    for (let i = 0; i < arrX.length; i++) {
        if (!arrX[i]) continue;
        for (let j = 0; j < arrY.length; j++) {
            if (!arrY[j]) continue;
            if (func(arrX[i], arrY[j])) {
                return true;
            }
        }
    }
    return false;
}


const isRuleset = item => item instanceof objects.Ruleset;
const isMediaQuery = item => item instanceof objects.Media;
const isIDSelector = item => item instanceof objects.IDSelector;
const isAttributeSelector = item => item instanceof objects.AttributeSelector;
const isPseudoElementSelector = item => item instanceof objects.PseudoElementSelector;
const isPseudoClassSelector = item => item instanceof objects.PseudoClassSelector;

function normalizeSelector(selector) {
    return selector instanceof objects.SelectorList ?
        selector.selectors :
        [selector];
}

function getLastInSelectorChain(selector) {
    if (selector instanceof objects.SimpleSelector) return selector;
    return getLastInSelectorChain(selector.descendant);
}

const mutuallyExclusiveAttrSelectors = {
    '=': true,
    '|=': true,
    '^=': true,
    '$=': true,
};

function canSelectorsEverTouchSameElement(selX, selY) {
    selX = selX.map(getLastInSelectorChain);
    selY = selY.map(getLastInSelectorChain);

    // TODO: Look at ID usage elsewhere in the selector. You might find
    // something like this:
    //   #foo *
    //   bar#foo
    // This otherwise looks (based on the last element in the selector) like
    // they might match, but the #foo usage tells otherwise.

    return manySome(selX, selY, (x, y) => {
        x = x.conditions;
        y = y.conditions;

        const xFirst = x[0];
        const yFirst = y[0];
        if (xFirst instanceof objects.ElementSelector &&
            yFirst instanceof objects.ElementSelector) {
            return xFirst.ident === yFirst.ident && xFirst.ns === yFirst.ns;
        }

        const xId = x.find(isIDSelector);
        const yId = x.find(isIDSelector);
        if (xId && yId) {
            return xId.ident !== yId.ident;
        }

        const attrTest = manySome(x, y, (x, y) => {
            if (!isAttributeSelector(x)) return false;
            if (!isAttributeSelector(y)) return false;

            if (!x.value || !y.value) return false;

            // TODO: There's a lot of other combinations that could be mutually
            // exclusive. `[x=abc]` and `[x^=b]` could be determined to never
            // match, for instance.
            return x.ident.toString() === y.ident.toString() &&
                x.comparison === y.comparison &&
                x.comparison in mutuallyExclusiveAttrSelectors &&
                x.value.toString() !== y.value.toString();
        });
        if (attrTest) return false;

        if (x.find(isPseudoElementSelector) ^ y.find(isPseudoElementSelector)) return false;
        if (x.find(isPseudoClassSelector) ^ y.find(isPseudoClassSelector)) return false;

        // TODO: not() support for classes, attributes

        return true;
    });
}
exports.canSelectorsEverTouchSameElement = canSelectorsEverTouchSameElement;


const supersetCache = new WeakMap();
function isSubset(subset, superset) {
    let strSuperset;
    if (supersetCache.has(superset)) {
        strSuperset = supersetCache.get(superset);
    } else {
        strSuperset = superset.map(x => x.toString());
        supersetCache.set(superset, strSuperset);
    }
    return subset.every(stmt => strSuperset.includes(stmt.toString()));
}

function canRulesetsBeCombined(parentBody, xIdx, yIdx) {
    const x = parentBody[xIdx];
    const y = parentBody[yIdx];
    if (!isRuleset(x) || !isRuleset(y)) return false;
    if (!isSubset(y.content, x.content)) {
        return false;
    }

    // You can't combine rulesets if there are media queries between the two.
    if (anyBetween(parentBody, xIdx, yIdx, isMediaQuery)) {
        return false;
    }

    const xSelector = normalizeSelector(x.selector);
    const ySelector = normalizeSelector(y.selector);

    // Adjacent rulesets are fine to merge.
    if (xIdx === yIdx - 1) return true;

    for (let i = yIdx - 1; i > xIdx; i--) {
        if (!isRuleset(parentBody[i])) continue;

        const tempSelector = normalizeSelector(parentBody[i].selector);
        if (canSelectorsEverTouchSameElement(ySelector, tempSelector)) return false;
    }

    return true;

}
exports.canRulesetsBeCombined = canRulesetsBeCombined;
