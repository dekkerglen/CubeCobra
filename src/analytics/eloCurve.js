import { weightedMedianOf, weightedMeanOf, weightedStdDevOf } from 'utils/Util';

async function eloCurve(cards) {
  const generateRandomly = false;
  if (generateRandomly) {
    cards = cards.map((card) => {
      card = { ...card };
      card.details.elo = Math.sqrt(-2 * Math.log(Math.random())) * Math.cos(2 * Math.PI * Math.random()) * 165 + 1500;
      return card;
    });
  }
  const elos = cards
    .map((card) => [card.details.elo, card.asfan])
    .filter(([a, b]) => a !== undefined && a !== null && b !== undefined && b !== null);
  const median = Math.round(weightedMedianOf(elos));
  const mean = Math.round(weightedMeanOf(elos));
  const stdDev = Math.round(weightedStdDevOf(elos));

  const buckets = [];
  const labels = [];
  const minElo = 0;
  const maxElo = 2250;
  const bucketSize = Math.trunc(stdDev / 4);
  const numBuckets = Math.ceil((maxElo - minElo) / bucketSize);
  for (let i = 0; i < numBuckets; i++) {
    buckets.push(0);
    labels.push(`${minElo + i * bucketSize}-${minElo + (i + 1) * bucketSize - 1}`);
  }

  for (const card of cards) {
    const { elo } = card.details;
    if (elo !== undefined && elo !== null) {
      const bucket = Math.max(Math.min(Math.trunc((elo - minElo) / bucketSize), numBuckets), 0);
      buckets[bucket] += card.asfan;
    }
  }

  const datasets = {
    labels,
    datasets: [
      {
        label: 'Cards',
        data: buckets.map((af) => af.toFixed(2)),
        fill: false,
        backgroundColor: '#000000',
        borderColor: '#000000',
      },
    ],
  };
  const options = {
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
            labelString: 'Elo',
          },
        },
      ],
      yAxes: [
        {
          display: true,
          scaleLabel: {
            display: true,
            labelString: 'Expected Opened',
          },
        },
      ],
    },
  };

  return {
    type: 'chart',
    description: `Expected number of cards a player will open each draft within the specified elo range.\n\nMedian Elo: ${median}\n\nAverage(Mean) Elo: ${mean}\n\nStandard Deviation of Elo: ${stdDev}`,
    chartType: 'bar',
    datasets,
    options,
  };
}

export default eloCurve;
