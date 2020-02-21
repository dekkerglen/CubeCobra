import { getCmc } from 'utils/Card';
import { GetColorCategory } from 'utils/Sort';

import { getWeightedDatasetFor, getOptionsForChart } from 'analytics/analyticsHelpers';

async function colorCurve(cards) {
  const colorCategoryColors = {
    White: '#D8CEAB',
    Blue: '#67A6D3',
    Black: '#8C7A91',
    Red: '#D85F69',
    Green: '#6AB572',
    Colorless: '#ADADAD',
    Multicolored: '#DBC467',
    Total: '#000000',
  };
  const cardsByCategory = cards.map((card) => [
    getCmc(card),
    card.asfan,
    GetColorCategory(card.details.type, card.colors),
  ]);
  let description =
    'Expected number of cards a player will open each draft at each CMC by color identity. Click the labels to filter the datasets. Lands are omitted for the curve chart.';
  let labels;
  const datasets = [];
  let dataset;
  let stats;
  for (const [colorCategory, color] of Object.entries(colorCategoryColors)) {
    ({ labels, dataset, stats } = getWeightedDatasetFor({
      data: cardsByCategory.filter(([, , category]) => category === colorCategory || colorCategory === 'Total'),
      minValue: 0,
      maxValue: 9,
      bucketSize: 1,
      dataSetColor: color,
      dataSetLabel: colorCategory,
      round: false,
    }));
    datasets.push(dataset);
    description += `\n\n${colorCategory} has ${stats.replace(/\n\n/g, ', ')}`;
  }

  const options = getOptionsForChart({ xAxisLabel: 'CMC' });
  return {
    type: 'chart',
    description,
    chartType: 'bar',
    datasets: {
      labels,
      datasets,
    },
    options,
  };
}

export default colorCurve;
