@include "./filterBase.ne"

@{%
import {
  defaultOperation,
  stringOperation,
  stringContainOperation,
  nameStringOperation,
  nameContainsOperation,
  nameOperation,
  typeOperation,
  parityOperation,
  collectorNumberOperation,
  dateOperation,
  todayIsoDate,
  isKnownKeyword,
  exactNameOperation,
  compileScryfallRegex,
  regexCondition,
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
  cardRulesText,
  cardSet,
  cardSetType,
  cardCollectorNumber,
  cardNotes,
  cardPowerValue,
  cardToughnessValue,
  cardLoyaltyValue,
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
  cardArtistCount,
  cardRarity,
  cardStatus,
  cardCost,
  cardLayout,
  cardLegalIn,
  cardBannedIn,
  cardRestrictedIn,
  cardGames,
  cardGamesEverAvailable,
  cardFirstPrintYear,
  cardReleaseYear,
  cardReleaseDate,
  cardProducedMana,
  cardBorderColor,
  cardLanguage,
  cardKeywords,
  cardOracleTags,
  cardArtTags,
  cardBoard,
  cardWordCount,
  cardQuantity,
} from '../../cardutil';
%} # %}

@{%
// Negating a neutral term (a search directive or an ignored term) leaves it as it is, as on Scryfall, where
// include:extras can't be negated and -lang:xx is ignored along with lang:xx. A negated term never asks for extras.
const negated = (inner) => {
  if (inner.neutral) {
    return inner;
  }
  const result = (card) => !inner(card);
  result.fieldsUsed = inner.fieldsUsed.filter((field) => field !== 'extras');
  result.regexes = inner.regexes;
  if (inner.directives) result.directives = inner.directives;
  result.describe = `not (${inner.describe})`;
  return result;
};

// A term that matches every card and drops out of and/or (see connect in filterBase.ne): search directives, and the
// placeholder makeFilter puts in place of a term it couldn't parse.
const neutralTerm = (describe, { fieldsUsed = [], directives } = {}) => {
  const result = () => true;
  result.neutral = true;
  result.fieldsUsed = fieldsUsed;
  result.describe = describe;
  if (directives) result.directives = directives;
  return result;
};

const ORDER_SORTS = { name: 'Alphabetical', cmc: 'Mana Value', usd: 'Price', edhrec: 'EDHREC Rank', released: 'Release date' };
const PREFERRED_PRINTINGS = { oldest: 'first', newest: 'recent', 'usd-low': 'cheapest', default: 'default' };
%} # %}

start -> filterStart {% id %}

condition -> (
    cmcCondition
  | colorCondition
  | colorIdentityCondition
  | colorCategoryCondition
  | typeCondition
  | oracleCondition
  | setCondition
  | setTypeCondition
  | fullOracleCondition
  | artistCountCondition
  | releaseYearCondition
  | dateCondition
  | producesCondition
  | borderCondition
  | languageCondition
  | directiveCondition
  | ignoredCondition
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
  | wordCountCondition
  | quantityCondition
) {% ([[condition]]) => condition %}

cmcCondition -> ("mv"i | "cmc"i | "manavalue"i) halfIntOpValue {% ([, valuePred]) => genericCondition('cmc', cardCmc, valuePred) %}
  | ("mv"i | "cmc"i | "manavalue"i) equalityOperator ("even"i | "odd"i) {% ([, op, [parity]]) => genericCondition('cmc', cardCmc, parityOperation(op, parity)) %}

colorCondition -> ("c"i | "color"i | "colors"i) colorCombinationOpValue {% ([, valuePred]) => genericCondition('colors', cardColors, valuePred) %}

colorIdentityCondition -> ("ci"i | "id"i | "identity"i | "coloridentity"i | "color_identity"i) colorIdentityOpValue {% ([, valuePred]) => genericCondition('color_identity',cardColorIdentity, valuePred) %}

colorCategoryCondition -> ("cc"i | "colorcategory"i | "color_category"i) colorCategoryOpValue {% ([, valuePred]) => genericCondition('colorcategory', cardColorCategory, valuePred) %}

typeCondition -> ("t"i |  "type"i | "type_line"i | "typeline"i) equalityOperator stringValue {% ([, op, value]) => genericCondition('type_line', cardType, typeOperation(op, value)) %}
  | ("t"i |  "type"i | "type_line"i | "typeline"i) ":" regexValue {% ([, , regex]) => regexCondition('type_line', cardType, regex, false) %}

# o: leaves out reminder text, as on Scryfall; fo: searches the full text.
oracleCondition -> ("o"i | "oracle"i | "text"i) nameStringOpValue {% ([, valuePred]) => genericCondition('oracle_text', cardRulesText, valuePred) %}
  | ("o"i | "oracle"i | "text"i) ":" regexValue {% ([, , regex]) => regexCondition('oracle_text', cardRulesText, regex, true) %}

fullOracleCondition -> ("fo"i | "fulloracle"i) nameStringOpValue {% ([, valuePred]) => genericCondition('full_oracle_text', cardOracleText, valuePred) %}
  | ("fo"i | "fulloracle"i) ":" regexValue {% ([, , regex]) => regexCondition('full_oracle_text', cardOracleText, regex, true) %}

setCondition -> ("s"i | "set"i | "e"i | "edition"i) alphaNumericOpValue {% ([, valuePred]) => genericCondition('set', cardSet, valuePred) %}

setTypeCondition -> ("st"i | "settype"i) setTypeOpValue {% ([, valuePred]) => genericCondition('set_type', (c) => cardSetType(c).replace(/_/g, ''), valuePred) %}

powerCondition -> powerWords halfIntOpValue {% ([, valuePred]) => genericCondition('power', cardPowerValue, valuePred) %}
  | powerWords anyOperator toughnessWords {% ([, op, ]) => comparisonCondition(propertyComparisonOperation(op), 'power', cardPowerValue, 'toughness', cardToughnessValue) %}

toughnessCondition -> toughnessWords halfIntOpValue {% ([, valuePred]) => genericCondition('toughness', cardToughnessValue, valuePred) %}
  | toughnessWords anyOperator powerWords {% ([, op, ]) => comparisonCondition(propertyComparisonOperation(op), 'toughness', cardToughnessValue, 'power', cardPowerValue) %}

ptSumCondition -> ("pt"i | "powtou"i | "wildpair"i) halfIntOpValue {% ([, valuePred]) => genericCondition('pt', (c) => cardToughnessValue(c) + cardPowerValue(c), valuePred) %}

tagCondition -> ("tag"i | "tags"i) tagSetElementOpValue {% ([, valuePred]) => genericCondition('tags', cardTags, valuePred) %}

finishCondition -> ("fin"i | "finish"i) finishOpValue {% ([, valuePred]) => genericCondition('finish', cardFinish, valuePred) %}

legalityCondition -> ("f"i | "format"i | "leg"i | "legal"i | "legality"i) equalityOperator legalityValue {% ([, op, legality]) => legalitySuperCondition(op, legality) %}

bannedCondition -> ("ban"i | "banned"i) legalityOpValue {% ([, valuePred]) => { const c = genericCondition('legality', cardBannedIn, valuePred); c.describe = `is banned in ${titleCase(valuePred.element || '')}`; return c; } %}

restrictedCondition -> "restricted"i legalityOpValue {% ([, valuePred]) => { const c = genericCondition('legality', cardRestrictedIn, valuePred); c.describe = `is restricted in ${titleCase(valuePred.element || '')}`; return c; } %}

priceCondition -> ("p"i | "usd"i | "price"i) dollarOpValue {% ([, valuePred]) => genericCondition('price', cardPrice, valuePred) %}

normalPriceCondition -> ("np"i | "pn"i | "normal"i | "normalprice"i | "pricenormal"i) dollarOpValue {% ([, valuePred]) => genericCondition('price_normal', cardNormalPrice, valuePred) %}

foilPriceCondition -> ("fp"i | "usdfoil"i | "pf"i | "foil"i | "foilprice"i | "pricefoil"i) dollarOpValue {% ([, valuePred]) => genericCondition('price_foil', cardFoilPrice, valuePred) %}

eurPriceCondition -> ("pe"i | "priceeur"i | "eur"i | "eurprice"i) dollarOpValue {% ([, valuePred]) => genericCondition('price_eur', cardPriceEur, valuePred) %}

tixPriceCondition -> ("tix"i | "pricetix"i | "tixprice"i) dollarOpValue {% ([, valuePred]) => genericCondition('price_tix', cardTix, valuePred) %}

statusCondition -> ("stat"i | "status"i) statusOpValue {% ([, valuePred]) => genericCondition('status', cardStatus, valuePred) %}

rarityCondition -> ("r"i | "rar"i | "rarity"i) rarityOpValue {% ([, valuePred]) => genericCondition('rarity', cardRarity, valuePred) %}

loyaltyCondition -> ("l"i | "loy"i | "loyal"i | "loyalty"i) integerOpValue {% ([, valuePred]) => genericCondition('loyalty', cardLoyaltyValue, valuePred) %}

artistCondition -> ("a"i | "artist"i) stringOpValue {% ([, valuePred]) => genericCondition('artist', cardArtist, valuePred) %}

artistCountCondition -> "artists"i integerOpValue {% ([, valuePred]) => genericCondition('artistCount', cardArtistCount, valuePred) %}

layoutCondition -> "layout"i  stringOpValue {% ([, valuePred]) => genericCondition('layout', cardLayout, valuePred) %}

eloCondition -> "elo"i integerOpValue {% ([, valuePred]) => genericCondition('elo', cardElo, valuePred) %}

popularityCondition ->  ("pop"i | "popularity"i) integerOpValue {% ([, valuePred]) => genericCondition('popularity', cardPopularity, valuePred) %}

cubeCountCondition -> ("cubes"i | "cubecount"i | "numcubes"i) integerOpValue {% ([, valuePred]) => genericCondition('cubecount', cardCubeCount, valuePred) %}

pickCountCondition -> ("picks"i | "pickcount"i | "numpicks"i) integerOpValue {% ([, valuePred]) => genericCondition('pickcount', cardPickCount, valuePred) %}

edhrecRankCondition -> ("edhrec"i | "edhrecrank"i | "rank"i) integerOpValue {% ([, valuePred]) => genericCondition('edhrecRank', cardEdhrecRank, valuePred) %}

saltCondition -> ("salt"i | "saltiness"i | "edhrecsalt"i) floatOpValue {% ([, valuePred]) => genericCondition('edhrecSalt', cardEdhrecSalt, valuePred) %}

nameCondition -> ("n"i | "name"i) equalityOperator stringValue {% ([, op, value]) => genericCondition('name_lower', cardNameLower, nameOperation(op, value)) %}
  | ("n"i | "name"i) ":" regexValue {% ([, , regex]) => regexCondition('name_lower', cardNameLower, regex, false) %}
  | "!" (dqstring | sqstring | noQuoteStringValue) {% ([, [value]]) => genericCondition('name_lower', cardNameLower, exactNameOperation(value)) %}
  | stringValue {% ([value], _l, reject) => (value === '++' || value === '@@' ? reject : genericCondition('name_lower', cardNameLower, nameContainsOperation(value))) %}

manaCostCondition -> ("mana"i | "cost"i | "m"i) manaCostOpValue {% ([, valuePred]) => genericCondition('parsed_cost', cardCost, valuePred) %}

castableCostCondition -> ("cw"i | "cast"i | "castable"i | "castwith"i | "castablewith"i) castableCostOpValue {% ([, valuePred]) => { const c = genericCondition('parsed_cost', cardCost, valuePred); c.describe = valuePred.describe; return c; } %}

devotionCondition -> ("d"i | "dev"i | "devotion"i | "devotionto"i) ("w"i | "u"i | "b"i | "r"i | "g"i) anyOperator integerValue {% ([, [color], op, value]) => { const dop = devotionOperation(op, [color.toLowerCase()], value); const c = genericCondition('parsed_cost', (c) => c, dop); c.describe = dop.describe; return c; } %}
  | ("d"i | "dev"i | "devotion"i | "devotionto"i) devotionOpValue {% ([, valuePred]) => { const c = genericCondition('parsed_cost', (c) => c, valuePred); c.describe = valuePred.describe; return c; } %}

collectorNumberCondition -> ("cn"i | "number"i) stringExactOpValue {% ([, valuePred]) => genericCondition('collector_number', cardCollectorNumber, valuePred) %}
  | ("cn"i | "number"i) ("<" | "<=" | ">" | ">=") integerValue {% ([, [op], value]) => genericCondition('collector_number', cardCollectorNumber, collectorNumberOperation(op, value)) %}

notesCondition -> "notes"i stringOpValue {% ([, valuePred]) => genericCondition('notes', cardNotes, valuePred) %}

# As on Scryfall, game:arena is about this printing and in:arena about any printing of the card. game:is-arena is
# our older spelling of game:arena.
gameCondition -> "game"i gameOpValue {% ([, valuePred]) => genericCondition('game', cardGames, valuePred) %}
  | "game"i exactGameOpValue {% ([, valuePred]) => genericCondition('game', cardGames, valuePred) %}
  | "in"i gameOpValue {% ([, valuePred]) => genericCondition('game', cardGamesEverAvailable, valuePred) %}

# year is the printing's release year, as on Scryfall; firstyear is the year the card was first printed.
releaseYearCondition -> "year"i integerOpValue {% ([, valuePred]) => genericCondition('releaseYear', cardReleaseYear, valuePred) %}

firstYearCondition -> ("firstyear"i | "fy"i) integerOpValue {% ([, valuePred]) => genericCondition('firstPrintYear', cardFirstPrintYear, valuePred) %}

dateCondition -> "date"i anyOperator dateValue {% ([, op, value]) => genericCondition('released_at', cardReleaseDate, dateOperation(op, value)) %}

producesCondition -> "produces"i anyOperator producesValue {% ([, op, value]) => genericCondition('produced_mana', cardProducedMana, setOperation(op.toString() === ':' ? '>=' : op, value)) %}

borderCondition -> "border"i equalityOperator borderValue {% ([, op, value]) => genericCondition('border_color', cardBorderColor, equalityOperation(op, value)) %}

# Our card data is English apart from printings that only exist in other languages, so lang:any changes nothing.
languageCondition -> ("lang"i | "language"i) ":" "any"i {% () => neutralTerm('any language') %}
  | ("lang"i | "language"i) equalityOperator langValue {% ([, op, value]) => genericCondition('language', cardLanguage, equalityOperation(op, value)) %}

# Search directives, applied by card search rather than to each card: unique:prints (or ++), order:, direction:,
# prefer:. Values Scryfall has that we can't follow (unique:art, order:artist, ...) fail to parse, so they're ignored.
directiveCondition -> "unique"i ":" ("cards"i | "prints"i) {% ([, , [unique]]) => neutralTerm(`one result per ${unique.toLowerCase() === 'cards' ? 'card' : 'printing'}`, { directives: { unique: unique.toLowerCase() } }) %}
  | "++" {% () => neutralTerm('one result per printing', { directives: { unique: 'prints' } }) %}
  | ("order"i | "sort"i) ":" ("name"i | "cmc"i | "usd"i | "edhrec"i | "released"i) {% ([, , [order]]) => neutralTerm(`sorted by ${order.toLowerCase()}`, { directives: { order: ORDER_SORTS[order.toLowerCase()] } }) %}
  | "direction"i ":" ("asc"i | "desc"i) {% ([, , [direction]]) => neutralTerm(`sorted ${direction.toLowerCase() === 'asc' ? 'ascending' : 'descending'}`, { directives: { direction: direction.toLowerCase() === 'asc' ? 'ascending' : 'descending' } }) %}
  | "prefer"i ":" ("oldest"i | "newest"i | "usd-low"i | "default"i) {% ([, , [prefer]]) => neutralTerm(`showing the ${prefer.toLowerCase()} printing`, { directives: { prefer: PREFERRED_PRINTINGS[prefer.toLowerCase()] } }) %}

# What makeFilter puts in place of a term it can't parse (see FilterCards). Not something to type.
ignoredCondition -> "⦃⦄" {% () => neutralTerm('') %}

keywordCondition -> ("kw"i | "keyword"i | "keywords"i) stringSetElementOpValue {% ([, valuePred], _l, reject) => (valuePred.element !== undefined && !isKnownKeyword(valuePred.element) ? reject : genericCondition('keywords', cardKeywords, valuePred)) %}

otagCondition -> ("otag"i | "oracletag"i | "oracletags"i | "function"i) tagSetElementOpValue {% ([, valuePred]) => genericCondition('otag', cardOracleTags, valuePred) %}

atagCondition -> ("atag"i | "art"i | "arttag"i | "arttags"i | "illustrationtag"i) tagSetElementOpValue {% ([, valuePred]) => genericCondition('atag', cardArtTags, valuePred) %}

wordCountCondition -> ("words"i | "wc"i | "wordcount"i) integerOpValue {% ([, valuePred]) => genericCondition('wordCount', cardWordCount, valuePred) %}

# Quantity is stamped per-card by the cube list before filtering, so this filter
# only meaningfully varies inside a cube; elsewhere every card reads as quantity=1.
quantityCondition -> ("quantity"i | "count"i | "copies"i) integerOpValue {% ([, valuePred]) => genericCondition('quantity', cardQuantity, valuePred) %}

# board=mainboard, board=maybeboard, board=basics, or any custom-board key.
# In non-cube contexts cardBoard() defaults to 'mainboard' so board=mainboard
# is a no-op there and board=anythingElse simply excludes the result, which
# is fine because non-cube callers don't put board= in their filters anyway.
boardCondition -> "board"i stringOpValue {% ([, valuePred]) => genericCondition('board', cardBoard, valuePred) %}

# "include:extras" is a search directive (matches everything), not a card
# predicate. It records the 'extras' field so the search layer knows to widen the
# candidate list to include tokens/planes/digital/etc. See searchCards.
includeExtrasCondition -> ("include"i | "in"i) ":" ("extras"i | "extra"i) {% () => neutralTerm('extra printings (tokens, emblems, etc.) are included', { fieldsUsed: ['extras'] }) %}

# is:funny also searches the funny cards card search hides by default (holiday cards, playtest cards, ...), as on
# Scryfall, so it asks for extras.
isCondition -> ("is"i | "has"i) isOpValue {% ([, valuePred]) => { const c = genericCondition('details', ({ details }) => details, valuePred); c.describe = `it is ${categoryLabel(valuePred.category)}`; if (valuePred.category === 'funny') c.fieldsUsed = [...c.fieldsUsed, 'extras']; return c; } %}

notCondition -> "not"i isOpValue {% ([, valuePred]) => { const c = genericCondition('details', ({ details }) => details, valuePred); const n = negated(c); n.describe = `it is not ${categoryLabel(valuePred.category)}`; return n; } %}

isOpValue -> ":" isWord {% ([, category]) => { const detector = CARD_CATEGORY_DETECTORS[category]; const wrapped = (details, card) => detector(details, card); wrapped.fieldsUsed = detector.fieldsUsed; wrapped.category = category; return wrapped; } %}

powerWords -> ("pow"i | "power"i)

toughnessWords -> ("tou"i | "tough"i | "toughness"i)
