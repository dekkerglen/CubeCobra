import React, { useMemo } from 'react';
import PropTypes from 'prop-types';
// eslint-disable-next-line no-unused-vars
import { Chart as ChartJS } from 'chart.js/auto';
import { Chart } from 'react-chartjs-2';
import { Col, Row, InputGroup, Input, InputGroupText } from 'reactstrap';

import AsfanDropdown from 'components/AsfanDropdown';
import useQueryParam from 'hooks/useQueryParam';
import CardPropType from 'proptypes/CardPropType';
import CubePropType from 'proptypes/CubePropType';
import { calculateAsfans } from 'drafting/createdraft';
import { sortIntoGroups, SORTS } from 'utils/Sort';

const ChartComponent = ({ cards, characteristics, cube }) => {
  const [sort, setSort] = useQueryParam('sort', 'Color Identity');
  const [characteristic, setcharacteristic] = useQueryParam('field', 'Mana Value');
  const [useAsfans, setUseAsfans] = useQueryParam('asfans', false);
  const [draftFormat, setDraftFormat] = useQueryParam('format', -1);

  const groups = sortIntoGroups(cards, sort);

  console.log(groups);

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

  const asfans = useMemo(() => {
    if (!useAsfans) {
      return {};
    }
    try {
      return calculateAsfans(cube, cards, draftFormat);
    } catch (e) {
      console.error('Invalid Draft Format', draftFormat, cube.formats[draftFormat], e);
      return {};
    }
  }, [cards, cube, draftFormat, useAsfans]);

  const data = useMemo(
    () => ({
      labels,
      datasets: Object.keys(groups).map((key, index) => ({
        label: key,
        data: labels.map((label) =>
          groups[key]
            .filter((card) => characteristics[characteristic].cardIsLabel(card, label))
            .reduce((acc, card) => acc + (asfans[card.cardID] || 1), 0),
        ),
        backgroundColor: getColor(key, index),
        borderColor: getColor(key, index),
      })),
    }),
    [labels, groups, getColor, characteristics, characteristic, asfans],
  );

  return (
    <>
      <Row>
        <Col>
          <h4 className="d-lg-block d-none">Chart</h4>
          <p>View the counts of a characteristic on a chart. For unstacked columns, use 'Unsorted'.</p>
          <InputGroup className="mb-3">
            <InputGroupText>Group by: </InputGroupText>
            <Input type="select" value={sort} onChange={(event) => setSort(event.target.value)}>
              {SORTS.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </Input>
          </InputGroup>
          <InputGroup className="mb-3">
            <InputGroupText>Characteristic: </InputGroupText>
            <Input type="select" value={characteristic} onChange={(event) => setcharacteristic(event.target.value)}>
              {Object.keys(characteristics).map((key) => (
                <option key={key} value={key}>
                  {key}
                </option>
              ))}
            </Input>
          </InputGroup>
        </Col>
      </Row>
      <AsfanDropdown
        cube={cube}
        draftFormat={draftFormat}
        setDraftFormat={setDraftFormat}
        useAsfans={useAsfans}
        setUseAsfans={setUseAsfans}
      />
      <Chart options={options} data={data} type="bar" />
    </>
  );
};
ChartComponent.propTypes = {
  cards: PropTypes.arrayOf(CardPropType).isRequired,
  characteristics: PropTypes.shape({}).isRequired,
  cube: CubePropType.isRequired,
};

export default ChartComponent;
