import { getCmc } from 'utils/Card';
import { GetColorCategory } from 'utils/Sort';


async function colorCurve(cards) {
  const curve = {
    White: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    Blue: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    Black: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    Red: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    Green: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    Colorless: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    Multicolored: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    Total: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  };

  for (const card of cards) {
    let colorCategory = GetColorCategory(card.details.type, card.colors);
    if (card.details.type.toLowerCase().includes('land')) {
      colorCategory = 'Land';
    }
    const category = curve[colorCategory];
    // Giving raw count instead of asfan currently.
    const asfan = 1;
    if (category) {
      let cmc = Math.floor(getCmc(card));
      if (cmc >= 9) {
        cmc = 9;
      }
      if (cmc < 0) {
        cmc = 0;
      }
      category[cmc] += asfan;
      curve.Total[cmc] += asfan;
    }
  }
  const datasets = {
    labels: ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9+'],
    datasets: [
      ['White', curve.White, '#D8CEAB'],
      ['Blue', curve.Blue, '#67A6D3'],
      ['Black', curve.Black, '#8C7A91'],
      ['Red', curve.Red, '#D85F69'],
      ['Green', curve.Green, '#6AB572'],
      ['Colorless', curve.Colorless, '#ADADAD'],
      ['Multicolored', curve.Multicolored, '#DBC467'],
      ['Total', curve.Total, '#000000'],
    ].map((color) => ({
      label: color[0],
      data: color[1].map((af) => af.toFixed(2)),
      fill: false,
      backgroundColor: color[2],
      borderColor: color[2],
    })),
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
            labelString: 'CMC',
          },
        },
      ],
      yAxes: [
        {
          display: true,
          scaleLabel: {
            display: true,
            labelString: 'Count',
          },
        },
      ],
    },
  };
  return {
    type: 'chart',
    description:
      'Count of cards at each CMC by color identity. Click the labels to filter the datasets. Lands are omitted for the curve chart.',
    chartType: 'bar',
    datasets,
    options,
  };
}

export default colorCurve;
