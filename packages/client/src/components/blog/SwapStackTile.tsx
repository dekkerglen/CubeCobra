import React from 'react';

import Card from '@utils/datatypes/Card';

import FoilCardImage from 'components/FoilCardImage';
import withAutocard from 'components/WithAutocard';

const AutocardDiv = withAutocard('div');

interface SwapStackTileProps {
  oldCard: Card;
  card: Card;
}

/**
 * One changelog swap drawn as a static stack, like the Card Stacks view: the outgoing card sits on top of the tile and
 * the incoming card overlaps it from below, leaving the outgoing card's name bar and art in view. The wrapper owns the
 * hover preview so both cards show side by side, which is why the images themselves are not autocards.
 */
const SwapStackTile: React.FC<SwapStackTileProps> = ({ oldCard, card }) => (
  // The top padding is a share of the tile's width: 78% of it is about the top 56% of a card, through its art box.
  <AutocardDiv card={oldCard} pairWith={card} className="relative pt-[78%]">
    <a href={`/tool/card/${oldCard.cardID}`} className="absolute top-0 left-0 w-full">
      <FoilCardImage card={oldCard} />
    </a>
    <a href={`/tool/card/${card.cardID}`} className="relative z-10 block w-full">
      <FoilCardImage card={card} />
      <div
        title="Added"
        aria-label="Added"
        className="absolute top-[14%] right-[8%] pointer-events-none px-2 py-0.5 text-sm font-semibold text-white rounded-md shadow-sm backdrop-blur-[2px] hidden md:block bg-green-600/90"
      >
        +
      </div>
    </a>
  </AutocardDiv>
);

export default SwapStackTile;
