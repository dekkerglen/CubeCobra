import { COLOR_COMBINATIONS } from 'utils/Card';
import { arraysAreEqualSets } from 'utils/Util';

async function colorCount(cards) {
  const ColorCounts = Array.from(COLOR_COMBINATIONS, () => 0);
  const ColorAsfans = Array.from(COLOR_COMBINATIONS, () => 0);
  let totalCount = 0;
  let totalAsfan = 0;
  for (const card of cards) {
    const asfan = card.asfan || 15 / cards.length;
    const cardColors = card.colors || card.details.colors || [];

    totalCount += 1;
    totalAsfan += asfan;
    COLOR_COMBINATIONS.forEach((combination, idx) => {
      if (arraysAreEqualSets(combination, cardColors)) {
        ColorCounts[idx] += 1;
        ColorAsfans[idx] += asfan;
      }
    });
  }
  const datapoints = Array.from(COLOR_COMBINATIONS, (combination, idx) => ({
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
      'Counts of cards that are exactly these color identities and the number you expect a player to open on average.',
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

export default colorCount;
