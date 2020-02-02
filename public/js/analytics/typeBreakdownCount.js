function GetColorCat(colors) {
  if (colors.length === 0) {
    return 'Colorless';
  }
  if (colors.length > 1) {
    return 'Multi';
  }
  if (colors.length === 1) {
    switch (colors[0]) {
      case 'W':
        return 'White';
      case 'U':
        return 'Blue';
      case 'B':
        return 'Black';
      case 'R':
        return 'Red';
      case 'G':
        return 'Green';
      case 'C':
      default:
        return 'Colorless';
    }
  }
}

onmessage = (e) => {
  if (!e) return;
  const cards = e.data;

  const TypeByColor = {
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
  for (const card of cards) {
    const asfan = card.asfan || 15 / cards.length;
    const colorCategory = GetColorCat(card.colors);

    TypeByColor.Total[colorCategory].count += 1;
    TypeByColor.Total[colorCategory].asfan += asfan;
    TypeByColor.Total.Total.count += 1;
    TypeByColor.Total.Total.asfan += asfan;

    let type = null;
    if (card.details.type.toLowerCase().includes('creature')) {
      type = TypeByColor.Creatures;
    } else if (card.details.type.toLowerCase().includes('enchantment')) {
      type = TypeByColor.Enchantments;
    } else if (card.details.type.toLowerCase().includes('land')) {
      type = TypeByColor.Lands;
    } else if (card.details.type.toLowerCase().includes('planeswalker')) {
      type = TypeByColor.Planeswalkers;
    } else if (card.details.type.toLowerCase().includes('instant')) {
      type = TypeByColor.Instants;
    } else if (card.details.type.toLowerCase().includes('sorcery')) {
      type = TypeByColor.Sorceries;
    } else if (card.details.type.toLowerCase().includes('artifact')) {
      type = TypeByColor.Artifacts;
    } else {
      console.warn(`Unrecognized type: ${card.details.type} from ${card.details.name}`);
    }
    if (type) {
      type[colorCategory].count += 1;
      type[colorCategory].asfan += asfan;
      type.Total.count += 1;
      type.Total.asfan += asfan;
    }
  }

  for (const type of Object.keys(TypeByColor)) {
    const typed = TypeByColor[type];
    for (const color of Object.keys(typed)) {
      if (color !== 'label') {
        const totalCount = TypeByColor.Total[color].count;
        const { count } = TypeByColor[type][color];
        const countText = String(count);
        let countPercentageStr = '';
        if (totalCount > 0 && type !== 'Total') {
          const countPercentage = Math.round((100.0 * count) / totalCount);
          countPercentageStr = ` %%${countPercentage}%%`;
        }
        TypeByColor[type][color] = `${countText}${countPercentageStr}`;
      }
    }
  }

  postMessage({
    type: 'table',
    description: 'The count of cards in that type and color, percentages are relative to the bottom row of totals.',
    tables: [
      {
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
        rows: [
          TypeByColor.Creatures,
          TypeByColor.Instants,
          TypeByColor.Sorceries,
          TypeByColor.Enchantments,
          TypeByColor.Artifacts,
          TypeByColor.Planeswalkers,
          TypeByColor.Lands,
          TypeByColor.Total,
        ],
      },
    ],
  });
};
