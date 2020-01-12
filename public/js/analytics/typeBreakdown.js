function GetColorCat(colors) {
  if (colors.length == 0) {
    return 'Colorless';
  } else if (colors.length > 1) {
    return 'Multi';
  } else if (colors.length == 1) {
    switch (colors[0]) {
      case 'W':
        return 'White';
        break;
      case 'U':
        return 'Blue';
        break;
      case 'B':
        return 'Black';
        break;
      case 'R':
        return 'Red';
        break;
      case 'G':
        return 'Green';
        break;
      case 'C':
        return 'Colorless';
        break;
    }
  }
}

onmessage = (e) => {
  if (!e) return;
  var cards = e.data;

  var TypeByColor = {
    Creatures: {
      label: 'Creatures',
      White: { asfan: 0, count: 0 },
      Blue: { asfan: 0, count: 0 },
      Black: { asfan: 0, count: 0 },
      Red: { asfan: 0, count: 0 },
      Green: { asfan: 0, count: 0 },
      Colorless: { asfan: 0, count: 0 },
      Multi: { asfan: 0, count: 0 },
      Total: { asfan: 0, count: 0 },
    },
    Enchantments: {
      label: 'Enchantments',
      White: { asfan: 0, count: 0 },
      Blue: { asfan: 0, count: 0 },
      Black: { asfan: 0, count: 0 },
      Red: { asfan: 0, count: 0 },
      Green: { asfan: 0, count: 0 },
      Colorless: { asfan: 0, count: 0 },
      Multi: { asfan: 0, count: 0 },
      Total: { asfan: 0, count: 0 },
    },
    Lands: {
      label: 'Lands',
      White: { asfan: 0, count: 0 },
      Blue: { asfan: 0, count: 0 },
      Black: { asfan: 0, count: 0 },
      Red: { asfan: 0, count: 0 },
      Green: { asfan: 0, count: 0 },
      Colorless: { asfan: 0, count: 0 },
      Multi: { asfan: 0, count: 0 },
      Total: { asfan: 0, count: 0 },
    },
    Planeswalkers: {
      label: 'Planeswalkers',
      White: { asfan: 0, count: 0 },
      Blue: { asfan: 0, count: 0 },
      Black: { asfan: 0, count: 0 },
      Red: { asfan: 0, count: 0 },
      Green: { asfan: 0, count: 0 },
      Colorless: { asfan: 0, count: 0 },
      Multi: { asfan: 0, count: 0 },
      Total: { asfan: 0, count: 0 },
    },
    Instants: {
      label: 'Instants',
      White: { asfan: 0, count: 0 },
      Blue: { asfan: 0, count: 0 },
      Black: { asfan: 0, count: 0 },
      Red: { asfan: 0, count: 0 },
      Green: { asfan: 0, count: 0 },
      Colorless: { asfan: 0, count: 0 },
      Multi: { asfan: 0, count: 0 },
      Total: { asfan: 0, count: 0 },
    },
    Sorceries: {
      label: 'Sorceries',
      White: { asfan: 0, count: 0 },
      Blue: { asfan: 0, count: 0 },
      Black: { asfan: 0, count: 0 },
      Red: { asfan: 0, count: 0 },
      Green: { asfan: 0, count: 0 },
      Colorless: { asfan: 0, count: 0 },
      Multi: { asfan: 0, count: 0 },
      Total: { asfan: 0, count: 0 },
    },
    Artifacts: {
      label: 'Artifacts',
      White: { asfan: 0, count: 0 },
      Blue: { asfan: 0, count: 0 },
      Black: { asfan: 0, count: 0 },
      Red: { asfan: 0, count: 0 },
      Green: { asfan: 0, count: 0 },
      Colorless: { asfan: 0, count: 0 },
      Multi: { asfan: 0, count: 0 },
      Total: { asfan: 0, count: 0 },
    },
    Total: {
      label: 'Total',
      White: { asfan: 0, count: 0 },
      Blue: { asfan: 0, count: 0 },
      Black: { asfan: 0, count: 0 },
      Red: { asfan: 0, count: 0 },
      Green: { asfan: 0, count: 0 },
      Colorless: { asfan: 0, count: 0 },
      Multi: { asfan: 0, count: 0 },
      Total: { asfan: 0, count: 0 },
    },
  };
  cards.forEach(function(card, index) {
    var asfan = card.asfan || 15 / cards.length;
    var colorCategory = GetColorCat(card.colors);

    TypeByColor['Total'][colorCategory].count += 1;
    TypeByColor['Total'][colorCategory].asfan += asfan;
    TypeByColor['Total']['Total'].count += 1;
    TypeByColor['Total']['Total'].asfan += asfan;

    var type = null;
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
    } else {
      return;
    }

    type[colorCategory].count += 1;
    type[colorCategory].asfan += asfan;
    type['Total'].count += 1;
    type['Total'].asfan += asfan;
  });

  for (let color in TypeByColor['Total']) {
    if (color == 'label') continue;
    const totalCount = TypeByColor['Total'][color].count;
    const totalAsfan = TypeByColor['Total'][color].asfan;
    for (let type in TypeByColor) {
      const count = TypeByColor[type][color].count;
      const asfan = TypeByColor[type][color].asfan;
      const countText = `${count} / ${asfan.toFixed(2)} AsFan`;
      if ((type === 'Total' && totalCount == 0) || totalAsfan == 0) {
        TypeByColor[type][color] = countText;
      } else {
        var percentageText;
        var percentageCount = 0;
        if (totalCount > 0) {
          percentageCount = Math.round((100.0 * count) / totalCount);
        }
        var perecentageAsfan = 0;
        if (totalAsfan > 0) {
          percentageAsfan = Math.round((100.0 * asfan) / totalAsfan);
        }
        TypeByColor[type][color] = `${countText} %%${percentageCount}% / ${percentageAsfan}% AsFan%%`;
      }
    }
  }
  postMessage({
    type: 'table',
    columns: [
      { header: '', key: 'label', rowHeader: true },
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
