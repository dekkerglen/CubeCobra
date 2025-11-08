import React, { useState } from 'react';

import { ArrowSwitchIcon } from '@primer/octicons-react';

import {
  cardCubeCount,
  cardElo,
  cardEtchedPrice,
  cardFoilPrice,
  cardNormalPrice,
  cardPopularity,
  cardPriceEur,
  cardTix,
  detailsToCard,
} from '@utils/cardutil';

import { CardDetails } from '@utils/datatypes/Card';
import HistoryType from '@utils/datatypes/History';
import Button from '../base/Button';
import { Flexbox } from '../base/Layout';
import Text from '../base/Text';
import CardIdBadge from '../card/CardIdBadge';
import ImageFallback from '../ImageFallback';
import AddToCubeModal from '../modals/AddToCubeModal';
import TextBadge from '../TextBadge';
import withModal from '../WithModal';

const AddModal = withModal(Button, AddToCubeModal);

const formatPrice = (price: number | undefined) => {
  if (price === undefined) {
    return '0.00';
  }

  return price.toFixed(2);
};

interface CardPageProps {
  card: CardDetails;
  history: HistoryType[];
}

const CardBreakdownStats: React.FC<CardPageProps> = ({ card }) => {
  const [imageUsed, setImageUsed] = useState(card.image_normal);

  return (
    <Flexbox direction="col" className="my-2 ml-2" gap="2">
      <ImageFallback className="w-full" src={imageUsed} fallbackSrc="/content/default_card.png" alt={card.name} />
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
      <Text>
        Played in {cardPopularity(detailsToCard(card)).toFixed(2)}%
        <Text sm className="text-text-secondary mx-1">
          {'('}
          {cardCubeCount(detailsToCard(card))}
          {')'}
        </Text>
        {'cubes total.'}
      </Text>
      <AddModal color="primary" block className="mb-1 me-2" modalprops={{ card, hideAnalytics: true }}>
        Add to Cube
      </AddModal>
      <CardIdBadge id={card.scryfall_id} />
      {card.prices && Number.isFinite(cardNormalPrice(detailsToCard(card))) && (
        <TextBadge name="TCGPlayer Market Price" className="mt-1">
          ${formatPrice(cardNormalPrice(detailsToCard(card)))}
        </TextBadge>
      )}
      {card.prices && Number.isFinite(cardFoilPrice(detailsToCard(card))) && (
        <TextBadge name="Foil TCGPlayer Market Price" className="mt-1">
          ${formatPrice(cardFoilPrice(detailsToCard(card)))}
        </TextBadge>
      )}
      {card.prices && Number.isFinite(cardEtchedPrice(detailsToCard(card))) && (
        <TextBadge name="Etched (TCGPlayer Market Price)" className="mt-1">
          ${formatPrice(cardEtchedPrice(detailsToCard(card)))}
        </TextBadge>
      )}
      {card.prices && Number.isFinite(cardPriceEur(detailsToCard(card))) && (
        <TextBadge name="Cardmarket Price" className="mt-1">
          €{formatPrice(cardPriceEur(detailsToCard(card)))}
        </TextBadge>
      )}
      {card.prices && Number.isFinite(cardTix(detailsToCard(card))) && (
        <TextBadge name="MTGO TIX" className="mt-1">
          {formatPrice(cardTix(detailsToCard(card)))}
        </TextBadge>
      )}
      {Number.isFinite(cardElo(detailsToCard(card))) && (
        <TextBadge name="Elo" className="mt-1">
          {cardElo(detailsToCard(card)).toFixed(0)}
        </TextBadge>
      )}
    </Flexbox>
  );
};

export default CardBreakdownStats;
