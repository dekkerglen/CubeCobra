import { getWeightedDatasetFor, getOptionsForChart } from 'analytics/analyticsHelpers';

async function priceCurve(cards) {
  const prices = cards.map((card) => [card.price, card.asfan]).filter(([price]) => price > 0.001);
  console.log(prices);
  const { labels, dataset, stats } = getWeightedDatasetFor({
    data: prices,
    minValue: 0,
    maxValue: 20,
    roundBucket: false,
    round: false,
  });

  const options = getOptionsForChart({ xAxisLabel: 'Price' });
  return {
    type: 'chart',
    chartType: 'bar',
    description: `Expected number of cards a player will open each draft within the specified price range.\n\n${stats}`,
    options,
    datasets: { labels, datasets: [dataset] },
  };
}

export default priceCurve;
