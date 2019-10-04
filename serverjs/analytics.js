/* used in the now abandoned GetTokens attempt to get token counts from rules text. If  
var Small = {
  'zero': 0,
  'one': 1,
  'two': 2,
  'three': 3,
  'four': 4,
  'five': 5,
  'six': 6,
  'seven': 7,
  'eight': 8,
  'nine': 9,
  'ten': 10,
  'eleven': 11,
  'twelve': 12,
  'thirteen': 13,
  'fourteen': 14,
  'fifteen': 15,
  'sixteen': 16,
  'seventeen': 17,
  'eighteen': 18,
  'nineteen': 19,
  'twenty': 20,
};

var a, n, g;

function text2num(a) {
  return Small[a];  
}
*/
function CheckContentsEqualityOfArray(target, candidate)
{
  var isValid = candidate.length == target.length;
  if (!isValid)                    
    return false;

  for (idx = 0;idx<target.length;idx++){
    if (!candidate.includes(target[idx]))
    {
      isValid = false;
      break;
    }                      
  }
  return isValid;
}

function GetColorCat(type, colors) {
  if (type.toLowerCase().includes('land')) {
    return 'l';
  } else if (colors.length == 0) {
    return 'c';
  } else if (colors.length > 1) {
    return 'm';
  } else if (colors.length == 1) {
    switch (colors[0]) {
      case "W":
        return 'w';
        break;
      case "U":
        return 'u';
        break;
      case "B":
        return 'b';
        break;
      case "R":
        return 'r';
        break;
      case "G":
        return 'g';
        break;
      case "C":
        return 'c';
        break;
    }
  }
}

function GetColorIdentity(colors) {
  if (colors.length == 0) {
    return 'Colorless';
  } else if (colors.length > 1) {
    return 'Multicolored';
  } else if (colors.length == 1) {
    switch (colors[0]) {
      case "W":
        return 'White';
        break;
      case "U":
        return 'Blue';
        break;
      case "B":
        return 'Black';
        break;
      case "R":
        return 'Red';
        break;
      case "G":
        return 'Green';
        break;
      case "C":
        return 'Colorless';
        break;
    }
  }
}

var methods = {
  GetTypeByColor: function(cards, carddb) {
    var TypeByColor = {
      Creatures: {
        White: 0,
        Blue: 0,
        Black: 0,
        Red: 0,
        Green: 0,
        Colorless: 0,
        Multi: 0,
        Total: 0
      },
      Enchantments: {
        White: 0,
        Blue: 0,
        Black: 0,
        Red: 0,
        Green: 0,
        Colorless: 0,
        Multi: 0,
        Total: 0
      },
      Lands: {
        White: 0,
        Blue: 0,
        Black: 0,
        Red: 0,
        Green: 0,
        Colorless: 0,
        Multi: 0,
        Total: 0
      },
      Planeswalkers: {
        White: 0,
        Blue: 0,
        Black: 0,
        Red: 0,
        Green: 0,
        Colorless: 0,
        Multi: 0,
        Total: 0
      },
      Instants: {
        White: 0,
        Blue: 0,
        Black: 0,
        Red: 0,
        Green: 0,
        Colorless: 0,
        Multi: 0,
        Total: 0
      },
      Sorceries: {
        White: 0,
        Blue: 0,
        Black: 0,
        Red: 0,
        Green: 0,
        Colorless: 0,
        Multi: 0,
        Total: 0
      },
      Artifacts: {
        White: 0,
        Blue: 0,
        Black: 0,
        Red: 0,
        Green: 0,
        Colorless: 0,
        Multi: 0,
        Total: 0
      },
      Total: {
        White: 0,
        Blue: 0,
        Black: 0,
        Red: 0,
        Green: 0,
        Colorless: 0,
        Multi: 0,
        Total: 0
      }
    };
    cards.forEach(function(card, index) {
      card.details = carddb.cardFromId(card.cardID);
    });
    cards.forEach(function(card, index) {
      var type = {};
      if (card.details.type.toLowerCase().includes('creature')) {
        type = TypeByColor['Creatures'];
      } else if (card.details.type.toLowerCase().includes('enchantment')) {
        type = TypeByColor['Enchantments'];
      } else if (card.details.type.toLowerCase().includes('land')) {
        type = TypeByColor['Lands'];
      } else if (card.details.type.toLowerCase().includes('planeswalker')) {
        type = TypeByColor['Planeswalkers'];
      } else if (card.details.type.toLowerCase().includes('instant')) {
        type = TypeByColor['Instants'];
      } else if (card.details.type.toLowerCase().includes('sorcery')) {
        type = TypeByColor['Sorceries'];
      } else if (card.details.type.toLowerCase().includes('artifact')) {
        type = TypeByColor['Artifacts'];
      }

      var colorCategory = GetColorCat(card.details.type, card.colors);
      if (colorCategory == 'l') {
        if (card.details.colors.length == 0) {
          type['Colorless'] += 1;
          type['Total'] += 1;
          TypeByColor['Total']['Colorless'] += 1;
          TypeByColor['Total']['Total'] += 1;
        } else if (card.details.colors.length > 1) {
          type['Multi'] += 1;
          type['Total'] += 1;
          TypeByColor['Total']['Multi'] += 1;
          TypeByColor['Total']['Total'] += 1;
        } else {
          switch (card.details.colors[0]) {
            case 'W':
              type['White'] += 1;
              type['Total'] += 1;
              TypeByColor['Total']['White'] += 1;
              TypeByColor['Total']['Total'] += 1;
              break;
            case 'U':
              type['Blue'] += 1;
              type['Total'] += 1;
              TypeByColor['Total']['Blue'] += 1;
              TypeByColor['Total']['Total'] += 1;
              break;
            case 'B':
              type['Black'] += 1;
              type['Total'] += 1;
              TypeByColor['Total']['Black'] += 1;
              TypeByColor['Total']['Total'] += 1;
              break;
            case 'R':
              type['Red'] += 1;
              type['Total'] += 1;
              TypeByColor['Total']['Red'] += 1;
              TypeByColor['Total']['Total'] += 1;
              break;
            case 'G':
              type['Green'] += 1;
              type['Total'] += 1;
              TypeByColor['Total']['Green'] += 1;
              TypeByColor['Total']['Total'] += 1;
              break;
            case 'C':
              type['Colorless'] += 1;
              type['Total'] += 1;
              TypeByColor['Total']['Colorless'] += 1;
              TypeByColor['Total']['Total'] += 1;
              break;
          }
        }
      } else {
        switch (colorCategory) {
          case 'w':
            type['White'] += 1;
            type['Total'] += 1;
            TypeByColor['Total']['White'] += 1;
            TypeByColor['Total']['Total'] += 1;
            break;
          case 'u':
            type['Blue'] += 1;
            type['Total'] += 1;
            TypeByColor['Total']['Blue'] += 1;
            TypeByColor['Total']['Total'] += 1;
            break;
          case 'b':
            type['Black'] += 1;
            type['Total'] += 1;
            TypeByColor['Total']['Black'] += 1;
            TypeByColor['Total']['Total'] += 1;
            break;
          case 'r':
            type['Red'] += 1;
            type['Total'] += 1;
            TypeByColor['Total']['Red'] += 1;
            TypeByColor['Total']['Total'] += 1;
            break;
          case 'g':
            type['Green'] += 1;
            type['Total'] += 1;
            TypeByColor['Total']['Green'] += 1;
            TypeByColor['Total']['Total'] += 1;
            break;
          case 'm':
            type['Multi'] += 1;
            type['Total'] += 1;
            TypeByColor['Total']['Multi'] += 1;
            TypeByColor['Total']['Total'] += 1;
            break;
          case 'c':
            type['Colorless'] += 1;
            type['Total'] += 1;
            TypeByColor['Total']['Colorless'] += 1;
            TypeByColor['Total']['Total'] += 1;
            break;
          default:
        }
      }
    });
    return TypeByColor;
  },
  GetColorCounts: function(cards, carddb) {
    var ColorCounts = {
      White: 0,
      Blue: 0,
      Black: 0,
      Red: 0,
      Green: 0,
      Azorius: 0,
      Dimir: 0,
      Rakdos: 0,
      Gruul: 0,
      Selesnya: 0,
      Orzhov: 0,
      Izzet: 0,
      Golgari: 0,
      Boros: 0,
      Simic: 0,
      Jund: 0,
      Bant: 0,
      Grixis: 0,
      Naya: 0,
      Esper: 0,
      Jeskai: 0,
      Mardu: 0,
      Sultai: 0,
      Temur: 0,
      Abzan: 0,
      NonWhite: 0,
      NonBlue: 0,
      NonBlack: 0,
      NonRed: 0,
      NonGreen: 0,
      FiveColor: 0
    };
    cards.forEach(function(card, index) {
      card.details = carddb.cardFromId(card.cardID);
    });
    cards.forEach(function(card, index) {
      if (card.details.colors.length === 2) {
        if (card.details.colors.includes('W') && card.details.colors.includes('U')) {
          ColorCounts.Azorius += 1;
          ColorCounts.White += 1;
          ColorCounts.Blue += 1;
        } else if (card.details.colors.includes('B') && card.details.colors.includes('U')) {
          ColorCounts.Dimir += 1;
          ColorCounts.Black += 1;
          ColorCounts.Blue += 1;
        } else if (card.details.colors.includes('B') && card.details.colors.includes('R')) {
          ColorCounts.Rakdos += 1;
          ColorCounts.Black += 1;
          ColorCounts.Red += 1;
        } else if (card.details.colors.includes('G') && card.details.colors.includes('R')) {
          ColorCounts.Gruul += 1;
          ColorCounts.Green += 1;
          ColorCounts.Red += 1;
        } else if (card.details.colors.includes('W') && card.details.colors.includes('G')) {
          ColorCounts.Selesnya += 1;
          ColorCounts.Green += 1;
          ColorCounts.White += 1;
        } else if (card.details.colors.includes('W') && card.details.colors.includes('B')) {
          ColorCounts.Orzhov += 1;
          ColorCounts.White += 1;
          ColorCounts.Black += 1;
        } else if (card.details.colors.includes('R') && card.details.colors.includes('U')) {
          ColorCounts.Izzet += 1;
          ColorCounts.Red += 1;
          ColorCounts.Blue += 1;
        } else if (card.details.colors.includes('G') && card.details.colors.includes('B')) {
          ColorCounts.Golgari += 1;
          ColorCounts.Green += 1;
          ColorCounts.Black += 1;
        } else if (card.details.colors.includes('W') && card.details.colors.includes('R')) {
          ColorCounts.Boros += 1;
          ColorCounts.White += 1;
          ColorCounts.Red += 1;
        } else if (card.details.colors.includes('G') && card.details.colors.includes('U')) {
          ColorCounts.Simic += 1
          ColorCounts.Green += 1;
          ColorCounts.Blue += 1;
        }
      } else if (card.colors.length == 3) {
        if (card.details.colors.includes('G') && card.details.colors.includes('B') && card.details.colors.includes('R')) {
          ColorCounts.Jund += 1;
          ColorCounts.Green += 1;
          ColorCounts.Black += 1;
          ColorCounts.Red += 1;
        } else if (card.details.colors.includes('G') && card.details.colors.includes('U') && card.details.colors.includes('W')) {
          ColorCounts.Bant += 1;
          ColorCounts.Green += 1;
          ColorCounts.White += 1;
          ColorCounts.Blue += 1;
        } else if (card.details.colors.includes('U') && card.details.colors.includes('B') && card.details.colors.includes('R')) {
          ColorCounts.Grixis += 1;
          ColorCounts.Blue += 1;
          ColorCounts.Black += 1;
          ColorCounts.Red += 1;
        } else if (card.details.colors.includes('G') && card.details.colors.includes('W') && card.details.colors.includes('R')) {
          ColorCounts.Naya += 1;
          ColorCounts.Green += 1;
          ColorCounts.White += 1;
          ColorCounts.Red += 1;
        } else if (card.details.colors.includes('U') && card.details.colors.includes('B') && card.details.colors.includes('W')) {
          ColorCounts.Esper += 1;
          ColorCounts.Blue += 1;
          ColorCounts.Black += 1;
          ColorCounts.White += 1;
        } else if (card.details.colors.includes('W') && card.details.colors.includes('U') && card.details.colors.includes('R')) {
          ColorCounts.Jeskai += 1;
          ColorCounts.Blue += 1;
          ColorCounts.White += 1;
          ColorCounts.Red += 1;
        } else if (card.details.colors.includes('W') && card.details.colors.includes('B') && card.details.colors.includes('R')) {
          ColorCounts.Mardu += 1;
          ColorCounts.White += 1;
          ColorCounts.Black += 1;
          ColorCounts.Red += 1;
        } else if (card.details.colors.includes('G') && card.details.colors.includes('B') && card.details.colors.includes('U')) {
          ColorCounts.Sultai += 1;
          ColorCounts.Green += 1;
          ColorCounts.Black += 1;
          ColorCounts.Blue += 1;
        } else if (card.details.colors.includes('G') && card.details.colors.includes('U') && card.details.colors.includes('R')) {
          ColorCounts.Temur += 1;
          ColorCounts.Green += 1;
          ColorCounts.Blue += 1;
          ColorCounts.Red += 1;
        } else if (card.details.colors.includes('G') && card.details.colors.includes('B') && card.details.colors.includes('W')) {
          ColorCounts.Abzan += 1;
          ColorCounts.Green += 1;
          ColorCounts.Black += 1;
          ColorCounts.White += 1;
        }
      } else if (card.colors.length == 4) {
        if (!card.details.colors.includes('W')) {
          ColorCounts.NonWhite += 1;
          ColorCounts.Green += 1;
          ColorCounts.Black += 1;
          ColorCounts.Blue += 1;
          ColorCounts.Red += 1;
        } else if (!card.details.colors.includes('U')) {
          ColorCounts.NonBlue += 1;
          ColorCounts.Green += 1;
          ColorCounts.Black += 1;
          ColorCounts.White += 1;
          ColorCounts.Red += 1;
        } else if (!card.details.colors.includes('B')) {
          ColorCounts.NonBlack += 1;
          ColorCounts.Green += 1;
          ColorCounts.White += 1;
          ColorCounts.Blue += 1;
          ColorCounts.Red += 1;
        } else if (!card.details.colors.includes('R')) {
          ColorCounts.NonRed += 1;
          ColorCounts.Green += 1;
          ColorCounts.Black += 1;
          ColorCounts.White += 1;
          ColorCounts.Blue += 1;
        } else if (!card.details.colors.includes('G')) {
          ColorCounts.NonGreen += 1;
          ColorCounts.Black += 1;
          ColorCounts.White += 1;
          ColorCounts.Blue += 1;
          ColorCounts.Red += 1;
        }
      } else if (card.details.colors.length == 5) {
        ColorCounts.FiveColor += 1;
        ColorCounts.Green += 1;
        ColorCounts.Black += 1;
        ColorCounts.White += 1;
        ColorCounts.Blue += 1;
        ColorCounts.Red += 1;
      }
    });
    return ColorCounts;
  },GetTokens: function(cards, carddb){
    
    var mentionedTokens = [];

    cards.forEach(function(card, index) {
      card.details = carddb.cardFromId(card.cardID);
    });

    cards.forEach(function(card,index2)
    {
      if (card.details.oracle_text != null){
        if ( card.details.oracle_text.includes(' token')){
          //find the ability that generates the token to reduce the amount of text to get confused by.
          var abilities = card.details.oracle_text.split("\n");
          for(abilityIndex = 0; abilityIndex<abilities.length;abilityIndex++){
            var ability = abilities[abilityIndex];
            if (ability.includes(' token'))
            {
              var re = new RegExp ("[Cc]reates? ([Xa-z]+(?: number of)?) ?(\\d\\/\\d)? ?(?:((?:colorless|red|green|white|black|blue| and )+))?([\\w ',]+)");
              var result = re.exec(ability);
              /* a start on figuring out how many of each token is required. May appear in future version.
              var tokenCount = 0;
              switch (result[1]){
                case 'a':
                  tokenCount = 1;
                  break;
                case 'a number of':
                case 'X':
                  tokenCount = 5; //just taken out of the air, could be anything really
                  break;
                default:
                  tokenCount = text2num(result[1]);
                  break;
              }
              var tokenMinimumCount = tokenCount;
              */
              var tokenPowerAndToughness = result[2];
              var tokenColor = [];
              if (result[3])
              {
                var colorStrings =result[3].trim().split(' ');
                colorStrings.forEach(rawColor =>{
                    switch (rawColor.toLowerCase())
                    {
                      case ("red"):
                        tokenColor.push('R');
                        break;
                      case ("white"):
                        tokenColor.push('W');
                        break;
                      case ("green"):
                        tokenColor.push('G');
                        break;
                      case ("black"):
                        tokenColor.push('B');
                        break;
                      case ("blue"):
                        tokenColor.push('U');
                        break;
                    }
                });
              }
              var tokenName = "";
              var tokenStringIndex = result[4].indexOf('token');
              var tokenSubAndSuperType = result[4].substr(0,tokenStringIndex).trim();           
              var tokenTypes = [];
              var typeStrings =tokenSubAndSuperType.trim().split(' ');

              typeStrings.forEach(element => {
                switch(element)
                {
                  case (""):
                    break;
                  case 'enchantment':
                  case 'artifact':
                  case 'creature':
                  case 'legendary':
                  case 'Aura':
                    tokenTypes.push(element);
                    break;

                  default:
                    if (tokenName.length > 0)
                      tokenName +=' ';
                    tokenName += element;
                    tokenTypes.push(element.toLowerCase());
                    break;
                }
              });
          
              if (tokenName == "")
              {
                if (result[4].includes("a copy of"))
                {
                  if (card.details.tokens)
                  {
                    mentionedTokens.push({tokenId:card.details.tokens[0],sourceCardId:card.details._id});
                    continue;
                  }
                  tokenName = "Copy"                  
                  tokenTypes = [""];
                }
              }
                          
              if (tokenName != "") //can't find a token with no name, most likely a token that could be a copy of any creature.
              {  
                var tokenPower;
                var tokenToughness;
                if (tokenPowerAndToughness){                     
                    if (tokenPowerAndToughness.length>0){
                      tokenPower = result[2].split('/')[0];
                      tokenToughness  = result[2].split('/')[1];
                    }
                  } 

                var postTokenString = result[4].substr(tokenStringIndex+5).trim();
                var tokenAbilities = [];
                if (postTokenString != "" && postTokenString != "s"){ //s for the plural ending of tokens                
                  var postTokenTypes = postTokenString.trim().split(' ');
                  
                  for (i=0;i<postTokenTypes.length;i++){
                    if ((postTokenTypes[i] == 'with' || postTokenTypes =='and')
                      && postTokenTypes.length > i ){
                      tokenAbilities.push(postTokenTypes[i+1]);
                      i += 2; 
                    }
                  }
                }
                
                var dbHits = carddb.nameToId[tokenName.toLowerCase()];
                for (i =0;i<dbHits.length;i++){
                  var candidate = carddb.cardFromId(dbHits[i]);
                  var areColorsValid = CheckContentsEqualityOfArray(tokenColor,candidate.colors);

                  var candidateTypes = candidate.type.toLowerCase().split(' ');
                  for(j = 0;j <candidateTypes.length;j++){
                    if (candidateTypes[j] =='token' ||
                        candidateTypes[j] =="—"){
                      candidateTypes.splice(j,1);
                      j--;
                    }
                  }                    
                  var areTypesValid = CheckContentsEqualityOfArray(tokenTypes,candidateTypes);

                  var areAbilitiesValid = false;
                  if (candidate.oracle_text != undefined && candidate.oracle_text.length>0)
                    areAbilitiesValid = CheckContentsEqualityOfArray(tokenAbilities,candidate.oracle_text.toLowerCase().split(','));
                  else
                    areAbilitiesValid = CheckContentsEqualityOfArray(tokenAbilities,[]);

                  if (candidate.power == tokenPower &&
                      candidate.toughness == tokenToughness &&
                      areColorsValid &&
                      areTypesValid &&
                      areAbilitiesValid
                      ){                        
                    mentionedTokens.push({tokenId:candidate._id,sourceCardId:card.details._id});
                    break;
                  }                                                
                }                  
              }            
            }
          }
        }
      }
    });
    var resultingTokens = {};
    mentionedTokens.forEach(element =>{
      if (resultingTokens[element.tokenId]){
        resultingTokens[element.tokenId].push(element.sourceCardId);                        
      }else{
        var cardId = [];
        cardId.push(element.sourceCardId);
        resultingTokens[element.tokenId] = cardId;
      }
    });

    return resultingTokens;
  },
  GetCurve: function(cards, carddb) {
    var curve = {
      white: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      blue: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      black: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      red: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      green: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      colorless: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      multi: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      total: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
    }

    cards.forEach(function(card, index) {
      card.details = carddb.cardFromId(card.cardID);
    });
    cards.forEach(function(card, index) {
      var category;
      switch (GetColorCat(card.details.type, card.colors)) {
        case 'w':
          category = curve.white;
          break;
        case 'u':
          category = curve.blue;
          break;
        case 'b':
          category = curve.black;
          break;
        case 'r':
          category = curve.red;
          break;
        case 'g':
          category = curve.green;
          break;
        case 'c':
          category = curve.colorless;
          break;
        case 'm':
          category = curve.multi;
          break;
      }
      if (category) {
        if (card.cmc >= 9) {
          category[9] += 1;
          curve.total[9] += 1;
        } else {
          category[Math.floor(card.cmc)] += 1;
          curve.total[Math.floor(card.cmc)] += 1;
        }
      }
    });
    return curve;
  }
};

module.exports = methods;