import React, { useState } from 'react';
import PropTypes from 'prop-types';

import { Col, Row, Table, InputGroup, InputGroupAddon, InputGroupText, CustomInput } from 'reactstrap';

import AsfanDropdown from 'components/AsfanDropdown';
import ErrorBoundary from 'components/ErrorBoundary';
import { sortIntoGroups, getSorts, getLabels, cardCanBeSorted } from 'utils/Sort';

const AnalyticTable = ({ cards, cube, defaultFormatId, setAsfans }) => {
  const sorts = getSorts();

  const [primary, setPrimary] = useState('Color Identity');
  const [secondary, setSecondary] = useState('Type');

  // some criteria cannot be applied to some cards
  cards = cards.filter((card) => cardCanBeSorted(card, primary) && cardCanBeSorted(card, secondary));

  const sortWithTotal = (pool, sort) => {
    const groups = sortIntoGroups(pool, sort);

    for (const key of Object.keys(groups)) {
      groups[key] = groups[key].reduce((acc, card) => acc + card.asfan, 0);
      if (!Number.isInteger(groups[key])) {
        groups[key] = groups[key].toFixed(2);
      }
    }

    groups.Total = pool.reduce((acc, card) => acc + card.asfan, 0);
    if (!Number.isInteger(groups.Total)) {
      groups.Total = groups.Total.toFixed(2);
    }

    return groups;
  };

  const primaryGroups = sortIntoGroups(cards, primary);
  const secondaryGroups = sortIntoGroups(cards, secondary);
  primaryGroups.Total = {};
  for (const key of Object.keys(primaryGroups)) {
    if (key !== 'Total') {
      primaryGroups[key] = sortWithTotal(primaryGroups[key], secondary);

      for (const subkey of Object.keys(primaryGroups[key])) {
        if (!primaryGroups.Total[subkey]) {
          primaryGroups.Total[subkey] = 0;
        }
        primaryGroups.Total[subkey] += parseFloat(primaryGroups[key][subkey], 10);
      }
    }
  }
  for (const subkey of Object.keys(primaryGroups.Total)) {
    if (!Number.isInteger(primaryGroups.Total[subkey])) {
      primaryGroups.Total[subkey] = primaryGroups.Total[subkey].toFixed(2);
    }
  }

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
      <AsfanDropdown cube={cube} defaultFormatId={defaultFormatId} setAsfans={setAsfans} />
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
                  <td key={`${primaryLabel}_${label}`}>
                    {primaryGroups[primaryLabel][label] || 0}
                    {label !== 'Total' && (
                      <span className="percent">
                        {(((primaryGroups[primaryLabel][label] ?? 0) / cards.length) * 100).toFixed(2)}%
                      </span>
                    )}
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
  cube: PropTypes.shape({
    cards: PropTypes.arrayOf(PropTypes.shape({ cardID: PropTypes.string.isRequired })).isRequired,
    draft_formats: PropTypes.arrayOf(
      PropTypes.shape({
        title: PropTypes.string.isRequired,
        _id: PropTypes.string.isRequired,
      }),
    ).isRequired,
    defaultDraftFormat: PropTypes.number,
  }).isRequired,
  defaultFormatId: PropTypes.number,
  setAsfans: PropTypes.func.isRequired,
};
AnalyticTable.defaultProps = {
  defaultFormatId: null,
};

export default AnalyticTable;
