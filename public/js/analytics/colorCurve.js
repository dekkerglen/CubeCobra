function GetColorCat(type, colors) {
  if (type.toLowerCase().includes('land')) {
    return 'l';
  }
  if (colors.length === 0) {
    return 'c';
  }
  if (colors.length > 1) {
    return 'm';
  }
  if (colors.length === 1) {
    switch (colors[0]) {
      case 'W':
        return 'w';
      case 'U':
        return 'u';
      case 'B':
        return 'b';
      case 'R':
        return 'r';
      case 'G':
        return 'g';
      case 'C':
      default:
        return 'c';
    }
  }
}

function GetCmc(card) {
  return card.cmc !== undefined ? card.cmc : card.details.cmc;
}

onmessage = (e) => {
  if (!e) return;
  const cards = e.data;
  const curve = {
    white: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    blue: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    black: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    red: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    green: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    colorless: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    multi: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    total: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  };

  for (const card of cards) {
    let category;
    switch (GetColorCat(card.details.type, card.colors)) {
      case 'w':
        category = curve.white;
        break;
      case 'u':
        category = curve.blue;
        break;
      case 'b':
        category = curve.black;
        break;
      case 'r':
        category = curve.red;
        break;
      case 'g':
        category = curve.green;
        break;
      case 'm':
        category = curve.multi;
        break;
      case 'c':
        category = curve.colorless;
        break;
      default:
        break;
    }
    // const asfan = card.asfan || 15 / cards.length;
    // Giving raw count instead of asfan currently.
    const asfan = 1;
    if (category) {
      if (GetCmc(card) >= 9) {
        category[9] += asfan;
        curve.total[9] += asfan;
      } else {
        category[Math.floor(GetCmc(card))] += asfan;
        curve.total[Math.floor(GetCmc(card))] += asfan;
      }
    }
  }
  const datasets = {
    labels: ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9+'],
    datasets: [
      ['White', curve.white, '#D8CEAB'],
      ['Blue', curve.blue, '#67A6D3'],
      ['Black', curve.black, '#8C7A91'],
      ['Red', curve.red, '#D85F69'],
      ['Green', curve.green, '#6AB572'],
      ['Colorless', curve.colorless, '#ADADAD'],
      ['Multicolored', curve.multi, '#DBC467'],
      ['Total', curve.total, '#000000'],
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
  postMessage({
    type: 'chart',
    description:
      'Count of cards at each CMC by color identity. Click the labels to filter the datasets. Lands are omitted for the curve chart.',
    chartType: 'bar',
    datasets,
    options,
  });
};
