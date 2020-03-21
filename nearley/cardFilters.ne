@builtin "whitespace.ne"

@{%
import { CARD_CATEGORY_DETECTORS } from 'utils/Card';
import { arrayIsSubset, arraysAreEqualSets } from 'utils/Util';
%} # %}

start ->
    _ {% () => {
      const result = () => true;
      result.fieldsUsed = [];
      return result;
    } %}
  | _ filter _ {% ([, filter]) => filter %}

filter ->
    filter __ connector clause {% ([clause1, , connector, clause2]) => {
      const result = connector(clause1, clause2);
      result.fieldsUsed = [...new Set(clause1.fieldsUsed.concat(clause2.fieldsUsed))];
      return result;
    } %}
  | clause {% id %}

clause -> "-":? ("(" filter ")" | condition) {% ([negation, inner]) => {
  if (inner.length === 3) {
    [, inner] = inner;
  } else {
    [inner] = inner;
  }
  if (negation) {
    const result = (card) => !inner(card);
    result.fieldsUsed = inner.fieldsUsed;
    return result;
  }
  return inner;
} %}

connector ->
    (null | "and"i __) {% () => (clause1, clause2) => (card) => clause1(card) && clause2(card) %}
  | "or"i __           {% () => (clause1, clause2) => (card) => clause1(card) || clause2(card) %}

condition -> (
    cmcCondition
  | colorCondition
  | colorIdentityCondition
  | typeCondition
  | oracleCondition
  | setCondition
  | powerCondition
  | toughnessCondition
  | tagCondition
  | finishCondition
  | priceCondition
  | normalPriceCondition
  | foilPriceCondition
  | statusCondition
  | rarityCondition
  | loyaltyCondition
  | artistCondition
  | isCondition
  | eloCondition
  | nameCondition
  | manaCostCondition
) {% ([[condition]]) => condition %}

@{% const genericCondition = (property, valuePred) => {
  const result = (card) => valuePred(propertyForCard(card, property));
  result.fieldsUsed = [property]
  return result;
}; %} # %}

cmcCondition -> "cmc"i integerOpValue {% ([, valuePred]) => genericCondition('cmc', valuePred) %}

colorCondition -> ("c"i | "color"i | "colors"i) colorCombinationOpValue {% ([, valuePred]) => genericCondition('colors', valuePred) %}

colorIdentityCondition -> ("ci"i | "id"i | "identity"i | "coloridentity" | "color_identity"i) colorCombinationOpValue {% ([, valuePred]) => genericCondition('color_identity', valuePred) %}

typeCondition -> ("t"i |  "type"i | "type_line"i) stringOpValue {% ([, valuePred]) => genericCondition('type_line', valuePred) %}

oracleCondition -> ("o"i | "oracle"i | "text"i) stringOpValue {% ([, valuePred]) => genericCondition('oracle_text', valuePred) %}

setCondition -> ("s"i | "set"i) alphaNumericOpValue {% ([, valuePred]) => genericCondition('set', valuePred) %}

powerCondition -> ("pow"i | "power"i) halfIntOpValue {% ([, valuePred]) => genericCondition('power', valuePred) %}

toughnessCondition -> ("tough"i | "toughness"i) halfIntOpValue {% ([, valuePred]) => genericCondition('toughness', valuePred) %}

tagCondition -> "tag"i stringSetElementOpValue {% ([, valuePred]) => genericCondition('tags', valuePred) %}

finishCondition -> ("fin"i | "finish"i) finishOpValue {% ([, valuePred]) => genericCondition('finish', valuePred) %}

priceCondition -> ("p"i | "price"i) dollarOpValue {% ([, valuePred]) => genericCondition('price', valuePred) %}

normalPriceCondition -> ("np"i | "pn"i | "normal"i | "normalprice"i | "pricenormal"i) dollarOpValue {% ([, valuePred]) => genericCondition('price_normal', valuePred) %}

foilPriceCondition -> ("fp"i | "pf"i | "foil"i | "foilprice"i | "pricefoil"i) dollarOpValue {% ([, valuePred]) => genericCondition('price_foil', valuePred) %}

statusCondition -> ("stat"i | "status"i) statusOpValue {% ([, valuePred]) => genericCondition('status', valuePred) %}

rarityCondition -> ("r"i | "rar"i | "rarity"i) rarityOpValue {% ([, valuePred]) => genericCondition('rarity', valuePred) %}

loyaltyCondition -> ("l"i | "loy"i | "loyal"i | "loyalty"i) integerOpValue {% ([, valuePred]) => genericCondition('loyalty', valuePred) %}

artistCondition -> ("a"i | "art"i | "artist"i) stringOpValue {% ([, valuePred]) => genericCondition('artist', valuePred) %}

isCondition -> "is"i isOpValue {% ([, valuePred]) => genericCondition('details', valuePred) %}

eloCondition -> "elo"i integerOpValue {% ([, valuePred]) => genericCondition('elo', valuePred) %}

# picksCondition -> "picks" integerOpValue 

# cubesCondition -> "cubes" integerOpValue

nameCondition -> ("n"i | "name"i) stringOpValue {% ([, valuePred]) => genericCondition('name_lower', valuePred) %}
  | noQuoteStringValue {% ([value]) => genericCondition('name_lower', (fieldValue) => fieldValue.contains(value.toLowerCase())) %}

manaCostCondition -> ("mana"i | "cost"i) manaCostOpValue {% ([, valuePred]) => genericCondition('parsed_cost', valuePred) %}

@{% const defaultOperation = (op, value) => {
  switch (op.toString()) {
  case ":":
  case "=":
    return (fieldValue) => fieldValue === value;
  case "!=":
  case "<>":
    return (fieldValue) => fieldValue !== value;
  case "<":
    return (fieldValue) => fieldValue < value;
  case "<=":
    return (fieldValue) => fieldValue <= value;
  case ">":
    return (fieldValue) => fieldValue > value;
  case ">=":
    return (fieldValue) => fieldValue >= value;
  default:
    throw new Error(`Unrecognized operator '${op}'`);
  }
}; %} # %}

@{% const stringOperation = (op, value) => {
  switch (op.toString()) {
  case ":":
    return (fieldValue) => fieldValue.contains(value);
  case "=":
    return (fieldValue) => fieldValue === value;
  case "!=":
  case "<>":
    return (fieldValue) => fieldValue !== value;
  default:
    throw new Error(`Unrecognized operator '${op}'`);
  }
}; %} # %}

@{% const equalityOperation = (op, value) => {
  switch (op.toString()) {
  case ":":
  case "=":
    return (fieldValue) => fieldValue === value;
  case "!=":
  case "<>":
    return (fieldValue) => fieldValue !== value;
  default:
    throw new Error(`Unrecognized operator '${op}'`);
  }
}; %} # %}

@{% const setOperation = (op, value) => {
  switch (op) {
  case ':':
  case '>=':
    return (fieldValue) => arrayIsSubset(value, fieldValue);
  case '=':
    return (fieldValue) => arraysAreEqualSets(value, fieldValue);
  case '!=':
    return (fieldValue) => !arraysAreEqualSets(value, fieldValue);
  case '<':
    return (fieldValue) => arrayIsSubset(fieldValue, value) && !arrayIsSubset(value, fieldValue);
  case '<=':
    return (fieldValue) => arrayIsSubset(fieldValue, value);
  case '>':
    return (fieldValue) => !arrayIsSubset(fieldValue, value) && arrayIsSubset(value, fieldValue);
  default:
    throw new Error(`Unrecognized operator ${op}`);
  }
}; %} # %}

@{% const rarityOperation = (op, value) => {
  const rarityMap = { 'c': 0, 'u': 1, 'r': 2, 'm': 3, 's': 4 };
  mappedRarity = rarityMap[value.charAt(0)];
  switch (op) {
  case ':':
  case '=':
    return (fieldValue) => fieldValue === value;
  case '!=':
  case '<>':
    return (fieldValue) => fieldValue !== value;
  case '<':
    return (fieldValue) => rarityMap[fieldValue.charAt(0)] < mappedRarity;
  case '<=':
    return (fieldValue) => rarityMap[fieldValue.charAt(0)] <= mappedRarity;
  case '>':
    return (fieldValue) => rarityMap[fieldValue.charAt(0)] > mappedRarity;
  case '>=':
    return (fieldValue) => rarityMap[fieldValue.charAt(0)] >= mappedRarity;
  default:
    throw new Error(`Unrecognized operator '${op}'`);
  }
}; %} # %}

@{%
const convertParsedCost = (parsedCost) => parsedCost.map((symbol) => symbol.toLowerCase().split('-'));
const manaCostOperation = (op, value) => {
  switch (op.toString()) {
  case ':':
  case '=':
    return (fieldValue) => arraysAreEqualSets(convertParsedCost(fieldValue), value, arraysAreEqualSets);
  case '!=':
  case '<>':
    return (fieldValue) => !arraysAreEqualSets(convertParsedCost(fieldValue), value, arraysAreEqualSets);
  default:
    throw new Error(`Unrecognized operator '${op}'`);
  }
}; %} # %}

positiveHalfIntOpValue -> anyOperator positiveHalfIntValue {% ([op, value]) => defaultOperation(op, value) %}

positiveHalfIntValue ->
    "-":? [0-9]:+ {% ([negative, digits]) => parseInt(`${negative || ''}${digits.join('')}`, 10) %}
  | [0-9]:* "." ("0" | "5") {% ([digits, , afterDecimal]) => parseFloat(`${digits.join('')}.${afterDecimal}`, 10) %}

halfIntOpValue -> anyOperator halfIntValue {% ([op, value]) => defaultOperation(op, value) %}

halfIntValue ->
    [0-9]:+ ("." ("0" | "5")):? {% ([digits, decimal]) => parseFloat(`${digits.join('')}${(decimal ?? []).join('')}`, 10) %}
  | "." ("0" | "5") {% ([, digit]) => digit === '5' ? 0.5 : 0 %}

integerOpValue -> anyOperator integerValue {% ([op, value]) => defaultOperation(op, value) %}

integerValue -> [0-9]:+ {% ([digits]) => parseInt(digits.join(''), 10) %}

dollarOpValue -> anyOperator dollarValue {% ([op, value]) => defaultOperation(op, value) %}

dollarValue -> "$":? (
    [0-9]:+
  | [0-9]:+ "." [0-9]
  | [0-9]:+ "." [0-9] [0-9]
) {% ([, [digits, ...decimal]]) => parseFloat(digits.concat(decimal).join(''), 10) %}

finishOpValue -> equalityOperator finishValue {% ([, value]) => equalityOperation(op, value) %}

finishValue -> "foil"i | "non-foil"i {% id %}

isOpValue -> ":" isValue {% ([, category]) => (fieldValue) => CARD_CATEGORY_DETECTORS[category](fieldValue) %}

isValue -> ("gold"i | "twobrid"i | "hybrid"i | "phyrexian"i | "promo"i | "digital"i | "reasonable"i) {% ([[category]]) => category.toLowerCase() %}

statusOpValue -> equalityOperator statusValue {% ([, value]) => equalityOperation(op, value) %}

statusValue -> ("owned"i | "proxied"i) {% ([[status]]) => status.toLowerCase() %} 
  | "'" ("not owned"i | "premium owned"i) "'" {% ([, [status]]) => status.toLowerCase() %}
  | "\"" ("not owned"i | "premium owned"i) "\"" {% ([, [status]]) => status.toLowerCase() %}

rarityOpValue -> anyOperator rarityValue {% ([op, value]) => rarityOperation(op, value) %}

rarityValue -> ("s"i | "special"i | "m"i | "mythic"i | "r"i | "rare"i | "u"i | "uncommon"i | "common"i | "c"i) {% ([[rarity]]) => rarity %}

stringSetElementOpValue -> ":" stringValue {% ([, value]) => fieldValue.findIndex(value) %}

alphaNumericOpValue -> equalityOperator alphaNumericValue {% ([op, value]) => equalityOperation(op, value) %}

alphaNumericValue -> [a-zA-Z]:+ {% ([letters]) => letters.join('') %}

colorCombinationOpValue -> anyOperator colorCombinationValue {% ([op, value]) => setOperation(op, value) %}

comb1[A] -> null {% () => [] %}
  | $A {% (comb) => comb %}

comb2[A, B] -> null {% () => [] %}
  | $A comb1[$B] {% ([a, rest]) => [a, ...rest] %}
  | $B comb1[$A] {% ([b, rest]) => [b, ...rest] %}

comb3[A, B, C] -> null {% () => [] %}
  | $A comb2[$B, $C] {% ([a, rest]) => [a, ...rest] %}
  | $B comb2[$A, $C] {% ([b, rest]) => [b, ...rest] %}
  | $C comb2[$B, $C] {% ([c, rest]) => [c, ...rest] %}

comb4[A, B, C, D] -> null {% () => [] %}
  | $A comb3[$B, $C, $D] {% ([a, rest]) => [a, ...rest] %}
  | $B comb3[$A, $C, $D] {% ([b, rest]) => [b, ...rest] %}
  | $C comb3[$A, $B, $D] {% ([c, rest]) => [c, ...rest] %}
  | $D comb3[$A, $B, $C] {% ([d, rest]) => [d, ...rest] %}

comb5NonEmpty[A, B, C, D, E] -> $A comb4[$B, $C, $D, $E] {% ([a, rest]) => [a, ...rest] %}
  | $B comb4[$A, $C, $D, $E] {% ([a, rest]) => [a, ...rest] %}
  | $C comb4[$A, $B, $D, $E] {% ([a, rest]) => [a, ...rest] %}
  | $D comb4[$A, $B, $C, $E] {% ([a, rest]) => [a, ...rest] %}
  | $E comb4[$A, $B, $C, $D] {% ([a, rest]) => [a, ...rest] %}

colorCombinationValue ->
    ("brown"i | "colorless"i) {% () => [] %}
  | "white"i {% () => ['w'] %}
  | "blue"i {% () => ['u'] %}
  | "black"i {% () => ['b'] %}
  | "red"i {% () => ['r'] %}
  | "green"i {% () => ['g'] %}
  | "azorious"i {% () => ['w', 'u'] %}
  | "dimir"i {% () => ['u', 'b'] %}
  | "rakdos"i {% () => ['b', 'r'] %}
  | "gruul"i {% () => ['r', 'g'] %}
  | "selesnya"i {% () => ['g', 'w'] %}
  | "orzhov"i {% () => ['w', 'b'] %}
  | "izzet"i {% () => ['u', 'r'] %}
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
  | ("rainbow"i | "fivecolor"i) {% () => ['w', 'u', 'b', 'r', 'g'] %}
  | comb5NonEmpty["w"i, "u"i, "b"i, "r"i, "g"i] {% id %}

stringOpValue -> equalityOperator stringValue {% ([op, value]) => stringOperation(op, value) %}

stringValue -> (noQuoteStringValue | doubleQuoteStringValue | singleQuoteStringValue) {% ([[value]]) => value %}

noQuoteStringValue -> [^ \t\n"'\\=<>:]:+ {% ([chars]) => chars.join() %}
# "

stringChar[Q] -> $Q {% id %}
  | "\\'" {% () => "'" %}
  | "\\\\" {% () => '\\' %}
  | "\\n"i {% () => '\n' %}
  | "\\t"i {% () => '\t' %}
  | "\\\"" {% () => '"' %}
# "

singleQuoteStringValue -> "'" stringChar[singleQuoteGroup]:+ "'" {% ([, chars]) => chars.join('') %}

doubleQuoteStringValue -> "\"" stringChar[doubleQuoteGroup]:+ "\"" {% ([, chars]) => chars.join('') %}

anyOperator -> ":" | "=" | "!=" | "<>" | "<" | "<=" | ">" | ">="  {% id %}

equalityOperator -> ":" | "=" | "!=" | "<>" {% id %}

doubleQuoteGroup -> [^"\\] {% id %}
# "

singleQuoteGroup -> [^'\\] {% id %}

manaCostOpValue -> equalityOperator manaCostValue {% ([op, value]) => manaCostOperation(op, value) %}

manaCostValue -> manaSymbol:+ {% id %}

manaSymbol -> innerManaSymbol {% id %}
  | "{" innerManaSymbol "}" {% ([, inner]) => inner %}
  | "(" innerManaSymbol ")" {% ([, inner]) => inner %}

innerManaSymbol -> [0-9]:+ {% ([digits]) => [digits.join('')] %}
  | ("x"i | "y"i | "z"i | "w"i | "u"i | "b"i | "r"i | "g"i | "s"i) {% ([[color]]) => [color.toLowerCase()] %}
  | ( "2"i ("/" | "-") ("p"i | "w"i | "u"i | "b"i | "r"i | "g"i)
    | "p"i ("/" | "-") ("2"i | "w"i | "u"i | "b"i | "r"i | "g"i)
    | "w"i ("/" | "-") ("2"i | "p"i | "u"i | "b"i | "r"i | "g"i)
    | "u"i ("/" | "-") ("2"i | "p"i | "w"i | "b"i | "r"i | "g"i)
    | "b"i ("/" | "-") ("2"i | "p"i | "w"i | "u"i | "r"i | "g"i)
    | "r"i ("/" | "-") ("2"i | "p"i | "w"i | "u"i | "b"i | "g"i)
    | "g"i ("/" | "-") ("2"i | "p"i | "w"i | "u"i | "b"i | "r"i)
    ) {% ([[color, , [secondColor]]]) => [color === '2' ? 2 : color, secondColor === '2' ? 2 : color] %}
