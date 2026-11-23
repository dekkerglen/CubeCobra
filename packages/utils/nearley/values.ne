# must implement the following to use these values.
# const defaultOperation = (op, value) => ...
# const stringOperation = (op, value) => ...
# const stringContainOperation = (op, value) => ...
# const nameStringOperation = (op, value) => ...
# const equalityOperation = (op, value) => ...
# const setOperation = (op, value) => ...
# const rarityOperation = (op, value) => ...
# const manaCostOperation = (op, value) => ...
# const castableCostOperation = (op, value) => ...
# const setElementOperation = (value) => ...
# const fetchedOperation = (op, value) => ...
# const propertyComparisonOperation = (op) => ...
# const setContainsOperation = (op, value) => ...
# const compileScryfallRegex = (pattern) => ...
# const devotionOperation = (op, colors, value) => ...

positiveHalfIntOpValue -> anyOperator positiveHalfIntValue {% ([op, value]) => defaultOperation(op, value) %}

positiveHalfIntValue ->
    "-":? [0-9]:+ {% ([negative, digits]) => parseInt(`${negative || ''}${digits.join('')}`, 10) %}
  | [0-9]:* "." ("0" | "5") {% ([digits, , afterDecimal]) => parseFloat(`${digits.join('')}.${afterDecimal}`, 10) %}

halfIntOpValue -> anyOperator halfIntValue {% ([op, value]) => defaultOperation(op, value) %}

halfIntValue ->
    [0-9]:+ ("." ("0" | "5")):? {% ([digits, decimal]) => parseFloat(`${digits.join('')}${(decimal || []).join('')}`, 10) %}
  | "." ("0" | "5") {% ([, digit]) => digit === '5' ? 0.5 : 0 %}

integerOpValue -> anyOperator integerValue {% ([op, value]) => defaultOperation(op, value) %}

# used for fields that are fetched from the database
fetchedIntegerOpValue -> anyOperator integerValue {% ([op, value]) => fetchedOperation(op, value) %}

integerValue -> [0-9]:+ {% ([digits]) => parseInt(digits.join(''), 10) %}

# Arbitrary-precision non-negative decimal, e.g. "salt>1.25". Unlike dollarValue this
# has no "$" prefix and allows any number of decimal places.
floatOpValue -> anyOperator floatValue {% ([op, value]) => defaultOperation(op, value) %}

floatValue -> [0-9]:+ ("." [0-9]:+):? {% ([digits, decimal]) => parseFloat(`${digits.join('')}${decimal ? '.' + decimal[1].join('') : ''}`) %}

dollarOpValue -> anyOperator dollarValue {% ([op, value]) => defaultOperation(op, value) %}

dollarValue -> "$":? (
    [0-9]:+
  | [0-9]:+ "." [0-9]
  | [0-9]:+ "." [0-9] [0-9]
) {% ([, [digits, ...decimal]]) => parseFloat(digits.concat(decimal).join(''), 10) %}

finishOpValue -> equalityOperator finishValue {% ([op, value]) => stringOperation(op.toString() === ':' ? '=' : op, value) %}

finishValue -> ("Foil"i | "Non-Foil"i | "Etched"i | "Alt-foil"i) {% ([[finish]]) => finish.toLowerCase() %}
  | "\"" ("Foil"i | "Non-Foil"i | "Etched"i | "Alt-foil"i) "\"" {% ([, [finish]]) => finish.toLowerCase() %}

legalityOpValue -> equalityOperator legalityValue {% ([op, value]) => setElementOperation(op, value) %}

legalityValue -> ("Standard"i | "Pioneer"i | "Modern"i | "Legacy"i | "Vintage"i | "Brawl"i | "Historic"i | "Pauper"i | "Penny"i | "Commander"i | "Timeless"i | "Premodern"i) {% ([[legality]]) => legality.toLowerCase() %}
  | "\"" ("Standard"i | "Pioneer"i | "Modern"i | "Legacy"i | "Vintage"i | "Brawl"i | "Historic"i | "Pauper"i | "Penny"i | "Commander"i | "Timeless"i | "Premodern"i) "\"" {% ([, [legality]]) => legality.toLowerCase() %}

statusOpValue -> equalityOperator statusValue {% ([op, value]) => stringOperation(op.toString() === ':' ? '=' : op, value) %}

statusValue -> ("owned"i | "proxied"i | "ordered"i | "borrowed"i) {% ([[status]]) => status.toLowerCase() %} 
  | "'" ("owned"i | "proxied"i | "ordered"i | "not owned"i | "premium owned"i | "borrowed"i) "'" {% ([, [status]]) => status.toLowerCase() %}
  | "\"" ("owned"i | "proxied"i | "ordered"i | "not owned"i | "premium owned"i | "borrowed"i) "\"" {% ([, [status]]) => status.toLowerCase() %}

rarityOpValue -> anyOperator rarityValue {% ([op, value]) => rarityOperation(op, value) %}

rarityValue -> ("s"i | "special"i | "m"i | "mythic"i | "r"i | "rare"i | "u"i | "uncommon"i | "common"i | "c"i | "b"i | "bonus"i) {% ([[rarity]]) => rarity %}

colorCategoryOpValue -> equalityOperator colorCategoryValue {% ([op, value]) => colorCategoryOperation(op, value) %}

colorCategoryValue -> ("w"i | "white"i | "u"i | "blue"i | "b"i | "black"i | "r"i | "red"i | "g"i | "green"i | "c"i | "colorless"i | "m"i | "multicolored"i | "l"i | "land"i) {% ([[category]]) => category.toLowerCase() %}
  | "\"" ("w"i | "white"i | "u"i | "blue"i | "b"i | "black"i | "r"i | "red"i | "g"i | "green"i | "c"i | "colorless"i | "m"i | "multicolored"i | "l"i | "land"i) "\"" {% ([, [category]]) => category.toLowerCase() %}

alphaNumericValue -> [a-zA-Z0-9]:+ {% ([letters]) => letters.join('').toLowerCase() %}

alphaNumericOpValue -> equalityOperator alphaNumericValue {% ([op, value]) => equalityOperation(op, value) %}

# Scryfall set types, some of which contain underscores (draft_innovation, duel_deck). Scryfall also takes them
# without the underscore (st:draftinnovation), so underscores are dropped on both sides.
setTypeValue -> [a-zA-Z_]:+ {% ([letters]) => letters.join('').toLowerCase().replace(/_/g, '') %}

setTypeOpValue -> equalityOperator setTypeValue {% ([op, value]) => equalityOperation(op, value) %}

gameOpValue -> equalityOperator gameValue {% ([op, value]) => setContainsOperation(op, value) %}

exactGameOpValue -> equalityOperator "is-"i gameValue {% ([op, , value]) => setContainsOperation(op, value) %}

gameValue -> ("Paper"i | "Arena"i | "Mtgo"i) {% ([[game]]) => game.toLowerCase() %}

@{%
const normalizeCombination = (combination) => combination.join('').toLowerCase().replace('c', '').split('');
// c:c means colorless (like c=c), not "includes no particular color", which every card would match.
const colorlessAware = (op, value) => (value.length === 0 && op.toString() === ':' ? '=' : op);
// m means multicolored, two or more colors: c:m and c=m are "at least two", c!=m is "fewer than two".
const multicolorOperation = (op) => {
  const withDescription = (operation, describe) => {
    const f = (count) => operation(count);
    f.describe = describe;
    return f;
  };
  switch (op.toString()) {
    case ':':
    case '=':
      return withDescription(defaultOperation('>=', 2), 'is multicolored');
    case '!=':
    case '<>':
      return withDescription(defaultOperation('<', 2), 'is not multicolored');
    default:
      return withDescription(defaultOperation(op, 2), `count ${numericPhrase(op, 2)}`);
  }
};
const reversedSetOperation = (op, value) => {
  if (op.toString() === ':') {
    op = '<=';
  }
  return setOperation(op, value);
};
%} # %}

# TODO: Make these work with non-func operations
colorCombinationOpValue -> anyOperator colorCombinationValue {% ([op, value]) => { const operation = setOperation(colorlessAware(op, value), value); const f = (fieldValue) => operation(normalizeCombination(fieldValue)); f.describe = operation.describe; return f; } %}
  | anyOperator integerValue {% ([op, value]) => { const operation = defaultOperation(op, value); const f = (fieldValue) => operation(normalizeCombination(fieldValue).length); f.describe = `count ${numericPhrase(op, value)}`; return f; } %}
  | anyOperator multicolorValue {% ([op]) => { const operation = multicolorOperation(op); const f = (fieldValue) => operation(normalizeCombination(fieldValue).length); f.describe = operation.describe; return f; } %}

colorIdentityOpValue -> anyOperator colorCombinationValue {% ([op, value]) => { const operation = reversedSetOperation(op, value); const f = (fieldValue) => operation(normalizeCombination(fieldValue)); f.describe = operation.describe; return f; } %}
  | anyOperator integerValue {% ([op, value]) => { const operation = defaultOperation(op, value); const f = (fieldValue) => operation(normalizeCombination(fieldValue).length); f.describe = `count ${numericPhrase(op, value)}`; return f; } %}
  | anyOperator multicolorValue {% ([op]) => { const operation = multicolorOperation(op); const f = (fieldValue) => operation(normalizeCombination(fieldValue).length); f.describe = operation.describe; return f; } %}

multicolorValue -> ("m"i | "multicolor"i | "multicolored"i)

# Macro based handling of 4/5 colors had ordering issues. Generated all combinations using Copilot,
# from 1 to 5 of the colors used
colorCombinationValue ->
    ("c"i | "brown"i | "colorless"i) {% () => [] %}
  | "white"i {% () => ['w'] %}
  | "blue"i {% () => ['u'] %}
  | "black"i {% () => ['b'] %}
  | "red"i {% () => ['r'] %}
  | "green"i {% () => ['g'] %}
  | ("azorious"i | "azorius"i) {% () => ['w', 'u'] %}
  | "dimir"i {% () => ['u', 'b'] %}
  | "rakdos"i {% () => ['b', 'r'] %}
  | ("gruul"i | "grul"i) {% () => ['r', 'g'] %}
  | "selesnya"i {% () => ['g', 'w'] %}
  | "orzhov"i {% () => ['w', 'b'] %}
  | ("izzet"i | "izet"i) {% () => ['u', 'r'] %}
  | "golgari"i {% () => ['b', 'g'] %}
  | "boros"i {% () => ['w', 'r'] %}
  | "simic"i {% () => ['u', 'g'] %}
  | "bant"i {% () => ['w', 'u', 'g'] %}
  | "esper"i {% () => ['w', 'u', 'b'] %}
  | "grixis"i {% () => ['u', 'b', 'r'] %}
  | "jund"i {% () => ['b', 'r', 'g'] %}
  | "naya"i {% () => ['w', 'r', 'g'] %}
  | "mardu"i {% () => ['w', 'b', 'r'] %}
  | "temur"i {% () => ['u', 'r', 'g'] %}
  | "abzan"i {% () => ['w', 'b', 'g'] %}
  | "jeskai"i {% () => ['w', 'u', 'r'] %}
  | "sultai"i {% () => ['u', 'b', 'g'] %}
  | "silverquill"i {% () => ['w', 'b'] %}
  | "prismari"i {% () => ['u', 'r'] %}
  | "witherbloom"i {% () => ['b', 'g'] %}
  | "lorehold"i {% () => ['r', 'w'] %}
  | "quandrix"i {% () => ['g', 'u'] %}
  | "chaos"i {% () => ['u', 'b', 'r', 'g'] %}
  | "aggression"i {% () => ['w', 'b', 'r', 'g'] %}
  | "altruism"i {% () => ['w', 'u', 'r', 'g'] %}
  | "growth"i {% () => ['w', 'u', 'b', 'g'] %}
  | "artifice"i {% () => ['w', 'u', 'b', 'r'] %}
  | ("rainbow"i | "fivecolor"i) {% () => ['w', 'u', 'b', 'r', 'g'] %}
  | "w"i {% () => ['w'] %}
  | "u"i {% () => ['u'] %}
  | "b"i {% () => ['b'] %}
  | "r"i {% () => ['r'] %}
  | "g"i {% () => ['g'] %}
  | "w"i "u"i {% () => ['w', 'u'] %}
  | "u"i "w"i {% () => ['u', 'w'] %}
  | "w"i "b"i {% () => ['w', 'b'] %}
  | "b"i "w"i {% () => ['b', 'w'] %}
  | "w"i "r"i {% () => ['w', 'r'] %}
  | "r"i "w"i {% () => ['r', 'w'] %}
  | "w"i "g"i {% () => ['w', 'g'] %}
  | "g"i "w"i {% () => ['g', 'w'] %}
  | "u"i "b"i {% () => ['u', 'b'] %}
  | "b"i "u"i {% () => ['b', 'u'] %}
  | "u"i "r"i {% () => ['u', 'r'] %}
  | "r"i "u"i {% () => ['r', 'u'] %}
  | "u"i "g"i {% () => ['u', 'g'] %}
  | "g"i "u"i {% () => ['g', 'u'] %}
  | "b"i "r"i {% () => ['b', 'r'] %}
  | "r"i "b"i {% () => ['r', 'b'] %}
  | "b"i "g"i {% () => ['b', 'g'] %}
  | "g"i "b"i {% () => ['g', 'b'] %}
  | "r"i "g"i {% () => ['r', 'g'] %}
  | "g"i "r"i {% () => ['g', 'r'] %}
  | "w"i "u"i "b"i {% () => ['w', 'u', 'b'] %}
  | "w"i "b"i "u"i {% () => ['w', 'b', 'u'] %}
  | "u"i "w"i "b"i {% () => ['u', 'w', 'b'] %}
  | "u"i "b"i "w"i {% () => ['u', 'b', 'w'] %}
  | "b"i "w"i "u"i {% () => ['b', 'w', 'u'] %}
  | "b"i "u"i "w"i {% () => ['b', 'u', 'w'] %}
  | "w"i "u"i "r"i {% () => ['w', 'u', 'r'] %}
  | "w"i "r"i "u"i {% () => ['w', 'r', 'u'] %}
  | "u"i "w"i "r"i {% () => ['u', 'w', 'r'] %}
  | "u"i "r"i "w"i {% () => ['u', 'r', 'w'] %}
  | "r"i "w"i "u"i {% () => ['r', 'w', 'u'] %}
  | "r"i "u"i "w"i {% () => ['r', 'u', 'w'] %}
  | "w"i "u"i "g"i {% () => ['w', 'u', 'g'] %}
  | "w"i "g"i "u"i {% () => ['w', 'g', 'u'] %}
  | "u"i "w"i "g"i {% () => ['u', 'w', 'g'] %}
  | "u"i "g"i "w"i {% () => ['u', 'g', 'w'] %}
  | "g"i "w"i "u"i {% () => ['g', 'w', 'u'] %}
  | "g"i "u"i "w"i {% () => ['g', 'u', 'w'] %}
  | "w"i "b"i "r"i {% () => ['w', 'b', 'r'] %}
  | "w"i "r"i "b"i {% () => ['w', 'r', 'b'] %}
  | "b"i "w"i "r"i {% () => ['b', 'w', 'r'] %}
  | "b"i "r"i "w"i {% () => ['b', 'r', 'w'] %}
  | "r"i "w"i "b"i {% () => ['r', 'w', 'b'] %}
  | "r"i "b"i "w"i {% () => ['r', 'b', 'w'] %}
  | "w"i "b"i "g"i {% () => ['w', 'b', 'g'] %}
  | "w"i "g"i "b"i {% () => ['w', 'g', 'b'] %}
  | "b"i "w"i "g"i {% () => ['b', 'w', 'g'] %}
  | "b"i "g"i "w"i {% () => ['b', 'g', 'w'] %}
  | "g"i "w"i "b"i {% () => ['g', 'w', 'b'] %}
  | "g"i "b"i "w"i {% () => ['g', 'b', 'w'] %}
  | "w"i "r"i "g"i {% () => ['w', 'r', 'g'] %}
  | "w"i "g"i "r"i {% () => ['w', 'g', 'r'] %}
  | "r"i "w"i "g"i {% () => ['r', 'w', 'g'] %}
  | "r"i "g"i "w"i {% () => ['r', 'g', 'w'] %}
  | "g"i "w"i "r"i {% () => ['g', 'w', 'r'] %}
  | "g"i "r"i "w"i {% () => ['g', 'r', 'w'] %}
  | "u"i "b"i "r"i {% () => ['u', 'b', 'r'] %}
  | "u"i "r"i "b"i {% () => ['u', 'r', 'b'] %}
  | "b"i "u"i "r"i {% () => ['b', 'u', 'r'] %}
  | "b"i "r"i "u"i {% () => ['b', 'r', 'u'] %}
  | "r"i "u"i "b"i {% () => ['r', 'u', 'b'] %}
  | "r"i "b"i "u"i {% () => ['r', 'b', 'u'] %}
  | "u"i "b"i "g"i {% () => ['u', 'b', 'g'] %}
  | "u"i "g"i "b"i {% () => ['u', 'g', 'b'] %}
  | "b"i "u"i "g"i {% () => ['b', 'u', 'g'] %}
  | "b"i "g"i "u"i {% () => ['b', 'g', 'u'] %}
  | "g"i "u"i "b"i {% () => ['g', 'u', 'b'] %}
  | "g"i "b"i "u"i {% () => ['g', 'b', 'u'] %}
  | "u"i "r"i "g"i {% () => ['u', 'r', 'g'] %}
  | "u"i "g"i "r"i {% () => ['u', 'g', 'r'] %}
  | "r"i "u"i "g"i {% () => ['r', 'u', 'g'] %}
  | "r"i "g"i "u"i {% () => ['r', 'g', 'u'] %}
  | "g"i "u"i "r"i {% () => ['g', 'u', 'r'] %}
  | "g"i "r"i "u"i {% () => ['g', 'r', 'u'] %}
  | "b"i "r"i "g"i {% () => ['b', 'r', 'g'] %}
  | "b"i "g"i "r"i {% () => ['b', 'g', 'r'] %}
  | "r"i "b"i "g"i {% () => ['r', 'b', 'g'] %}
  | "r"i "g"i "b"i {% () => ['r', 'g', 'b'] %}
  | "g"i "b"i "r"i {% () => ['g', 'b', 'r'] %}
  | "g"i "r"i "b"i {% () => ['g', 'r', 'b'] %}
  | "w"i "u"i "b"i "r"i {% () => ['w', 'u', 'b', 'r'] %}
  | "w"i "u"i "r"i "b"i {% () => ['w', 'u', 'r', 'b'] %}
  | "w"i "b"i "u"i "r"i {% () => ['w', 'b', 'u', 'r'] %}
  | "w"i "b"i "r"i "u"i {% () => ['w', 'b', 'r', 'u'] %}
  | "w"i "r"i "u"i "b"i {% () => ['w', 'r', 'u', 'b'] %}
  | "w"i "r"i "b"i "u"i {% () => ['w', 'r', 'b', 'u'] %}
  | "u"i "w"i "b"i "r"i {% () => ['u', 'w', 'b', 'r'] %}
  | "u"i "w"i "r"i "b"i {% () => ['u', 'w', 'r', 'b'] %}
  | "u"i "b"i "w"i "r"i {% () => ['u', 'b', 'w', 'r'] %}
  | "u"i "b"i "r"i "w"i {% () => ['u', 'b', 'r', 'w'] %}
  | "u"i "r"i "w"i "b"i {% () => ['u', 'r', 'w', 'b'] %}
  | "u"i "r"i "b"i "w"i {% () => ['u', 'r', 'b', 'w'] %}
  | "b"i "w"i "u"i "r"i {% () => ['b', 'w', 'u', 'r'] %}
  | "b"i "w"i "r"i "u"i {% () => ['b', 'w', 'r', 'u'] %}
  | "b"i "u"i "w"i "r"i {% () => ['b', 'u', 'w', 'r'] %}
  | "b"i "u"i "r"i "w"i {% () => ['b', 'u', 'r', 'w'] %}
  | "b"i "r"i "w"i "u"i {% () => ['b', 'r', 'w', 'u'] %}
  | "b"i "r"i "u"i "w"i {% () => ['b', 'r', 'u', 'w'] %}
  | "r"i "w"i "u"i "b"i {% () => ['r', 'w', 'u', 'b'] %}
  | "r"i "w"i "b"i "u"i {% () => ['r', 'w', 'b', 'u'] %}
  | "r"i "u"i "w"i "b"i {% () => ['r', 'u', 'w', 'b'] %}
  | "r"i "u"i "b"i "w"i {% () => ['r', 'u', 'b', 'w'] %}
  | "r"i "b"i "w"i "u"i {% () => ['r', 'b', 'w', 'u'] %}
  | "r"i "b"i "u"i "w"i {% () => ['r', 'b', 'u', 'w'] %}
  | "w"i "u"i "b"i "g"i {% () => ['w', 'u', 'b', 'g'] %}
  | "w"i "u"i "g"i "b"i {% () => ['w', 'u', 'g', 'b'] %}
  | "w"i "b"i "u"i "g"i {% () => ['w', 'b', 'u', 'g'] %}
  | "w"i "b"i "g"i "u"i {% () => ['w', 'b', 'g', 'u'] %}
  | "w"i "g"i "u"i "b"i {% () => ['w', 'g', 'u', 'b'] %}
  | "w"i "g"i "b"i "u"i {% () => ['w', 'g', 'b', 'u'] %}
  | "u"i "w"i "b"i "g"i {% () => ['u', 'w', 'b', 'g'] %}
  | "u"i "w"i "g"i "b"i {% () => ['u', 'w', 'g', 'b'] %}
  | "u"i "b"i "w"i "g"i {% () => ['u', 'b', 'w', 'g'] %}
  | "u"i "b"i "g"i "w"i {% () => ['u', 'b', 'g', 'w'] %}
  | "u"i "g"i "w"i "b"i {% () => ['u', 'g', 'w', 'b'] %}
  | "u"i "g"i "b"i "w"i {% () => ['u', 'g', 'b', 'w'] %}
  | "b"i "w"i "u"i "g"i {% () => ['b', 'w', 'u', 'g'] %}
  | "b"i "w"i "g"i "u"i {% () => ['b', 'w', 'g', 'u'] %}
  | "b"i "u"i "w"i "g"i {% () => ['b', 'u', 'w', 'g'] %}
  | "b"i "u"i "g"i "w"i {% () => ['b', 'u', 'g', 'w'] %}
  | "b"i "g"i "w"i "u"i {% () => ['b', 'g', 'w', 'u'] %}
  | "b"i "g"i "u"i "w"i {% () => ['b', 'g', 'u', 'w'] %}
  | "g"i "w"i "u"i "b"i {% () => ['g', 'w', 'u', 'b'] %}
  | "g"i "w"i "b"i "u"i {% () => ['g', 'w', 'b', 'u'] %}
  | "g"i "u"i "w"i "b"i {% () => ['g', 'u', 'w', 'b'] %}
  | "g"i "u"i "b"i "w"i {% () => ['g', 'u', 'b', 'w'] %}
  | "g"i "b"i "w"i "u"i {% () => ['g', 'b', 'w', 'u'] %}
  | "g"i "b"i "u"i "w"i {% () => ['g', 'b', 'u', 'w'] %}
  | "w"i "u"i "r"i "g"i {% () => ['w', 'u', 'r', 'g'] %}
  | "w"i "u"i "g"i "r"i {% () => ['w', 'u', 'g', 'r'] %}
  | "w"i "r"i "u"i "g"i {% () => ['w', 'r', 'u', 'g'] %}
  | "w"i "r"i "g"i "u"i {% () => ['w', 'r', 'g', 'u'] %}
  | "w"i "g"i "u"i "r"i {% () => ['w', 'g', 'u', 'r'] %}
  | "w"i "g"i "r"i "u"i {% () => ['w', 'g', 'r', 'u'] %}
  | "u"i "w"i "r"i "g"i {% () => ['u', 'w', 'r', 'g'] %}
  | "u"i "w"i "g"i "r"i {% () => ['u', 'w', 'g', 'r'] %}
  | "u"i "r"i "w"i "g"i {% () => ['u', 'r', 'w', 'g'] %}
  | "u"i "r"i "g"i "w"i {% () => ['u', 'r', 'g', 'w'] %}
  | "u"i "g"i "w"i "r"i {% () => ['u', 'g', 'w', 'r'] %}
  | "u"i "g"i "r"i "w"i {% () => ['u', 'g', 'r', 'w'] %}
  | "r"i "w"i "u"i "g"i {% () => ['r', 'w', 'u', 'g'] %}
  | "r"i "w"i "g"i "u"i {% () => ['r', 'w', 'g', 'u'] %}
  | "r"i "u"i "w"i "g"i {% () => ['r', 'u', 'w', 'g'] %}
  | "r"i "u"i "g"i "w"i {% () => ['r', 'u', 'g', 'w'] %}
  | "r"i "g"i "w"i "u"i {% () => ['r', 'g', 'w', 'u'] %}
  | "r"i "g"i "u"i "w"i {% () => ['r', 'g', 'u', 'w'] %}
  | "g"i "w"i "u"i "r"i {% () => ['g', 'w', 'u', 'r'] %}
  | "g"i "w"i "r"i "u"i {% () => ['g', 'w', 'r', 'u'] %}
  | "g"i "u"i "w"i "r"i {% () => ['g', 'u', 'w', 'r'] %}
  | "g"i "u"i "r"i "w"i {% () => ['g', 'u', 'r', 'w'] %}
  | "g"i "r"i "w"i "u"i {% () => ['g', 'r', 'w', 'u'] %}
  | "g"i "r"i "u"i "w"i {% () => ['g', 'r', 'u', 'w'] %}
  | "w"i "b"i "r"i "g"i {% () => ['w', 'b', 'r', 'g'] %}
  | "w"i "b"i "g"i "r"i {% () => ['w', 'b', 'g', 'r'] %}
  | "w"i "r"i "b"i "g"i {% () => ['w', 'r', 'b', 'g'] %}
  | "w"i "r"i "g"i "b"i {% () => ['w', 'r', 'g', 'b'] %}
  | "w"i "g"i "b"i "r"i {% () => ['w', 'g', 'b', 'r'] %}
  | "w"i "g"i "r"i "b"i {% () => ['w', 'g', 'r', 'b'] %}
  | "b"i "w"i "r"i "g"i {% () => ['b', 'w', 'r', 'g'] %}
  | "b"i "w"i "g"i "r"i {% () => ['b', 'w', 'g', 'r'] %}
  | "b"i "r"i "w"i "g"i {% () => ['b', 'r', 'w', 'g'] %}
  | "b"i "r"i "g"i "w"i {% () => ['b', 'r', 'g', 'w'] %}
  | "b"i "g"i "w"i "r"i {% () => ['b', 'g', 'w', 'r'] %}
  | "b"i "g"i "r"i "w"i {% () => ['b', 'g', 'r', 'w'] %}
  | "r"i "w"i "b"i "g"i {% () => ['r', 'w', 'b', 'g'] %}
  | "r"i "w"i "g"i "b"i {% () => ['r', 'w', 'g', 'b'] %}
  | "r"i "b"i "w"i "g"i {% () => ['r', 'b', 'w', 'g'] %}
  | "r"i "b"i "g"i "w"i {% () => ['r', 'b', 'g', 'w'] %}
  | "r"i "g"i "w"i "b"i {% () => ['r', 'g', 'w', 'b'] %}
  | "r"i "g"i "b"i "w"i {% () => ['r', 'g', 'b', 'w'] %}
  | "g"i "w"i "b"i "r"i {% () => ['g', 'w', 'b', 'r'] %}
  | "g"i "w"i "r"i "b"i {% () => ['g', 'w', 'r', 'b'] %}
  | "g"i "b"i "w"i "r"i {% () => ['g', 'b', 'w', 'r'] %}
  | "g"i "b"i "r"i "w"i {% () => ['g', 'b', 'r', 'w'] %}
  | "g"i "r"i "w"i "b"i {% () => ['g', 'r', 'w', 'b'] %}
  | "g"i "r"i "b"i "w"i {% () => ['g', 'r', 'b', 'w'] %}
  | "u"i "b"i "r"i "g"i {% () => ['u', 'b', 'r', 'g'] %}
  | "u"i "b"i "g"i "r"i {% () => ['u', 'b', 'g', 'r'] %}
  | "u"i "r"i "b"i "g"i {% () => ['u', 'r', 'b', 'g'] %}
  | "u"i "r"i "g"i "b"i {% () => ['u', 'r', 'g', 'b'] %}
  | "u"i "g"i "b"i "r"i {% () => ['u', 'g', 'b', 'r'] %}
  | "u"i "g"i "r"i "b"i {% () => ['u', 'g', 'r', 'b'] %}
  | "b"i "u"i "r"i "g"i {% () => ['b', 'u', 'r', 'g'] %}
  | "b"i "u"i "g"i "r"i {% () => ['b', 'u', 'g', 'r'] %}
  | "b"i "r"i "u"i "g"i {% () => ['b', 'r', 'u', 'g'] %}
  | "b"i "r"i "g"i "u"i {% () => ['b', 'r', 'g', 'u'] %}
  | "b"i "g"i "u"i "r"i {% () => ['b', 'g', 'u', 'r'] %}
  | "b"i "g"i "r"i "u"i {% () => ['b', 'g', 'r', 'u'] %}
  | "r"i "u"i "b"i "g"i {% () => ['r', 'u', 'b', 'g'] %}
  | "r"i "u"i "g"i "b"i {% () => ['r', 'u', 'g', 'b'] %}
  | "r"i "b"i "u"i "g"i {% () => ['r', 'b', 'u', 'g'] %}
  | "r"i "b"i "g"i "u"i {% () => ['r', 'b', 'g', 'u'] %}
  | "r"i "g"i "u"i "b"i {% () => ['r', 'g', 'u', 'b'] %}
  | "r"i "g"i "b"i "u"i {% () => ['r', 'g', 'b', 'u'] %}
  | "g"i "u"i "b"i "r"i {% () => ['g', 'u', 'b', 'r'] %}
  | "g"i "u"i "r"i "b"i {% () => ['g', 'u', 'r', 'b'] %}
  | "g"i "b"i "u"i "r"i {% () => ['g', 'b', 'u', 'r'] %}
  | "g"i "b"i "r"i "u"i {% () => ['g', 'b', 'r', 'u'] %}
  | "g"i "r"i "u"i "b"i {% () => ['g', 'r', 'u', 'b'] %}
  | "g"i "r"i "b"i "u"i {% () => ['g', 'r', 'b', 'u'] %}
  | "w"i "u"i "b"i "r"i "g"i {% () => ['w', 'u', 'b', 'r', 'g'] %}
  | "w"i "u"i "b"i "g"i "r"i {% () => ['w', 'u', 'b', 'g', 'r'] %}
  | "w"i "u"i "r"i "b"i "g"i {% () => ['w', 'u', 'r', 'b', 'g'] %}
  | "w"i "u"i "r"i "g"i "b"i {% () => ['w', 'u', 'r', 'g', 'b'] %}
  | "w"i "u"i "g"i "b"i "r"i {% () => ['w', 'u', 'g', 'b', 'r'] %}
  | "w"i "u"i "g"i "r"i "b"i {% () => ['w', 'u', 'g', 'r', 'b'] %}
  | "w"i "b"i "u"i "r"i "g"i {% () => ['w', 'b', 'u', 'r', 'g'] %}
  | "w"i "b"i "u"i "g"i "r"i {% () => ['w', 'b', 'u', 'g', 'r'] %}
  | "w"i "b"i "r"i "u"i "g"i {% () => ['w', 'b', 'r', 'u', 'g'] %}
  | "w"i "b"i "r"i "g"i "u"i {% () => ['w', 'b', 'r', 'g', 'u'] %}
  | "w"i "b"i "g"i "u"i "r"i {% () => ['w', 'b', 'g', 'u', 'r'] %}
  | "w"i "b"i "g"i "r"i "u"i {% () => ['w', 'b', 'g', 'r', 'u'] %}
  | "w"i "r"i "u"i "b"i "g"i {% () => ['w', 'r', 'u', 'b', 'g'] %}
  | "w"i "r"i "u"i "g"i "b"i {% () => ['w', 'r', 'u', 'g', 'b'] %}
  | "w"i "r"i "b"i "u"i "g"i {% () => ['w', 'r', 'b', 'u', 'g'] %}
  | "w"i "r"i "b"i "g"i "u"i {% () => ['w', 'r', 'b', 'g', 'u'] %}
  | "w"i "r"i "g"i "u"i "b"i {% () => ['w', 'r', 'g', 'u', 'b'] %}
  | "w"i "r"i "g"i "b"i "u"i {% () => ['w', 'r', 'g', 'b', 'u'] %}
  | "w"i "g"i "u"i "b"i "r"i {% () => ['w', 'g', 'u', 'b', 'r'] %}
  | "w"i "g"i "u"i "r"i "b"i {% () => ['w', 'g', 'u', 'r', 'b'] %}
  | "w"i "g"i "b"i "u"i "r"i {% () => ['w', 'g', 'b', 'u', 'r'] %}
  | "w"i "g"i "b"i "r"i "u"i {% () => ['w', 'g', 'b', 'r', 'u'] %}
  | "w"i "g"i "r"i "u"i "b"i {% () => ['w', 'g', 'r', 'u', 'b'] %}
  | "w"i "g"i "r"i "b"i "u"i {% () => ['w', 'g', 'r', 'b', 'u'] %}
  | "u"i "w"i "b"i "r"i "g"i {% () => ['u', 'w', 'b', 'r', 'g'] %}
  | "u"i "w"i "b"i "g"i "r"i {% () => ['u', 'w', 'b', 'g', 'r'] %}
  | "u"i "w"i "r"i "b"i "g"i {% () => ['u', 'w', 'r', 'b', 'g'] %}
  | "u"i "w"i "r"i "g"i "b"i {% () => ['u', 'w', 'r', 'g', 'b'] %}
  | "u"i "w"i "g"i "b"i "r"i {% () => ['u', 'w', 'g', 'b', 'r'] %}
  | "u"i "w"i "g"i "r"i "b"i {% () => ['u', 'w', 'g', 'r', 'b'] %}
  | "u"i "b"i "w"i "r"i "g"i {% () => ['u', 'b', 'w', 'r', 'g'] %}
  | "u"i "b"i "w"i "g"i "r"i {% () => ['u', 'b', 'w', 'g', 'r'] %}
  | "u"i "b"i "r"i "w"i "g"i {% () => ['u', 'b', 'r', 'w', 'g'] %}
  | "u"i "b"i "r"i "g"i "w"i {% () => ['u', 'b', 'r', 'g', 'w'] %}
  | "u"i "b"i "g"i "w"i "r"i {% () => ['u', 'b', 'g', 'w', 'r'] %}
  | "u"i "b"i "g"i "r"i "w"i {% () => ['u', 'b', 'g', 'r', 'w'] %}
  | "u"i "r"i "w"i "b"i "g"i {% () => ['u', 'r', 'w', 'b', 'g'] %}
  | "u"i "r"i "w"i "g"i "b"i {% () => ['u', 'r', 'w', 'g', 'b'] %}
  | "u"i "r"i "b"i "w"i "g"i {% () => ['u', 'r', 'b', 'w', 'g'] %}
  | "u"i "r"i "b"i "g"i "w"i {% () => ['u', 'r', 'b', 'g', 'w'] %}
  | "u"i "r"i "g"i "w"i "b"i {% () => ['u', 'r', 'g', 'w', 'b'] %}
  | "u"i "r"i "g"i "b"i "w"i {% () => ['u', 'r', 'g', 'b', 'w'] %}
  | "u"i "g"i "w"i "b"i "r"i {% () => ['u', 'g', 'w', 'b', 'r'] %}
  | "u"i "g"i "w"i "r"i "b"i {% () => ['u', 'g', 'w', 'r', 'b'] %}
  | "u"i "g"i "b"i "w"i "r"i {% () => ['u', 'g', 'b', 'w', 'r'] %}
  | "u"i "g"i "b"i "r"i "w"i {% () => ['u', 'g', 'b', 'r', 'w'] %}
  | "u"i "g"i "r"i "w"i "b"i {% () => ['u', 'g', 'r', 'w', 'b'] %}
  | "u"i "g"i "r"i "b"i "w"i {% () => ['u', 'g', 'r', 'b', 'w'] %}
  | "b"i "w"i "u"i "r"i "g"i {% () => ['b', 'w', 'u', 'r', 'g'] %}
  | "b"i "w"i "u"i "g"i "r"i {% () => ['b', 'w', 'u', 'g', 'r'] %}
  | "b"i "w"i "r"i "u"i "g"i {% () => ['b', 'w', 'r', 'u', 'g'] %}
  | "b"i "w"i "r"i "g"i "u"i {% () => ['b', 'w', 'r', 'g', 'u'] %}
  | "b"i "w"i "g"i "u"i "r"i {% () => ['b', 'w', 'g', 'u', 'r'] %}
  | "b"i "w"i "g"i "r"i "u"i {% () => ['b', 'w', 'g', 'r', 'u'] %}
  | "b"i "u"i "w"i "r"i "g"i {% () => ['b', 'u', 'w', 'r', 'g'] %}
  | "b"i "u"i "w"i "g"i "r"i {% () => ['b', 'u', 'w', 'g', 'r'] %}
  | "b"i "u"i "r"i "w"i "g"i {% () => ['b', 'u', 'r', 'w', 'g'] %}
  | "b"i "u"i "r"i "g"i "w"i {% () => ['b', 'u', 'r', 'g', 'w'] %}
  | "b"i "u"i "g"i "w"i "r"i {% () => ['b', 'u', 'g', 'w', 'r'] %}
  | "b"i "u"i "g"i "r"i "w"i {% () => ['b', 'u', 'g', 'r', 'w'] %}
  | "b"i "r"i "w"i "u"i "g"i {% () => ['b', 'r', 'w', 'u', 'g'] %}
  | "b"i "r"i "w"i "g"i "u"i {% () => ['b', 'r', 'w', 'g', 'u'] %}
  | "b"i "r"i "u"i "w"i "g"i {% () => ['b', 'r', 'u', 'w', 'g'] %}
  | "b"i "r"i "u"i "g"i "w"i {% () => ['b', 'r', 'u', 'g', 'w'] %}
  | "b"i "r"i "g"i "w"i "u"i {% () => ['b', 'r', 'g', 'w', 'u'] %}
  | "b"i "r"i "g"i "u"i "w"i {% () => ['b', 'r', 'g', 'u', 'w'] %}
  | "b"i "g"i "w"i "u"i "r"i {% () => ['b', 'g', 'w', 'u', 'r'] %}
  | "b"i "g"i "w"i "r"i "u"i {% () => ['b', 'g', 'w', 'r', 'u'] %}
  | "b"i "g"i "u"i "w"i "r"i {% () => ['b', 'g', 'u', 'w', 'r'] %}
  | "b"i "g"i "u"i "r"i "w"i {% () => ['b', 'g', 'u', 'r', 'w'] %}
  | "b"i "g"i "r"i "w"i "u"i {% () => ['b', 'g', 'r', 'w', 'u'] %}
  | "b"i "g"i "r"i "u"i "w"i {% () => ['b', 'g', 'r', 'u', 'w'] %}
  | "r"i "w"i "u"i "b"i "g"i {% () => ['r', 'w', 'u', 'b', 'g'] %}
  | "r"i "w"i "u"i "g"i "b"i {% () => ['r', 'w', 'u', 'g', 'b'] %}
  | "r"i "w"i "b"i "u"i "g"i {% () => ['r', 'w', 'b', 'u', 'g'] %}
  | "r"i "w"i "b"i "g"i "u"i {% () => ['r', 'w', 'b', 'g', 'u'] %}
  | "r"i "w"i "g"i "u"i "b"i {% () => ['r', 'w', 'g', 'u', 'b'] %}
  | "r"i "w"i "g"i "b"i "u"i {% () => ['r', 'w', 'g', 'b', 'u'] %}
  | "r"i "u"i "w"i "b"i "g"i {% () => ['r', 'u', 'w', 'b', 'g'] %}
  | "r"i "u"i "w"i "g"i "b"i {% () => ['r', 'u', 'w', 'g', 'b'] %}
  | "r"i "u"i "b"i "w"i "g"i {% () => ['r', 'u', 'b', 'w', 'g'] %}
  | "r"i "u"i "b"i "g"i "w"i {% () => ['r', 'u', 'b', 'g', 'w'] %}
  | "r"i "u"i "g"i "w"i "b"i {% () => ['r', 'u', 'g', 'w', 'b'] %}
  | "r"i "u"i "g"i "b"i "w"i {% () => ['r', 'u', 'g', 'b', 'w'] %}
  | "r"i "b"i "w"i "u"i "g"i {% () => ['r', 'b', 'w', 'u', 'g'] %}
  | "r"i "b"i "w"i "g"i "u"i {% () => ['r', 'b', 'w', 'g', 'u'] %}
  | "r"i "b"i "u"i "w"i "g"i {% () => ['r', 'b', 'u', 'w', 'g'] %}
  | "r"i "b"i "u"i "g"i "w"i {% () => ['r', 'b', 'u', 'g', 'w'] %}
  | "r"i "b"i "g"i "w"i "u"i {% () => ['r', 'b', 'g', 'w', 'u'] %}
  | "r"i "b"i "g"i "u"i "w"i {% () => ['r', 'b', 'g', 'u', 'w'] %}
  | "r"i "g"i "w"i "u"i "b"i {% () => ['r', 'g', 'w', 'u', 'b'] %}
  | "r"i "g"i "w"i "b"i "u"i {% () => ['r', 'g', 'w', 'b', 'u'] %}
  | "r"i "g"i "u"i "w"i "b"i {% () => ['r', 'g', 'u', 'w', 'b'] %}
  | "r"i "g"i "u"i "b"i "w"i {% () => ['r', 'g', 'u', 'b', 'w'] %}
  | "r"i "g"i "b"i "w"i "u"i {% () => ['r', 'g', 'b', 'w', 'u'] %}
  | "r"i "g"i "b"i "u"i "w"i {% () => ['r', 'g', 'b', 'u', 'w'] %}
  | "g"i "w"i "u"i "b"i "r"i {% () => ['g', 'w', 'u', 'b', 'r'] %}
  | "g"i "w"i "u"i "r"i "b"i {% () => ['g', 'w', 'u', 'r', 'b'] %}
  | "g"i "w"i "b"i "u"i "r"i {% () => ['g', 'w', 'b', 'u', 'r'] %}
  | "g"i "w"i "b"i "r"i "u"i {% () => ['g', 'w', 'b', 'r', 'u'] %}
  | "g"i "w"i "r"i "u"i "b"i {% () => ['g', 'w', 'r', 'u', 'b'] %}
  | "g"i "w"i "r"i "b"i "u"i {% () => ['g', 'w', 'r', 'b', 'u'] %}
  | "g"i "u"i "w"i "b"i "r"i {% () => ['g', 'u', 'w', 'b', 'r'] %}
  | "g"i "u"i "w"i "r"i "b"i {% () => ['g', 'u', 'w', 'r', 'b'] %}
  | "g"i "u"i "b"i "w"i "r"i {% () => ['g', 'u', 'b', 'w', 'r'] %}
  | "g"i "u"i "b"i "r"i "w"i {% () => ['g', 'u', 'b', 'r', 'w'] %}
  | "g"i "u"i "r"i "w"i "b"i {% () => ['g', 'u', 'r', 'w', 'b'] %}
  | "g"i "u"i "r"i "b"i "w"i {% () => ['g', 'u', 'r', 'b', 'w'] %}
  | "g"i "b"i "w"i "u"i "r"i {% () => ['g', 'b', 'w', 'u', 'r'] %}
  | "g"i "b"i "w"i "r"i "u"i {% () => ['g', 'b', 'w', 'r', 'u'] %}
  | "g"i "b"i "u"i "w"i "r"i {% () => ['g', 'b', 'u', 'w', 'r'] %}
  | "g"i "b"i "u"i "r"i "w"i {% () => ['g', 'b', 'u', 'r', 'w'] %}
  | "g"i "b"i "r"i "w"i "u"i {% () => ['g', 'b', 'r', 'w', 'u'] %}
  | "g"i "b"i "r"i "u"i "w"i {% () => ['g', 'b', 'r', 'u', 'w'] %}
  | "g"i "r"i "w"i "u"i "b"i {% () => ['g', 'r', 'w', 'u', 'b'] %}
  | "g"i "r"i "w"i "b"i "u"i {% () => ['g', 'r', 'w', 'b', 'u'] %}
  | "g"i "r"i "u"i "w"i "b"i {% () => ['g', 'r', 'u', 'w', 'b'] %}
  | "g"i "r"i "u"i "b"i "w"i {% () => ['g', 'r', 'u', 'b', 'w'] %}
  | "g"i "r"i "b"i "w"i "u"i {% () => ['g', 'r', 'b', 'w', 'u'] %}
  | "g"i "r"i "b"i "u"i "w"i {% () => ['g', 'r', 'b', 'u', 'w'] %}

@builtin "string.ne"

# Keywords match a whole keyword, as on Scryfall: kw:flying, kw:"first strike". Numbers compare the keyword count.
stringSetElementOpValue -> ("=" | "!=" | "<>" | "<" | "<=" | ">" | ">=") integerValue {% ([[op], value]) => setCountOperation(op, value) %}
  | ":" noQuoteStringValue {% ([, value]) => setElementOperation('=', value.toLowerCase()) %}
  | ":" dqstring  {% ([, value]) => setElementOperation('=', value.toLowerCase()) %}
  | ":" sqstring  {% ([, value]) => setElementOperation('=', value.toLowerCase()) %}

# Tags (cube tags, oracle tags, art tags): `:` is a partial (substring) match and `=` is an exact
# match; a quoted value after `:` is also exact (quotes always mean exact). Hyphens are normalized
# away either way (see setElementOperation). Numeric operands still mean tag count (`tags=0`,
# `oracletags>2`). The `=`-with-a-bare-number case is ambiguous (count vs. a tag literally named
# "3"), so the string branch rejects pure integers and lets the count branch win; quote the value
# (`tag="3"`) to exact-match a numeric tag name.
tagSetElementOpValue -> ("=" | "!=" | "<>" | "<" | "<=" | ">" | ">=") integerValue {% ([[op], value]) => setCountOperation(op, value) %}
  | ":" noQuoteStringValue {% ([, value]) => setElementOperation(':', value.toLowerCase()) %}
  | ":" dqstring  {% ([, value]) => setElementOperation('=', value.toLowerCase()) %}
  | ":" sqstring  {% ([, value]) => setElementOperation('=', value.toLowerCase()) %}
  | "=" noQuoteStringValue {% ([, value], _l, reject) => (/^[0-9]+$/.test(value) ? reject : setElementOperation('=', value.toLowerCase())) %}
  | "=" dqstring  {% ([, value]) => setElementOperation('=', value.toLowerCase()) %}
  | "=" sqstring  {% ([, value]) => setElementOperation('=', value.toLowerCase()) %}

stringOpValue -> equalityOperator stringValue {% ([op, value]) => stringOperation(op, value) %}

stringContainOpValue -> equalityOperator stringValue {% ([op, value]) => stringContainOperation(op, value) %}

stringExactOpValue -> equalityOperator stringValue {% ([op, value]) => equalityOperation(op, value) %}

nameStringOpValue -> equalityOperator stringValue {% ([op, value]) => nameStringOperation(op, value) %}

stringValue -> (noQuoteStringValue | dqstring | sqstring) {% ([[value]]) => value.toLowerCase() %}

# Scryfall-style /regex/: anything up to the next unescaped slash. Compiled here so a malformed pattern is a parse
# error rather than a filter that throws.
regexValue -> "/" ([^/\\\n] | "\\" [^\n]):* "/" {% ([, chars], _l, reject) => compileScryfallRegex(chars.flat().join('')) ?? reject %}

# anything that isn't a special character and isn't "and" or "or".
# A bare word never starts with a slash, which would read as the start of a /regex/, or with a bang,
# which would read as the start of an !exact name. Reserving the bang is what keeps that syntax
# unambiguous: otherwise "!fire" parses both as an exact-name match and as the bare word "!fire",
# and "!'x'" likewise, since wordTail allows ' (names like "Urza's Saga" need it). Double quotes
# need no such rule: wordTail already excludes them.
# A bare word can never start with a parenthesis, and any parentheses inside it must come in
# balanced pairs (wordParens), so "tag:removal(cheap)" is one word but a paren that could be a
# grouping paren never is. If words could absorb grouping parens, every "(word)" would have several
# parses and the parse count grows combinatorially with the number of groups (a DoS). Anything else
# with parentheses must be quoted, e.g. name:"Erase (Not the Urza's Legacy One)".
noQuoteStringValue -> 
  ("a"i | "an"i | "o"i) {% ([[value]]) => value.toLowerCase() %}
  | ([^aAoO\-/! \t\n"'\\=<>:()\u2983] 
    | "a"i ([^nN \t\n"'\\=<>:()] | wordParens)
    | "an"i ([^dD \t\n"'\\=<>:()] | wordParens)
    | "and"i ([^ \t\n"'\\=<>:()] | wordParens)
    | "o"i ([^rR \t\n"'\\=<>:()] | wordParens)
    | "or"i ([^ \t\n"'\\=<>:()] | wordParens)
    ) wordTail {% ([startChars, tail]) => (startChars.flat(Infinity).join('') + tail).toLowerCase() %}

# Plain characters, then any number of balanced (...) segments each followed by more plain
# characters. Splitting it this way keeps parsing a word without parentheses as cheap as before.
wordTail -> [^ \t\n"\\=<>:()]:* (wordParens [^ \t\n"\\=<>:()]:*):* {% ([chars, segments]) => chars.join('') + segments.map(([parens, rest]) => parens + rest.join('')).join('') %}

wordParens -> "(" wordTail ")" {% ([, inner]) => `(${inner})` %}
# "

manaCostOpValue -> anyOperator manaCostValue {% ([op, value]) => manaCostOperation(op, value) %}

manaCostValue -> manaSymbol:+ {% id %}

manaSymbol -> innerManaSymbol {% id %}
  | "{" innerManaSymbol "}" {% ([, inner]) => inner %}
  | "(" innerManaSymbol ")" {% ([, inner]) => inner %}

# Numbers, single symbols, two-part hybrid and Phyrexian symbols ({W/U}, {2/G}, {R/P}, {C/G}), and Phyrexian hybrid
# such as {G/W/P}.
innerManaSymbol -> [0-9]:+ {% ([digits]) => [digits.join('')] %}
  | ("x"i | "y"i | "z"i | "w"i | "u"i | "b"i | "r"i | "g"i | "s"i | "c"i) {% ([[color]]) => [color.toLowerCase()] %}
  | ( "2"i ("/" | "-") ("w"i | "u"i | "b"i | "r"i | "g"i)
    | "p"i ("/" | "-") ("w"i | "u"i | "b"i | "r"i | "g"i)
    | "w"i ("/" | "-") ("2"i | "p"i | "u"i | "b"i | "r"i | "g"i)
    | "u"i ("/" | "-") ("2"i | "p"i | "w"i | "b"i | "r"i | "g"i)
    | "b"i ("/" | "-") ("2"i | "p"i | "w"i | "u"i | "r"i | "g"i)
    | "r"i ("/" | "-") ("2"i | "p"i | "w"i | "u"i | "b"i | "g"i)
    | "g"i ("/" | "-") ("2"i | "p"i | "w"i | "u"i | "b"i | "r"i)
    | "c"i ("/" | "-") ("p"i | "w"i | "u"i | "b"i | "r"i | "g"i)
    ) {% ([[color, , [secondColor]]]) => [color.toLowerCase(), secondColor.toLowerCase()] %}
  | [wubrgWUBRG] ("/" | "-") [wubrgWUBRG] ("/" | "-") [pP] {% ([color, , secondColor]) => [color.toLowerCase(), secondColor.toLowerCase(), 'p'] %}

castableCostOpValue -> ("=" | ":" | "<>" | "!=" | "<=" | ">") basicCostValue  {%([op, value]) => castableCostOperation(op, value) %}

basicCostValue -> basicManaSymbol:+ {% id %}

basicManaSymbol -> innerBasicManaSymbol {% id %}
  | "{" innerBasicManaSymbol "}" {% ([, inner]) => inner %}
  | "(" innerBasicManaSymbol ")" {% ([, inner]) => inner %}

innerBasicManaSymbol -> [0-9]:+ {% ([digits]) => parseInt(digits.join('')) %}
  | ("w"i | "u"i | "b"i | "r"i | "g"i | "s"i | "c"i) {% ([[color]]) => color.toLowerCase() %}

devotionOpValue -> anyOperator devotionValue {% ([op, [colors, length]]) => devotionOperation(op, colors, length) %}

# Repeats of one colored symbol, or of one two-color hybrid symbol: uuu, {u}{u}{u}, {u/b}{u/b}{u/b}.
devotionValue -> manaSymbol:+ {% ([symbols], _l, reject) => {
  const key = (symbol) => [...symbol].sort().join('/');
  const first = symbols[0];
  if (first.length > 2 || !first.every((part) => 'wubrg'.includes(part)) || !symbols.every((symbol) => key(symbol) === key(first))) {
    return reject;
  }
  return [first, symbols.length];
} %}

# produces=wu: the kinds of mana a card can produce, c for colorless.
producesValue -> [wubrgcWUBRGC]:+ {% ([letters]) => [...new Set(letters.map((letter) => letter.toLowerCase()))] %}

borderValue -> ("black"i | "white"i | "silver"i | "gold"i | "borderless"i | "yellow"i) {% ([[border]]) => border.toLowerCase() %}

# Release dates: 2015-08-18, 2015-08 or 2015, or now/today. Scryfall also takes a set code here; we don't.
dateValue -> [0-9] [0-9] [0-9] [0-9] ("-" [0-9] [0-9] ("-" [0-9] [0-9]):?):? {% (parts) => parts.flat(Infinity).join('') %}
  | ("now"i | "today"i) {% () => todayIsoDate() %}

@{%
const LANGUAGES = {
  en: 'en', english: 'en', es: 'es', spanish: 'es', fr: 'fr', french: 'fr', de: 'de', german: 'de', it: 'it',
  italian: 'it', pt: 'pt', portuguese: 'pt', ja: 'ja', jp: 'ja', japanese: 'ja', ko: 'ko', kr: 'ko', korean: 'ko',
  ru: 'ru', russian: 'ru', zhs: 'zhs', cs: 'zhs', zht: 'zht', ct: 'zht', he: 'he', hebrew: 'he', la: 'la',
  latin: 'la', grc: 'grc', greek: 'grc', ar: 'ar', arabic: 'ar', sa: 'sa', sanskrit: 'sa', ph: 'ph',
  phyrexian: 'ph', qya: 'qya', quenya: 'qya',
};
%} # %}

# A language name or code; lang:any is handled by the condition.
langValue -> [a-zA-Z]:+ {% ([letters], _l, reject) => LANGUAGES[letters.join('').toLowerCase()] ?? reject %}

anyOperator -> ":" | "=" | "!=" | "<>" | "<" | "<=" | ">" | ">="  {% id %}

# An is:/not: category name. Underscores and hyphens are dropped (is:judge_gift is judgegift), and anything that
# isn't a known category fails to parse, so makeFilter ignores the term.
isWord -> [a-zA-Z0-9_\-]:+ {% ([letters], _l, reject) => { const category = letters.join('').toLowerCase().replace(/[_-]/g, ''); return CARD_CATEGORY_DETECTORS[category] ? category : reject; } %}

equalityOperator -> ":" | "=" | "!=" | "<>" {% id %}

