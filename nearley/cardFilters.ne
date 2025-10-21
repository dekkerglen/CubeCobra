@include "./filterBase.ne"

@{%
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
  propertyComparisonOperation,
  genericCondition,
  comparisonCondition,
  legalitySuperCondition,
  setContainsOperation,
} from '../../filtering/FuncOperations';
import {
  CARD_CATEGORY_DETECTORS,
  cardCmc,
  cardColors,
  cardColorIdentity,
  cardType,
  cardOracleText,
  cardSet,
  cardCollectorNumber,
  cardNotes,
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
  cardPopularity,
  cardCubeCount,
  cardPickCount,
  cardArtist,
  cardLoyalty,
  cardRarity,
  cardStatus,
  cardCost,
  cardLayout,
  cardDevotion,
  cardLegalIn,
  cardBannedIn,
  cardRestrictedIn,
  cardGames,
} from '../../utils/cardutil';
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
  | ptSumCondition
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
  | popularityCondition
  | cubeCountCondition
  | pickCountCondition
  | nameCondition
  | manaCostCondition
  | castableCostCondition
  | devotionCondition
  | legalityCondition
  | bannedCondition
  | restrictedCondition
  | layoutCondition
  | collectorNumberCondition
  | notesCondition
  | gameCondition
) {% ([[condition]]) => condition %}

cmcCondition -> ("mv"i | "cmc"i) integerOpValue {% ([, valuePred]) => genericCondition('cmc', cardCmc, valuePred) %}

colorCondition -> ("c"i | "color"i | "colors"i) colorCombinationOpValue {% ([, valuePred]) => genericCondition('colors', cardColors, valuePred) %}

colorIdentityCondition -> ("ci"i | "id"i | "identity"i | "coloridentity"i | "color_identity"i) colorIdentityOpValue {% ([, valuePred]) => genericCondition('color_identity',cardColorIdentity, valuePred) %}

typeCondition -> ("t"i |  "type"i | "type_line"i | "typeline"i) stringContainOpValue {% ([, valuePred]) => genericCondition('type_line', cardType, valuePred) %}

oracleCondition -> ("o"i | "oracle"i | "text"i) nameStringOpValue {% ([, valuePred]) => genericCondition('oracle_text', cardOracleText, valuePred) %}

setCondition -> ("s"i | "set"i | "e"i | "edition"i) alphaNumericOpValue {% ([, valuePred]) => genericCondition('set', cardSet, valuePred) %}

powerCondition -> powerWords halfIntOpValue {% ([, valuePred]) => genericCondition('power', (c) => parseFloat(cardPower(c)), valuePred) %}
  | powerWords anyOperator toughnessWords {% ([, op, ]) => comparisonCondition(propertyComparisonOperation(op), 'power', (c) => parseFloat(cardPower(c)), 'toughness', (c) => parseFloat(cardToughness(c))) %}

toughnessCondition -> toughnessWords halfIntOpValue {% ([, valuePred]) => genericCondition('toughness', (c) => parseFloat(cardToughness(c)), valuePred) %}
  | toughnessWords anyOperator powerWords {% ([, op, ]) => comparisonCondition(propertyComparisonOperation(op), 'toughness', (c) => parseFloat(cardToughness(c)), 'power', (c) => parseFloat(cardPower(c))) %}

ptSumCondition -> ("pt"i | "wildpair"i) halfIntOpValue {% ([, valuePred]) => genericCondition('pt', (c) => parseFloat(cardToughness(c)) + parseFloat(cardPower(c)), valuePred) %}

tagCondition -> ("tag"i | "tags"i) stringSetElementOpValue {% ([, valuePred]) => genericCondition('tags', cardTags, valuePred) %}

finishCondition -> ("fin"i | "finish"i) finishOpValue {% ([, valuePred]) => genericCondition('finish', cardFinish, valuePred) %}

legalityCondition -> ("leg"i | "legal"i | "legality"i) equalityOperator legalityValue {% ([, op, legality]) => legalitySuperCondition(op, legality) %}

bannedCondition -> ("ban"i | "banned"i) legalityOpValue {% ([, valuePred]) => genericCondition('legality', cardBannedIn, valuePred) %}

restrictedCondition -> "restricted"i legalityOpValue {% ([, valuePred]) => genericCondition('legality', cardRestrictedIn, valuePred) %}

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

popularityCondition ->  ("pop"i | "popularity"i) integerOpValue {% ([, valuePred]) => genericCondition('popularity', cardPopularity, valuePred) %}

cubeCountCondition -> ("cubes"i | "cubecount"i | "numcubes"i) integerOpValue {% ([, valuePred]) => genericCondition('cubecount', cardCubeCount, valuePred) %}

pickCountCondition -> ("picks"i | "pickcount"i | "numpicks"i) integerOpValue {% ([, valuePred]) => genericCondition('pickcount', cardPickCount, valuePred) %}

nameCondition -> ("n"i | "name"i) stringOpValue {% ([, valuePred]) => genericCondition('name_lower', cardNameLower, valuePred) %}
  | stringValue {% ([value]) => genericCondition('name_lower', cardNameLower, (fieldValue) => fieldValue.includes(value.toLowerCase())) %}

manaCostCondition -> ("mana"i | "cost"i | "m"i) manaCostOpValue {% ([, valuePred]) => genericCondition('parsed_cost', cardCost, valuePred) %}

castableCostCondition -> ("cw"i | "cast"i | "castable"i | "castwith"i | "castablewith"i) castableCostOpValue {% ([, valuePred]) => genericCondition('parsed_cost', cardCost, valuePred) %}

devotionCondition -> ("d"i | "dev"i | "devotion"i | "devotionto"i) ("w"i | "u"i | "b"i | "r"i | "g"i) anyOperator integerValue {% ([, [color], op, value]) => genericCondition('parsed_cost', (c) => c, devotionOperation(op, color, value)) %}
  | ("d"i | "dev"i | "devotion"i | "devotionto"i) devotionOpValue {% ([, valuePred]) => genericCondition('parsed_cost', (c) => c, valuePred) %}

collectorNumberCondition -> ("cn"i | "number"i) stringExactOpValue {% ([, valuePred]) => genericCondition('collector_number', cardCollectorNumber, valuePred) %}

notesCondition -> "notes"i stringOpValue {% ([, valuePred]) => genericCondition('notes', cardNotes, valuePred) %}

gameCondition -> "game"i gameOpValue {% ([, valuePred]) => genericCondition('game', cardGames, valuePred) %}

isCondition -> "is"i isOpValue {% ([, valuePred]) => genericCondition('details', ({ details }) => details, valuePred) %}

notCondition -> "not"i isOpValue {% ([, valuePred]) => negated(genericCondition('details', ({ details }) => details, valuePred)) %}

isOpValue -> ":" isValue {% ([, category]) => CARD_CATEGORY_DETECTORS[category] %}

isValue -> (
    "gold"i | "twobrid"i | "hybrid"i | "phyrexian"i | "promo"i | "reprint"i | "firstprint"i | "firstprinting"i | "digital"i | "reasonable"i 
  | "dfc"i | "mdfc"i | "tdfc"i
  | "meld"i | "transform"i | "split"i | "flip"i | "leveler"i | "commander"i | "spell"i | "permanent"i | "historic"i
  | "vanilla"i | "modal"i | "fullart"i | "foil"i | "nonfoil"i | "etched"i | "altfoil"i
  | "bikeland"i | "cycleland"i | "bicycleland"i | "bounceland"i | "karoo"i | "canopyland"i | "canland"i | "fetchland"i
  | "checkland"i | "dual"i | "fastland"i | "filterland"i | "gainland"i | "painland"i | "scryland"i | "shadowland"i
  | "shockland"i | "storageland"i | "creatureland"i | "manland"i | "triland"i | "tangoland"i | "battleland"i | "surveilland"i
  | "universesbeyond"i | "ub"i
  | "reserved"i
) {% ([[category]]) => category.toLowerCase() %}

powerWords -> ("pow"i | "power"i)

toughnessWords -> ("tou"i | "tough"i | "toughness"i)