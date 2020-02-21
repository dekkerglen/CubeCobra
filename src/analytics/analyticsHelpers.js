import { weightedMedianOf, weightedMeanOf, weightedStdDevOf } from 'utils/Util';

export const colorCombinations = [
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
export function getWeightedDatasetFor({
  data,
  minValue = 0,
  maxValue,
  bucketSize = null,
  dataSetLabel = 'Cards',
  dataSetColor = '#000000',
  roundBucket = true,
  round = true,
}) {
  data = data.filter(([a, b]) => a !== undefined && a !== null && b !== undefined && b !== null);
  let median = weightedMedianOf(data);
  let mean = weightedMeanOf(data);
  let stdDev = weightedStdDevOf(data);

  const buckets = [];
  const labels = [];
  if (bucketSize == null) {
    bucketSize = Math.min(median / 2, stdDev / 4);
  }
  if (roundBucket) {
    bucketSize = Math.trunc(bucketSize);
  }
  if (bucketSize < (roundBucket ? 1 : 0.01)) {
    bucketSize = roundBucket ? 1 : 0.01;
  }
  if (round) {
    median = Math.round(median);
    mean = Math.round(mean);
    stdDev = Math.round(stdDev);
  } else {
    median = median.toFixed(2);
    mean = mean.toFixed(2);
    stdDev = stdDev.toFixed(2);
  }

  const numBuckets = Math.ceil((maxValue - minValue) / bucketSize);
  buckets.push(0);
  const firstBucketValue = minValue + bucketSize;
  if (roundBucket) {
    labels.push(`Less than ${firstBucketValue}`);
  } else {
    labels.push(`Less than ${firstBucketValue.toFixed(2)}`);
  }
  for (let i = 1; i < numBuckets - 1; i++) {
    buckets.push(0);
    let minBucketValue = minValue + i * bucketSize;
    let maxBucketValue = minBucketValue + bucketSize - (roundBucket ? 1 : 0.01);
    if (!roundBucket) {
      minBucketValue = minBucketValue.toFixed(2);
      maxBucketValue = maxBucketValue.toFixed(2);
    }
    if (bucketSize === 1 && roundBucket) {
      labels.push(minBucketValue);
    } else {
      labels.push(`${minBucketValue}-${maxBucketValue}`);
    }
  }
  buckets.push(0);
  labels.push(`${(numBuckets - 1) * bucketSize + minValue} or More`);

  for (const [value, weight] of data) {
    const bucket = Math.max(Math.min(Math.trunc((value - minValue) / bucketSize), numBuckets - 1), 0);
    buckets[bucket] += weight;
  }

  return {
    labels,
    dataset: {
      label: dataSetLabel,
      data: buckets.map((af) => af.toFixed(2)),
      fill: true,
      backgroundColor: dataSetColor,
      borderColor: dataSetColor,
    },
    stats: `Median: ${median}\n\nAverage(Mean): ${mean}\n\nStandard Deviation: ${stdDev}`,
  };
}

export function getOptionsForChart({ xAxisLabel, yAxisLabel = 'Expected Opened' }) {
  return {
    responsive: true,
    tooltips: {
      mode: 'index',
      intersect: false,
    },
    hover: {
      mode: 'nearest',
      intersect: true,
    },
    scales: {
      xAxes: [
        {
          display: true,
          scaleLabel: {
            display: true,
            labelString: xAxisLabel,
          },
        },
      ],
      yAxes: [
        {
          display: true,
          scaleLabel: {
            display: true,
            labelString: yAxisLabel,
          },
        },
      ],
    },
  };
}

export default { getWeightedDatasetFor, getOptionsForChart, colorCombinations };
