@include "./filterBase.ne"
@include "./funcOperations.ne"

@{%
import { CARD_CATEGORY_DETECTORS } from 'utils/Card';
%} # %}

@{%
const negated = (inner) => {
  const result = (card) => !inner(card);
  result.fieldsUsed = inner.fieldsUsed;
  return result;
};
%} # %}

start -> filterStart {% id %}

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

@{%
const genericCondition = (propertyName, propertyAccessor, valuePred) => {
  const result = (card) => valuePred(propertyAccessor(card));
  result.fieldsUsed = [propertyName]
  return result;
};
%} # %}

cmcCondition -> "cmc"i integerOpValue {% ([, valuePred]) => genericCondition('cmc', (card) => card.cmc ?? card.details.cmc, valuePred) %}

colorCondition -> ("c"i | "color"i | "colors"i) colorCombinationOpValue {% ([, valuePred]) => genericCondition('colors', (card) => card.details.colors, valuePred) %}

colorIdentityCondition -> ("ci"i | "id"i | "identity"i | "coloridentity" | "color_identity"i) colorIdentityOpValue {% ([, valuePred]) => genericCondition('color_identity', (card) => card.colors ?? card.details.color_identity, valuePred) %}

typeCondition -> ("t"i |  "type"i | "type_line"i) stringOpValue {% ([, valuePred]) => genericCondition('type_line', (card) => card.type_line ?? card.details.type, valuePred) %}

oracleCondition -> ("o"i | "oracle"i | "text"i) stringOpValue {% ([, valuePred]) => genericCondition('oracle_text', (card) => card.details.oracle_text, valuePred) %}

setCondition -> ("s"i | "set"i) alphaNumericOpValue {% ([, valuePred]) => genericCondition('set', (card) => card.details.set, valuePred) %}

powerCondition -> ("pow"i | "power"i) halfIntOpValue {% ([, valuePred]) => genericCondition('power', (card) => card.details.power, valuePred) %}

toughnessCondition -> ("tough"i | "toughness"i) halfIntOpValue {% ([, valuePred]) => genericCondition('toughness', (card) => card.details.toughness, valuePred) %}

tagCondition -> "tag"i stringSetElementOpValue {% ([, valuePred]) => genericCondition('tags', (card) => card.tags, valuePred) %}

finishCondition -> ("fin"i | "finish"i) finishOpValue {% ([, valuePred]) => genericCondition('finish', (card) => card.finish, valuePred) %}

priceCondition -> ("p"i | "price"i) dollarOpValue {% ([, valuePred]) => genericCondition('price', (card) => card.price ?? card.details.price ?? card.details.price_foil, valuePred) %}

normalPriceCondition -> ("np"i | "pn"i | "normal"i | "normalprice"i | "pricenormal"i) dollarOpValue {% ([, valuePred]) => genericCondition('price_normal', (card) => card.details.price ?? card.price, valuePred) %}

foilPriceCondition -> ("fp"i | "pf"i | "foil"i | "foilprice"i | "pricefoil"i) dollarOpValue {% ([, valuePred]) => genericCondition('price_foil', (card) => card.details.price_foil ?? card.price, valuePred) %}

statusCondition -> ("stat"i | "status"i) statusOpValue {% ([, valuePred]) => genericCondition('status', (card) => card.status, valuePred) %}

rarityCondition -> ("r"i | "rar"i | "rarity"i) rarityOpValue {% ([, valuePred]) => genericCondition('rarity', (card) => card.details.rarity, valuePred) %}

loyaltyCondition -> ("l"i | "loy"i | "loyal"i | "loyalty"i) integerOpValue {% ([, valuePred]) => genericCondition('loyalty', (card) => card.details.loyalty, valuePred) %}

artistCondition -> ("a"i | "art"i | "artist"i) stringOpValue {% ([, valuePred]) => genericCondition('artist', (card) => card.details.artist, valuePred) %}

isCondition -> "is"i isOpValue {% ([, valuePred]) => genericCondition('details', (card) => card.details, valuePred) %}

eloCondition -> "elo"i integerOpValue {% ([, valuePred]) => genericCondition('elo', (card) => card.details.elo, valuePred) %}

# picksCondition -> "picks" integerOpValue 

# cubesCondition -> "cubes" integerOpValue

nameCondition -> ("n"i | "name"i) stringOpValue {% ([, valuePred]) => genericCondition('name_lower', (card) => card.details.name_lower, valuePred) %}
  | noQuoteStringValue {% ([value]) => genericCondition('name_lower', (card) => card.details.name_lower, (fieldValue) => fieldValue.includes(value.toLowerCase())) %}

manaCostCondition -> ("mana"i | "cost"i) manaCostOpValue {% ([, valuePred]) => genericCondition('parsed_cost', (card) => card.details.parsed_cost, valuePred) %}

isOpValue -> ":" isValue {% ([, category]) => (fieldValue) => CARD_CATEGORY_DETECTORS[category](fieldValue) %}

isValue -> ("gold"i | "twobrid"i | "hybrid"i | "phyrexian"i | "promo"i | "digital"i | "reasonable"i) {% ([[category]]) => category.toLowerCase() %}
