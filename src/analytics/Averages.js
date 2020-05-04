import React, { useState } from 'react';
import PropTypes from 'prop-types';

import { Col, Row, Table, InputGroup, InputGroupAddon, InputGroupText, CustomInput } from 'reactstrap';

import { sortIntoGroups, getSorts } from 'utils/Sort';
import { average, median, stddev } from 'utils/draftutil';
import ErrorBoundary from 'components/ErrorBoundary';
import useSortableData from 'hooks/UseSortableData';
import HeaderCell from 'components/HeaderCell';

const Averages = ({ cards, characteristics }) => {
  const sorts = getSorts();
  const [sort, setSort] = useState('Color');
  const [characteristic, setcharacteristic] = useState('CMC');

  const groups = sortIntoGroups(cards, sort);

  const counts = Object.entries(groups)
    .map((tuple) => {
      const vals = tuple[1]
        .filter((card) => {
          if (characteristic === 'CMC') {
            /* If we are calculating the average cmc, we don't want to include lands in the average.
               We can't just filter out 0 cmc cards, so we need to check the type here. */
            const type = card.type_line || card.details.type;
            if (type.toLowerCase().includes('land')) return false;
          }
          return true;
        })
        .map((card) => {
          return characteristics[characteristic](card);
        })
        .filter((x) => {
          // Don't include null, undefined, or NaN values, but we still want to include 0 values.
          return x || x === 0;
        });
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
    <>
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
    </>
  );
};
Averages.propTypes = {
  cards: PropTypes.arrayOf(PropTypes.shape({})).isRequired,
  characteristics: PropTypes.shape({}).isRequired,
};

export default Averages;
