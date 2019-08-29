var data = JSON.parse(document.getElementById('curveData').value);

var config = {
  type: 'bar',
  data: {
    labels: ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9+'],
    datasets: [{
      label: 'White',
      data: data.white,
      fill: false,
      backgroundColor: '#D8CEAB',
      borderColor: '#D8CEAB'
    }, {
      label: 'Blue',
      data: data.blue,
      fill: false,
      backgroundColor: '#67A6D3',
      borderColor: '#67A6D3'
    }, {
      label: 'Black',
      data: data.black,
      fill: false,
      backgroundColor: '#8C7A91',
      borderColor: '#8C7A91'
    }, {
      label: 'Red',
      data: data.red,
      fill: false,
      backgroundColor: '#D85F69',
      borderColor: '#D85F69'
    }, {
      label: 'Green',
      data: data.green,
      fill: false,
      backgroundColor: '#6AB572',
      borderColor: '#6AB572'
    }, {
      label: 'Colorless',
      data: data.colorless,
      fill: false,
      backgroundColor: '#ADADAD',
      borderColor: '#ADADAD'
    }, {
      label: 'Multicolored',
      data: data.multi,
      fill: false,
      backgroundColor: '#DBC467',
      borderColor: '#DBC467'
    }, {
      label: 'Total',
      data: data.total,
      fill: false,
      backgroundColor: '#000000',
      borderColor: '#000000'
    }]
  },
  options: {
    responsive: true,
    tooltips: {
      mode: 'index',
      intersect: false,
    },
    hover: {
      mode: 'nearest',
      intersect: true
    },
    scales: {
      xAxes: [{
        display: true,
        scaleLabel: {
          display: true,
          labelString: 'CMC'
        }
      }],
      yAxes: [{
        display: true,
        scaleLabel: {
          display: true,
          labelString: 'Count'
        }
      }]
    }
  }
};

var ctx = document.getElementById('canvas').getContext('2d');
window.myLine = new Chart(ctx, config);