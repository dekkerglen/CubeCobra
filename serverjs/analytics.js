function GetColorCat (type, colors)  {
  if(type.toLowerCase().includes('land'))
  {
    return 'l';
  }
  else if(colors.length == 0)
  {
    return 'c';
  }
  else if(colors.length >  1)
  {
    return 'm';
  }
  else if(colors.length ==  1)
  {
    switch(colors[0])
    {
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

function GetColorIdentity (colors)  {
  if(colors.length == 0)
  {
    return 'Colorless';
  }
  else if(colors.length >  1)
  {
    return 'Multicolored';
  }
  else if(colors.length ==  1)
  {
    switch(colors[0])
    {
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
  GetTypeByColor: function (cards, carddb) {
    var TypeByColor = {
      Creatures:{White:0, Blue:0,Black:0,Red:0,Green:0,Colorless:0,Multi:0,Total:0},
      Enchantments:{White:0, Blue:0,Black:0,Red:0,Green:0,Colorless:0,Multi:0,Total:0},
      Lands:{White:0, Blue:0,Black:0,Red:0,Green:0,Colorless:0,Multi:0,Total:0},
      Planeswalkers:{White:0, Blue:0,Black:0,Red:0,Green:0,Colorless:0,Multi:0,Total:0},
      Instants:{White:0, Blue:0,Black:0,Red:0,Green:0,Colorless:0,Multi:0,Total:0},
      Sorceries:{White:0, Blue:0,Black:0,Red:0,Green:0,Colorless:0,Multi:0,Total:0},
      Artifacts:{White:0, Blue:0,Black:0,Red:0,Green:0,Colorless:0,Multi:0,Total:0},
      Total:{White:0, Blue:0,Black:0,Red:0,Green:0,Colorless:0,Multi:0,Total:0}
    };
    cards.forEach(function(card, index)
    {
      card.details = carddb.carddict[card.cardID];
    });
    cards.forEach(function(card, index)
    {
      var type = {};
      if(card.details.type.toLowerCase().includes('creature'))
      {
        type = TypeByColor['Creatures'];
      }
      else if(card.details.type.toLowerCase().includes('enchantment'))
      {
        type = TypeByColor['Enchantments'];
      }
      else if(card.details.type.toLowerCase().includes('land'))
      {
        type = TypeByColor['Lands'];
      }
      else if(card.details.type.toLowerCase().includes('planeswalker'))
      {
        type = TypeByColor['Planeswalkers'];
      }
      else if(card.details.type.toLowerCase().includes('instant'))
      {
        type = TypeByColor['Instants'];
      }
      else if(card.details.type.toLowerCase().includes('sorcery'))
      {
        type = TypeByColor['Sorceries'];
      }
      else if(card.details.type.toLowerCase().includes('artifact'))
      {
        type = TypeByColor['Artifacts'];
      }

      var colorCategory = GetColorCat(card.details.type, card.colors);
      if(colorCategory=='l')
      {
        if(card.details.colors.length == 0)
        {
          type['Colorless'] += 1;
          type['Total'] += 1;
          TypeByColor['Total']['Colorless'] += 1;
          TypeByColor['Total']['Total'] += 1;
        }
        else if(card.details.colors.length > 1)
        {
          type['Multi'] += 1;
          type['Total'] += 1;
          TypeByColor['Total']['Multi'] += 1;
          TypeByColor['Total']['Total'] += 1;
        }
        else
        {
          switch(card.details.colors[0])
          {
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
      }
      else
      {
        switch(colorCategory)
        {
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
  GetColorCounts: function (cards, carddb) {
    var ColorCounts = {
      White:0,
      Blue:0,
      Black:0,
      Red:0,
      Green:0,
      Azorius:0,
      Dimir:0,
      Rakdos:0,
      Gruul:0,
      Selesnya:0,
      Orzhov:0,
      Izzet:0,
      Golgari:0,
      Boros:0,
      Simic:0,
      Jund:0,
      Bant:0,
      Grixis:0,
      Naya:0,
      Esper:0,
      Jeskai:0,
      Mardu:0,
      Sultai:0,
      Temur:0,
      Abzan:0,
      NonWhite:0,
      NonBlue:0,
      NonBlack:0,
      NonRed:0,
      NonGreen:0,
      FiveColor:0
    };
    cards.forEach(function(card, index)
    {
      card.details = carddb.carddict[card.cardID];
    });
    cards.forEach(function(card, index)
    {
      if(card.details.colors.length === 2)
      {
        if(card.details.colors.includes('W') && card.details.colors.includes('U'))
        {
          ColorCounts.Azorius += 1;
          ColorCounts.White += 1;
          ColorCounts.Blue += 1;
        }
        else if(card.details.colors.includes('B') && card.details.colors.includes('U'))
        {
          ColorCounts.Dimir += 1;
          ColorCounts.Black += 1;
          ColorCounts.Blue += 1;
        }
        else if(card.details.colors.includes('B') && card.details.colors.includes('R'))
        {
          ColorCounts.Rakdos += 1;
          ColorCounts.Black += 1;
          ColorCounts.Red += 1;
        }
        else if(card.details.colors.includes('G') && card.details.colors.includes('R'))
        {
          ColorCounts.Gruul += 1;
          ColorCounts.Green += 1;
          ColorCounts.Red += 1;
        }
        else if(card.details.colors.includes('W') && card.details.colors.includes('G'))
        {
          ColorCounts.Selesnya += 1;
          ColorCounts.Green += 1;
          ColorCounts.White += 1;
        }
        else if(card.details.colors.includes('W') && card.details.colors.includes('B'))
        {
          ColorCounts.Orzhov += 1;
          ColorCounts.White += 1;
          ColorCounts.Black += 1;
        }
        else if(card.details.colors.includes('R') && card.details.colors.includes('U'))
        {
          ColorCounts.Izzet += 1;
          ColorCounts.Red += 1;
          ColorCounts.Blue += 1;
        }
        else if(card.details.colors.includes('G') && card.details.colors.includes('B'))
        {
          ColorCounts.Golgari += 1;
          ColorCounts.Green += 1;
          ColorCounts.Black += 1;
        }
        else if(card.details.colors.includes('W') && card.details.colors.includes('R'))
        {
          ColorCounts.Boros += 1;
          ColorCounts.White += 1;
          ColorCounts.Red += 1;
        }
         else if(card.details.colors.includes('G') && card.details.colors.includes('U'))
        {
          ColorCounts.Simic += 1
          ColorCounts.Green += 1;
          ColorCounts.Blue += 1;
        }
      }
      else if(card.colors.length == 3)
      {
        if(card.details.colors.includes('G') && card.details.colors.includes('B') && card.details.colors.includes('R'))
        {
          ColorCounts.Jund += 1;
          ColorCounts.Green += 1;
          ColorCounts.Black += 1;
          ColorCounts.Red += 1;
        }
        else if(card.details.colors.includes('G') && card.details.colors.includes('U') && card.details.colors.includes('W'))
        {
          ColorCounts.Bant += 1;
          ColorCounts.Green += 1;
          ColorCounts.White += 1;
          ColorCounts.Blue += 1;
        }
        else if(card.details.colors.includes('U') && card.details.colors.includes('B') && card.details.colors.includes('R'))
        {
          ColorCounts.Grixis += 1;
          ColorCounts.Blue += 1;
          ColorCounts.Black += 1;
          ColorCounts.Red += 1;
        }
        else if(card.details.colors.includes('G') && card.details.colors.includes('W') && card.details.colors.includes('R'))
        {
          ColorCounts.Naya += 1;
          ColorCounts.Green += 1;
          ColorCounts.White += 1;
          ColorCounts.Red += 1;
        }
        else if(card.details.colors.includes('U') && card.details.colors.includes('B') && card.details.colors.includes('W'))
        {
          ColorCounts.Esper += 1;
          ColorCounts.Blue += 1;
          ColorCounts.Black += 1;
          ColorCounts.White += 1;
        }
        else if(card.details.colors.includes('W') && card.details.colors.includes('U') && card.details.colors.includes('R'))
        {
          ColorCounts.Jeskai += 1;
          ColorCounts.Blue += 1;
          ColorCounts.White += 1;
          ColorCounts.Red += 1;
        }
        else if(card.details.colors.includes('W') && card.details.colors.includes('B') && card.details.colors.includes('R'))
        {
          ColorCounts.Mardu += 1;
          ColorCounts.White += 1;
          ColorCounts.Black += 1;
          ColorCounts.Red += 1;
        }
        else if(card.details.colors.includes('G') && card.details.colors.includes('B') && card.details.colors.includes('U'))
        {
          ColorCounts.Sultai += 1;
          ColorCounts.Green += 1;
          ColorCounts.Black += 1;
          ColorCounts.Blue += 1;
        }
        else if(card.details.colors.includes('G') && card.details.colors.includes('U') && card.details.colors.includes('R'))
        {
          ColorCounts.Temur += 1;
          ColorCounts.Green += 1;
          ColorCounts.Blue += 1;
          ColorCounts.Red += 1;
        }
        else if(card.details.colors.includes('G') && card.details.colors.includes('B') && card.details.colors.includes('W'))
        {
          ColorCounts.Abzan += 1;
          ColorCounts.Green += 1;
          ColorCounts.Black += 1;
          ColorCounts.White += 1;
        }
      }
      else if(card.colors.length == 4)
      {
        if(!card.details.colors.includes('W'))
        {
          ColorCounts.NonWhite += 1;
          ColorCounts.Green += 1;
          ColorCounts.Black += 1;
          ColorCounts.Blue += 1;
          ColorCounts.Red += 1;
        }
        else if(!card.details.colors.includes('U'))
        {
          ColorCounts.NonBlue += 1;
          ColorCounts.Green += 1;
          ColorCounts.Black += 1;
          ColorCounts.White += 1;
          ColorCounts.Red += 1;
        }
        else if(!card.details.colors.includes('B'))
        {
          ColorCounts.NonBlack += 1;
          ColorCounts.Green += 1;
          ColorCounts.White += 1;
          ColorCounts.Blue += 1;
          ColorCounts.Red += 1;
        }
        else if(!card.details.colors.includes('R'))
        {
          ColorCounts.NonRed += 1;
          ColorCounts.Green += 1;
          ColorCounts.Black += 1;
          ColorCounts.White += 1;
          ColorCounts.Blue += 1;
        }
        else if(!card.details.colors.includes('G'))
        {
          ColorCounts.NonGreen += 1;
          ColorCounts.Black += 1;
          ColorCounts.White += 1;
          ColorCounts.Blue += 1;
          ColorCounts.Red += 1;
        }
      }
      else if(card.details.colors.length == 5)
      {
        ColorCounts.FiveColor += 1;
        ColorCounts.Green += 1;
        ColorCounts.Black += 1;
        ColorCounts.White += 1;
        ColorCounts.Blue += 1;
        ColorCounts.Red += 1;
      }
    });
    return ColorCounts;
  },
  GetCurve: function (cards, carddb) {
    var curve = {
      white: [0,0,0,0,0,0,0,0,0,0],
      blue:[0,0,0,0,0,0,0,0,0,0],
      black:[0,0,0,0,0,0,0,0,0,0],
      red:[0,0,0,0,0,0,0,0,0,0],
      green:[0,0,0,0,0,0,0,0,0,0],
      colorless:[0,0,0,0,0,0,0,0,0,0],
      multi:[0,0,0,0,0,0,0,0,0,0],
      total:[0,0,0,0,0,0,0,0,0,0]
    }

    cards.forEach(function(card, index)
    {
      card.details = carddb.carddict[card.cardID];
    });
    cards.forEach(function(card, index)
    {
      var category;
      switch(GetColorCat(card.details.type, card.colors))
      {
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
      if(category)
      {
        if(card.cmc >= 9)
        {
          category[9] += 1;
          curve.total[9] += 1;
        }
        else
        {
          category[Math.floor(card.cmc)] += 1;
          curve.total[Math.floor(card.cmc)] += 1;
        }
      }
    });
    return curve;
  }
};

module.exports = methods;
