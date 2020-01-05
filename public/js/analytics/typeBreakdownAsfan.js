function GetColorCat(type, colors) {
  if (type.toLowerCase().includes('land')) {
    return 'l';
  } else if (colors.length == 0) {
    return 'c';
  } else if (colors.length > 1) {
    return 'm';
  } else if (colors.length == 1) {
    switch (colors[0]) {
      case 'W':
        return 'w';
        break;
      case 'U':
        return 'u';
        break;
      case 'B':
        return 'b';
        break;
      case 'R':
        return 'r';
        break;
      case 'G':
        return 'g';
        break;
      case 'C':
        return 'c';
        break;
    }
  }
}

onmessage = (e) => {
  if (!e) return;
  var cards = e.data;

  var TypeByColor = {
    Creatures: {
      key: 'Creatures',
      White: 0,
      Blue: 0,
      Black: 0,
      Red: 0,
      Green: 0,
      Colorless: 0,
      Multi: 0,
      Total: 0,
    },
    Enchantments: {
      key: 'Enchantments',
      White: 0,
      Blue: 0,
      Black: 0,
      Red: 0,
      Green: 0,
      Colorless: 0,
      Multi: 0,
      Total: 0,
    },
    Lands: {
      key: 'Lands',
      White: 0,
      Blue: 0,
      Black: 0,
      Red: 0,
      Green: 0,
      Colorless: 0,
      Multi: 0,
      Total: 0,
    },
    Planeswalkers: {
      key: 'Planeswalkers',
      White: 0,
      Blue: 0,
      Black: 0,
      Red: 0,
      Green: 0,
      Colorless: 0,
      Multi: 0,
      Total: 0,
    },
    Instants: {
      key: 'Instants',
      White: 0,
      Blue: 0,
      Black: 0,
      Red: 0,
      Green: 0,
      Colorless: 0,
      Multi: 0,
      Total: 0,
    },
    Sorceries: {
      key: 'Sorceries',
      White: 0,
      Blue: 0,
      Black: 0,
      Red: 0,
      Green: 0,
      Colorless: 0,
      Multi: 0,
      Total: 0,
    },
    Artifacts: {
      key: 'Artifacts',
      White: 0,
      Blue: 0,
      Black: 0,
      Red: 0,
      Green: 0,
      Colorless: 0,
      Multi: 0,
      Total: 0,
    },
    Total: {
      key: 'Total',
      White: 0,
      Blue: 0,
      Black: 0,
      Red: 0,
      Green: 0,
      Colorless: 0,
      Multi: 0,
      Total: 0,
    },
  };
  var asfan;
  cards.forEach(function(card, index) {
    asfan = card.asfan || 15 / cards.length;
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

    // special case for land
    if (colorCategory == 'l') {
      if (card.colors.length == 0) {
        colorCategory = 'c';
      } else if (card.colors.length > 1) {
        colorCategory = 'm';
      } else {
        colorCategory = card.colors[0].toLowerCase();
      }
    }

    switch (colorCategory) {
      case 'w':
        type['White'] += asfan;
        type['Total'] += asfan;
        TypeByColor['Total']['White'] += asfan;
        TypeByColor['Total']['Total'] += asfan;
        break;
      case 'u':
        type['Blue'] += asfan;
        type['Total'] += asfan;
        TypeByColor['Total']['Blue'] += asfan;
        TypeByColor['Total']['Total'] += asfan;
        break;
      case 'b':
        type['Black'] += asfan;
        type['Total'] += asfan;
        TypeByColor['Total']['Black'] += asfan;
        TypeByColor['Total']['Total'] += asfan;
        break;
      case 'r':
        type['Red'] += asfan;
        type['Total'] += asfan;
        TypeByColor['Total']['Red'] += asfan;
        TypeByColor['Total']['Total'] += asfan;
        break;
      case 'g':
        type['Green'] += asfan;
        type['Total'] += asfan;
        TypeByColor['Total']['Green'] += asfan;
        TypeByColor['Total']['Total'] += asfan;
        break;
      case 'm':
        type['Multi'] += asfan;
        type['Total'] += asfan;
        TypeByColor['Total']['Multi'] += asfan;
        TypeByColor['Total']['Total'] += asfan;
        break;
      case 'c':
        type['Colorless'] += asfan;
        type['Total'] += asfan;
        TypeByColor['Total']['Colorless'] += asfan;
        TypeByColor['Total']['Total'] += asfan;
        break;
      default:
    }
  });

  for (let color of Object.keys(TypeByColor['Total'])) {
    const total = TypeByColor['Total'][color];
    if (color == 'key' || total == 0) continue;
    for (let type in TypeByColor) {
      const count = TypeByColor[type][color];
      const percentage = Math.round((100.0 * count) / total);
      TypeByColor[type][color] = `${count.toFixed(2)} %25${percentage}%25`;
      console.log(TypeByColor[type][color]);
    }
  }
  postMessage({
    type: 'table',
    columns: [
      { header: '', key: 'key' },
      { header: '{w}', key: 'White' },
      { header: '{u}', key: 'Blue' },
      { header: '{b}', key: 'Black' },
      { header: '{r}', key: 'Red' },
      { header: '{g}', key: 'Green' },
      { header: '{c}', key: 'Colorless' },
      { header: '{m}', key: 'Multi' },
      { header: 'Total', key: 'Total' },
    ],
    data: [
      TypeByColor['Creatures'],
      TypeByColor['Instants'],
      TypeByColor['Sorceries'],
      TypeByColor['Enchantments'],
      TypeByColor['Artifacts'],
      TypeByColor['Planeswalkers'],
      TypeByColor['Lands'],
      TypeByColor['Total'],
    ],
  });
};
