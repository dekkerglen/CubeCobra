@builtin "whitespace.ne"

@{%
// Compose a readable description of "clause1 <and|or> clause2", parenthesizing a
// child whose own connector differs so mixed and/or reads unambiguously.
const describeConnect = (clause1, clause2, conn) => {
  const wrap = (c) => (c.conn && c.conn !== conn ? `(${c.describe})` : c.describe);
  return `${wrap(clause1)} ${conn} ${wrap(clause2)}`;
};

const mergeDirectives = (clause1, clause2) =>
  clause1.directives || clause2.directives ? { ...(clause1.directives ?? {}), ...(clause2.directives ?? {}) } : undefined;

// Join two clauses with and/or. A neutral clause (a search directive such as include:extras, or a term makeFilter
// had to ignore) doesn't take part in matching, so it drops out of the connective and the other clause stands
// alone, as on Scryfall: "t:goblin or lang:ja" is just "t:goblin". Its fields and directives are kept.
const connect = (clause1, clause2, conn) => {
  const fieldsUsed = [...new Set(clause1.fieldsUsed.concat(clause2.fieldsUsed))];
  const regexes = [...(clause1.regexes ?? []), ...(clause2.regexes ?? [])];
  const directives = mergeDirectives(clause1, clause2);
  let result;
  if (clause1.neutral || clause2.neutral) {
    const kept = clause1.neutral ? clause2 : clause1;
    result = (card) => kept(card);
    result.neutral = clause1.neutral && clause2.neutral;
    result.conn = kept.conn;
    result.describe = clause1.neutral && clause2.neutral
      ? [clause1.describe, clause2.describe].filter(Boolean).join(` ${conn} `)
      : kept.describe;
  } else {
    result = conn === 'and' ? (card) => clause1(card) && clause2(card) : (card) => clause1(card) || clause2(card);
    result.conn = conn;
    result.describe = describeConnect(clause1, clause2, conn);
  }
  result.fieldsUsed = fieldsUsed;
  result.regexes = regexes;
  if (directives) result.directives = directives;
  return result;
};
%} # %}

filterStart ->
    _ {% () => {
      const result = () => true;
      result.fieldsUsed = [];
      result.describe = '';
      return result;
    } %}
  | _ filter _ {% ([, filter]) => filter %}

# "and" binds tighter than "or", as on Scryfall: "a or b c" is "a or (b and c)".
filter -> orFilter {% id %}

orFilter ->
    orFilter __ "or"i __ andFilter {% ([clause1, , , , clause2]) => connect(clause1, clause2, 'or') %}
  | andFilter {% id %}

andFilter ->
    andFilter __ ("and"i __):? clause {% ([clause1, , , clause2]) => connect(clause1, clause2, 'and') %}
  | clause {% id %}

clause -> "-":? (
    "(" filter ")" {% ([, f]) => [f] %}
  | condition
) {% ([negation, [inner]]) => {
  if (negation) {
    return negated(inner);
  }
  return inner;
} %}

@include "./values.ne"
