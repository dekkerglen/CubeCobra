import CardImage, { CardImageProps } from 'components/CardImage';
import FoilOverlay, { FoilOverlayProps } from 'components/FoilOverlay';

type FoilCardImageProps = CardImageProps & FoilOverlayProps;

const FoilCardImage: React.FC<FoilCardImageProps> = FoilOverlay(CardImage);

export default FoilCardImage;
