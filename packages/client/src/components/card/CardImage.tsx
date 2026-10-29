import React, { useContext, useMemo } from 'react';

import { cardImageUrl, cardName, isAlphaPrinting } from '@utils/cardutil';
import classNames from 'classnames';
import { cdnUrl } from '@utils/cdnUrl';
import Card from '@utils/datatypes/Card';
import { CardDetails } from '@utils/datatypes/Card';

import DisplayContext from '../../contexts/DisplayContext';
import ImageFallback from '../ImageFallback';
import withAutocard from '../WithAutocard';

const ImageAutocard = withAutocard<typeof ImageFallback>(ImageFallback);

export interface CardImageProps {
  card?: Card;
  details?: CardDetails;
  autocard?: boolean;
  className?: string;
  width?: string;
  height?: string;
  onClick?: () => void;
}

const CardImage: React.FC<CardImageProps> = ({
  card,
  autocard = false,
  className,
  details,
  width,
  height,
  onClick,
}) => {
  const current = useMemo<Card>(() => {
    const base: Card = card || {
      cardID: '',
      details: {} as CardDetails,
    };

    // Return a copy rather than assigning onto `base`: when `card` is supplied, `base` IS the
    // caller's prop object, so writing to it mutated a card the parent (and anything else
    // holding that reference) still owns.
    if (details) {
      return { ...base, details, cardID: details.oracle_id };
    }

    return base;
  }, [card, details]);

  const { showCustomImages } = useContext(DisplayContext);
  const imageSrc = (showCustomImages && cardImageUrl(current)) || current.details?.image_normal;
  // ImageFallback always applies card-border; this only adds the Alpha override on top.
  const borderClass = classNames(className, { 'card-border-alpha': isAlphaPrinting(current) });

  if (autocard) {
    return (
      <ImageAutocard
        card={current}
        src={imageSrc}
        fallbackSrc={cdnUrl('/content/loadingcard.png')}
        alt={cardName(current)}
        width={width ?? '100%'}
        height={height ?? 'auto'}
        className={borderClass}
        onClick={onClick}
      />
    );
  }

  return (
    <ImageFallback
      src={imageSrc}
      fallbackSrc={cdnUrl('/content/loadingcard.png')}
      alt={cardName(current)}
      width={width ?? '100%'}
      height={height ?? 'auto'}
      className={borderClass}
      onClick={onClick}
    />
  );
};

export default CardImage;
