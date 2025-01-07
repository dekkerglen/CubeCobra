import React, { useContext, useMemo } from 'react';

import AsfanDropdown from '../components/analytics/AsfanDropdown';
import ErrorBoundary from '../components/ErrorBoundary';
import { compareStrings, SortableTable } from '../components/SortableTable';
import { calculateAsfans } from '../drafting/createdraft';
import useQueryParam from '../hooks/useQueryParam';
import { sortIntoGroups, SORTS } from 'utils/Sort';
import CubeContext from '../contexts/CubeContext';
import Card from '../datatypes/Card';
import Select from '../components/base/Select';
import Text from '../components/base/Text';
import { Col, Flexbox, Row } from '../components/base/Layout';

const Asfans: React.FC = () => {
  const { cube, changedCards } = useContext(CubeContext);
  const cards = changedCards.mainboard;
  const [sort, setSort] = useQueryParam('sort', 'Color');
  const [draftFormat, setDraftFormat] = useQueryParam('format', '-1');

  const cardAsfans = useMemo(() => {
    try {
      return calculateAsfans(cube, cards, parseInt(draftFormat));
    } catch (e) {
      console.error('Invalid Draft Format', draftFormat, cube.formats[parseInt(draftFormat)], e);
      return {};
    }
  }, [cards, cube, draftFormat]);

  const cardsWithAsfan = useMemo(
    () => cards.map((card) => ({ ...card, asfan: cardAsfans[card.cardID] || 1 })),
    [cards, cardAsfans],
  );

  const asfans = useMemo(
    () =>
      Object.entries(sortIntoGroups(cardsWithAsfan, sort)).map(([label, cardsInGroup]) => ({
        label,
        asfan: (cardsInGroup as Card[]).reduce((acc, { asfan }) => acc + (asfan || 0), 0),
      })),
    [cardsWithAsfan, sort],
  );

  return (
    <Flexbox direction="col" gap="2" className="m-2">
      <Text>
        View the expected number of cards per player, per draft format. Standard Draft assumes 3 packs of 15 cards.
      </Text>
      <Text>
        We use 'Asfan' to mean the expected number of cards per player opened. So if red creatures have an Asfan of 2,
        on average I will see 2 red creatures in all the packs I open together. The more common meaning is per pack
        instead of per player, but with custom formats it makes more sense to talk about per player.
      </Text>
      <Row>
        <Col xs={12} md={6}>
          <AsfanDropdown
            cube={cube}
            draftFormat={draftFormat}
            setDraftFormat={setDraftFormat}
            useAsfans
            alwaysOn
            setUseAsfans={() => {}}
          />
        </Col>
        <Col xs={12} md={6}>
          <Select
            label="Order By"
            options={SORTS.map((item) => ({ value: item, label: item }))}
            value={sort}
            setValue={setSort}
          />
        </Col>
      </Row>
      <ErrorBoundary>
        <SortableTable
          columnProps={[
            { key: 'label', title: sort, heading: true, sortable: true },
            { key: 'asfan', title: 'Asfan', heading: false, sortable: true },
          ]}
          data={asfans}
          sortFns={{ label: compareStrings }}
        />
      </ErrorBoundary>
    </Flexbox>
  );
};

export default Asfans;
