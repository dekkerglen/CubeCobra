import React, { useState } from 'react';

import { ArrowSwitchIcon } from '@primer/octicons-react';
import { detailsToCard } from '@utils/cardutil';
import { cdnUrl } from '@utils/cdnUrl';
import { CardDetails } from '@utils/datatypes/Card';
import HistoryType from '@utils/datatypes/History';

import Button from '../base/Button';
import { Flexbox } from '../base/Layout';
import CardIdBadge from '../card/CardIdBadge';
import ImageFallback from '../ImageFallback';
import AddToCubeModal from '../modals/AddToCubeModal';
import withModal from '../WithModal';
import CardMetrics from './CardMetrics';

const AddModal = withModal(Button, AddToCubeModal);

/**
 * Four layouts carry a back face, but only one of them turns into its other side during
 * play. Calling a modal DFC, a double-faced token or a reversible card a "transform"
 * describes something the card cannot do, so they get the neutral word -- which is also
 * the safe default for a layout this does not recognise.
 */
const faceToggleLabel = (layout: string): string => (layout === 'transform' ? 'Transform' : 'Flip');

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

  return (
    <Flexbox direction="col" className="my-2 mx-2" gap="2">
      <ImageFallback
        className="w-full"
        src={imageUsed}
        fallbackSrc={cdnUrl('/content/loadingcard.png')}
        alt={card.name}
      />
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
          <ArrowSwitchIcon size={16} /> {faceToggleLabel(card.layout)}
        </Button>
      )}
      <AddModal color="primary" block modalprops={{ card: detailsToCard(card), hideAnalytics: true }}>
        Add to Cube
      </AddModal>
      <CardMetrics card={card} history={history} />
      <CardIdBadge id={card.scryfall_id} />
      {/* Where this card already appears. Secondary to the metrics above, and the page
          heading already names the card, so the buttons do not repeat it. */}
      <Flexbox direction="row" gap="2">
        <Button
          type="link"
          color="secondary"
          block
          href={`/search/?q=${encodeURIComponent(`card:"${card.name}"`)}`}
          target="_blank"
        >
          Cubes
        </Button>
        <Button
          type="link"
          color="secondary"
          block
          href={`/packages?q=${encodeURIComponent(`card:"${card.name}"`)}`}
          target="_blank"
        >
          Packages
        </Button>
      </Flexbox>
    </Flexbox>
  );
};

export default CardBreakdownStats;
