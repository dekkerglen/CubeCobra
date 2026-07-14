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
  colorCategoryOperation,
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
  titleCase,
  numericPhrase,
  categoryLabel,
} from '../../filtering/FuncOperations';
import {
  CARD_CATEGORY_DETECTORS,
  cardCmc,
  cardColors,
  cardColorIdentity,
  cardColorCategory,
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
  cardEdhrecRank,
  cardEdhrecSalt,
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
  cardGamesEverAvailable,
  cardFirstPrintYear,
  cardKeywords,
  cardOracleTags,
  cardArtTags,
  cardBoard,
} from '../../cardutil';
%} # %}

@{%
const negated = (inner) => {
  const result = (card) => !inner(card);
  result.fieldsUsed = inner.fieldsUsed;
  result.describe = `not (${inner.describe})`;
  return result;
};
%} # %}

start -> filterStart {% id %}

connector ->
    (null | "and"i __) {% () => { const f = (clause1, clause2) => (card) => clause1(card) && clause2(card); f.conn = 'and'; return f; } %}
  | "or"i __           {% () => { const f = (clause1, clause2) => (card) => clause1(card) || clause2(card); f.conn = 'or'; return f; } %}

condition -> (
    cmcCondition
  | colorCondition
  | colorIdentityCondition
  | colorCategoryCondition
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
  | includeExtrasCondition
  | eloCondition
  | popularityCondition
  | cubeCountCondition
  | pickCountCondition
  | edhrecRankCondition
  | saltCondition
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
  | firstYearCondition
  | keywordCondition
  | otagCondition
  | atagCondition
  | boardCondition
) {% ([[condition]]) => condition %}

cmcCondition -> ("mv"i | "cmc"i) integerOpValue {% ([, valuePred]) => genericCondition('cmc', cardCmc, valuePred) %}

colorCondition -> ("c"i | "color"i | "colors"i) colorCombinationOpValue {% ([, valuePred]) => genericCondition('colors', cardColors, valuePred) %}

colorIdentityCondition -> ("ci"i | "id"i | "identity"i | "coloridentity"i | "color_identity"i) colorIdentityOpValue {% ([, valuePred]) => genericCondition('color_identity',cardColorIdentity, valuePred) %}

colorCategoryCondition -> ("cc"i | "colorcategory"i | "color_category"i) colorCategoryOpValue {% ([, valuePred]) => genericCondition('colorcategory', cardColorCategory, valuePred) %}

typeCondition -> ("t"i |  "type"i | "type_line"i | "typeline"i) stringContainOpValue {% ([, valuePred]) => genericCondition('type_line', cardType, valuePred) %}

oracleCondition -> ("o"i | "oracle"i | "text"i) nameStringOpValue {% ([, valuePred]) => genericCondition('oracle_text', cardOracleText, valuePred) %}

setCondition -> ("s"i | "set"i | "e"i | "edition"i) alphaNumericOpValue {% ([, valuePred]) => genericCondition('set', cardSet, valuePred) %}

powerCondition -> powerWords halfIntOpValue {% ([, valuePred]) => genericCondition('power', (c) => parseFloat(cardPower(c)), valuePred) %}
  | powerWords anyOperator toughnessWords {% ([, op, ]) => comparisonCondition(propertyComparisonOperation(op), 'power', (c) => parseFloat(cardPower(c)), 'toughness', (c) => parseFloat(cardToughness(c))) %}

toughnessCondition -> toughnessWords halfIntOpValue {% ([, valuePred]) => genericCondition('toughness', (c) => parseFloat(cardToughness(c)), valuePred) %}
  | toughnessWords anyOperator powerWords {% ([, op, ]) => comparisonCondition(propertyComparisonOperation(op), 'toughness', (c) => parseFloat(cardToughness(c)), 'power', (c) => parseFloat(cardPower(c))) %}

ptSumCondition -> ("pt"i | "wildpair"i) halfIntOpValue {% ([, valuePred]) => genericCondition('pt', (c) => parseFloat(cardToughness(c)) + parseFloat(cardPower(c)), valuePred) %}

tagCondition -> ("tag"i | "tags"i) exactSetElementOpValue {% ([, valuePred]) => genericCondition('tags', cardTags, valuePred) %}

finishCondition -> ("fin"i | "finish"i) finishOpValue {% ([, valuePred]) => genericCondition('finish', cardFinish, valuePred) %}

legalityCondition -> ("leg"i | "legal"i | "legality"i) equalityOperator legalityValue {% ([, op, legality]) => legalitySuperCondition(op, legality) %}

bannedCondition -> ("ban"i | "banned"i) legalityOpValue {% ([, valuePred]) => { const c = genericCondition('legality', cardBannedIn, valuePred); c.describe = `is banned in ${titleCase(valuePred.element || '')}`; return c; } %}

restrictedCondition -> "restricted"i legalityOpValue {% ([, valuePred]) => { const c = genericCondition('legality', cardRestrictedIn, valuePred); c.describe = `is restricted in ${titleCase(valuePred.element || '')}`; return c; } %}

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

edhrecRankCondition -> ("edhrec"i | "edhrecrank"i | "rank"i) integerOpValue {% ([, valuePred]) => genericCondition('edhrecRank', cardEdhrecRank, valuePred) %}

saltCondition -> ("salt"i | "saltiness"i | "edhrecsalt"i) floatOpValue {% ([, valuePred]) => genericCondition('edhrecSalt', cardEdhrecSalt, valuePred) %}

nameCondition -> ("n"i | "name"i) stringOpValue {% ([, valuePred]) => genericCondition('name_lower', cardNameLower, valuePred) %}
  | stringValue {% ([value]) => { const pred = (fieldValue) => fieldValue.includes(value.toLowerCase()); pred.describe = `contains "${value.toLowerCase()}"`; return genericCondition('name_lower', cardNameLower, pred); } %}

manaCostCondition -> ("mana"i | "cost"i | "m"i) manaCostOpValue {% ([, valuePred]) => genericCondition('parsed_cost', cardCost, valuePred) %}

castableCostCondition -> ("cw"i | "cast"i | "castable"i | "castwith"i | "castablewith"i) castableCostOpValue {% ([, valuePred]) => { const c = genericCondition('parsed_cost', cardCost, valuePred); c.describe = valuePred.describe; return c; } %}

devotionCondition -> ("d"i | "dev"i | "devotion"i | "devotionto"i) ("w"i | "u"i | "b"i | "r"i | "g"i) anyOperator integerValue {% ([, [color], op, value]) => { const dop = devotionOperation(op, color, value); const c = genericCondition('parsed_cost', (c) => c, dop); c.describe = dop.describe; return c; } %}
  | ("d"i | "dev"i | "devotion"i | "devotionto"i) devotionOpValue {% ([, valuePred]) => { const c = genericCondition('parsed_cost', (c) => c, valuePred); c.describe = valuePred.describe; return c; } %}

collectorNumberCondition -> ("cn"i | "number"i) stringExactOpValue {% ([, valuePred]) => genericCondition('collector_number', cardCollectorNumber, valuePred) %}

notesCondition -> "notes"i stringOpValue {% ([, valuePred]) => genericCondition('notes', cardNotes, valuePred) %}

gameCondition -> "game"i gameOpValue {% ([, valuePred]) => genericCondition('game', cardGamesEverAvailable, valuePred) %}
  | "game"i exactGameOpValue {% ([, valuePred]) => genericCondition('game', cardGames, valuePred) %}

firstYearCondition -> ("year"i | "firstyear"i | "fy"i) integerOpValue {% ([, valuePred]) => genericCondition('firstPrintYear', cardFirstPrintYear, valuePred) %}

keywordCondition -> ("kw"i | "keyword"i | "keywords"i) stringSetElementOpValue {% ([, valuePred]) => genericCondition('keywords', cardKeywords, valuePred) %}

otagCondition -> ("otag"i | "oracletag"i | "oracletags"i) exactSetElementOpValue {% ([, valuePred]) => genericCondition('otag', cardOracleTags, valuePred) %}

atagCondition -> ("atag"i | "arttag"i | "arttags"i | "illustrationtag"i) exactSetElementOpValue {% ([, valuePred]) => genericCondition('atag', cardArtTags, valuePred) %}

# board=mainboard, board=maybeboard, board=basics, or any custom-board key.
# In non-cube contexts cardBoard() defaults to 'mainboard' so board=mainboard
# is a no-op there and board=anythingElse simply excludes the result, which
# is fine because non-cube callers don't put board= in their filters anyway.
boardCondition -> "board"i stringOpValue {% ([, valuePred]) => genericCondition('board', cardBoard, valuePred) %}

# "include:extras" is a search directive (matches everything), not a card
# predicate. It records the 'extras' field so the search layer knows to widen the
# candidate list to include tokens/planes/digital/etc. See searchCards.
includeExtrasCondition -> ("include"i | "in"i) ":" ("extras"i | "extra"i) {% () => {
  const result = () => true;
  result.fieldsUsed = ['extras'];
  result.describe = 'extra printings (tokens, emblems, etc.) are included';
  return result;
} %}

isCondition -> ("is"i | "has"i) isOpValue {% ([, valuePred]) => { const c = genericCondition('details', ({ details }) => details, valuePred); c.describe = `it is ${categoryLabel(valuePred.category)}`; return c; } %}

notCondition -> "not"i isOpValue {% ([, valuePred]) => { const c = genericCondition('details', ({ details }) => details, valuePred); const n = negated(c); n.describe = `it is not ${categoryLabel(valuePred.category)}`; return n; } %}

isOpValue -> ":" isValue {% ([, category]) => { const detector = CARD_CATEGORY_DETECTORS[category]; const wrapped = (card) => detector(card); wrapped.fieldsUsed = detector.fieldsUsed; wrapped.category = category; return wrapped; } %}

isValue -> (
    "gold"i | "twobrid"i | "hybrid"i | "phyrexian"i | "promo"i | "reprint"i | "firstprint"i | "firstprinting"i | "digital"i | "reasonable"i | "default"i
  | "dfc"i | "mdfc"i | "tdfc"i
  | "meld"i | "transform"i | "split"i | "adventure"i | "omen"i | "prepared"i | "flip"i | "leveler"i | "commander"i | "spell"i | "permanent"i | "historic"i
  | "vanilla"i | "modal"i | "fullart"i | "foil"i | "nonfoil"i | "etched"i | "altfoil"i
  | "bikeland"i | "cycleland"i | "bicycleland"i | "bounceland"i | "karoo"i | "canopyland"i | "canland"i | "fetchland"i
  | "checkland"i | "dual"i | "fastland"i | "filterland"i | "gainland"i | "painland"i | "scryland"i | "shadowland"i
  | "shockland"i | "storageland"i | "creatureland"i | "manland"i | "triland"i | "tangoland"i | "battleland"i | "surveilland"i
  | "universesbeyond"i | "ub"i
  | "reserved"i
  | "standard"i | "supplemental"i
  | "voucher"i
) {% ([[category]]) => category.toLowerCase() %}

powerWords -> ("pow"i | "power"i)

toughnessWords -> ("tou"i | "tough"i | "toughness"i)
