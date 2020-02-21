import { weightedMedianOf, weightedMeanOf, weightedStdDevOf } from 'utils/Util';

export function getWeightedDatasetFor({
  data,
  minValue = 0,
  maxValue,
  bucketSize = null,
  dataSetLabel = 'Cards',
  dataSetColor = '#000000',
  round = true,
}) {
  data = data.filter(([a, b]) => a !== undefined && a !== null && b !== undefined && b !== null);
  let median = weightedMedianOf(data);
  let mean = weightedMeanOf(data);
  let stdDev = weightedStdDevOf(data);

  const buckets = [];
  const labels = [];
  if (bucketSize == null) {
    bucketSize = stdDev / 4;
  }
  bucketSize = Math.trunc(bucketSize);
  if (bucketSize === 0) {
    bucketSize = 1;
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
  labels.push(`Less than ${minValue + bucketSize}`);
  for (let i = 1; i < numBuckets - 1; i++) {
    buckets.push(0);
    if (bucketSize === 1) {
      labels.push(`${minValue + i * bucketSize}`);
    } else {
      labels.push(`${minValue + i * bucketSize}-${minValue + (i + 1) * bucketSize - 1}`);
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

export default { getWeightedDatasetFor, getOptionsForChart };
