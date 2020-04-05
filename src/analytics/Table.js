import React, { useState } from 'react';
import PropTypes from 'prop-types';

import { Col, Row, Table, InputGroup, InputGroupAddon, InputGroupText, CustomInput } from 'reactstrap';

import { sortIntoGroups, getSorts, getLabels } from 'utils/Sort';
import ErrorBoundary from 'components/ErrorBoundary';

const AnalyticTable = ({ cards }) => {
  const sorts = getSorts();

  const [primary, setPrimary] = useState('Color Identity');
  const [secondary, setSecondary] = useState('Type');

  const sortWithTotal = (pool, sort) => {
    const groups = sortIntoGroups(pool, sort);

    for (const key of Object.keys(groups)) {
      groups[key] = groups[key].length;
    }

    groups.Total = pool.length;

    return groups;
  };

  const groups = sortIntoGroups(cards, primary);
  groups.Total = {};
  for (const key of Object.keys(groups)) {
    if (key !== 'Total') {
      groups[key] = sortWithTotal(groups[key], secondary);

      for (const subkey of Object.keys(groups[key])) {
        if (!groups.Total[subkey]) {
          groups.Total[subkey] = 0;
        }
        groups.Total[subkey] += groups[key][subkey];
      }
    }
  }
  groups.Total.Total = cards.length;

  console.log(groups);

  const primaryGroups = sortIntoGroups(cards, primary);
  const secondaryGroups = sortIntoGroups(cards, secondary);

  const primaryLabels = getLabels(cards, primary)
    .filter((label) => primaryGroups[label])
    .concat(['Total']);
  const secondaryLabels = getLabels(cards, secondary)
    .filter((label) => secondaryGroups[label])
    .concat(['Total']);

  return (
    <>
      <Row>
        <Col>
          <h4 className="d-lg-block d-none">Table</h4>
          <p>View card counts and percentages.</p>
          <InputGroup className="mb-3">
            <InputGroupAddon addonType="prepend">
              <InputGroupText>Columns: </InputGroupText>
            </InputGroupAddon>
            <CustomInput type="select" value={primary} onChange={(event) => setPrimary(event.target.value)}>
              {sorts.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </CustomInput>
          </InputGroup>
          <InputGroup className="mb-3">
            <InputGroupAddon addonType="prepend">
              <InputGroupText>Rows: </InputGroupText>
            </InputGroupAddon>
            <CustomInput type="select" value={secondary} onChange={(event) => setSecondary(event.target.value)}>
              {sorts.map((item) => (
                <option key={item} value={item}>
                  {item}
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
              <th scope="col"> </th>
              {primaryLabels.map((label) => (
                <th key={label} scope="col">
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="breakdown">
            {secondaryLabels.map((label) => (
              <tr key={label}>
                <th scope="col">{label}</th>
                {primaryLabels.map((primaryLabel) => (
                  <td>
                    {groups[primaryLabel][label] || 0}
                    <span className="percent">{groups[primaryLabel][label] || 0 / cards.length}%</span>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </Table>
      </ErrorBoundary>
    </>
  );
};

AnalyticTable.propTypes = {
  cards: PropTypes.arrayOf(PropTypes.shape({})).isRequired,
};

export default AnalyticTable;
