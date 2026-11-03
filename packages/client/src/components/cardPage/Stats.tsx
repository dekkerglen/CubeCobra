import React, { useState } from 'react';

import { ArrowSwitchIcon } from '@primer/octicons-react';
import { cardFaceOrientations, cardFaceToggleLabel, detailsToCard } from '@utils/cardutil';
import { cdnUrl } from '@utils/cdnUrl';
import { CardDetails } from '@utils/datatypes/Card';
import HistoryType from '@utils/datatypes/History';

import Button from '../base/Button';
import { Flexbox } from '../base/Layout';
import CardIdBadge from '../card/CardIdBadge';
import CardOrientationFrame from '../card/CardOrientationFrame';
import ImageFallback from '../ImageFallback';
import AddToCubeModal from '../modals/AddToCubeModal';
import withAutocard from '../WithAutocard';
import withModal from '../WithModal';
import CardMetrics from './CardMetrics';

const AddModal = withModal(Button, AddToCubeModal);
// Constrained to this column, a landscape card renders smaller than a normal one; the
// hover raises the ordinary autocard preview at full size.
const HoverPreviewFrame = withAutocard(CardOrientationFrame);

interface CardPageProps {
  card: CardDetails;
  history: HistoryType[];
}

/**
 * The column beside the card breakdown: the art, the one action worth taking, the card's
 * analytics, and its identifier. Prices deliberately live only in the Purchase section,
 * which covers more vendors and every finish.
 */
const CardBreakdownStats: React.FC<CardPageProps> = ({ card, history }) => {
  const [imageUsed, setImageUsed] = useState(card.image_normal);

  // Orientation is per face: a Battle's landscape front becomes a portrait back.
  const faceOrientations = cardFaceOrientations(card);
  const displayedOrientation = imageUsed === card.image_normal ? faceOrientations.front : faceOrientations.back;

  const image = (
    <ImageFallback
      card={card}
      className="w-full"
      src={imageUsed}
      fallbackSrc={cdnUrl('/content/loadingcard.png')}
      alt={card.name}
    />
  );

  return (
    <Flexbox direction="col" className="my-2 mx-2" gap="2">
      {displayedOrientation === 'landscape' ? (
        <HoverPreviewFrame orientation="landscape" card={detailsToCard(card)}>
          {image}
        </HoverPreviewFrame>
      ) : (
        image
      )}
      {card.image_flip && (
        <Button
          color="accent"
          block
          onClick={() => {
            if (imageUsed === card.image_normal) {
              setImageUsed(card.image_flip);
            } else {
              setImageUsed(card.image_normal);
            }
          }}
        >
          <ArrowSwitchIcon size={16} /> {cardFaceToggleLabel(card.layout)}
        </Button>
      )}
      <AddModal color="primary" block modalprops={{ card: detailsToCard(card), hideAnalytics: true }}>
        Add to Cube
      </AddModal>
      <CardIdBadge id={card.scryfall_id} />
      <CardMetrics card={card} history={history} />
    </Flexbox>
  );
};

export default CardBreakdownStats;
