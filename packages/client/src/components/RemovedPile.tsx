import React, { useEffect, useState } from 'react';

import CardType from '@utils/datatypes/Card';

import DraftLocation from '../drafting/DraftLocation';
import { Flexbox } from './base/Layout';
import DraggableCard from './DraggableCard';

interface RemovedPileProps {
  cards: CardType[];
}

const RemovedPile: React.FC<RemovedPileProps> = ({ cards }) => {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (cards.length === 0) {
      setOpen(false);
    }
  }, [cards.length]);

  if (cards.length === 0) {
    return null;
  }

  return (
    <div className="mx-2 mb-3">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
        className="font-medium text-link hover:text-link-active"
      >
        Removed ({cards.length})
      </button>
      {open && (
        <Flexbox direction="row" wrap="wrap" gap="2" className="mt-2 p-2 border border-border rounded-md">
          {cards.map((card, index) => (
            <div key={`removed-${index}-${card.cardID}`} className="w-32">
              <DraggableCard card={card} location={DraftLocation.removed(index)} />
            </div>
          ))}
        </Flexbox>
      )}
    </div>
  );
};

export default RemovedPile;
