/* eslint-disable react/no-array-index-key */
/* eslint-disable jsx-a11y/anchor-is-valid */
import React, { useContext, useEffect, useState } from 'react';
import PropTypes from 'prop-types';

import { Row, Col, Spinner, Card } from 'reactstrap';

import CubeContext from 'contexts/CubeContext';
import withAutocard from 'components/WithAutocard';
import withCardModal from 'components/WithCardModal';

import { PlusCircleIcon, NoEntryIcon, ArrowSwitchIcon, ToolsIcon, ArrowRightIcon } from '@primer/octicons-react';
import CardPropType from 'proptypes/CardPropType';

const TextAutocard = withAutocard('span');
const CardModalLink = withCardModal(TextAutocard);

const capitalizeFirstLetter = (string) => {
  return string.charAt(0).toUpperCase() + string.slice(1);
};

const RemoveButton = ({ onClick }) => (
  <a href="#" className="clickx" onClick={onClick}>
    ×
  </a>
);

RemoveButton.propTypes = {
  onClick: PropTypes.func.isRequired,
};

const Add = ({ card, revert }) => {
  const [loading, setLoading] = useState(true);
  const [details, setDetails] = useState({});

  useEffect(() => {
    const getData = async () => {
      const response = await fetch(`/cube/api/getcardfromid/${card.cardID}`);
      if (response.ok) {
        const data = await response.json();
        setDetails(data.card);
        setLoading(false);
      }
      return null;
    };
    getData();
  }, [card]);

  return (
    <li>
      <RemoveButton onClick={revert} />
      <span className="mx-1" style={{ color: 'green' }}>
        <PlusCircleIcon />
      </span>
      {!loading ? <TextAutocard card={{ details, ...card }}>{details.name}</TextAutocard> : <Spinner size="sm" />}
    </li>
  );
};

Add.propTypes = {
  revert: PropTypes.func.isRequired,
  card: CardPropType.isRequired,
};

const Remove = ({ card, revert }) => (
  <li>
    <RemoveButton onClick={revert} />
    <span className="mx-1" style={{ color: 'red' }}>
      <NoEntryIcon />
    </span>
    <CardModalLink
      card={card}
      altClick={() => {
        window.open(`/tool/card/${card.cardID}`);
      }}
      modalProps={{
        card,
      }}
    >
      {card.details.name}
    </CardModalLink>
  </li>
);

Remove.propTypes = {
  revert: PropTypes.func.isRequired,
  card: PropTypes.shape({
    cardID: PropTypes.string.isRequired,
    details: PropTypes.shape({
      name: PropTypes.string.isRequired,
    }).isRequired,
  }).isRequired,
};

const Edit = ({ card, revert }) => (
  <li>
    <RemoveButton onClick={revert} />
    <span className="mx-1" style={{ color: 'orange' }}>
      <ToolsIcon />
    </span>
    <CardModalLink
      card={card}
      altClick={() => {
        window.open(`/tool/card/${card.cardID}`);
      }}
      modalProps={{
        card,
      }}
    >
      {card.details.name}
    </CardModalLink>
  </li>
);

Edit.propTypes = {
  revert: PropTypes.func.isRequired,
  card: PropTypes.shape({
    cardID: PropTypes.string.isRequired,
    details: PropTypes.shape({
      name: PropTypes.string.isRequired,
    }).isRequired,
  }).isRequired,
};

const Swap = ({ card, oldCard, revert }) => {
  const [loading, setLoading] = useState(true);
  const [details, setDetails] = useState({});

  useEffect(() => {
    const getData = async () => {
      const response = await fetch(`/cube/api/getcardfromid/${card.cardID}`);
      if (response.ok) {
        const data = await response.json();
        setDetails(data.card);
        setLoading(false);
      }
      return null;
    };
    getData();
  }, [card.cardID]);

  return (
    <li>
      <RemoveButton onClick={revert} />
      <span className="mx-1" style={{ color: 'blue' }}>
        <ArrowSwitchIcon />
      </span>
      <TextAutocard card={oldCard}>{oldCard.details.name}</TextAutocard>
      <ArrowRightIcon className="mx-1" />
      {!loading ? <TextAutocard card={{ details }}>{details.name}</TextAutocard> : <Spinner size="sm" />}
    </li>
  );
};

Swap.propTypes = {
  revert: PropTypes.func.isRequired,
  card: CardPropType.isRequired,
  oldCard: CardPropType.isRequired,
};

const Changelist = () => {
  const { cube, unfilteredChangedCards, changes, revertAdd, revertRemove, revertSwap, revertEdit } =
    useContext(CubeContext);

  return (
    <div>
      {Object.entries(changes).map(([board, { adds, removes, swaps, edits }]) => (
        <div key={board} className="mb-2">
          <h6>
            <Row>
              <Col>{capitalizeFirstLetter(board)} Changelist</Col>
              <Col className="col-sm-auto">
                <div className="text-secondary">
                  +{(adds || []).length}, -{(removes || []).length},{' '}
                  {cube.cards[board].length + (adds || []).length - (removes || []).length} Total
                </div>
              </Col>
            </Row>
          </h6>
          <Card className="changelist-container p-2">
            <ul className="changelist">
              {adds &&
                adds.map((card, index) => <Add key={card.cardID} card={card} revert={() => revertAdd(index, board)} />)}
              {removes &&
                removes.map((remove, index) => (
                  <Remove
                    key={remove.oldCard.cardID}
                    card={{ ...remove.oldCard, details: unfilteredChangedCards[board][remove.index].details }}
                    revert={() => revertRemove(index, board)}
                  />
                ))}
              {swaps &&
                swaps.map((swap, index) => (
                  <Swap
                    key={unfilteredChangedCards[board][swap.index].cardID}
                    oldCard={{ ...swap.oldCard, details: unfilteredChangedCards[board][swap.index].details }}
                    card={swap.card}
                    revert={() => revertSwap(index, board)}
                  />
                ))}
              {edits &&
                edits.map((edit, index) => (
                  <Edit
                    key={edit.oldCard.cardID}
                    card={{ ...edit.newCard, details: unfilteredChangedCards[board][edit.index].details }}
                    revert={() => revertEdit(index, board)}
                  />
                ))}
            </ul>
          </Card>
        </div>
      ))}
    </div>
  );
};

export default Changelist;
