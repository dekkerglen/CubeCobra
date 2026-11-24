import React from 'react';

import Card from '@utils/datatypes/Card';

import FoilCardImage from 'components/FoilCardImage';
import withAutocard from 'components/WithAutocard';

const AutocardDiv = withAutocard('div');

// CardGrid's badge, hidden on phones like the rest of the Cards view's badges.
const BADGE_CLASS =
  'absolute top-[14%] right-[8%] pointer-events-none px-2 py-0.5 text-sm font-semibold text-white rounded-md shadow-sm backdrop-blur-[2px] hidden md:block';

interface SwapStackTileProps {
  oldCard: Card;
  card: Card;
}

/**
 * One changelog swap drawn as a static stack: the outgoing card sits at the top left of the tile, and the incoming
 * card overlaps it from below and to the right, leaving its name bar and upper art in view. The wrapper owns the
 * hover preview so both cards show side by side, which is why the images themselves are not autocards.
 */
const SwapStackTile: React.FC<SwapStackTileProps> = ({ oldCard, card }) => (
  // Padding is a share of the tile's width: 35% down shows the outgoing card's name bar and the top of its art.
  <AutocardDiv card={oldCard} pairWith={card} className="relative pt-[35%] pl-[10%]">
    <a href={`/tool/card/${oldCard.cardID}`} className="absolute top-0 left-0 w-[90%]">
      <FoilCardImage card={oldCard} />
      {/* 14% down the card is inside the strip left uncovered by the incoming card. */}
      <div title="Removed" aria-label="Removed" className={`${BADGE_CLASS} bg-red-600/90`}>
        −
      </div>
    </a>
    <a href={`/tool/card/${card.cardID}`} className="relative z-10 block w-full">
      <FoilCardImage card={card} />
      <div title="Added" aria-label="Added" className={`${BADGE_CLASS} bg-green-600/90`}>
        +
      </div>
    </a>
  </AutocardDiv>
);

export default SwapStackTile;
