import React, { MouseEventHandler, useContext, useEffect, useState } from 'react';

import { ArrowRightIcon, ArrowSwitchIcon, NoEntryIcon, PlusCircleIcon, ToolsIcon } from '@primer/octicons-react';

import withAutocard from 'components/WithAutocard';
import Text from 'components/base/Text';
import withCardModal from 'components/modals/WithCardModal';
import CubeContext from 'contexts/CubeContext';
import CardData, { boardTypes } from 'datatypes/Card';
import CardDetails from 'datatypes/CardDetails';
import { Card } from './base/Card';
import { Flexbox } from './base/Layout';
import Spinner from './base/Spinner';

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
    <Flexbox direction="row" gap="1" alignItems="center">
      <RemoveButton onClick={revert} />
      <span className="mx-1" style={{ color: 'green' }}>
        <PlusCircleIcon />
      </span>
      {!loading && details ? <TextAutocard card={{ details, ...card }}>{details.name}</TextAutocard> : <Spinner sm />}
    </Flexbox>
  );
};

const Remove = ({ card, revert }: { card: CardData; revert: () => void }) => (
  <Flexbox direction="row" gap="1">
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
  </Flexbox>
);

const Edit = ({ card, revert }: { card: CardData; revert: () => void }) => (
  <Flexbox direction="row" gap="1">
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
  </Flexbox>
);

const Swap = ({ card, oldCard, revert }: { card: CardData; oldCard: CardData; revert: () => void }) => {
  const [loading, setLoading] = useState(true);
  const [newCardDetails, setNewCardDetails] = useState<CardDetails | null>();
  const [oldCardDetails, setOldCardDetails] = useState<CardDetails | null>();

  useEffect(() => {
    const getData = async () => {
      const response = await fetch(`/cube/api/getcardfromid/${card.cardID}`);
      if (response.ok) {
        const data = await response.json();
        setNewCardDetails(data.card);
        setLoading(false);
      }

      const response2 = await fetch(`/cube/api/getcardfromid/${oldCard.cardID}`);
      if (response2.ok) {
        const data = await response2.json();
        setOldCardDetails(data.card);
        setLoading(false);
      }

      return null;
    };
    getData();
  }, [card.cardID]);

  return (
    <Flexbox direction="row" gap="1">
      <RemoveButton onClick={revert} />
      <span className="mx-1" style={{ color: 'blue' }}>
        <ArrowSwitchIcon />
      </span>
      {!loading && oldCardDetails ? (
        <TextAutocard card={{ ...oldCard, details: oldCardDetails }}>{oldCardDetails.name}</TextAutocard>
      ) : (
        <Spinner sm />
      )}
      <ArrowRightIcon className="mx-1" />
      {!loading && newCardDetails ? (
        <TextAutocard card={{ ...card, details: newCardDetails }}>{newCardDetails.name}</TextAutocard>
      ) : (
        <Spinner sm />
      )}
    </Flexbox>
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
        const { adds, removes, swaps, edits } = changes[board] || { adds: [], removes: [], swaps: [], edits: [] };
        if (adds.length === 0 && removes.length === 0 && swaps.length === 0 && edits.length === 0) {
          return false;
        }
        return (
          <div key={board} className="mb-2">
            <Text semibold sm>
              <Flexbox direction="row" justify="between">
                <Text sm semibold>
                  {capitalizeFirstLetter(board)} Changelist
                </Text>
                <div className="text-secondary">
                  +{adds.length + edits.length}, -{removes.length + edits.length},{' '}
                  {cube.cards[board].length + adds.length - removes.length} Total
                </div>
              </Flexbox>
            </Text>
            <Card className="changelist-container p-2">
              <ul className="changelist">
                {adds &&
                  adds.map((card, index) => <Add key={index} card={card} revert={() => revertAdd(index, board)} />)}
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
