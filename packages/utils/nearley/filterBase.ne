@builtin "whitespace.ne"
filterStart ->
    _ {% () => {
      const result = () => true;
      result.fieldsUsed = [];
      return result;
    } %}
  | _ filter _ {% ([, filter]) => filter %}

filter ->
    filter __ connector clause {% ([clause1, , connectorFunc, clause2]) => {
      const result = connectorFunc(clause1, clause2);
      result.fieldsUsed = [...new Set(clause1.fieldsUsed.concat(clause2.fieldsUsed))];
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
