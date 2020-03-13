### What does the parser do?
The parser takes strings inputted by the user, and converts them to a filter object, which can be used to check if a card matches all of the filters within. This can include things like the card's name, mana cost, oracle text, tags, etc.

### The Basic Steps
The parser runs through text in 3 basic steps:
1. Tokenize input
2. Verify Tokens
3. Generate Tree

We can take a look at `generateFilters(filterText)` to see how those functions are called in order.
```javascript
function generateFilters(filterText) {
  let tokens = [];

  if (tokenizeInput(filterText, tokens)) {
    if (verifyTokens(tokens)) {
      filters = [parseTokens(tokens)];
      addUrlToFilter(filterText);

      //TODO: generate a filter string, and return better errors to user
      document.getElementById('filterarea').innerHTML = '<p><em>Filter Applied.</em></p>';
      updateCubeList();
    } else {
      document.getElementById('filterarea').innerHTML = '<p class="invalid-filter"><em>Invalid Filter String.</em></p>';
    }
  } else {
    document.getElementById('filterarea').innerHTML = '<p class="invalid-filter"><em>Invalid Filter String.</em></p>';
  }
}
```
first, we call `tokenizeInput(filterText)`, to take care of tokenizing the input. That function will return a falsy value if it fails somewhere. Next, we check if verify tokens returns true or false. Third, we call `parseTokens(tokens)` to return the final tree. Because our filtering processing requires everything to be in an array, we wrap the result in an outer array, in case the filter object only has one filter, and isn't wrapped in an array!

### tokenizing the input
`tokenizeInput()` is a recursive function that passes an instance of (tokens) around with it. Tokens is a 1D array containing each token that tokenize input finds. Due to recent improvement, it could now probably be implemented as a for loop or while loop to avoid recursion.

In short, tokenizeInput does the following to the filter string, depending on what characters it encounters
```
if string begins with '('
  check if there is a ')'
  push {type: 'open'} to Tokens
  call filterText with rest of string
if string begins with ')'
  push {type: 'close' to Tokens}
  call filterText with rest of string
```
We check for parentheses first, since they have a very special meaning. We ideally only want to tokenize parentheses with closing statements, so that someone typing simply '(' will find cards that have '(' in their name. This functionality is probably never relevant, but better than other fail cases. To call filterText with "rest of string" means to slice off the character(s) we just processed, and call filterText with remaining string
```
if string begins with 'or' and only 'or' //i.e. not 'origin' or similar
  push {type: 'or'}
  call filterText with rest of string
if string begins with 'and' and only 'and'
  call filterText with rest of string
```
We push a token of `type: 'or'` if there is an `OR` encountered. This will be explained further once we generate the tree. For now, we just ignore the word `and`, since it is implied by the lack of a word between terms. This has the slightly undesirable effect that people can just put and wherever they want and it won't do anything to the resulting filter object, but we don't make any reference to the word `and` in our syntax guide. I just wanted to include this for people familiar with the syntax of other websites. Adding `and` would not add any expressive power to our filter language.
```
//create a generic token object
let token = {
  not: false,
  type: 'token'
}
if string begins with '-'
  set token.not = true
  remove the '-'
  continue
//split off the first term based only on spaces
//check if there's an operator i.e. '>' '<' '=' etc.
//find the category (text before operator)
```
If we have not encountered any of the above 'special' operators, `and`, `(`, etc. then we must have encountered a filter. This could be any number of things, like the name of a card, it's oracle text, etc. In general, filters have operators. In `pow>7`, the operator would be `>`. In `o:draw` the operator would be ':'. `name` is something of a special case, since it is the only one that appears as a plain string, and as such doesn't have an operator. For example the string `bob` should search for cards whose name contains 'bob'. To this end, the first thing we check for is if the token is going to be negated by `-`. If it is, we simply set the not flag in the token, then remove the `-` character, then continue on to find the opeartor:
```javascript
let firstTerm = filterText.split(' ', 1);

//find operand
let operand = firstTerm[0].match(operators_re);
if(operand) {
  operand = operand[0];
  token.operand = operand;
} else {
  token.operand = 'none';
}
```
We split off the first term based only on where the next space character is. (we'll be using that a lot from here on out). Next, we attempt to find an operator in that first term. Next we find the category: i.e. `pow` in `pow<7`
```javascript
//find category
let category = '';
if (token.operand == 'none') {
  category = 'name';
} else {
  category = firstTerm[0].split(operators_re)[0];
}
```
If there is no operand, we know the category must be `name`.
Next there are two cases where quotation marks might be involved, in the first they are the beginning of the string, and in the second they are at the beginning of the argument, i.e. `"draw a card"` in `o:"draw a card"`.
```javascript
//find arg value
  //if there are two quotes, and first char is quote
  if (filterText.indexOf('"') == 0 && filterText.split('"').length > 2) {
    //grab the quoted string, ignoring escaped quotes
    let quotes_re = new RegExp('"([^"\\\\]*(?:\\\\.[^"\\\\]*)*)"');
    //replace escaped quotes with plain quotes
    token.arg = filterText.match(quotes_re)[1];
    parens = true;
  } else if (firstTerm[0].search(quoteOp_re) > -1 && filterText.split('"').length > 2) {
    //check if there is a paren after an operator
    //TODO: make sure the closing paren isn't before the operator
    let quotes_re = new RegExp('"([^"\\\\]*(?:\\\\.[^"\\\\]*)*)"');
    token.arg = filterText.match(quotes_re)[1];
    parens = true;
  }
```
These two if statements handle that very well, matching all text inside quotes ignoring escaped quotes. They also ensure there is a closing quote before running the regex. Then we just check the other two cases, i.e. it's a name, or a non-quoted argument:
```javascript
else if (token.operand != 'none'){
  token.arg = firstTerm[0].slice(category.length + token.operand.length).split(')')[0];
} else {
  token.arg = firstTerm[0].split(')')[0];
}
```
In a future update, we should probably slice off the operand and category before processing, to reduce it to 2 cases, quoted or non quoted string.
```javascript
filterText = filterText.slice((token.operand == 'none' ? (token.arg.length) : (token.arg.length + token.operand.length + category.length)) + (parens ? 2 : 0));
```
We'll then standardize the category and argument:
```javascript
Next we filter away the operand, argument, and category, or in other words the entire expression/filter we just parsed.
if (!categoryMap.has(category)) {
  return false;
}


token.category = categoryMap.get(category);
token.arg = simplifyArg(token.arg, token.category);
```
And the last part of the function simplify pushes the resulting token to the array, and calls filterText with the rest of the string.

### simplifying the arguments:
This function is pretty self explanatory, other than it's helper function:

### Parse Mana cost
The only important thing to note besides the comments is that we transform symbols such as `{2/g}` to `{2-g}`, since our filenames for the mana cost symbols can't have `/`. Since we compare against parsed-mana-cost, this is the best way to do it!
```javascript
function parseManaCost (cost) {
  let res = []; //resulting array
  //loop through the mana cost string allowable characters are:
  //w, {w}, u, {u}, etc.
  //1-20, or {1}-{20}
  //{w/g}, {2/g}, {g/p} for hybrid, 2 mana hybrid, and phyrexian respectively
  //c and s for colorless and snow
  //x, y, and z for optional number costs.
  for (let i = 0; i < cost.length; i++) {
    //handle the cases where argument is wrapped in brackets
    //TODO: fix the case where there is no closing bracket...
    if (cost[i] == '{') {
      //create a substring with the 3 inner characters.
      let str = cost.slice(i+1, i+4).toLowerCase();

      //if the string is one of the 5 phyrexian mana symbols:
      if (str.search(/[wubrg]\/p/) > -1) {
        res.push(cost[i+1] + '-p');
        i = i+4;
      }
      //if the string is a {2/C} hybrid
      else if (str.search(/2\/[wubrg]/) > -1) {
        res.push('2-' + cost[i+3]);
        i = i+4;
      }
      //if the string is a {a/b} hybrid cost
      else if (str.search(/[wubrg]\/[wubrg]/) > -1) {
        let symbol = cost[i+1] + '-' + cost[i+3];
        if (hybridMap.has(symbol)) {
          symbol = hybridMap.get(symbol);
        }
        res.push(symbol);
        i = i+4;
      }
      //if the string is a single character i.e. {w}, {c}, etc.
      else if (str.search(/^[wubrgscxyz]}/) > -1 ) {
        res.push(cost[i+1]);
        i = i+2;
      }
      //if the string is a 1 or 2 digit number i.e. {1}, {17}, etc.
      else if (str.search(/^[0-9]+}/) > -1) {
        let num = str.match(/[0-9]+/)[0];
        if (num.length <= 2) {
          res.push(num);
        }
        i = i + num.length + 1;
      }
    }
    //if the character is a lone symbol i.e. w, u, c, etc.
    else if (cost[i].search(/[wubrgscxyz]/) > -1) {
      res.push(cost[i]);
    }
    //if the character is a number, match a 1 or 2 digit number
    else if (cost[i].search(/[0-9]/) > -1) {
      let num = cost.slice(i).match(/[0-9]+/)[0];
      if (num.length <= 2) {
        res.push(num);
      } else {
        return false;
      }
    } else {
      return false;
    }
  }
  return res;
}
```

### verify tokens
Next we come to verifying tokens. This is pretty straight forward. First we check if every open bracket has a closed bracket and so on. Next we make sure every or is surrounded by other tokens, and doesn't have a close or open bracket on the wrong side, then we check the arguments of the tokens, where they are constrained to certain values. There's some annoying regex to verify mana, but it's not too bad.

### parseTokens aka generate the tree
Lastly, we call parse tokens to generate our filter object. Here's an example of some filter objects based on simple strings:  
`t:creature t:artifact`
```javascript
[
  [
    0: {type: 'token', operand: ':', arg:'creature', not:'false', category:'type'}
    1: {type: 'token', operand: ':', arg:'artifact', not:'false', category:'type'}
  ]
]
```

`t:creature (t:artifact or t:enchantment)`
```javascript
[
  [
    0: {type: 'token', operand: ':', arg:'creature', not:'false', category:'type'}
    1: [
      [
        0: {type: 'token', operand: ':', arg:'artifact', not:'false', category:'type'}
        1: {type: 'token', operand: ':', arg:'enchatment', not:'false', category:'type'}
        type: 'or'
      ]
    ]
  ]
]
```

Does this look horrible? Don't worry, it is! Luckily a human will never have to read these objects outside of debugging. As you can see in the second example, sometimes the filter generates extra levels of nesting. This is okay, since we simply traverse down whenever we find an array while applying the filter, but we'll get to that later. Right now, we're going to talk about generating these. I believe this technique is known as iterative descent parsing, but I'm not sure if that's exactly how I've implemented it. Luckily, the implementation is very short! The things to remember are that an array in the filter object can never have more than two indexes (not including the type: 'or', if it exists).
```javascript
const parseTokens = (tokens) => {
  let peek = () => tokens[0];
  let consume = peek;

  let result = [];
  //if we encounter an or, move on, since we've dealt with it in the previous step.
  if (peek().type == 'or') {
    return parseTokens(tokens.slice(1));
  }
  //encountered open parentheses
  if (peek().type == 'open') {
    let end = findClose(tokens);
    if(end < tokens.length - 1 && tokens[end + 1].type == 'or') result.type = 'or';
    result.push(parseTokens(tokens.slice(1, end)));
    if(tokens.length > end + 1) result.push(parseTokens(tokens.slice(end+1)));
    return result;
  }
  //encountered a token
  else if (peek().type == 'token') {
    if (tokens.length == 1) {
      return consume();
    } else {
      if(tokens[1].type == 'or') result.type = 'or';
      result.push(consume());
      result.push(parseTokens(tokens.slice(1)));
      return result;
    }
  }
}
```
For my own sanity, and hopefully the sanity of anyone revisiting this code later, I've simply made the helper functions peek and consume to get the current element, in a way that makes the code more clear to me. In reality, it's very possible consume() should also slice off the first element of the array, to make the code a bit cleaner and more concise.
```javascript  
//encountered open parentheses
if (peek().type == 'open') {
  let end = findClose(tokens);
  if(end < tokens.length - 1 && tokens[end + 1].type == 'or') result.type = 'or';
  result.push(parseTokens(tokens.slice(1, end)));
  if(tokens.length > end + 1) result.push(parseTokens(tokens.slice(end+1)));
  return result;
}
```
Every single time we call this function, we should return either a single token, or an array. The termination of the recursion will always be as a token. If we encounter parentheses, the code above will push everything inside the parentheses to the first element in our returned array, and everything after the parentheses block to the second element.
```javascript
//encountered a token
else if (peek().type == 'token') {
  if (tokens.length == 1) {
    return consume();
  } else {
    if(tokens[1].type == 'or') result.type = 'or';
    result.push(consume());
    result.push(parseTokens(tokens.slice(1)));
    return result;
  }
}
```
Meanwhile if we encounter a token, there's a chance that it's the terminating point for the recursion. If that's the case, that token will be the only thing in the tokens array, so we should just return it. Otherwise, as above, we should return an array where the first element is this token, and the second array is the return value of this function called with everything after it, which could be another array, or a token if there's only one token left.
### Conclusion
I know there are many things to be improved here still, but hopefully this document gives people an idea of how they can contribute to the parser!
