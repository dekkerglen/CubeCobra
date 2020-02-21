import { getWeightedDatasetFor, getOptionsForChart } from 'analytics/analyticsHelpers';

async function eloCurve(cards) {
  const generateRandomly = false;
  if (generateRandomly) {
    cards = cards.map((card) => {
      card = { ...card };
      card.details.elo = Math.sqrt(-2 * Math.log(Math.random())) * Math.cos(2 * Math.PI * Math.random()) * 180 + 1200;
      return card;
    });
  }

  const elos = cards.map((card) => [card.details.elo, card.asfan]);

  const { labels, dataset, stats } = getWeightedDatasetFor({
    data: elos,
    minValue: 500,
    maxValue: 2250,
  });

  const options = getOptionsForChart({ xAxisLabel: 'Elo' });
  return {
    type: 'chart',
    chartType: 'bar',
    description: `Expected number of cards a player will open each draft within the specified elo range.\n\n${stats}`,
    options,
    datasets: { labels, datasets: [dataset] },
  };
}

export default eloCurve;
