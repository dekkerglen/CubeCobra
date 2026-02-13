import React, { MouseEventHandler, useContext, useEffect, useState } from 'react';

import { ArrowRightIcon, ArrowSwitchIcon, NoEntryIcon, PlusCircleIcon, ToolsIcon } from '@primer/octicons-react';
import { cardName } from '@utils/cardutil';
import CardData, { BoardChanges, BoardType, CubeCardEdit, CubeCardRemove, CubeCardSwap } from '@utils/datatypes/Card';
import { CardDetails } from '@utils/datatypes/Card';

import CubeContext from '../contexts/CubeContext';
import { Card } from './base/Card';
import { Flexbox } from './base/Layout';
import Link from './base/Link';
import Spinner from './base/Spinner';
import Text from './base/Text';
import withCardModal from './modals/WithCardModal';
import withAutocard from './WithAutocard';

interface RemoveButtonProps {
  onClick: MouseEventHandler;
}

const TextAutocard = withAutocard('span');
const AutocardLink = withAutocard(Link);
const CardModalLink = withCardModal(AutocardLink);

const capitalizeFirstLetter = (string: string): string => {
  return string.charAt(0).toUpperCase() + string.slice(1);
};

const RemoveButton = ({ onClick }: RemoveButtonProps) => (
  <a href="#" className="clickx" onClick={onClick}>
    ×
  </a>
);

const Add = ({
  card,
  revert,
  index,
  board,
}: {
  card: CardData;
  revert: () => void;
  index: number;
  board: 'mainboard' | 'maybeboard';
}) => {
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
      {!loading && details ? (
        <CardModalLink
          card={{ details, ...card }}
          altClick={() => {
            window.open(`/tool/card/${card.cardID}`);
          }}
          modalprops={{
            card: {
              board,
              index,
              isNewlyAdded: true,
              addIndex: index,
            },
          }}
        >
          {cardName({ details, ...card })}
        </CardModalLink>
      ) : (
        <Spinner sm />
      )}
    </Flexbox>
  );
};

const Remove = ({ card, revert }: { card: CardData; revert: () => void }) => (
  <Flexbox direction="row" gap="1">
    <RemoveButton onClick={revert} />
    <span className="mx-1" style={{ color: 'red' }}>
      <NoEntryIcon />
    </span>
    <TextAutocard card={card}>{cardName(card)}</TextAutocard>
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
      {cardName(card)}
    </CardModalLink>
  </Flexbox>
);

const Swap = ({
  card,
  oldCard,
  revert,
  index,
  board,
}: {
  card: CardData;
  oldCard: CardData;
  revert: () => void;
  index: number;
  board: 'mainboard' | 'maybeboard';
}) => {
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
  }, [card.cardID, oldCard.cardID]);

  return (
    <Flexbox direction="row" gap="1">
      <RemoveButton onClick={revert} />
      <span className="mx-1" style={{ color: 'blue' }}>
        <ArrowSwitchIcon />
      </span>
      {!loading && oldCardDetails ? (
        <TextAutocard card={{ ...oldCard, details: oldCardDetails }}>
          {cardName({ details: oldCardDetails, ...oldCard })}
        </TextAutocard>
      ) : (
        <Spinner sm />
      )}
      <ArrowRightIcon className="mx-1" />
      {!loading && newCardDetails ? (
        <CardModalLink
          card={{ ...card, details: newCardDetails }}
          altClick={() => {
            window.open(`/tool/card/${card.cardID}`);
          }}
          modalprops={{
            card: {
              board,
              index,
              isSwapped: true,
              swapIndex: index,
            },
          }}
        >
          {cardName({ details: newCardDetails, ...card })}
        </CardModalLink>
      ) : (
        <Spinner sm />
      )}
    </Flexbox>
  );
};

const Changelist: React.FC = () => {
  const [isLoadingNewCards, setIsLoadingNewCards] = useState(false);

  const cubeContextValue = useContext(CubeContext);
  if (cubeContextValue === null || cubeContextValue.cube === undefined) {
    return <></>;
  }

  const {
    cube,
    unfilteredChangedCards,
    changes,
    revertAdd,
    revertRemove,
    revertSwap,
    revertEdit,
    setModalSelection,
    setModalOpen,
  } = cubeContextValue;

  const handleEditAllNewCards = async () => {
    setIsLoadingNewCards(true);

    // Collect all newly added and swapped cards
    const newCards: CardData[] = [];

    for (const board of ['mainboard', 'maybeboard'] as const) {
      const boardChanges = changes[board] as BoardChanges | undefined;
      const { adds, swaps } = boardChanges || { adds: [], swaps: [] };

      // Add all newly added cards
      for (let index = 0; index < (adds || []).length; index++) {
        const card = adds![index];
        const response = await fetch(`/cube/api/getcardfromid/${card.cardID}`);
        if (response.ok) {
          const data = await response.json();
          newCards.push({
            ...card,
            details: data.card,
            board,
            index: -1, // Sentinel value for new cards
            addIndex: index,
          } as CardData);
        }
      }

      // Add all newly swapped-in cards
      for (let index = 0; index < (swaps || []).length; index++) {
        const swap = swaps![index];
        const response = await fetch(`/cube/api/getcardfromid/${swap.card.cardID}`);
        if (response.ok) {
          const data = await response.json();
          newCards.push({
            ...swap.card,
            details: data.card,
            board,
            index: -1, // Sentinel value for new cards
            swapIndex: index,
          } as CardData);
        }
      }
    }

    if (newCards.length > 0) {
      // Set modal selection to indicate group modal for new cards
      setModalSelection(newCards as any);
      setModalOpen(true);
    }

    setIsLoadingNewCards(false);
  };

  const totalNewCards =
    ((changes.mainboard as BoardChanges | undefined)?.adds?.length || 0) +
    ((changes.maybeboard as BoardChanges | undefined)?.adds?.length || 0) +
    ((changes.mainboard as BoardChanges | undefined)?.swaps?.length || 0) +
    ((changes.maybeboard as BoardChanges | undefined)?.swaps?.length || 0);

  return (
    <div>
      {totalNewCards > 2 && (
        <div className="mb-2">
          <Link onClick={handleEditAllNewCards}>
            {isLoadingNewCards ? (
              <>
                Loading... <Spinner sm />
              </>
            ) : (
              `Edit attributes of all new cards (${totalNewCards})`
            )}
          </Link>
        </div>
      )}
      {Object.keys(changes)
        .filter((key) => key !== 'version')
        .map((board) => {
          const boardChanges = changes[board];
          if (!boardChanges || typeof boardChanges !== 'object') return false;

          const { adds, removes, swaps, edits } = boardChanges as BoardChanges;
          if (
            (adds || []).length === 0 &&
            (removes || []).length === 0 &&
            (swaps || []).length === 0 &&
            (edits || []).length === 0
          ) {
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
                    +{(adds || []).length + (edits || []).length}, -{(removes || []).length + (edits || []).length},{' '}
                    {cube.cards[board].length + (adds || []).length - (removes || []).length} Total
                  </div>
                </Flexbox>
              </Text>
              <Card className="changelist-container p-2">
                <ul className="changelist">
                  {adds &&
                    adds.map((card: CardData, index: number) => (
                      <Add
                        key={index}
                        card={card}
                        revert={() => revertAdd(index, board as any)}
                        index={index}
                        board={board as any}
                      />
                    ))}
                  {removes &&
                    removes.map((remove: CubeCardRemove, index: number) => (
                      <Remove
                        key={remove.oldCard.cardID}
                        card={{
                          ...remove.oldCard,
                          details: unfilteredChangedCards[board][remove.index].details,
                        }}
                        revert={() => revertRemove(index, board as BoardType)}
                      />
                    ))}
                  {swaps &&
                    swaps.map((swap: CubeCardSwap, index: number) => (
                      <Swap
                        key={unfilteredChangedCards[board][swap.index].cardID}
                        oldCard={{
                          ...swap.oldCard,
                          details: unfilteredChangedCards[board][swap.index].details,
                        }}
                        card={swap.card}
                        revert={() => revertSwap(index, board as any)}
                        index={index}
                        board={board as any}
                      />
                    ))}
                  {edits &&
                    edits.map((edit: CubeCardEdit, index: number) => (
                      <Edit
                        key={edit.oldCard.cardID}
                        card={{
                          ...edit.newCard,
                          details: unfilteredChangedCards[board][edit.index].details,
                        }}
                        revert={() => revertEdit(index, board as BoardType)}
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
