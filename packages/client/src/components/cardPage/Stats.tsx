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
    <Flexbox direction="col" className="my-2 ml-2" gap="2">
      <ImageFallback
        className="w-full"
        src={imageUsed}
        fallbackSrc={cdnUrl('/content/loadingcard.png')}
        alt={card.name}
      />
      {card.image_flip && (
        <Button
          className="mt-1"
          color="accent"
          outline
          block
          onClick={() => {
            if (imageUsed === card.image_normal) {
              setImageUsed(card.image_flip);
            } else {
              setImageUsed(card.image_normal);
            }
          }}
        >
          <ArrowSwitchIcon size={16} /> Transform
        </Button>
      )}
      <AddModal
        color="primary"
        block
        className="mb-1 me-2"
        modalprops={{ card: detailsToCard(card), hideAnalytics: true }}
      >
        Add to Cube
      </AddModal>
      <CardMetrics card={card} history={history} />
      <CardIdBadge id={card.scryfall_id} />
    </Flexbox>
  );
};

export default CardBreakdownStats;
