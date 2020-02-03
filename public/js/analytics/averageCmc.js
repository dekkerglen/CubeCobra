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

  const ColorCounts = {
    White: { label: '{w}', asfan: 0, count: 0, totalAsfan: 0, totalCount: 0 },
    Blue: { label: '{u}', asfan: 0, count: 0, totalAsfan: 0, totalCount: 0 },
    Black: { label: '{b}', asfan: 0, count: 0, totalAsfan: 0, totalCount: 0 },
    Red: { label: '{r}', asfan: 0, count: 0, totalAsfan: 0, totalCount: 0 },
    Green: { label: '{g}', asfan: 0, count: 0, totalAsfan: 0, totalCount: 0 },
    Colorless: { label: '{c}', asfan: 0, count: 0, totalAsfan: 0, totalCount: 0 },
    Multi: { label: '{m}', asfan: 0, count: 0, totalAsfan: 0, totalCount: 0 },
    Total: { label: 'Total', asfan: 0, count: 0, totalAsfan: 0, totalCount: 0 },
  };

  for (const card of cards) {
    const asfan = card.asfan || 15 / cards.length;
    const colorCat = GetColorCat(card.colors || card.details.color_identity);
    const cmc = card.cmc !== undefined ? card.cmc : card.details.cmc;
    ColorCounts[colorCat].count += cmc;
    ColorCounts.Total.count += cmc;
    ColorCounts[colorCat].totalCount += 1;
    ColorCounts.Total.totalCount += 1;
    ColorCounts[colorCat].asfan += cmc * asfan;
    ColorCounts.Total.asfan += cmc * asfan;
    ColorCounts[colorCat].totalAsfan += asfan;
    ColorCounts.Total.totalAsfan += asfan;
  }

  postMessage({
    type: 'table',
    description: 'The average CMC in the cube as a whole, and the expected average in a players pool.',
    tables: [
      {
        columns: [
          { header: 'Color', key: 'label', rowHeader: true },
          { header: 'Average CMC in Cube', key: 'countAverage' },
          { header: 'Expected Average CMC in Pool', key: 'asfanAverage' },
        ],
        rows: Object.keys(ColorCounts)
          .map((key) => ColorCounts[key])
          .map(({ label, asfan, count, totalAsfan, totalCount }) => ({
            label,
            countAverage: totalCount > 0 ? (count / totalCount).toFixed(2) : 0,
            asfanAverage: totalAsfan > 0 ? (asfan / totalAsfan).toFixed(2) : 0,
          })),
      },
    ],
  });
};
