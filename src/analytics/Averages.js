import React, { useMemo, useState } from 'react';
import PropTypes from 'prop-types';

import { Col, Row, InputGroup, InputGroupAddon, InputGroupText, CustomInput } from 'reactstrap';

import AsfanDropdown from 'components/AsfanDropdown';
import ErrorBoundary from 'components/ErrorBoundary';
import { cardType } from 'utils/Card';
import { weightedAverage, weightedMedian, weightedStdDev } from 'utils/draftutil';
import { sortIntoGroups, SORTS } from 'utils/Sort';
import { compareStrings, SortableTable } from 'components/SortableTable';

const Averages = ({ cards, characteristics, defaultFormatId, cube, setAsfans }) => {
  const [sort, setSort] = useState('Color');
  const [characteristic, setCharacteristic] = useState('CMC');

  const groups = useMemo(() => sortIntoGroups(cards, sort), [cards, sort]);

  const counts = useMemo(
    () =>
      Object.entries(groups)
        .map((tuple) => {
          const vals = tuple[1]
            .filter((card) => {
              if (characteristic === 'CMC') {
                /* If we are calculating the average cmc, we don't want to include lands in the average.
                   We can't just filter out 0 cmc cards, so we need to check the type here. */
                const type = cardType(card);
                if (type.toLowerCase().includes('land')) return false;
              }
              return true;
            })
            .map((card) => {
              return [card.asfan, characteristics[characteristic](card)];
            })
            .filter(([weight, x]) => {
              // Don't include null, undefined, or NaN values, but we still want to include 0 values.
              return weight && weight > 0 && (x || x === 0);
            });
          const avg = weightedAverage(vals);
          return {
            label: tuple[0],
            mean: avg.toFixed(2),
            median: weightedMedian(vals).toFixed(2),
            stddev: weightedStdDev(vals, avg).toFixed(2),
            count: vals.length,
            sum: (vals.length * avg).toFixed(2),
          };
        })
        .filter((row) => row.count > 0),
    [characteristic, characteristics, groups],
  );

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
      <AsfanDropdown cube={cube} defaultFormatId={defaultFormatId} setAsfans={setAsfans} />
      <ErrorBoundary>
        <SortableTable
          columnProps={[
            { key: 'label', title: sort, heading: true, sortable: true },
            { key: 'mean', title: 'Average (Mean)', sortable: true, heading: false },
            { key: 'median', title: 'Median', sortable: true, heading: false },
            { key: 'stddev', title: 'Standard Deviation', sortable: true, heading: false },
            { key: 'count', title: 'Count', sortable: true, heading: false },
            { key: 'sum', title: 'Sum', sortable: true, heading: false },
          ]}
          data={counts}
          sortFns={{ label: compareStrings }}
        />
      </ErrorBoundary>
    </>
  );
};
Averages.propTypes = {
  cards: PropTypes.arrayOf(PropTypes.shape({})).isRequired,
  characteristics: PropTypes.shape({}).isRequired,
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
Averages.defaultProps = {
  defaultFormatId: null,
};

export default Averages;
