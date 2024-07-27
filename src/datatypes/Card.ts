import CardDetails from 'datatypes/CardDetails';

interface Card {
  index?: number;
  imgUrl?: string;
  imgBackUrl?: string;
  cardID: string;
  colors?: ('W' | 'U' | 'B' | 'R' | 'G')[];
  colorCategory?: 'w' | 'u' | 'b' | 'r' | 'g' | 'h' | 'l' | 'c' | 'm';
  tags?: string[];
  finish?: string;
  status?: string;
  cmc?: string;
  type_line?: string;
  rarity?: string;
  addedTmsp?: string;
  notes?: string;
  details?: CardDetails;
}

export default Card;
