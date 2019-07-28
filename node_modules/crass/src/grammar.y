// CSS grammar based on CSS3+ specification(s)
// Written by Matt Basta
// Copyright 2016

%lex
ws                  [ \n\r\t\f]
comment             "/*"(.|\n|\r)*?"*/"
hex                 [a-fA-F0-9]
escape_seq          \\([\da-fA-F]+\s|[^\n])
ident               ([a-zA-Z_]|[^\x00-\x7F]|\-([a-zA-Z_\-]|[^\x00-\x7F])|\-?\\([\da-fA-F]{1,6}\s|[^\n\da-fA-F]))([\w_\-]|[^\x00-\x7F]|\\([\da-fA-F]+\s|[^\n\da-fA-F]))*
int                 ([1-9][0-9]*|"0")
ie_junk             [a-zA-Z0-9=#, \n\r\t'"]
ie_ident            [a-zA-Z0-9\.:]
vendor_prefix       ((\-[a-zA-Z]+\-)?)

%%
"#"{hex}{hex}{hex}{hex}{hex}{hex}{hex}{hex}   return 'HEX_LONG_ALPHA'
"#"{hex}{hex}{hex}{hex}{hex}{hex}   return 'HEX_LONG'
"#"{hex}{hex}{hex}{hex}             return 'HEX_SHORT_ALPHA'
"#"{hex}{hex}{hex}                  return 'HEX_SHORT'
{int}"e"("+"|"-")?{int}             return 'SCINOT'
{int}?"."[0-9]+                     return 'FLOAT'
{int}"."[0-9]*                      return 'FLOAT'
{int}                               return 'INTEGER'
({ws}|{comment})+                   return 'S'
","                                 return ','
";"                                 return ';'
","                                 return ','
"{"                                 return '{'
"}"                                 return '}'
"["                                 return '['
"]"                                 return ']'
"("                                 return '('
")"                                 return ')'
"%"                                 return '%'
"*"                                 return '*'
"|="                                return '|='
"|"                                 return '|'
"/"                                 return '/'
"*"                                 return '*'
"="                                 return '='
"n-resize"                          return 'IDENT'  // For cursor: n-resize
"not-allowed"                       return 'IDENT'  // For cursor: not-allowed
"n"                                 return 'N'
"@charset"                          return 'BLOCK_CHARSET'
"@counter-style"                    return 'BLOCK_COUNTERSTYLE'
"@import"                           return 'BLOCK_IMPORT'
"@namespace"                        return 'BLOCK_NAMESPACE'
"@media"                            return 'BLOCK_MEDIA'
"@font-face"                        return 'BLOCK_FONT_FACE'
"@font-feature-values"              return 'BLOCK_FONT_FEATURE_VALUES'
"@page"                             return 'BLOCK_PAGE'
"@keyframes"                        return 'BLOCK_KEYFRAMES'
"@-"[a-zA-Z]+"-keyframes"           return 'BLOCK_VENDOR_KEYFRAMES'
"@viewport"                         return 'BLOCK_VIEWPORT'
"@-"[a-zA-Z]+"-viewport"            return 'BLOCK_VENDOR_VIEWPORT'
"@supports"                         return 'BLOCK_SUPPORTS'

"@top-left-corner"                  return 'PAGE_TOP_LEFT_CORNER'
"@top-left"                         return 'PAGE_TOP_LEFT'
"@top-center"                       return 'PAGE_TOP_CENTER'
"@top-right"                        return 'PAGE_TOP_RIGHT'
"@top-right-corner"                 return 'PAGE_TOP_RIGHT_CORNER'
"@bottom-left-corner"               return 'PAGE_BOTTOM_LEFT_CORNER'
"@bottom-left"                      return 'PAGE_BOTTOM_LEFT'
"@bottom-center"                    return 'PAGE_BOTTOM_CENTER'
"@bottom-right"                     return 'PAGE_BOTTOM_RIGHT'
"@bottom-right-corner"              return 'PAGE_BOTTOM_RIGHT_CORNER'
"@left-top"                         return 'PAGE_LEFT_TOP'
"@left-middle"                      return 'PAGE_LEFT_MIDDLE'
"@left-bottom"                      return 'PAGE_LEFT_BOTTOM'
"@right-top"                        return 'PAGE_RIGHT_TOP'
"@right-middle"                     return 'PAGE_RIGHT_MIDDLE'
"@right-bottom"                     return 'PAGE_RIGHT_BOTTOM'

"@swash"                            return 'FFV_SWASH'
"@annotation"                       return 'FFV_ANNOTATION'
"@ornaments"                        return 'FFV_ORNAMENTS'
"@stylistic"                        return 'FFV_STYLISTIC'
"@styleset"                         return 'FFV_STYLESET'
"@character-variant"                return 'FFV_CHARACTER_VARIANT'

'U+'{hex}+'-'{hex}+                 return 'UNICODE_RANGE'
'U+'{hex}+'?'*                      return 'UNICODE_RANGE'

\"(?:\\(?:.|{ws})|[^"\\])*\"     yytext = yytext.substr(1,yyleng-2); return 'STRING';
\'(?:\\(?:.|{ws})|[^'\\])*\'     yytext = yytext.substr(1,yyleng-2); return 'STRING';
"only"                              return 'ONLY'
"not"                               return 'NOT'
"and"                               return 'AND'
"or"                                return 'OR'
"odd"                               return 'ODD'
"even"                              return 'EVEN'
"!"                                 return '!'
"important"                         return 'IMPORTANT'
"expression(".*?")"                 return 'IE_EXPRESSION'

"-ms-filter"{ws}*":"{ws}*"progid:"?({ie_ident}+"("{ie_junk}*")"{ws}*)+  return 'IE_FILTER'
"-ms-filter"{ws}*":"{ws}*"alpha("{ie_junk}*")"{ws}*({ie_ident}+"("{ie_junk}*")"{ws}*)*  return 'IE_FILTER'
"filter"{ws}*":"{ws}*"progid:"({ie_ident}+"("{ie_junk}*")"{ws}*)+  return 'IE_FILTER'
"filter"{ws}*":"{ws}*"progid:"?"DXImageTransform."({ie_ident}+"("{ie_junk}*")"{ws}*)+  return 'IE_FILTER'
"filter"{ws}*":"{ws}*"alpha("{ie_junk}*")"{ws}*({ie_ident}+"("{ie_junk}*")"{ws}*)*  return 'IE_FILTER'

"url("(\"(?:\\(?:.|{ws})|[^"\\])*\"|\'(?:\\(?:.|{ws})|[^'\\])*\'|[^)]*)")"                      return 'URL_FULL'
{vendor_prefix}"calc"               return 'CALC'
"attr"                              return 'ATTR'
"#"{ident}"#"{ident}                return 'ID_IDENT'  // for ie :(
"#"{ident}                          return 'ID_IDENT'
"."{ident}                          return 'CLASS_IDENT'
{ident}"("                          return 'FUNCTION_IDENT'
"from"                              return 'FROM'
"to"                                return 'TO'
{ident}                             return 'IDENT'
"$"                                 return '$'
"^"                                 return '^'
"-"                                 return '-'
"+"                                 return '+'
">"                                 return 'SEL_CHILD'
"~"                                 return 'SEL_SIBLING'
":nth-"("last-")?("child"|"of-type") return 'NTH_FUNC'
":only-child"                       return 'PSEUDO_CLASS'
":only-of-type"                     return 'PSEUDO_CLASS'
"::"                                return '::'
":"                                 return ':'
"\\0"                               return 'SLASH_ZERO'
"\\9"                               return 'SLASH_NINE'
<<EOF>>                             return 'EOF'

/lex

%start file

%%

file
    : scc stylesheet EOF
        { return $2; }
    ;

string
    : STRING
        { $$ = new yy.String($1); }
    ;

string_or_ident
    : string
        { $$ = $1; }
    | IDENT
        { $$ = $1; }
    ;

string_or_uri
    : string
        { $$ = $1; }
    | uri
        { $$ = $1; }
    ;

junk
    : S
        { $$ = null; }
    |
        { $$ = null; }
    ;

scc
    :
        { $$ = null; }
    | S
        { $$ = null; }
    | HTML_COMMENT
        { $$ = null; }
    ;

stylesheet
    : charset_block import_list namespace_list blocks
        { $$ = new yy.Stylesheet($1, $2, $3, $4); }
    ;

charset_block
    : BLOCK_CHARSET junk string junk ';' junk
        { $$ = new yy.Charset($3); $$.range = @$; }
    |
        { $$ = null; }
    ;

import_list
    : BLOCK_IMPORT junk import_block ';' junk import_list
        { $$ = $6; $$.unshift($3); }
    |
        { $$ = []; }
    ;

import_block
    : string_or_uri junk optional_medium_list
        { $$ = new yy.Import($1, $3); $$.range = @$; }
    ;

optional_medium_list
    : medium_list junk
        { $$ = $1; }
    |
        { $$ = null; }
    ;

namespace_list
    : namespace_block ';' junk namespace_list
        { $$ = $4; $$.unshift($1); }
    |
        { $$ = []; }
    ;

namespace_block
    : BLOCK_NAMESPACE junk string_or_uri junk
        { $$ = new yy.Namespace($3, null); $$.range = @$; }
    | BLOCK_NAMESPACE junk IDENT junk string_or_uri junk
        { $$ = new yy.Namespace($5, $3); $$.range = @$; }
    ;

blocks
    : block blocks
        { $$ = $2; $2.unshift($1); }
    | charset_block blocks
        { $$ = $2; }
    |
        { $$ = []; }
    ;

block
    : ruleset junk
        { $$ = $1; }
    | media_block junk
        { $$ = $1; }
    | page_block junk
        { $$ = $1; }
    | font_face_block junk
        { $$ = $1; }
    | font_feature_values_block junk
        { $$ = $1; }
    | keyframes_block junk
        { $$ = $1; }
    | viewport_block junk
        { $$ = $1; }
    | supports_block junk
        { $$ = $1; }
    | counter_styles_block junk
        { $$ = $1; }
    ;

block_of_declarations
    : '{' junk declaration_list '}'
        { $$ = $3; }
    ;


media_block
    : BLOCK_MEDIA junk medium_list junk '{' junk media_inner_list '}'
        { $$ = new yy.Media($3, $7); $$.range = @$; }
    ;

media_inner_list
    : media_inner media_inner_list
        { $$ = $2; $$.unshift($1); }
    |
        { $$ = []; }
    ;

media_inner
    : media_block junk
        { $$ = $1; }
    | page_block junk
        { $$ = $1; }
    | ruleset junk
        { $$ = $1; }
    ;

medium_list
    : media_query medium_list_extended
        { $$ = $2; $$.unshift($1); }
    ;

medium_list_extended
    : ',' junk medium_list
        { $$ = $3; }
    |
        { $$ = []; }
    ;

media_query
    : media_query_type
        { $$ = $1; }
    | media_query_expr
        { $$ = new yy.MediaQuery(null, null, $1); $$.range = @$; }
    ;

media_query_type
    : ONLY junk IDENT junk optional_media_query_expression
        { $$ = new yy.MediaQuery($3, 'only', $5); $$.range = @$; }
    | NOT junk IDENT junk optional_media_query_expression
        { $$ = new yy.MediaQuery($3, 'not', $5); $$.range = @$; }
    | IDENT junk optional_media_query_expression
        { $$ = new yy.MediaQuery($1, null, $3); $$.range = @$; }
    ;

optional_media_query_expression
    : AND junk media_query_expr
        { $$ = $3; }
    |
        { $$ = null; }
    ;

media_query_expr
    : media_expr media_query_expr_and
        { $$ = $2; $$.unshift($1); }
    ;

media_query_expr_and
    : 'AND' junk media_query_expr
        { $$ = $3; }
    |
        { $$ = []; }
    ;

media_expr
    : '(' junk IDENT junk media_expr_value junk media_expr_slashzero ')' junk
        { $$ = new yy.MediaExpression($3, $5, $7); $$.range = @$; }
    ;

media_expr_value
    : ':' junk expr
        { $$ = $3; }
    |
        { $$ = null; }
    ;

media_expr_slashzero
    : SLASH_ZERO junk
        { $$ = {slashZero: true}; }
    |
        { $$ = {}; }
    ;

page_block
    : BLOCK_PAGE junk page_name '{' junk page_declaration_list '}'
        { $$ = new yy.Page($3, $6); $$.range = @$; }
    ;

page_name
    : IDENT page_name_optional_pseudo junk
        { $$ = $1 + $2; }
    | page_name_optional_pseudo junk
        { $$ = $1; }
    ;

page_name_optional_pseudo
    : ':' IDENT
        { $$ = ':' + $2; }
    |
        { $$ = ''; }
    ;

page_declaration_list
    : page_declaration page_declaration_list
        { $$ = $2; if ($1 !== null) {$$.unshift($1);} }
    |
        { $$ = []; }
    ;

page_declaration
    : declaration
        { $$ = $1; }
    | page_margin_declaration
        { $$ = $1; }
    | ';' junk
        { $$ = null; }
    ;


page_margin_declaration
    : page_margin junk block_of_declarations junk
        { $$ = new yy.PageMargin($1.substr(1), $3); }
    ;

page_margin
    : PAGE_TOP_LEFT_CORNER
        { $$ = $1; }
    | PAGE_TOP_LEFT
        { $$ = $1; }
    | PAGE_TOP_CENTER
        { $$ = $1; }
    | PAGE_TOP_RIGHT
        { $$ = $1; }
    | PAGE_TOP_RIGHT_CORNER
        { $$ = $1; }
    | PAGE_BOTTOM_LEFT_CORNER
        { $$ = $1; }
    | PAGE_BOTTOM_LEFT
        { $$ = $1; }
    | PAGE_BOTTOM_CENTER
        { $$ = $1; }
    | PAGE_BOTTOM_RIGHT
        { $$ = $1; }
    | PAGE_BOTTOM_RIGHT_CORNER
        { $$ = $1; }
    | PAGE_LEFT_TOP
        { $$ = $1; }
    | PAGE_LEFT_MIDDLE
        { $$ = $1; }
    | PAGE_LEFT_BOTTOM
        { $$ = $1; }
    | PAGE_RIGHT_TOP
        { $$ = $1; }
    | PAGE_RIGHT_MIDDLE
        { $$ = $1; }
    | PAGE_RIGHT_BOTTOM
        { $$ = $1; }
    ;

font_face_block
    : BLOCK_FONT_FACE junk block_of_declarations
        { $$ = new yy.FontFace($3); $$.range = @$; }
    ;

font_feature_values_block
    : BLOCK_FONT_FEATURE_VALUES junk font_feature_name '{' junk font_feature_values_contents '}'
        { $$ = new yy.FontFeatureValues($3, $6); $$.range = @$; }
    ;

font_feature_name
    : IDENT junk font_feature_name_extended
        { $$ = $1 + $3; }
    ;

font_feature_name_extended
    : font_feature_name
        { $$ = ' ' + $1; }
    |
        { $$ = ''; }
    ;

font_feature_values_contents
    : font_feature_values_inner_block font_feature_values_contents
        { $$ = $2; $$.unshift($1); }
    |
        { $$ = []; }
    ;

font_feature_values_inner_block
    : font_feature_values_content_block junk block_of_declarations junk
        { $$ = new yy.FontFeatureValuesBlock($1, $3); $$.range = @$; }
    ;

font_feature_values_content_block
    : FFV_SWASH
        { $$ = $1; }
    | FFV_ANNOTATION
        { $$ = $1; }
    | FFV_ORNAMENTS
        { $$ = $1; }
    | FFV_STYLISTIC
        { $$ = $1; }
    | FFV_STYLESET
        { $$ = $1; }
    | FFV_CHARACTER_VARIANT
        { $$ = $1; }
    ;

keyframes_block
    : BLOCK_KEYFRAMES junk IDENT junk '{' junk keyframe_list '}'
        { $$ = new yy.Keyframes($3, $7); $$.range = @$; }
    | BLOCK_VENDOR_KEYFRAMES junk IDENT junk '{' junk keyframe_list '}'
        { $$ = new yy.Keyframes($3, $7, $1.substring(1, $1.length - 9)); $$.range = @$; }
    ;

keyframe_list
    : keyframe keyframe_list
        { $$ = $2; $$.unshift($1); }
    |
        { $$ = []; }
    ;

keyframe
    : keyframe_selector_list block_of_declarations junk
        { $$ = new yy.Keyframe($1, $2); $$.range = @$; }
    ;

keyframe_selector_list
    : keyframe_selector junk keyframe_selector_list_extended
        { $$ = $3; $$.unshift($1); }
    ;

keyframe_selector_list_extended
    : ',' junk keyframe_selector_list
        { $$ = $3; }
    |
        { $$ = []; }
    ;

keyframe_selector
    : num optional_percent
        {
            if ($2) {
                $$ = new yy.KeyframeSelector($1 + '%');
            } else {
                if ($1.asNumber() !== 0) throw new SyntaxError('Invalid keyframe selector: ' + $1.toString());
                $$ = new yy.KeyframeSelector($1.toString());
            }
            $$.range = @$;
        }
    | FROM
        { $$ = new yy.KeyframeSelector('from'); $$.range = @$; }
    | TO
        { $$ = new yy.KeyframeSelector('to'); $$.range = @$; }
    ;

optional_percent
    : '%'
        { $$ = true; }
    |
        { $$ = false; }
    ;

viewport_block
    : BLOCK_VIEWPORT junk block_of_declarations
        { $$ = new yy.Viewport($3); $$.range = @$; }
    | BLOCK_VENDOR_VIEWPORT junk block_of_declarations
        { $$ = new yy.Viewport($3, $1.substring(1, $1.length - 8)); $$.range = @$; }
    ;


supports_block
    : BLOCK_SUPPORTS junk supports_list '{' junk blocks '}'
        { $$ = new yy.Supports($3, $6); $$.range = @$; }
    ;

supports_list
    : supports_item OR junk supports_list
        { $$ = yy.createSupportsConditionList($1, 'or', $4); }
    | supports_item AND junk supports_list
        { $$ = yy.createSupportsConditionList($1, 'and', $4); }
    | supports_item
        { $$ = $1; }
    ;

supports_item
    : supports_negation_base supports_negation
        { $$ = $2; $$.range = @$; }
    | '(' junk declaration ')' junk
        { $$ = new yy.SupportsCondition($3); $$.range = @$; }
    | '(' junk supports_list ')' junk
        { $$ = $3; }
    ;

supports_negation
    : supports_list ')' junk
        { $$ = new yy.SupportsCondition($1); $$.range = @$; $$.negate(); }
    | declaration ')' junk
        { $$ = new yy.SupportsCondition($1); $$.range = @$; $$.negate(); }
    | supports_negation_base supports_negation ')' junk
        { $$ = new yy.SupportsCondition($2); $$.negate(); }
    ;

supports_negation_base
    : NOT junk '(' junk
        { $$ = null; }
    ;

counter_styles_block
    : BLOCK_COUNTERSTYLE junk IDENT junk block_of_declarations
        { $$ = new yy.CounterStyle($3, $5); $$.range = @$; }
    ;


ruleset
    : selector_list block_of_declarations
        { $$ = new yy.Ruleset($1, $2); $$.range = @$; }
    ;

selector_list
    : selector_list ',' junk selector_chunk_list
        { $$ = yy.createSelectorList($1, $4); }
    | selector_chunk_list
        { $$ = $1; }
    ;

selector_chunk_list
    : selector_chunk_list '+' junk simple_selector junk
        { $$ = new yy.AdjacentSelector($1, $4); $$.range = @$; }
    | selector_chunk_list SEL_CHILD junk simple_selector junk
        { $$ = new yy.DirectDescendantSelector($1, $4); $$.range = @$; }
    | selector_chunk_list SEL_SIBLING junk simple_selector junk
        { $$ = new yy.SiblingSelector($1, $4); $$.range = @$; }
    | selector_chunk_list simple_selector junk
        { $$ = new yy.DescendantSelector($1, $2); $$.range = @$; }
    | simple_selector junk
        { $$ = $1; }
    ;

simple_selector
    : element_name simple_selector_part_list
        { $$ = new yy.SimpleSelector([$1].concat($2)); $$.range = @$; }
    | simple_selector_part_list
        { $$ = new yy.SimpleSelector($1); $$.range = @$; }
    ;

simple_selector_part_list
    : ID_IDENT simple_selector_part_list
        { $$ = $2; $$.unshift(new yy.IDSelector($1.substr(1))); }
    /* FIXME: These next eight rules are an abomination. */
    | HEX_SHORT simple_selector_part_list
        { $$ = $2; $$.unshift(new yy.IDSelector($1.substr(1))); }
    | HEX_SHORT IDENT simple_selector_part_list
        { $$ = $3; $$.unshift(new yy.IDSelector($1.substr(1) + $2)); }
    | HEX_LONG simple_selector_part_list
        { $$ = $2; $$.unshift(new yy.IDSelector($1.substr(1))); }
    | HEX_LONG IDENT simple_selector_part_list
        { $$ = $3; $$.unshift(new yy.IDSelector($1.substr(1) + $2)); }
    | HEX_SHORT_ALPHA simple_selector_part_list
        { $$ = $2; $$.unshift(new yy.IDSelector($1.substr(1))); }
    | HEX_SHORT_ALPHA IDENT simple_selector_part_list
        { $$ = $3; $$.unshift(new yy.IDSelector($1.substr(1) + $2)); }
    | HEX_LONG_ALPHA simple_selector_part_list
        { $$ = $2; $$.unshift(new yy.IDSelector($1.substr(1))); }
    | HEX_LONG_ALPHA IDENT simple_selector_part_list
        { $$ = $3; $$.unshift(new yy.IDSelector($1.substr(1) + $2)); }
    /* </abomination> */
    | CLASS_IDENT simple_selector_part_list
        { $$ = $2; $$.unshift(new yy.ClassSelector($1.substr(1))); }
    | attribute_selector simple_selector_part_list
        { $$ = $2; $$.unshift($1); }
    | pseudo_selector simple_selector_part_list
        { $$ = $2; $$.unshift($1); }
    |
        { $$ = []; }
    ;

element_name
    : element_type '|' IDENT
        { $$ = new yy.ElementSelector($1, $3); $$.range = @$; }
    | element_type
        { $$ = new yy.ElementSelector($1, null); $$.range = @$; }
    | '|' IDENT
        { $$ = new yy.ElementSelector(null, $2); $$.range = @$; }
    ;

element_type
    : IDENT
        { $$ = $1; }
    | '*'
        { $$ = $1; }
    ;

attribute_selector
    : '[' junk attribute_selector_body ']'
        { $$ = $3; $$.range = @$; }
    ;

attribute_selector_body
    : attribute_selector_body_name
        { $$ = new yy.AttributeSelector($1, null, null); }
    | attribute_selector_body_name attribute_selector_body_operator junk string_or_ident junk
        { $$ = new yy.AttributeSelector($1, $2, $4); }
    ;

attribute_selector_body_name
    : element_name junk
        { $$ = $1; }
    ;

attribute_selector_body_operator
    : '='
        { $$ = $1; }
    | '*' '='
        { $$ = '*='; }
    | '|='
        { $$ = $1; }
    | '^' '='
        { $$ = '^='; }
    | '$' '='
        { $$ = '$='; }
    | SEL_SIBLING '='
        { $$ = '~='; }
    ;

pseudo_selector
    : '::' IDENT
        { $$ = new yy.PseudoElementSelector($2); $$.range = @$; }
    | NTH_FUNC '(' junk nth ')'
        { $$ = new yy.NthSelector($1.substr(1), $4); $$.range = @$; }
    | ':' NOT '(' junk selector_list ')'
        { $$ = new yy.NotSelector($5); $$.range = @$; }
    | ':' FUNCTION_IDENT junk expr ')'
        { $$ = new yy.PseudoSelectorFunction($2.substring(0, $2.length - 1), $4); $$.range = @$; }
    | PSEUDO_CLASS
        { $$ = new yy.PseudoClassSelector($1.substr(1)); $$.range = @$; }
    | ':' IDENT
        { $$ = new yy.PseudoClassSelector($2); $$.range = @$; }
    ;

nth
    : n_val '+' junk integer junk
        { $4.applySign($2); $$ = new yy.LinearFunction($1, $4); $$.range = @$; }
    | n_val '-' junk integer junk
        { $4.applySign($2); $$ = new yy.LinearFunction($1, $4); $$.range = @$; }
    | n_val
        { $$ = $1; }
    | ODD junk
        { $$ = 'odd'; }
    | EVEN junk
        { $$ = 'even'; }
    | signed_integer junk
        { $$ = new yy.LinearFunction(null, $1); $$.range = @$; }
    ;

n_val
    : signed_integer N junk
        { $$ = new yy.NValue($1); $$.range = @$; }
    | N junk
        { $$ = new yy.NValue(1); $$.range = @$; }
    ;

declaration_list
    : declaration_list ';' junk declaration
        { $$ = $1; $$.push($4); }
    | declaration_list ';' junk
        { $$ = $1; }
    | declaration
        { $$ = [$1]; }
    |
        { $$ = []; }
    ;

declaration
    : declaration_body optional_important optional_slash_nine
        { $$ = $1; Object.assign($$, $2, $3); }
    ;

declaration_body
    : IE_FILTER junk
        { $$ = new yy.IEFilter($1); $$.range = @$; }
    | declaration_head expr
        { $$ = new yy.Declaration($1, $2); $$.range = @$; }
    | declaration_head
        { $$ = new yy.Declaration($1, null); $$.range = @$; }
    ;

declaration_head
    : declaration_name junk ':' junk
        { $$ = $1; }
    ;

declaration_name
    : '*' IDENT
        { $$ = $1 + $2; }
    | IDENT
        { $$ = $1; }
    ;

optional_important
    : '!' junk IMPORTANT junk
        { $$ = {important: true}; }
    |
        { $$ = {}; }
    ;

optional_slash_nine
    : SLASH_NINE junk
        { $$ = {slashNine: true}; }
    | SLASH_ZERO junk
        { $$ = {slashZero: true}; }
    |
        { $$ = {}; }
    ;


expr
    : term junk expr_chain
        { $$ = new yy.Expression([[null, $1]].concat($3)); $$.range = @$; }
    ;

expr_chain
    : expr_chain ',' junk term junk
        { $$ = $1; $$.push([$2, $4]); }
    | expr_chain '/' junk term junk
        { $$ = $1; $$.push([$2, $4]); }
    | expr_chain term junk
        { $$ = $1; $$.push([null, $2]); }
    |
        { $$ = []; }
    ;

term
    : uri
        { $$ = $1; }
    | unit
        { $$ = $1; }
    | string
        { $$ = $1; }
    | TO
        { $$ = $1; }
    | UNICODE_RANGE
        { $$ = $1; }
    | IDENT
        { $$ = $1; }
    | hexcolor
        { $$ = $1; }
    | custom_ident
        { $$ = $1; }
    | IE_EXPRESSION
        { $$ = $1; }
    ;

uri
    : URL_FULL
        { $$ = new yy.URI($1.substr(4, $1.length - 5)); $$.range = @$; }
    ;

unit
    : num unit_dim
        {
            if ($2 !== null) {
                $$ = new yy.Dimension($1, $2); $$.range = @$;
            } else {
                $$ = $1;
            }
        }
    | '(' junk math_expr ')'
        { $$ = $3; }
    | CALC '(' junk math_expr ')'
        { $$ = new yy.Func($1, $4, null); $$.range = @$; }
    | attr_expression
        { $$ = $1; }
    | function
        { $$ = $1; }
    ;

function
    : FUNCTION_IDENT junk expr ')'
        { $$ = new yy.Func($1.substr(0, $1.length - 1), $3); $$.range = @$; }
    | FUNCTION_IDENT junk ')'
        { $$ = new yy.Func($1.substr(0, $1.length - 1), null); $$.range = @$; }
    ;

unit_dim
    : IDENT
        { $$ = $1; }
    | '%'
        { $$ = '%'; }
    |
        { $$ = null; }
    ;


attr_expression
    : ATTR '(' junk element_name junk attr_expression_unit ')'
        {
            $$ = new yy.Func(
                'attr',
                $6
                    ? new yy.Expression([[null, $4]].concat($6))
                    : $4
            );
        }
    ;

attr_expression_unit
    : IDENT junk attr_expression_fallback junk
        { $$ = [[null, $1]].concat($3); }
    | ',' junk unit junk
        { $$ = [[',', $3]]; }
    |
        { $$ = null; }
    ;

attr_expression_fallback
    : ',' junk unit
        { $$ = [[',', $3]]; }
    |
        { $$ = []; }
    ;

math_expr
    : math_expr '+' junk math_product junk
        { $$ = new yy.MathSum($1, $2, $4); $$.range = @$; }
    | math_expr '-' junk math_product junk
        { $$ = new yy.MathSum($1, $2, $4); $$.range = @$; }
    | math_product junk
        { $$ = $1; }
    ;

math_product
    : math_product junk '*' junk unit
        { $$ = new yy.MathProduct($1, $3, $5); $$.range = @$; }
    | math_product junk '/' junk unit
        { $$ = new yy.MathProduct($1, $3, $5); $$.range = @$; }
    | unit
        { $$ = $1; }
    ;


hexcolor
    : HEX_SHORT
        { $$ = new yy.HexColor($1); $$.range = @$; }
    | HEX_LONG
        { $$ = new yy.HexColor($1); $$.range = @$; }
    | HEX_LONG_ALPHA
        { $$ = new yy.HexColor($1); $$.range = @$; }
    | HEX_SHORT_ALPHA
        { $$ = new yy.HexColor($1); $$.range = @$; }
    ;

custom_ident
    : '[' junk custom_ident_chain ']'
        { $$ = new yy.CustomIdent($3); $$.range = @$; }
    ;

custom_ident_chain
    : IDENT junk custom_ident_chain
        { $$ = [$1].concat($3); }
    | IDENT junk
        { $$ = [$1]; }
    ;


signed_integer
    : '+' integer
        { $$ = $2; }
    | '-' integer
        { $$ = $2; $$.applySign($1); }
    | integer
        { $$ = $1; }
    ;

integer
    : INTEGER
        { $$ = new yy.Number($1); $$.range = @$; }
    | SCINOT
        {
            const parts = $1.split('e');
            const base = parseInt(parts[0], 10);
            const exp = /[^\d]/.exec(parts[1][0]) ? parts[1].substr(1) : parts[1];
            const sign = parts[1][0] === '-' ? -1 : 1;
            $$ = new yy.Number(base * Math.pow(10, sign * parseInt(exp, 10)));
            $$.range = @$;
        }
    ;

num
    : signed_integer
        { $$ = $1; }
    | '+' FLOAT
        { $$ = new yy.Number($2); $$.range = @$; $$.applySign($1); }
    | '-' FLOAT
        { $$ = new yy.Number($2); $$.range = @$; $$.applySign($1); }
    | FLOAT
        { $$ = new yy.Number($1); $$.range = @$; }
    ;
