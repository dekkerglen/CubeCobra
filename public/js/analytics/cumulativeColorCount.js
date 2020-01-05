function areArraysEqualSets(a1, a2) {
  if (a1.length != a2.length) return false;
  let superSet = {};
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

  for (let e in superSet) {
    if (superSet[e] === 1) {
      return false;
    }
  }

  return true;
}

function arrayContainsOtherArray(arr1, arr2) {
  return arr2.every((v) => arr1.includes(v));
}

onmessage = (e) => {
  if (!e) return;
  var cards = e.data;
  var colorCombinations = [
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
  var ColorCounts = Array.from(colorCombinations, (label) => 0);
  var ColorAsfans = Array.from(colorCombinations, (label) => 0);
  var totalCount = 0;
  var totalAsfan = 0;
  var cardColors;
  cards.forEach((card, index) => {
    // Hack until asfan can be properly added to cards
    asfan = card.asfan || 15 / cards.length;
    cardColors = card.colors || card.details.colors || [];

    totalCount += 1;
    totalAsfan += asfan;
    colorCombinations.forEach((combination, idx) => {
      if (arrayContainsOtherArray(combination, cardColors)) {
        ColorCounts[idx] += 1;
        ColorAsfans[idx] += asfan;
      }
    });
  });
  datapoints = Array.from(colorCombinations, (combination, idx) => ({
    key: combination.length == 0 ? 'C' : combination.join(''),
    label: combination.length == 0 ? '{c}' : combination.map((c) => '{' + c.toLowerCase() + '}').join(''),
    asfan: ColorAsfans[idx].toFixed(2),
    count: ColorCounts[idx],
  }));
  datapoints.push({ key: 'total', label: 'Total', asfan: totalAsfan.toFixed(2), count: totalCount });
  postMessage({
    type: 'table',
    columns: [
      { header: 'Color Combination', key: 'label' },
      { header: 'AsFan of Contained In', key: 'asfan' },
      { header: 'Count of Contained In', key: 'count' },
    ],
    data: datapoints,
  });
};
