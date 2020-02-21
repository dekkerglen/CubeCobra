import { arrayIsSubset } from 'utils/Util';

import { colorCombinations } from 'analytics/analyticsHelpers';

async function inclusiveColorCount(cards) {
  const ColorCounts = Array.from(colorCombinations, () => 0);
  const ColorAsfans = Array.from(colorCombinations, () => 0);
  let totalCount = 0;
  let totalAsfan = 0;
  for (const card of cards) {
    // Hack until asfan can be properly added to cards
    const asfan = card.asfan || 15 / cards.length;
    const cardColors = card.colors || card.details.colors || [];

    totalCount += 1;
    totalAsfan += asfan;
    colorCombinations.forEach((combination, idx) => {
      if (arrayIsSubset(combination, cardColors)) {
        ColorCounts[idx] += 1;
        ColorAsfans[idx] += asfan;
      }
    });
  }
  const datapoints = Array.from(colorCombinations, (combination, idx) => ({
    label: combination.length === 0 ? '{c}' : combination.map((c) => `{${c.toLowerCase()}}`).join(''),
    asfan: ColorAsfans[idx].toFixed(2),
    count: ColorCounts[idx],
  }));
  const columns = [
    { header: 'Color Combination', key: 'label', rowHeader: true },
    { header: 'Expected Opened', key: 'asfan' },
    { header: 'Count', key: 'count' },
  ];
  datapoints.push({ key: 'total', label: 'Total', asfan: totalAsfan.toFixed(2), count: totalCount });
  return {
    type: 'table',
    description:
      'Count of cards that can only be played if you have all these colors and the number you expect a player to open on average in a draft.',
    tables: [
      {
        columns,
        rows: datapoints.slice(0, 6),
      },
      {
        columns,
        rows: datapoints.slice(6, 16),
      },
      {
        columns,
        rows: datapoints.slice(16, 26),
      },
      {
        columns,
        rows: datapoints.slice(26),
      },
    ],
  };
}

export default inclusiveColorCount;
