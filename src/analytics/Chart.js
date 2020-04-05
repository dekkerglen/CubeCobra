import React, { useState } from 'react';
import PropTypes from 'prop-types';
import ChartComponent from 'react-chartjs-2';
import { Col, Row, InputGroup, InputGroupAddon, CustomInput, InputGroupText } from 'reactstrap';
import { sortIntoGroups, getSorts, getLabels, cardIsLabel } from 'utils/Sort';

const Chart = ({ cards, characteristics }) => {
  const sorts = getSorts();

  const [sort, setSort] = useState('Color Identity');
  const [characteristic, setcharacteristic] = useState('CMC');

  const groups = sortIntoGroups(cards, sort);

  const colorMap = {
    White: '#D8CEAB',
    Blue: '#67A6D3',
    Black: '#8C7A91',
    Red: '#D85F69',
    Green: '#6AB572',
    Colorless: '#ADADAD',
    Multicolored: '#DBC467',
  };

  const getColor = (label) => {
    return colorMap[label] ?? '#000000';
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
            labelString: characteristic,
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
  const labels = getLabels(cards, characteristic);
  const data = {
    labels,
    datasets: Object.keys(groups).map((key) => ({
      label: key,
      data: labels.map((label) => groups[key].filter((card) => cardIsLabel(card, label, characteristic)).length),
      backgroundColor: getColor(key),
      borderColor: getColor(key),
    })),
  };

  return (
    <>
      <Row>
        <Col>
          <h4 className="d-lg-block d-none">Chart</h4>
          <p>View the counts of a characteristic on a chart. For unstacked columns, used 'Unsorted'.</p>
          <InputGroup className="mb-3">
            <InputGroupAddon addonType="prepend">
              <InputGroupText>Group by: </InputGroupText>
            </InputGroupAddon>
            <CustomInput type="select" value={sort} onChange={(event) => setSort(event.target.value)}>
              {sorts.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </CustomInput>
          </InputGroup>
          <InputGroup className="mb-3">
            <InputGroupAddon addonType="prepend">
              <InputGroupText>Characteristic: </InputGroupText>
            </InputGroupAddon>
            <CustomInput
              type="select"
              value={characteristic}
              onChange={(event) => setcharacteristic(event.target.value)}
            >
              {Object.keys(characteristics).map((key) => (
                <option key={key} value={key}>
                  {key}
                </option>
              ))}
            </CustomInput>
          </InputGroup>
        </Col>
      </Row>
      <ChartComponent options={options} data={data} type="bar" />
    </>
  );
};
Chart.propTypes = {
  cards: PropTypes.arrayOf(PropTypes.shape({})).isRequired,
  characteristics: PropTypes.shape({}).isRequired,
};

export default Chart;
