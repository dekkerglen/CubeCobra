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

  const TypeByColor = Object.fromEntries(
    ['Creatures', 'Enchantments', 'Lands', 'Planeswalkers', 'Instants', 'Sorceries', 'Artifacts', 'Total'].map(
      (header) => [
        header,
        {
          label: header,
          ...Object.fromEntries(
            ['White', 'Blue', 'Black', 'Red', 'Green', 'Colorless', 'Multi', 'Total'].map((color) => [
              color,
              { asfan: 0, count: 0 },
            ]),
          ),
        },
      ],
    ),
  );
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
        const totalAsfan = TypeByColor.Total[color].asfan;
        const { asfan } = TypeByColor[type][color];
        const asfanText = asfan.toFixed(2);
        let asfanPercentageStr = '';
        if (totalAsfan > 0 && type !== 'Total') {
          const asfanPercentage = Math.round((100.0 * asfan) / totalAsfan);
          asfanPercentageStr = ` %%${asfanPercentage}%%`;
        }
        TypeByColor[type][color] = `${asfanText}${asfanPercentageStr}`;
      }
    }
  }
  postMessage({
    type: 'table',
    description:
      'The expected count to find in the packs a player will open on average, percentages are relative to the bottom row of totals.',
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
