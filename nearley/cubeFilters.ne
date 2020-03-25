@include "./filterBase.ne"
@include "./mongoOperations.ne"

@{%
const negated = ({ query, fieldsUsed }) => ({ query: { $not: query }, fieldsUsed });
%} # %}

start -> filterStart {% id %}

connector -> (null | "and"i __) {% () => (clause1, clause2) => ({ query: { $and: [clause1.query, clause2.query] } }) %}
  | "or"i __ {% () => (clause1, clause2) => ({ query: { $or: [clause1.query, clause2.query] } }) %}
  
  condition -> (
      ownerNameCondition
    | nameCondition
    | numDecksCondition
    | cardCountCondition
    | categoryCondition
    | cardCondition
  )  {% ([[condition]]) => condition %}

@{%
const genericCondition = (property, valuePred) => ({ query: { [property]: valuePred }, fieldsUsed: [property] });
%} # %}

ownerNameCondition -> ("owner"i | "owner_name"i | "ownername"i) stringOpValue {% ([, valuePred]) => genericCondition('owner_name', valuePred) %}

nameCondition -> ("n"i | "name"i | "cubename"i | "cube_name"i) stringOpValue {% ([, valuePred]) => genericCondition('name', valuePred) %}
  | noQuoteStringValue {% ([value]) => genericCondition('name', stringOperation(':', value)) %}

numDecksCondition -> ("numdecks"i | "num_decks"i | "decks"i | "d"i) integerOpValue {% ([, valuePred]) => genericCondition('numDecks', valuePred) %}

cardCountCondition -> ("cardcount"i | "card_count"i | "cards"i | "c"i) integerOpValue {% ([, valuePred]) => genericCondition('card_count', valuePred) %}

cardCondition -> ("card"i) ":" stringValue {% ([, , value]) => ({ query: { CARD: value }, fieldsUsed: ['card'] }) %}

categoryCondition -> ("category"i) (prefixCategoryOpValue | overrideCategoryOpValue) {% ([, [condition]]) => condition %}

prefixCategoryOpValue -> ":" prefixCategoryValue {% ([, prefix]) => genericCondition('categoryPrefixes', { $regex: prefix, $options: 'i' }) %}

overrideCategoryOpValue -> ":" overrideCategoryValue {% ([, category]) => genericCondition('categoryOverride', { $regex: category, $options: 'i' }) %}

prefixCategoryValue -> ("Powered"i | "Unpowered"i | "Pauper"i | "Peasant"i | "Budget"i | "Silver-bordered"i | "Commander"i) {% ([[prefix]]) => prefix %}

overrideCategoryValue -> ("Vintage"i | "Legacy"i | "Modern"i | "Pioneer"i | "Standard"i) {% ([[category]]) => category %}
