const combination = (n: number, r: number): number => {
  const topArray: number[] = [];
  const botArray: number[] = [];
  const comboArray: number[] = [];

  for (let i = 1; i <= n; i++) {
    topArray.push(i);
  }
  for (let i = 1; i <= r; i++) {
    botArray.push(i);
  }
  for (let i = 1; i <= n - r; i++) {
    comboArray.push(i);
  }

  let sum: number = 1;

  for (let i = 0; i < Math.max(topArray.length, botArray.length, comboArray.length); i++) {
    if (topArray[i]) {
      sum *= topArray[i];
    }
    if (botArray[i]) {
      sum /= botArray[i];
    }
    if (comboArray[i]) {
      sum /= comboArray[i];
    }
  }
  return sum;
};

const hyp = (N: number, S: number, n: number, s: number): number => {
  return (combination(S, s) * combination(N - S, n - s)) / combination(N, n);
};

const clamp = (val: number, min: number, max: number): number => {
  return Math.min(Math.max(val, min), max);
};

const calculate = (
  populationSize: string,
  sampleSize: string,
  popSuccesses: string,
  sampleSuccesses: string
): {
  equalTo: number;
  lessThan: number;
  lessThanEqual: number;
  greaterThan: number;
  greaterThanEqual: number;
} => {
  const keys: number[] = Array.from(new Array(parseInt(sampleSuccesses, 10) + 1).keys());
  const values: number[] = keys.map((x) =>
    hyp(parseInt(populationSize, 10), parseInt(sampleSize, 10), parseInt(popSuccesses, 10), x)
  );
  const equalTo: number = clamp(values[values.length - 1], 0, 1);
  const lessThan: number = clamp(values.reduce((a, b) => a + b, 0) - equalTo, 0, 1);
  const lessThanEqual: number = clamp(lessThan + equalTo, 0, 1);
  const greaterThan: number = 1 - clamp(lessThanEqual, 0, 1);
  const greaterThanEqual: number = clamp(greaterThan + equalTo, 0, 1);

  return { equalTo, lessThan, lessThanEqual, greaterThan, greaterThanEqual };
};

export default calculate;
