function GetColorCat(type, colors) {
  if (type.toLowerCase().includes('land')) {
    return 'l';
  } else if (colors.length == 0) {
    return 'c';
  } else if (colors.length > 1) {
    return 'm';
  } else if (colors.length == 1) {
    switch (colors[0]) {
      case 'W':
        return 'w';
        break;
      case 'U':
        return 'u';
        break;
      case 'B':
        return 'b';
        break;
      case 'R':
        return 'r';
        break;
      case 'G':
        return 'g';
        break;
      case 'C':
        return 'c';
        break;
    }
  }
}

onmessage = (e) => {
  if (!e) return;
  var cards = e.data;
  var curve = {
    white: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    blue: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    black: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    red: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    green: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    colorless: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    multi: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    total: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  };

  var category;
  var asfan;
  cards.forEach(function(card, index) {
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
      case 'c':
        category = curve.colorless;
        break;
      case 'm':
        category = curve.multi;
        break;
    }
    asfan = card.asfan || 15 / cards.length;
    if (category) {
      if (card.cmc >= 9) {
        category[9] += asfan;
        curve.total[9] += asfan;
      } else {
        category[Math.floor(card.cmc)] += asfan;
        curve.total[Math.floor(card.cmc)] += asfan;
      }
    }
  });
  const data = {
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
  postMessage({
    type: 'bar',
    datasets: data,
    xAxisLabel: 'CMC',
    yAxisLabel: 'Asfan',
  });
};
