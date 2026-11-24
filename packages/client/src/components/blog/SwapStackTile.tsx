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
 * One changelog swap drawn as a static stack: the outgoing card peeks out behind the incoming one. The wrapper owns
 * the hover preview so both cards show side by side, which is why the images themselves are not autocards.
 */
const SwapStackTile: React.FC<SwapStackTileProps> = ({ oldCard, card }) => (
  <AutocardDiv card={oldCard} pairWith={card} className="relative">
    <a href={`/tool/card/${oldCard.cardID}`} className="absolute top-0 left-0 w-[85%]">
      <FoilCardImage card={oldCard} />
    </a>
    <a href={`/tool/card/${card.cardID}`} className="relative z-10 block ml-[15%] mt-[12%] w-[85%]">
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
