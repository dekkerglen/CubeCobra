import React, { MouseEventHandler, useContext, useEffect, useState } from 'react';
import { Card, Col, Row, Spinner } from 'reactstrap';

import { ArrowRightIcon, ArrowSwitchIcon, NoEntryIcon, PlusCircleIcon, ToolsIcon } from '@primer/octicons-react';

import withAutocard from 'components/WithAutocard';
import withCardModal from 'components/WithCardModal';
import CubeContext from 'contexts/CubeContext';
import CardData, { boardTypes } from 'datatypes/Card';
import CardDetails from 'datatypes/CardDetails';

interface RemoveButtonProps {
  onClick: MouseEventHandler;
}

const TextAutocard = withAutocard('span');
const CardModalLink = withCardModal(TextAutocard);

const capitalizeFirstLetter = (string: string): string => {
  return string.charAt(0).toUpperCase() + string.slice(1);
};

const RemoveButton = ({ onClick }: RemoveButtonProps) => (
  <a href="#" className="clickx" onClick={onClick}>
    ×
  </a>
);

const Add = ({ card, revert }: { card: CardData; revert: () => void }) => {
  const [loading, setLoading] = useState(true);
  const [details, setDetails] = useState<CardDetails | null>(null);

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
      <span className="mx-1" style={{ color: 'green' }}>
        <PlusCircleIcon />
      </span>
      {!loading && details ? (
        <TextAutocard card={{ details, ...card }}>{details.name}</TextAutocard>
      ) : (
        <Spinner size="sm" />
      )}
    </li>
  );
};

const Remove = ({ card, revert }: { card: CardData; revert: () => void }) => (
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
      modalprops={{
        card,
      }}
    >
      {card.details?.name}
    </CardModalLink>
  </li>
);

const Edit = ({ card, revert }: { card: CardData; revert: () => void }) => (
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
      modalprops={{
        card,
      }}
    >
      {card.details?.name}
    </CardModalLink>
  </li>
);

const Swap = ({ card, oldCard, revert }: { card: CardData; oldCard: CardData; revert: () => void }) => {
  const [loading, setLoading] = useState(true);
  const [details, setDetails] = useState<CardDetails | null>();

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
      <TextAutocard card={oldCard}>{oldCard.details?.name}</TextAutocard>
      <ArrowRightIcon className="mx-1" />
      {!loading && details ? (
        <TextAutocard card={{ ...oldCard, details }}>{details.name}</TextAutocard>
      ) : (
        <Spinner size="sm" />
      )}
    </li>
  );
};

const Changelist: React.FC = () => {
  const cubeContextValue = useContext(CubeContext);
  if (cubeContextValue === null || cubeContextValue.cube === undefined) {
    return <></>;
  }

  const { cube, unfilteredChangedCards, changes, revertAdd, revertRemove, revertSwap, revertEdit } = cubeContextValue;

  return (
    <div>
      {boardTypes.map((board) => {
        const { adds, removes, swaps, edits } = changes[board];
        if (adds.length === 0 && removes.length === 0 && swaps.length === 0 && edits.length === 0) {
          return false;
        }
        return (
          <div key={board} className="mb-2">
            <h6>
              <Row>
                <Col>{capitalizeFirstLetter(board)} Changelist</Col>
                <Col className="col-sm-auto">
                  <div className="text-secondary">
                    +{adds.length + edits.length}, -{removes.length + edits.length},{' '}
                    {cube.cards[board].length + adds.length - removes.length} Total
                  </div>
                </Col>
              </Row>
            </h6>
            <Card className="changelist-container p-2">
              <ul className="changelist">
                {adds &&
                  adds.map((card, index) => (
                    <Add key={card.cardID} card={card} revert={() => revertAdd(index, board)} />
                  ))}
                {removes &&
                  removes.map((remove, index) => (
                    <Remove
                      key={remove.oldCard.cardID}
                      card={{
                        ...remove.oldCard,
                        details: unfilteredChangedCards[board][remove.index].details,
                      }}
                      revert={() => revertRemove(index, board)}
                    />
                  ))}
                {swaps &&
                  swaps.map((swap, index) => (
                    <Swap
                      key={unfilteredChangedCards[board][swap.index].cardID}
                      oldCard={{
                        ...swap.oldCard,
                        details: unfilteredChangedCards[board][swap.index].details,
                      }}
                      card={swap.card}
                      revert={() => revertSwap(index, board)}
                    />
                  ))}
                {edits &&
                  edits.map((edit, index) => (
                    <Edit
                      key={edit.oldCard.cardID}
                      card={{
                        ...edit.newCard,
                        details: unfilteredChangedCards[board][edit.index].details,
                      }}
                      revert={() => revertEdit(index, board)}
                    />
                  ))}
              </ul>
            </Card>
          </div>
        );
      })}
    </div>
  );
};

export default Changelist;
