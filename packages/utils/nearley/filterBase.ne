@builtin "whitespace.ne"

@{%
// Compose a readable description of "clause1 <and|or> clause2", parenthesizing a
// child whose own connector differs so mixed and/or reads unambiguously.
const describeConnect = (clause1, clause2, conn) => {
  const wrap = (c) => (c.conn && c.conn !== conn ? `(${c.describe})` : c.describe);
  return `${wrap(clause1)} ${conn} ${wrap(clause2)}`;
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

filter ->
    filter __ connector clause {% ([clause1, , connectorFunc, clause2]) => {
      const result = connectorFunc(clause1, clause2);
      result.fieldsUsed = [...new Set(clause1.fieldsUsed.concat(clause2.fieldsUsed))];
      result.conn = connectorFunc.conn;
      result.describe = describeConnect(clause1, clause2, connectorFunc.conn);
      return result;
    } %}
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
