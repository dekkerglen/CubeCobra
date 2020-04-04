import React, { useState } from 'react';
import PropTypes from 'prop-types';

import { Col, Row, Table, InputGroup, InputGroupAddon, InputGroupText, CustomInput, NavLink } from 'reactstrap';

import { getCmc } from 'utils/Card';
import { sortIntoGroups, getSorts } from 'utils/Sort';
import ErrorBoundary from 'components/ErrorBoundary';

const useSortableData = (items, config = null) => {
  const [sortConfig, setSortConfig] = useState(config);

  const sortedItems = React.useMemo(() => {
    const sortableItems = [...items];
    if (sortConfig !== null) {
      sortableItems.sort((a, b) => {
        if (a[sortConfig.key] - b[sortConfig.key] < 0) {
          return sortConfig.direction === 'ascending' ? -1 : 1;
        }
        if (a[sortConfig.key] - b[sortConfig.key] > 0) {
          return sortConfig.direction === 'ascending' ? 1 : -1;
        }
        return 0;
      });
    }
    return sortableItems;
  }, [items, sortConfig]);

  const requestSort = (key) => {
    let direction = 'descending';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'descending') {
      direction = 'ascending';
    }
    setSortConfig({ key, direction });
  };

  return { items: sortedItems, requestSort, sortConfig };
};

const HeaderCell = ({ label, fieldName, sortConfig, requestSort }) => {
  let icon = '/content/nosort.png';

  if (sortConfig && sortConfig.key === fieldName) {
    if (sortConfig.direction === 'descending') {
      icon = '/content/ascending.png';
    } else {
      icon = '/content/descending.png';
    }
  }

  return (
    <th scope="col">
      <NavLink href="#" onClick={() => requestSort(fieldName)}>
        {label} <img src={icon} className="sortIcon" alt="" />
      </NavLink>
    </th>
  );
};

HeaderCell.propTypes = {
  label: PropTypes.string.isRequired,
  fieldName: PropTypes.string.isRequired,
  sortConfig: PropTypes.shape({
    key: PropTypes.string.isRequired,
    direction: PropTypes.string.isRequired,
  }).isRequired,
  requestSort: PropTypes.string.isRequired,
};

const Averages = ({ cards }) => {
  const sorts = getSorts();
  const characteristics = {
    CMC: getCmc,
    Power: (card) => parseInt(card.details.power, 10),
    Toughness: (card) => parseInt(card.details.toughness, 10),
    Elo: (card) => parseFloat(card.details.elo, 10),
    Price: (card) => parseFloat(card.details.price),
    'Price Foil': (card) => parseFloat(card.details.price_foil),
  };

  const [sort, setSort] = useState('Color');
  const [Characteristic, setCharacteristic] = useState('CMC');

  const groups = sortIntoGroups(cards, sort);

  const average = (arr) => {
    const total = arr.reduce((acc, c) => acc + c, 0);
    return total / arr.length;
  };
  const median = (arr) => {
    const mid = Math.floor(arr.length / 2);
    const nums = [...arr].sort((a, b) => a - b);
    return arr.length % 2 !== 0 ? nums[mid] : (nums[mid - 1] + nums[mid]) / 2;
  };
  const stddev = (arr, avg) => {
    const squareDiffs = arr.map(function(value) {
      const diff = value - avg;
      const sqrDiff = diff * diff;
      return sqrDiff;
    });

    const avgSquareDiff = average(squareDiffs);

    const stdDev = Math.sqrt(avgSquareDiff);
    return stdDev;
  };

  const counts = Object.entries(groups)
    .map((tuple) => {
      const vals = tuple[1].map((card) => characteristics[Characteristic](card)).filter((x) => x);
      const avg = average(vals);
      return {
        label: tuple[0],
        mean: avg.toFixed(2),
        median: median(vals).toFixed(2),
        stddev: stddev(vals, avg).toFixed(2),
        count: vals.length,
        sum: (vals.length * avg).toFixed(2),
      };
    })
    .filter((row) => row.count > 0);

  const { items, requestSort, sortConfig } = useSortableData(counts);

  return (
    <Col xs="12" lg="10">
      <Row>
        <Col>
          <h4 className="d-lg-block d-none">Averages</h4>
          <p>View the averages of a characteristic for all the cards, grouped by category.</p>
          <InputGroup className="mb-3">
            <InputGroupAddon addonType="prepend">
              <InputGroupText>Order By: </InputGroupText>
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
              value={Characteristic}
              onChange={(event) => setCharacteristic(event.target.value)}
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
      <ErrorBoundary>
        <Table bordered responsive className="mt-lg-3">
          <thead>
            <tr>
              <th scope="col">{sort}</th>
              <HeaderCell label="Average" fieldName="mean" sortConfig={sortConfig} requestSort={requestSort} />
              <HeaderCell label="Median" fieldName="median" sortConfig={sortConfig} requestSort={requestSort} />
              <HeaderCell
                label="Standard Deviation"
                fieldName="stddev"
                sortConfig={sortConfig}
                requestSort={requestSort}
              />
              <HeaderCell label="Count" fieldName="count" sortConfig={sortConfig} requestSort={requestSort} />
              <HeaderCell label="Sum" fieldName="sum" sortConfig={sortConfig} requestSort={requestSort} />
            </tr>
          </thead>
          <tbody className="breakdown">
            {items.map((row) => (
              <tr key={row.label}>
                <th scope="col">{row.label}</th>
                <td>{row.mean}</td>
                <td>{row.median}</td>
                <td>{row.stddev}</td>
                <td>{row.count}</td>
                <td>{row.sum}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      </ErrorBoundary>
    </Col>
  );
};
Averages.propTypes = {
  cards: PropTypes.arrayOf(PropTypes.shape({})).isRequired,
};

export default Averages;
