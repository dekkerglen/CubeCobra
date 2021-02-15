@include "./filterBase.ne"

@{%
import { CARD_CATEGORY_DETECTORS } from 'utils/Card';
import {
  defaultOperation,
  stringOperation,
  stringContainOperation,
  nameStringOperation,
  equalityOperation,
  setOperation,
  rarityOperation,
  convertParsedCost,
  manaCostOperation,
  castableCostOperation,
  setElementOperation,
  setCountOperation,
  devotionOperation,
} from 'filtering/FuncOperations';
import {
  cardCmc,
  cardColors,
  cardColorIdentity,
  cardType,
  cardOracleText,
  cardSet,
  cardCollectorNumber,
  cardPower,
  cardToughness,
  cardTags,
  cardFinish,
  cardPrice,
  cardNormalPrice,
  cardFoilPrice,
  cardPriceEur,
  cardTix,
  cardNameLower,
  cardElo,
  cardArtist,
  cardLoyalty,
  cardRarity,
  cardStatus,
  cardCost,
  cardLayout,
  cardDevotion,
  cardLegalIn
} from 'utils/Card';
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
  | eurPriceCondition
  | tixPriceCondition
  | statusCondition
  | rarityCondition
  | loyaltyCondition
  | artistCondition
  | isCondition
  | notCondition
  | eloCondition
  | nameCondition
  | manaCostCondition
  | castableCostCondition
  | devotionCondition
  | picksCondition
  | cubesCondition
  | legalityCondition
  | layoutCondition
  | collectorNumberCondition
) {% ([[condition]]) => condition %}

@{%
const genericCondition = (propertyName, propertyAccessor, valuePred) => {
  const result = (card) => valuePred(propertyAccessor(card), card);
  result.fieldsUsed = [propertyName]
  return result;
};
%} # %}


cmcCondition -> "cmc"i integerOpValue {% ([, valuePred]) => genericCondition('cmc', cardCmc, valuePred) %}

colorCondition -> ("c"i | "color"i | "colors"i) colorCombinationOpValue {% ([, valuePred]) => genericCondition('colors', cardColors, valuePred) %}

colorIdentityCondition -> ("ci"i | "id"i | "identity"i | "coloridentity" | "color_identity"i) colorIdentityOpValue {% ([, valuePred]) => genericCondition('color_identity',cardColorIdentity, valuePred) %}

typeCondition -> ("t"i |  "type"i | "type_line"i | "typeline"i) stringContainOpValue {% ([, valuePred]) => genericCondition('type_line', cardType, valuePred) %}

oracleCondition -> ("o"i | "oracle"i | "text"i) nameStringOpValue {% ([, valuePred]) => genericCondition('oracle_text', cardOracleText, valuePred) %}

setCondition -> ("s"i | "set"i | "e"i | "edition"i) alphaNumericOpValue {% ([, valuePred]) => genericCondition('set', cardSet, valuePred) %}

powerCondition -> ("pow"i | "power"i) halfIntOpValue {% ([, valuePred]) => genericCondition('power', (c) => parseFloat(cardPower(c), 10), valuePred) %}

toughnessCondition -> ("tou"i | "tough"i | "toughness"i) halfIntOpValue {% ([, valuePred]) => genericCondition('toughness', (c) => parseFloat(cardToughness(c), 10), valuePred) %}

tagCondition -> ("tag"i | "tags"i) stringSetElementOpValue {% ([, valuePred]) => genericCondition('tags', cardTags, valuePred) %}

finishCondition -> ("fin"i | "finish"i) finishOpValue {% ([, valuePred]) => genericCondition('finish', cardFinish, valuePred) %}

legalityCondition -> ("leg"i | "legal"i | "legality"i) legalityOpValue {% ([, valuePred]) => genericCondition('legality', cardLegalIn, valuePred) %}

priceCondition -> ("p"i | "usd"i | "price"i) dollarOpValue {% ([, valuePred]) => genericCondition('price', cardPrice, valuePred) %}

normalPriceCondition -> ("np"i | "pn"i | "normal"i | "normalprice"i | "pricenormal"i) dollarOpValue {% ([, valuePred]) => genericCondition('price_normal', cardNormalPrice, valuePred) %}

foilPriceCondition -> ("fp"i | "usdfoil"i | "pf"i | "foil"i | "foilprice"i | "pricefoil"i) dollarOpValue {% ([, valuePred]) => genericCondition('price_foil', cardFoilPrice, valuePred) %}

eurPriceCondition -> ("pe"i | "priceeur"i | "eur"i | "eurprice"i) dollarOpValue {% ([, valuePred]) => genericCondition('price_eur', cardPriceEur, valuePred) %}

tixPriceCondition -> ("tix"i | "pricetix"i | "tixprice"i) dollarOpValue {% ([, valuePred]) => genericCondition('price_tix', cardTix, valuePred) %}

statusCondition -> ("stat"i | "status"i) statusOpValue {% ([, valuePred]) => genericCondition('status', cardStatus, valuePred) %}

rarityCondition -> ("r"i | "rar"i | "rarity"i) rarityOpValue {% ([, valuePred]) => genericCondition('rarity', cardRarity, valuePred) %}

loyaltyCondition -> ("l"i | "loy"i | "loyal"i | "loyalty"i) integerOpValue {% ([, valuePred]) => genericCondition('loyalty', cardLoyalty, valuePred) %}

artistCondition -> ("a"i | "art"i | "artist"i) stringOpValue {% ([, valuePred]) => genericCondition('artist', cardArtist, valuePred) %}

layoutCondition -> "layout"i  stringOpValue {% ([, valuePred]) => genericCondition('layout', cardLayout, valuePred) %}

eloCondition -> "elo"i integerOpValue {% ([, valuePred]) => genericCondition('elo', cardElo, valuePred) %}

nameCondition -> ("n"i | "name"i) stringOpValue {% ([, valuePred]) => genericCondition('name_lower', cardNameLower, valuePred) %}
  | stringValue {% ([value]) => genericCondition('name_lower', cardNameLower, (fieldValue) => fieldValue.includes(value.toLowerCase())) %}

manaCostCondition -> ("mana"i | "cost"i | "m"i) manaCostOpValue {% ([, valuePred]) => genericCondition('parsed_cost', cardCost, valuePred) %}

castableCostCondition -> ("cw"i | "cast"i | "castable"i | "castwith"i | "castablewith"i) castableCostOpValue {% ([, valuePred]) => genericCondition('parsed_cost', cardCost, valuePred) %}

devotionCondition -> ("d"i | "dev"i | "devotion"i | "devotionto"i) ("w"i | "u"i | "b"i | "r"i | "g"i) anyOperator integerValue {% ([, [color], op, value]) => genericCondition('parsed_cost', (c) => c, devotionOperation(op, color, value)) %}
  | ("d"i | "dev"i | "devotion"i | "devotionto"i) devotionOpValue {% ([, valuePred]) => genericCondition('parsed_cost', (c) => c, valuePred) %}

picksCondition -> "picks" integerOpValue  {% ([,valuePred]) => genericCondition('picks', (card) => card.details.picks, valuePred) %}

cubesCondition -> "cubes" integerOpValue  {% ([,valuePred]) => genericCondition('cubes', (card) => card.details.cubes, valuePred) %}

collectorNumberCondition -> ("cn"i | "number"i) stringExactOpValue {% ([, valuePred]) => genericCondition('collector_number', cardCollectorNumber, valuePred) %}

isCondition -> "is"i isOpValue {% ([, valuePred]) => genericCondition('details', ({ details }) => details, valuePred) %}

notCondition -> "not"i isOpValue {% ([, valuePred]) => negated(genericCondition('details', ({ details }) => details, valuePred)) %}

isOpValue -> ":" isValue {% ([, category]) => (fieldValue) => CARD_CATEGORY_DETECTORS[category](fieldValue) %}

isValue -> (
    "gold"i | "twobrid"i | "hybrid"i | "phyrexian"i | "promo"i | "digital"i | "reasonable"i | "dfc"i | "mdfc"i
  | "meld"i | "transform"i | "split"i | "flip"i | "leveler"i | "commander"i | "spell"i | "permanent"i | "historic"i
  | "vanilla"i | "modal"i
  | "bikeland"i | "cycleland"i | "bicycleland"i | "bounceland"i | "karoo"i | "canopyland"i | "canland"i
  | "checkland"i | "dual"i | "fastland"i | "filterland"i | "gainland"i | "painland"i | "scryland"i | "shadowland"i
  | "shockland"i | "storageland"i | "creatureland"i | "manland"i | "triland"i | "tangoland"i | "battleland"i
  | "foil"i | "nonfoil"i | "fullart"i
) {% ([[category]]) => category.toLowerCase() %}
