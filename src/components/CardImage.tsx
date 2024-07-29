import React, { useContext } from 'react';
import Card from 'datatypes/Card';
import DisplayContext from 'contexts/DisplayContext';
import ImageFallback, { ImageFallbackProps } from 'components/ImageFallback';
import withAutocard, { WithAutocardProps } from 'components/WithAutocard';

const ImageAutocard = withAutocard<typeof ImageFallback>(ImageFallback);

export interface CardImageProps extends Partial<ImageFallbackProps> {
  card: Card;
  autocard?: boolean;
  className?: string;
  width?: string;
  height?: string;
}

const CardImage: React.FC<CardImageProps> = ({ card, autocard = false, className, width, height, ...props }) => {
  const { showCustomImages } = useContext(DisplayContext);
  const imageSrc = (showCustomImages && card.imgUrl) || card.details?.image_normal;
  const Tag: React.ComponentType<ImageFallbackProps & WithAutocardProps> = autocard ? ImageAutocard : ImageFallback;

  return (
    <Tag
      card={autocard ? card : undefined}
      src={imageSrc}
      fallbackSrc="/content/default_card.png"
      alt={card.details?.name}
      width={width ?? '100%'}
      height={height ?? 'auto'}
      className={className ? `${className} card-border` : 'card-border'}
      {...props}
    />
  );
};

export default CardImage;
