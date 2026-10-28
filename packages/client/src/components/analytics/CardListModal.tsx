import React, { useCallback, useMemo, useState } from 'react';

import { cardName } from '@utils/cardutil';
import Card from '@utils/datatypes/Card';
import { ActiveElement, ChartEvent } from 'chart.js';

import { ListGroup } from '../base/ListGroup';
import { Modal, ModalBody, ModalHeader } from '../base/Modal';
import AutocardListItem from '../card/AutocardListItem';

export interface CardListSelection {
  title: string;
  cards: Card[];
}

interface CardListModalProps extends CardListSelection {
  isOpen: boolean;
  setOpen: (open: boolean) => void;
}

// Read-only list of the cards behind an analytics chart segment or table cell.
const CardListModal: React.FC<CardListModalProps> = ({ isOpen, setOpen, title, cards }) => {
  // Collapse copies of the same card into one row with a count, matching the table view.
  const entries = useMemo(() => {
    const byName = new Map<string, { card: Card; count: number }>();
    for (const card of cards) {
      const name = cardName(card);
      const entry = byName.get(name);
      if (entry) {
        entry.count += 1;
      } else {
        byName.set(name, { card, count: 1 });
      }
    }
    return [...byName.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [cards]);

  return (
    <Modal md isOpen={isOpen} setOpen={setOpen} scrollable>
      <ModalHeader setOpen={setOpen}>
        {title} ({cards.length} {cards.length === 1 ? 'card' : 'cards'})
      </ModalHeader>
      <ModalBody scrollable>
        <ListGroup>
          {entries.map(([name, { card, count }], index) => (
            <AutocardListItem
              key={name}
              card={card}
              inModal
              onClick={() => window.open(`/tool/card/${card.cardID}`)}
              first={index === 0}
              last={index === entries.length - 1}
              appendChildren
            >
              {count > 1 && <span className="font-semibold">×{count}</span>}
            </AutocardListItem>
          ))}
        </ListGroup>
      </ModalBody>
    </Modal>
  );
};

// Owns the modal's state; render `cardListModal` once and call `openCardList` from click handlers.
export const useCardListModal = () => {
  const [selection, setSelection] = useState<CardListSelection | null>(null);
  const [isOpen, setOpen] = useState(false);

  const openCardList = useCallback((next: CardListSelection) => {
    if (next.cards.length === 0) return;
    setSelection(next);
    setOpen(true);
  }, []);

  // The selection is kept after closing so the list doesn't vanish mid fade-out.
  const cardListModal = selection && (
    <CardListModal isOpen={isOpen} setOpen={setOpen} title={selection.title} cards={selection.cards} />
  );

  return { openCardList, cardListModal };
};

// Chart.js onClick/onHover options that open the card list for the clicked bar or slice.
export const chartCardListHandlers = (
  selectionAt: (datasetIndex: number, index: number) => CardListSelection | undefined,
  openCardList: (selection: CardListSelection) => void,
) => ({
  onClick: (_event: ChartEvent, elements: ActiveElement[]) => {
    const element = elements[0];
    const selection = element && selectionAt(element.datasetIndex, element.index);
    if (selection) openCardList(selection);
  },
  onHover: (event: ChartEvent, elements: ActiveElement[]) => {
    const target = event.native?.target;
    if (target instanceof HTMLElement) target.style.cursor = elements.length > 0 ? 'pointer' : '';
  },
});

export default CardListModal;
