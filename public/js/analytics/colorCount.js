function areArraysEqualSets(a1, a2) {
  const set1 = new Set(a1);
  const set2 = new Set(a2);
  return a1.every((x) => set2.has(x)) && a2.every((x) => set1.has(x));
}

onmessage = (e) => {
  if (!e) return;
  const cards = e.data;
  const colorCombinations = [
    [],
    ['W'],
    ['U'],
    ['B'],
    ['R'],
    ['G'],
    ['W', 'U'],
    ['U', 'B'],
    ['B', 'R'],
    ['R', 'G'],
    ['G', 'W'],
    ['W', 'B'],
    ['U', 'R'],
    ['B', 'G'],
    ['R', 'W'],
    ['G', 'U'],
    ['G', 'W', 'U'],
    ['W', 'U', 'B'],
    ['U', 'B', 'R'],
    ['B', 'R', 'G'],
    ['R', 'G', 'W'],
    ['R', 'W', 'B'],
    ['G', 'U', 'R'],
    ['W', 'B', 'G'],
    ['U', 'R', 'W'],
    ['B', 'G', 'U'],
    ['U', 'B', 'R', 'G'],
    ['B', 'R', 'G', 'W'],
    ['R', 'G', 'W', 'U'],
    ['G', 'W', 'U', 'B'],
    ['W', 'U', 'B', 'R'],
    ['W', 'U', 'B', 'R', 'G'],
  ];
  const ColorCounts = Array.from(colorCombinations, () => 0);
  const ColorAsfans = Array.from(colorCombinations, () => 0);
  let totalCount = 0;
  let totalAsfan = 0;
  for (const card of cards) {
    const asfan = card.asfan || 15 / cards.length;
    const cardColors = card.colors || card.details.colors || [];

    totalCount += 1;
    totalAsfan += asfan;
    colorCombinations.forEach((combination, idx) => {
      if (areArraysEqualSets(combination, cardColors)) {
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
  postMessage({
    type: 'table',
    description: 'Counts of cards that are exactly these color identities and the number you expect a player to open on average.',
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
  });
};
