import React, { useCallback, useMemo } from 'react';
import { Col, Input, InputGroup, InputGroupText, Row } from 'reactstrap';

import PropTypes from 'prop-types';
import CardPropType from 'proptypes/CardPropType';
import CubePropType from 'proptypes/CubePropType';

import AsfanDropdown from 'components/AsfanDropdown';
import ErrorBoundary from 'components/ErrorBoundary';
import { compareStrings, SortableTable, valueRenderer } from 'components/SortableTable';
import { calculateAsfans } from 'drafting/createdraft';
import useQueryParam from 'hooks/useQueryParam';
import { cardCanBeSorted, sortGroupsOrdered, SORTS } from 'utils/Sort';
import { fromEntries } from 'utils/Util';

const sortWithTotal = (pool, sort) =>
  [...sortGroupsOrdered(pool, sort), ['Total', pool]].map(([label, cards]) => [
    label,
    cards.reduce((acc, card) => acc + card.asfan, 0),
  ]);

const AnalyticTable = ({ cards, cube }) => {
  const [column, setColumn] = useQueryParam('column', 'Color Identity');
  const [row, setRow] = useQueryParam('row', 'Type');
  const [percentOf, setPercentOf] = useQueryParam('percentOf', 'total');
  const [useAsfans, setUseAsfans] = useQueryParam('asfans', false);
  const [draftFormat, setDraftFormat] = useQueryParam('format', -1);

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

  // some criteria cannot be applied to some cards
  const cardsWithAsfan = useMemo(
    () =>
      cards
        .filter((card) => cardCanBeSorted(card, column) && cardCanBeSorted(card, row))
        .map((card) => ({ ...card, asfan: asfans[card.cardID] || 1 })),
    [asfans, cards, column, row],
  );

  const [columnCounts, columnLabels] = useMemo(() => {
    const counts = sortWithTotal(cardsWithAsfan, column).filter(([label, count]) => label === 'Total' || count > 0);
    return [fromEntries(counts), counts.map(([label]) => label)];
  }, [cardsWithAsfan, column]);
  const rows = useMemo(
    () =>
      [...sortGroupsOrdered(cardsWithAsfan, row), ['Total', cardsWithAsfan]]
        .map(([label, groupCards]) => [label, fromEntries(sortWithTotal(groupCards, column))])
        .map(([rowLabel, columnValues]) => ({
          rowLabel,
          ...fromEntries(columnLabels.map((label) => [label, columnValues[label] ?? 0])),
        })),
    [cardsWithAsfan, column, row, columnLabels],
  );

  const entryRenderer = useCallback(
    (value, { Total: rowTotal }, columnLabel) => {
      value = Number.isFinite(value) ? value : 0;
      let scalingFactor = null;
      if (percentOf === 'total') scalingFactor = 100 / columnCounts.Total;
      else if (percentOf === 'row') scalingFactor = 100 / rowTotal;
      else if (percentOf === 'column') scalingFactor = 100 / columnCounts[columnLabel];
      return (
        <>
          {valueRenderer(value)}
          {scalingFactor && <span className="percent">{valueRenderer(value * scalingFactor)}%</span>}
        </>
      );
    },
    [columnCounts, percentOf],
  );

  const columnProps = useMemo(
    () => [
      { key: 'rowLabel', title: row, heading: true, sortable: true },
      ...columnLabels.map((title) => ({ key: title, title, heading: false, sortable: true, renderFn: entryRenderer })),
    ],
    [entryRenderer, columnLabels, row],
  );

  return (
    <>
      <Row>
        <Col>
          <h4 className="d-lg-block d-none">Table</h4>
          <p>View card counts and percentages.</p>
          <InputGroup className="mb-3">
            <InputGroupText>Columns: </InputGroupText>
            <Input id="columnSort" type="select" value={column} onChange={(event) => setColumn(event.target.value)}>
              {SORTS.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </Input>
          </InputGroup>
          <InputGroup className="mb-3">
            <InputGroupText>Rows: </InputGroupText>
            <Input id="rowSort" type="select" value={row} onChange={(event) => setRow(event.target.value)}>
              {SORTS.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </Input>
          </InputGroup>
          <InputGroup className="mb-3">
            <InputGroupText>Show Percent Of: </InputGroupText>
            <Input
              id="percentOf"
              type="select"
              value={percentOf}
              onChange={(event) => setPercentOf(event.target.value)}
            >
              <option key="total" value="total">
                Total
              </option>
              <option key="row" value="row">
                Row Total
              </option>
              <option key="column" value="column">
                Column Total
              </option>
              <option key="none" value="none">
                No Percent
              </option>
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
      <ErrorBoundary>
        <SortableTable columnProps={columnProps} data={rows} sortFns={{ rowLabel: compareStrings }} />
      </ErrorBoundary>
    </>
  );
};

AnalyticTable.propTypes = {
  cards: PropTypes.arrayOf(CardPropType.isRequired).isRequired,
  cube: CubePropType.isRequired,
};

export default AnalyticTable;
