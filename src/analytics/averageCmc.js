import { getCmc } from 'utils/Card';
import { GetColorCategory } from 'utils/Sort';

async function averageCmc(cards) {
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
    if (!card.details.type.toLowerCase().includes('land')) {
      const asfan = card.asfan || 15 / cards.length;
      const colorCat = GetColorCategory(card.details.type, card.colors);
      const cmc = getCmc(card);
      if (ColorCounts[colorCat]) {
        ColorCounts[colorCat].count += cmc;
        ColorCounts.Total.count += cmc;
        ColorCounts[colorCat].totalCount += 1;
        ColorCounts.Total.totalCount += 1;
        ColorCounts[colorCat].asfan += cmc * asfan;
        ColorCounts.Total.asfan += cmc * asfan;
        ColorCounts[colorCat].totalAsfan += asfan;
        ColorCounts.Total.totalAsfan += asfan;
      }
    }
  }

  return {
    type: 'table',
    description: 'The average(mean) CMC in the cube as a whole, and the expected average(mean) a player will open.',
    tables: [
      {
        columns: [
          { header: 'Color', key: 'label', rowHeader: true },
          { header: 'Mean CMC in Cube', key: 'countAverage' },
          { header: 'Expected Mean CMC Opened', key: 'asfanAverage' },
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
  };
}

export default averageCmc;
