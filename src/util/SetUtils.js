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

export default { areArraysEqualSets, arrayContainsOtherArray };
