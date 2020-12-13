import React, { useEffect, useMemo, useState } from 'react';
import PropTypes from 'prop-types';

import { Col, Row, InputGroup, InputGroupAddon, InputGroupText, CustomInput } from 'reactstrap';

import ErrorBoundary from 'components/ErrorBoundary';
import { compareStrings, SortableTable } from 'components/SortableTable';
import { SORTS, sortIntoGroups } from 'utils/Sort';
import { calculateAsfans } from 'utils/draftutil';
import { fromEntries } from 'utils/Util';

const Asfans = ({ cards: cardsNoAsfan, cube }) => {
  const [sort, setSort] = useState('Color');
  const [draftFormat, setDraftFormat] = useState(-1);
  const [asfanLookup, setAsfanLookup] = useState(fromEntries(cardsNoAsfan.map((card) => [card.cardID, 0])));
  const cards = useMemo(() => cardsNoAsfan.map((card) => ({ ...card, asfan: asfanLookup[card.cardID] })), [
    cardsNoAsfan,
    asfanLookup,
  ]);

  useEffect(() => {
    try {
      const asfans = calculateAsfans(cube, draftFormat);
      setAsfanLookup(asfans);
    } catch (e) {
      console.error('Invalid Draft Format', draftFormat, cube.draft_formats[draftFormat], e);
      setAsfanLookup(fromEntries(cube.cards.map((card) => [card.cardID, 0])));
    }
  }, [cube, draftFormat, setAsfanLookup]);

  const asfans = useMemo(
    () =>
      Object.entries(sortIntoGroups(cards, sort)).map(([label, cardsInGroup]) => ({
        label,
        asfan: cardsInGroup.reduce((acc, { asfan }) => acc + asfan, 0),
      })),
    [cards, sort],
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
          <InputGroup className="mb-3">
            <InputGroupAddon addonType="prepend">
              <InputGroupText>Draft Format: </InputGroupText>
            </InputGroupAddon>
            <CustomInput
              type="select"
              value={draftFormat}
              onChange={(event) => setDraftFormat(parseInt(event.target.value, 10))}
            >
              <option value={-1}>Standard Draft</option>
              {cube.draft_formats.map((format, index) => (
                <option key={format._id} value={index}>
                  {format.title}
                </option>
              ))}
            </CustomInput>
          </InputGroup>
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
    draft_formats: PropTypes.arrayOf(PropTypes.shape({})),
  }).isRequired,
  cards: PropTypes.arrayOf(PropTypes.shape({})).isRequired,
};

export default Asfans;
