export const weightedAverage = (arr: [number, number][]): number => {
  const [count, total] = arr.reduce(([c, t], [weight, value]) => [c + weight, t + weight * value], [0, 0]);
  return total / (count || 1);
};

export const weightedMedian = (arr: [number, number][]): number => {
  const count = arr.reduce((acc, [weight]) => acc + weight, 0);
  const nums = [...arr].sort(([, a], [, b]) => a - b);
  const mid = count / 2;
  let total = 0;
  let prevValue = nums[0]?.[1] ?? 0;
  for (const [weight, value] of nums) {
    const newTotal = total + weight;
    // We can assume that total < mid since otherwise we would've already returned
    // Small exception happens if mid = 0 due to zero weights or empty array
    // which we do handle correctly.
    if (newTotal > mid) return (prevValue + value) / 2;
    if (newTotal === mid) return value;
    prevValue = value;
    total = newTotal;
  }
  return 0;
};

// Returns num+1 elements that are min, 1/num, 2/num, ..., max
export const weightedPercentiles = (arr: [number, number][], num: number): number[] => {
  const count = arr.reduce((acc, [weight]) => acc + weight, 0);
  const nums = [...arr].sort(([, a], [, b]) => a - b);
  let total = 0;
  let prevValue = nums[0]?.[1] ?? 0;
  const percentiles: number[] = [];
  for (const [weight, value] of nums) {
    const newTotal = total + weight;
    while (newTotal > (percentiles.length * count) / num) {
      percentiles.push((prevValue + value) / 2);
    }
    if (newTotal === (percentiles.length * count) / num) {
      percentiles.push(value);
    }
    prevValue = value;
    total = newTotal;
  }
  return percentiles;
};

export const weightedStdDev = (arr: [number, number][], avg: number | null = null): number => {
  if (avg === null) {
    avg = weightedAverage(arr);
  }
  const squareDiffs: [number, number][] = arr.map(([weight, value]) => [weight, (value - avg) ** 2]);

  const count = arr.filter(([weight]) => weight).length;
  // Don't take stddev of 0 or 1 length vectors. The normalization is correct
  // something about degrees of freedom.
  const avgSquareDiff = (weightedAverage(squareDiffs) * count) / (count - 1 || 1);

  const stdDev = Math.sqrt(avgSquareDiff);
  return stdDev;
};
