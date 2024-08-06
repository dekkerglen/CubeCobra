import React, { useMemo } from 'react';
import { Col, Input, InputGroup, InputGroupText, Row } from 'reactstrap';

import PropTypes from 'prop-types';
import CubePropType from 'proptypes/CubePropType';

import AsfanDropdown from 'components/AsfanDropdown';
import ErrorBoundary from 'components/ErrorBoundary';
import { compareStrings, SortableTable } from 'components/SortableTable';
import { calculateAsfans } from 'drafting/createdraft';
import useQueryParam from 'hooks/useQueryParam';
import { sortIntoGroups, SORTS } from 'utils/Sort';

const Asfans = ({ cards, cube }) => {
  const [sort, setSort] = useQueryParam('sort', 'Color');
  const [draftFormat, setDraftFormat] = useQueryParam('format', -1);

  const cardAsfans = useMemo(() => {
    try {
      return calculateAsfans(cube, cards, draftFormat);
    } catch (e) {
      console.error('Invalid Draft Format', draftFormat, cube.formats[draftFormat], e);
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
        asfan: cardsInGroup.reduce((acc, { asfan }) => acc + asfan, 0),
      })),
    [cardsWithAsfan, sort],
  );

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
          <AsfanDropdown cube={cube} draftFormat={draftFormat} setDraftFormat={setDraftFormat} useAsfans alwaysOn />
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
  cube: CubePropType.isRequired,
  cards: PropTypes.arrayOf(PropTypes.shape({})).isRequired,
  asfans: PropTypes.shape({}).isRequired,
};

export default Asfans;
