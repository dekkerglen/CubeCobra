import React, { useContext, useMemo } from 'react';

import { cardType } from 'utils/cardutil';
import { sortIntoGroups, SORTS } from 'utils/Sort';
import { weightedAverage, weightedMedian, weightedStdDev } from 'utils/Stats';

import Card from '../../datatypes/Card';
import AsfanDropdown from '../components/analytics/AsfanDropdown';
import { Col, Flexbox, Row } from '../components/base/Layout';
import Select from '../components/base/Select';
import Text from '../components/base/Text';
import ErrorBoundary from '../components/ErrorBoundary';
import { compareStrings, SortableTable } from '../components/SortableTable';
import CubeContext from '../contexts/CubeContext';
import { calculateAsfans } from '../drafting/createdraft';
import useQueryParam from '../hooks/useQueryParam';

interface Characteristic {
  get: (card: Card) => number | string;
  labels: (list: any[]) => string[];
  cardIsLabel: (card: Card, label: string) => boolean;
}

interface AveragesProps {
  characteristics: { [key: string]: Characteristic };
}

const DEFAULT_SORT = 'Color';
const DEFAULT_CHARACTERISTIC = 'Mana Value';
const DEFAULT_USE_ASFANS = 'false';
const DEFAULT_DRAFT_FORMAT = '-1';

const Averages: React.FC<AveragesProps> = ({ characteristics }) => {
  const { cube, changedCards } = useContext(CubeContext);
  const cards = changedCards.mainboard;

  const [sort, setSort] = useQueryParam('sort', DEFAULT_SORT);
  const [characteristic, setCharacteristic] = useQueryParam('field', DEFAULT_CHARACTERISTIC);
  const [useAsfans, setUseAsfans] = useQueryParam('asfans', DEFAULT_USE_ASFANS);
  const [draftFormat, setDraftFormat] = useQueryParam('format', DEFAULT_DRAFT_FORMAT);

  const groups = useMemo(() => sortIntoGroups(cards, sort || DEFAULT_SORT), [cards, sort]);

  const asfans = useMemo(() => {
    if (useAsfans !== 'true') {
      return {};
    }
    try {
      return calculateAsfans(cube, cards, parseInt(draftFormat || '-1', 10));
    } catch (e) {
      // eslint-disable-next-line no-console -- Debugging
      console.error(
        'Invalid Draft Format',
        draftFormat,
        cube.formats[parseInt(draftFormat || DEFAULT_DRAFT_FORMAT, 10)],
        e,
      );
      return {};
    }
  }, [cube, cards, draftFormat, useAsfans]);

  const counts = useMemo(
    () =>
      Object.entries(groups)
        .map(([label, groupCards]) => {
          const vals = groupCards
            .filter((card) => {
              if (characteristic === 'Mana Value') {
                const type = cardType(card);
                if (type.toLowerCase().includes('land')) return false;
              }
              return true;
            })
            .map((card): [number, number] => {
              return [
                asfans[card.cardID] || 1,
                parseFloat(characteristics[characteristic || DEFAULT_CHARACTERISTIC].get(card).toString()),
              ];
            })
            .filter(([weight, x]) => {
              return weight && weight > 0 && (x || x === 0);
            });
          const avg = weightedAverage(vals);
          return {
            label,
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
    <Flexbox direction="col" gap="2" className="m-2">
      <Text>View the averages of a characteristic for all the cards, grouped by category.</Text>
      <Row>
        <Col xs={12} md={6}>
          <Select
            label="Order By"
            options={SORTS.map((item) => ({ value: item, label: item }))}
            value={sort || DEFAULT_SORT}
            setValue={setSort}
          />
        </Col>
        <Col xs={12} md={6}>
          <Select
            label="Characteristic"
            options={Object.keys(characteristics).map((item) => ({ value: item, label: item }))}
            value={characteristic || DEFAULT_CHARACTERISTIC}
            setValue={setCharacteristic}
          />
        </Col>
      </Row>
      <AsfanDropdown
        cube={cube}
        draftFormat={draftFormat || DEFAULT_DRAFT_FORMAT}
        setDraftFormat={(value) => setDraftFormat(value)}
        useAsfans={useAsfans === 'true'}
        setUseAsfans={(value) => setUseAsfans(`${value}`)}
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
          defaultSortConfig={undefined}
        />
      </ErrorBoundary>
    </Flexbox>
  );
};

export default Averages;
