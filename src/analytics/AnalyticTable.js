import React, { useCallback, useMemo } from 'react';
import PropTypes from 'prop-types';

import { Col, Row, InputGroup, InputGroupAddon, InputGroupText, CustomInput } from 'reactstrap';

import AsfanDropdown from 'components/AsfanDropdown';
import ErrorBoundary from 'components/ErrorBoundary';
import { SortableTable, compareStrings, valueRenderer } from 'components/SortableTable';
import useQueryParam from 'hooks/useQueryParam';
import CardPropType from 'proptypes/CardPropType';
import CubePropType from 'proptypes/CubePropType';
import { sortIntoGroups, SORTS, getLabels, cardCanBeSorted } from 'utils/Sort';
import { fromEntries } from 'utils/Util';

const sortWithTotal = (pool, sort) => {
  const groups = sortIntoGroups(pool, sort);

  for (const key of Object.keys(groups)) {
    groups[key] = groups[key].reduce((acc, card) => acc + card.asfan, 0);
  }

  groups.Total = pool.reduce((acc, card) => acc + card.asfan, 0);

  return groups;
};

const AnalyticTable = ({ cards: allCards, cube, defaultFormatId, setAsfans }) => {
  const [primary, setPrimary] = useQueryParam('primary', 'Color Identity');
  const [secondary, setSecondary] = useQueryParam('secondary', 'Type');

  // some criteria cannot be applied to some cards
  const cards = useMemo(
    () => allCards.filter((card) => cardCanBeSorted(card, primary) && cardCanBeSorted(card, secondary)),
    [allCards, primary, secondary],
  );
  const primaryGroups = useMemo(() => {
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
    return groups;
  }, [cards, primary, secondary]);
  const entryRenderer = useCallback(
    (value) => (
      <>
        {valueRenderer(value ?? 0)}
        <span className="percent">{valueRenderer(((value ?? 0) / primaryGroups.Total.Total) * 100)}%</span>
      </>
    ),
    [primaryGroups],
  );

  const primaryLabels = useMemo(
    () =>
      getLabels(cards, primary)
        .filter((label) => primaryGroups[label])
        .concat(['Total']),
    [cards, primary, primaryGroups],
  );
  const rows = useMemo(() => {
    const secondaryGroups = sortIntoGroups(cards, secondary);
    return getLabels(cards, secondary)
      .filter((label) => secondaryGroups[label])
      .concat(['Total'])
      .map((secondaryLabel) => ({
        secondaryLabel,
        ...fromEntries(
          primaryLabels.map((primaryLabel) => [primaryLabel, primaryGroups[primaryLabel][secondaryLabel] ?? 0]),
        ),
      }));
  }, [cards, secondary, primaryLabels, primaryGroups]);
  const columnProps = useMemo(
    () => [
      { key: 'secondaryLabel', title: '', heading: true, sortable: true },
      ...primaryLabels.map((title) => ({ key: title, title, heading: false, sortable: true, renderFn: entryRenderer })),
    ],
    [entryRenderer, primaryLabels],
  );

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
              {SORTS.map((item) => (
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
              {SORTS.map((item) => (
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
        <SortableTable
          columnProps={columnProps}
          data={rows}
          defaultSortConfig={{ key: 'secondaryLabel', direction: 'ascending' }}
          sortFns={{ secondaryLabel: compareStrings }}
        />
      </ErrorBoundary>
    </>
  );
};

AnalyticTable.propTypes = {
  cards: PropTypes.arrayOf(CardPropType.isRequired).isRequired,
  cube: CubePropType.isRequired,
  defaultFormatId: PropTypes.number,
  setAsfans: PropTypes.func.isRequired,
};
AnalyticTable.defaultProps = {
  defaultFormatId: null,
};

export default AnalyticTable;
