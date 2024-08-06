import React, { useMemo } from 'react';
import { Col, Input, InputGroup, InputGroupText, Row } from 'reactstrap';

import PropTypes from 'prop-types';

import AsfanDropdown from 'components/AsfanDropdown';
import ErrorBoundary from 'components/ErrorBoundary';
import { compareStrings, SortableTable } from 'components/SortableTable';
import { calculateAsfans, weightedAverage, weightedMedian, weightedStdDev } from 'drafting/createdraft';
import useQueryParam from 'hooks/useQueryParam';
import { cardType } from 'utils/Card';
import { sortIntoGroups, SORTS } from 'utils/Sort';

const Averages = ({ cards, characteristics, cube }) => {
  const [sort, setSort] = useQueryParam('sort', 'Color');
  const [characteristic, setCharacteristic] = useQueryParam('field', 'Mana Value');
  const [useAsfans, setUseAsfans] = useQueryParam('asfans', false);
  const [draftFormat, setDraftFormat] = useQueryParam('format', -1);

  const groups = useMemo(() => sortIntoGroups(cards, sort), [cards, sort]);

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

  const counts = useMemo(
    () =>
      Object.entries(groups)
        .map((tuple) => {
          const vals = tuple[1]
            .filter((card) => {
              if (characteristic === 'Mana Value') {
                /* If we are calculating the average cmc, we don't want to include lands in the average.
                   We can't just filter out 0 cmc cards, so we need to check the type here. */
                const type = cardType(card);
                if (type.toLowerCase().includes('land')) return false;
              }
              return true;
            })
            .map((card) => {
              return [asfans[card.cardID] || 1, parseFloat(characteristics[characteristic].get(card), 10)];
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
    [asfans, characteristic, characteristics, groups],
  );

  return (
    <>
      <Row>
        <Col>
          <h4 className="d-lg-block d-none">Averages</h4>
          <p>View the averages of a characteristic for all the cards, grouped by category.</p>
          <InputGroup className="mb-3">
            <InputGroupText>Order By: </InputGroupText>
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
            <Input type="select" value={characteristic} onChange={(event) => setCharacteristic(event.target.value)}>
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
    formats: PropTypes.arrayOf(
      PropTypes.shape({
        title: PropTypes.string.isRequired,
      }),
    ).isRequired,
    defaultDraftFormat: PropTypes.number,
  }).isRequired,
};

export default Averages;
