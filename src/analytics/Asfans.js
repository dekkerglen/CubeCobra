import React, { useMemo } from 'react';
import PropTypes from 'prop-types';

import { Col, Row, InputGroup, InputGroupText, Input } from 'reactstrap';

import ErrorBoundary from 'components/ErrorBoundary';
import { compareStrings, SortableTable } from 'components/SortableTable';
import useQueryParam from 'hooks/useQueryParam';
import { SORTS, sortIntoGroups } from 'utils/Sort';
import AsfanDropdown from 'components/AsfanDropdown';

const Asfans = ({ cards, asfans: rawAsfans, cube, defaultFormatId, setAsfans }) => {
  const [sort, setSort] = useQueryParam('sort', 'Color');

  const cardsWithAsfan = useMemo(
    () => cards.map((card) => ({ ...card, asfan: rawAsfans[card.cardID] ?? 1 })),
    [cards, rawAsfans],
  );

  console.log(cardsWithAsfan);

  const asfans = useMemo(
    () =>
      Object.entries(sortIntoGroups(cardsWithAsfan, sort)).map(([label, cardsInGroup]) => ({
        label,
        asfan: cardsInGroup.reduce((acc, { asfan }) => acc + asfan, 0),
      })),
    [cardsWithAsfan, sort],
  );

  console.log(asfans);

  return (
    <>
      <Row>
        <Col>
          <h4 className="d-lg-block d-none">Asfans</h4>
          <p>
            View the expected number of cards per player, per draft format. Standard Draft assumes 3 packs of 15 cards.
          </p>
          <p>
            We use 'Asfan' to mean the expected number of cards per player opened. So if red creatures have an Asfan of
            2, on average I will see 2 red creatures in all the packs I open together. The more common meaning is per
            pack instead of per player, but with custom formats it makes more sense to talk about per player.
          </p>
          <AsfanDropdown cube={cube} cards={cards} defaultFormatId={defaultFormatId} setAsfans={setAsfans} />
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
    </>
  );
};

Asfans.propTypes = {
  cube: PropTypes.shape({
    cards: PropTypes.arrayOf(PropTypes.shape({})),
    formats: PropTypes.arrayOf(PropTypes.shape({})),
  }).isRequired,
  cards: PropTypes.arrayOf(PropTypes.shape({})).isRequired,
  asfans: PropTypes.shape({}).isRequired,
  defaultFormatId: PropTypes.string.isRequired,
  setAsfans: PropTypes.func.isRequired,
};

export default Asfans;
