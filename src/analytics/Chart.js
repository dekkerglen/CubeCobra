import React, { useMemo } from 'react';
import PropTypes from 'prop-types';
import ChartComponent from 'react-chartjs-2';
import { Col, Row, InputGroup, InputGroupAddon, CustomInput, InputGroupText } from 'reactstrap';

import AsfanDropdown from 'components/AsfanDropdown';
import useQueryParam from 'hooks/useQueryParam';
import CardPropType from 'proptypes/CardPropType';
import CubePropType from 'proptypes/CubePropType';
import { sortIntoGroups, SORTS } from 'utils/Sort';

const Chart = ({ cards, characteristics, setAsfans, cube, defaultFormatId }) => {
  const [sort, setSort] = useQueryParam('sort', 'Color Identity');
  const [characteristic, setcharacteristic] = useQueryParam('field', 'Mana Value');

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
  const colors = [...Object.values(colorMap), '#000000'];

  const getColor = useMemo(
    () => (label, index) => {
      return colorMap[label] ?? colors[index % colors.length];
    },
    [colorMap, colors],
  );

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

  const labels = useMemo(
    () => characteristics[characteristic].labels(cards, characteristic),
    [characteristic, characteristics, cards],
  );

  const data = useMemo(
    () => ({
      labels,
      datasets: Object.keys(groups).map((key, index) => ({
        label: key,
        data: labels.map((label) =>
          groups[key]
            .filter((card) => characteristics[characteristic].cardIsLabel(card, label))
            .reduce((acc, card) => acc + card.asfan, 0),
        ),
        backgroundColor: getColor(key, index),
        borderColor: getColor(key, index),
      })),
    }),
    [labels, characteristic, characteristics, getColor, groups],
  );

  console.log(data);

  return (
    <>
      <Row>
        <Col>
          <h4 className="d-lg-block d-none">Chart</h4>
          <p>View the counts of a characteristic on a chart. For unstacked columns, use 'Unsorted'.</p>
          <InputGroup className="mb-3">
            <InputGroupAddon addonType="prepend">
              <InputGroupText>Group by: </InputGroupText>
            </InputGroupAddon>
            <CustomInput type="select" value={sort} onChange={(event) => setSort(event.target.value)}>
              {SORTS.map((item) => (
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
      <AsfanDropdown cube={cube} defaultFormatId={defaultFormatId} setAsfans={setAsfans} />
      <ChartComponent options={options} data={data} type="bar" />
    </>
  );
};
Chart.propTypes = {
  cards: PropTypes.arrayOf(CardPropType).isRequired,
  characteristics: PropTypes.shape({}).isRequired,
  cube: CubePropType.isRequired,
  defaultFormatId: PropTypes.number,
  setAsfans: PropTypes.func.isRequired,
};
Chart.defaultProps = {
  defaultFormatId: null,
};

export default Chart;
