import CardDetails from 'datatypes/CardDetails';

interface Card {
  index?: number;
  imgUrl?: string;
  imgBackUrl?: string;
  cardID: string;
  colors?: ('W' | 'U' | 'B' | 'R' | 'G')[];
  tags?: string[];
  details?: CardDetails;
}

export default Card;