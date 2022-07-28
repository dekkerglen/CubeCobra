/* eslint-disable react/no-array-index-key */
/* eslint-disable jsx-a11y/anchor-is-valid */
import React, { useContext, useEffect, useState } from 'react';
import PropTypes from 'prop-types';

import { Row, Col, Spinner, Card } from 'reactstrap';

import CubeContext from 'contexts/CubeContext';
import withAutocard from 'components/WithAutocard';
import withCardModal from 'components/WithCardModal';

import { PlusCircleIcon, XCircleIcon, PlayIcon, GearIcon, ArrowRightIcon } from '@primer/octicons-react';

const TextAutocard = withAutocard('span');
const CardModalLink = withCardModal(TextAutocard);

const RemoveButton = ({ onClick }) => (
  <a href="#" className="clickx" onClick={onClick}>
    ×
  </a>
);

RemoveButton.propTypes = {
  onClick: PropTypes.func.isRequired,
};

const Add = ({ cardId, revert }) => {
  const [loading, setLoading] = useState(true);
  const [card, setCard] = useState({});

  useEffect(() => {
    const getData = async () => {
      const response = await fetch(`/cube/api/getcardfromid/${cardId}`);
      if (response.ok) {
        const data = await response.json();
        setCard(data.card);
        setLoading(false);
      }
      return null;
    };
    getData();
  }, [cardId]);

  return (
    <li>
      <RemoveButton onClick={revert} />
      <span className="mx-1" style={{ color: 'green' }}>
        <PlusCircleIcon />
      </span>
      {!loading ? <TextAutocard card={{ details: card }}>{card.name}</TextAutocard> : <Spinner size="sm" />}
    </li>
  );
};

Add.propTypes = {
  revert: PropTypes.func.isRequired,
  cardId: PropTypes.string.isRequired,
};

const Remove = ({ card, revert }) => (
  <li>
    <RemoveButton onClick={revert} />
    <span className="mx-1" style={{ color: 'red' }}>
      <XCircleIcon />
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
      <GearIcon />
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

const Swap = ({ cardIdToAdd, cardToRemove, revert }) => {
  const [loading, setLoading] = useState(true);
  const [cardToAdd, setCard] = useState({});

  useEffect(() => {
    const getData = async () => {
      const response = await fetch(`/cube/api/getcardfromid/${cardIdToAdd}`);
      if (response.ok) {
        const data = await response.json();
        setCard(data.card);
        setLoading(false);
      }
      return null;
    };
    getData();
  }, [cardIdToAdd]);

  return (
    <li>
      <RemoveButton onClick={revert} />
      <span className="mx-1" style={{ color: 'blue' }}>
        <PlayIcon />
      </span>
      <TextAutocard card={cardToRemove}>{cardToRemove.details.name}</TextAutocard>
      <ArrowRightIcon className="mx-1" />
      {!loading ? <TextAutocard card={{ details: cardToAdd }}>{cardToAdd.name}</TextAutocard> : <Spinner size="sm" />}
    </li>
  );
};

Swap.propTypes = {
  revert: PropTypes.func.isRequired,
  cardIdToAdd: PropTypes.string.isRequired,
  cardToRemove: PropTypes.shape({
    details: PropTypes.shape({
      name: PropTypes.string.isRequired,
    }).isRequired,
  }).isRequired,
};

const Changelist = () => {
  const { cube, changedCards, changes, revertAdd, revertRemove, revertSwap, revertEdit } = useContext(CubeContext);
  return (
    <div>
      {Object.entries(changes).map(([board, { adds, removes, swaps, edits }]) => (
        <div key={board} className="mb-2">
          <h6>
            <Row>
              <Col>{board} Changelist</Col>
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
                adds.map((card, index) => (
                  <Add key={card.cardID} cardId={card.cardID} revert={() => revertAdd(index, board)} />
                ))}
              {removes &&
                removes.map((remove, index) => (
                  <Remove
                    key={changedCards[board][remove.index].cardID}
                    card={changedCards[board][remove.index]}
                    revert={() => revertRemove(index, board)}
                  />
                ))}
              {swaps &&
                swaps.map((swap, index) => (
                  <Swap
                    key={changedCards[board][swap.index].cardID}
                    cardToRemove={changedCards[board][swap.index]}
                    cardIdToAdd={swap.card.cardID}
                    revert={() => revertSwap(index, board)}
                  />
                ))}
              {edits &&
                edits.map((edit, index) => (
                  <Edit
                    key={edit.oldCard.cardID}
                    card={changedCards[board][edit.index]}
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
