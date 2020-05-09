# must implement the following to use these values.
# const defaultOperation = (op, value) => ...
# const stringOperation = (op, value) => ...
# const stringContainOperation = (op, value) => ...
# const equalityOperation = (op, value) => ...
# const setOperation = (op, value) => ...
# const rarityOperation = (op, value) => ...
# const manaCostOperation = (op, value) => ...
# const castableCostOperation = (op, value) => ...
# const setElementOperation = (value) => ...

positiveHalfIntOpValue -> anyOperator positiveHalfIntValue {% ([op, value]) => defaultOperation(op, value) %}

positiveHalfIntValue ->
    "-":? [0-9]:+ {% ([negative, digits]) => parseInt(`${negative || ''}${digits.join('')}`, 10) %}
  | [0-9]:* "." ("0" | "5") {% ([digits, , afterDecimal]) => parseFloat(`${digits.join('')}.${afterDecimal}`, 10) %}

halfIntOpValue -> anyOperator halfIntValue {% ([op, value]) => defaultOperation(op, value) %}

halfIntValue ->
    [0-9]:+ ("." ("0" | "5")):? {% ([digits, decimal]) => parseFloat(`${digits.join('')}${(decimal || []).join('')}`, 10) %}
  | "." ("0" | "5") {% ([, digit]) => digit === '5' ? 0.5 : 0 %}

integerOpValue -> anyOperator integerValue {% ([op, value]) => defaultOperation(op, value) %}

integerValue -> [0-9]:+ {% ([digits]) => parseInt(digits.join(''), 10) %}

dollarOpValue -> anyOperator dollarValue {% ([op, value]) => defaultOperation(op, value) %}

dollarValue -> "$":? (
    [0-9]:+
  | [0-9]:+ "." [0-9]
  | [0-9]:+ "." [0-9] [0-9]
) {% ([, [digits, ...decimal]]) => parseFloat(digits.concat(decimal).join(''), 10) %}

finishOpValue -> equalityOperator finishValue {% ([op, value]) => stringOperation(op.toString() === ':' ? '=' : op, value) %}

finishValue -> ("Foil"i | "Non-Foil"i) {% ([[finish]]) => finish.toLowerCase() %}
  | "\"" ("Foil"i | "Non-Foil"i) "\"" {% ([, [finish]]) => finish.toLowerCase() %}

statusOpValue -> equalityOperator statusValue {% ([op, value]) => stringOperation(op.toString() === ':' ? '=' : op, value) %}

statusValue -> ("owned"i | "proxied"i | "ordered"i) {% ([[status]]) => status.toLowerCase() %} 
  | "'" ("owned"i | "proxied"i | "ordered"i | "not owned"i | "premium owned"i) "'" {% ([, [status]]) => status.toLowerCase() %}
  | "\"" ("owned"i | "proxied"i | "ordered"i | "not owned"i | "premium owned"i) "\"" {% ([, [status]]) => status.toLowerCase() %}

rarityOpValue -> anyOperator rarityValue {% ([op, value]) => rarityOperation(op, value) %}

rarityValue -> ("s"i | "special"i | "m"i | "mythic"i | "r"i | "rare"i | "u"i | "uncommon"i | "common"i | "c"i) {% ([[rarity]]) => rarity %}

alphaNumericValue -> [a-zA-Z0-9]:+ {% ([letters]) => letters.join('').toLowerCase() %}

alphaNumericOpValue -> equalityOperator alphaNumericValue {% ([op, value]) => equalityOperation(op, value) %}

@{%
const normalizeCombination = (combination) => combination.join('').toLowerCase().replace('c', '').split('');
const reversedSetOperation = (op, value) => {
  if (op.toString() === ':') {
    op = '<=';
  }
  return setOperation(op, value);
};
%} # %}

# TODO: Make these work with non-func operations
colorCombinationOpValue -> anyOperator colorCombinationValue {% ([op, value]) => { const operation = setOperation(op, value); return (fieldValue) => operation(normalizeCombination(fieldValue)); } %}
  | anyOperator integerValue {% ([op, value]) => { const operation = defaultOperation(op, value); return (fieldValue) => operation(normalizeCombination(fieldValue).length); } %}
  | anyOperator "m"i {% ([op]) => { const operation = defaultOperation(op, 2); return (fieldValue) => operation(normalizeCombination(fieldValue).length); } %}

colorIdentityOpValue -> anyOperator colorCombinationValue {% ([op, value]) => { const operation = reversedSetOperation(op, value); return (fieldValue) => operation(normalizeCombination(fieldValue)); } %}
  | anyOperator integerValue {% ([op, value]) => { const operation = defaultOperation(op, value); return (fieldValue) => operation(normalizeCombination(fieldValue).length); } %}
  | ("=" | ":") "m"i {% ([op]) => { normalizeCombination(fieldValue).length > 1; } %}
  | ("!=" | "<>") "m"i {% ([op]) => { normalizeCombination(fieldValue).length < 2; } %}

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
    ("c"i | "brown"i | "colorless"i) {% () => [] %}
  | "white"i {% () => ['w'] %}
  | "blue"i {% () => ['u'] %}
  | "black"i {% () => ['b'] %}
  | "red"i {% () => ['r'] %}
  | "green"i {% () => ['g'] %}
  | "azorious"i {% () => ['w', 'u'] %}
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
  | ("rainbow"i | "fivecolor"i) {% () => ['w', 'u', 'b', 'r', 'g'] %}
  | comb5NonEmpty["w"i, "u"i, "b"i, "r"i, "g"i] {% ([[comb]]) => comb %}

@builtin "string.ne"

stringSetElementOpValue -> equalityOperator stringValue {% ([op, value]) => setElementOperation(op, value) %}

stringOpValue -> equalityOperator stringValue {% ([op, value]) => stringOperation(op, value) %}

stringContainOpValue -> equalityOperator stringValue {% ([op, value]) => stringContainOperation(op, value) %}

stringValue -> (noQuoteStringValue | dqstring | sqstring) {% ([[value]]) => value.toLowerCase() %}

# anything that isn't a special character and isn't "and" or "or"
noQuoteStringValue -> ([^aAoO\- \t\n"'\\=<>:] 
  | "a"i [^nN \t\n"'\\=<>:] 
  | "an"i:+ [^dD \t\n"'\\=<>:] 
  | "and"i:+ [^ \t\n"'\\=<>:] 
  | "o"i:+ [^rR \t\n"'\\=<>:]
  | "or"i:+ [^ \t\n"'\\=<>:]
) [^ \t\n"'\\=<>:]:* {% ([startChars, chars]) => startChars.concat(chars).join('').toLowerCase() %}
# "

manaCostOpValue -> equalityOperator manaCostValue {% ([op, value]) => manaCostOperation(op, value) %}

manaCostValue -> manaSymbol:+ {% id %}

manaSymbol -> innerManaSymbol {% id %}
  | "{" innerManaSymbol "}" {% ([, inner]) => inner %}
  | "(" innerManaSymbol ")" {% ([, inner]) => inner %}

innerManaSymbol -> [0-9]:+ {% ([digits]) => [digits.join('')] %}
  | ("x"i | "y"i | "z"i | "w"i | "u"i | "b"i | "r"i | "g"i | "s"i | "c"i) {% ([[color]]) => [color.toLowerCase()] %}
  | ( "2"i ("/" | "-") ("w"i | "u"i | "b"i | "r"i | "g"i)
    | "p"i ("/" | "-") ("w"i | "u"i | "b"i | "r"i | "g"i)
    | "w"i ("/" | "-") ("2"i | "p"i | "u"i | "b"i | "r"i | "g"i)
    | "u"i ("/" | "-") ("2"i | "p"i | "w"i | "b"i | "r"i | "g"i)
    | "b"i ("/" | "-") ("2"i | "p"i | "w"i | "u"i | "r"i | "g"i)
    | "r"i ("/" | "-") ("2"i | "p"i | "w"i | "u"i | "b"i | "g"i)
    | "g"i ("/" | "-") ("2"i | "p"i | "w"i | "u"i | "b"i | "r"i)
    ) {% ([[color, , [secondColor]]]) => [color, secondColor] %}

castableCostOpValue -> ("=" | ":" | "<>" | "!=" | "<=" | ">") basicCostValue  {%([op, value]) => castableCostOperation(op, value) %}

basicCostValue -> basicManaSymbol:+ {% id %}

basicManaSymbol -> innerBasicManaSymbol {% id %}
  | "{" innerBasicManaSymbol "}" {% ([, inner]) => inner %}
  | "(" innerBasicManaSymbol ")" {% ([, inner]) => inner %}

innerBasicManaSymbol -> [0-9]:+ {% ([digits]) => parseInt(digits.join('')) %}
  | ("w"i | "u"i | "b"i | "r"i | "g"i | "s"i | "c"i) {% ([[color]]) => color.toLowerCase() %}

anyOperator -> ":" | "=" | "!=" | "<>" | "<" | "<=" | ">" | ">="  {% id %}

equalityOperator -> ":" | "=" | "!=" | "<>" {% id %}
