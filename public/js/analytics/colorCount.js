function areArraysEqualSets(a1, a2) {
  if (a1.length !== a2.length) return false;
  const superSet = {};
  for (let i = 0; i < a1.length; i++) {
    const e = a1[i] + typeof a1[i];
    superSet[e] = 1;
  }

  for (let i = 0; i < a2.length; i++) {
    const e = a2[i] + typeof a2[i];
    if (!superSet[e]) {
      return false;
    }
    superSet[e] = 2;
  }

  for (const e in superSet) {
    if (superSet[e] === 1) {
      return false;
    }
  }

  return true;
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
    { header: 'Expected in Pool', key: 'asfan' },
    { header: 'Count', key: 'count' },
  ];
  datapoints.push({ key: 'total', label: 'Total', asfan: totalAsfan.toFixed(2), count: totalCount });
  postMessage({
    type: 'table',
    description: 'Counts for cards that are exactly these color identities.',
    tables: [
      {
        columns,
        rows: datapoints.slice(0,6),
      },
      {
        columns,
        rows: datapoints.slice(6,16),
      },
      {
        columns,
        rows: datapoints.slice(16,26),
      },
      {
        columns,
        rows: datapoints.slice(26),
      },
    ],
  });
};
