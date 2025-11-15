import CardImage, { CardImageProps } from './card/CardImage';
import FoilOverlay, { FoilOverlayProps } from './FoilOverlay';

type FoilCardImageProps = FoilOverlayProps & CardImageProps;

const FoilCardImage: React.FC<FoilCardImageProps> = FoilOverlay(CardImage);

export default FoilCardImage;
