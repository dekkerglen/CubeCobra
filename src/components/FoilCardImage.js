import CardImage from './CardImage';
import FoilOverlay from './FoilOverlay';

const FoilCardImage = FoilOverlay(CardImage);
FoilCardImage.defaultCard = CardImage.defaultCard;

export default FoilCardImage;
