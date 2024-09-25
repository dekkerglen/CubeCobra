import CardDetails from 'datatypes/CardDetails';

export const boardTypes = ['mainboard', 'maybeboard'] as const;
export type BoardType = (typeof boardTypes)[number];

export type BoardChanges = {
  adds: Card[];
  removes: { index: number; oldCard: Card }[];
  swaps: { index: number; card: Card; oldCard: Card }[];
  edits: { index: number; newCard: Card; oldCard: Card }[];
};

export type Changes = Record<BoardType, BoardChanges>;

interface Card {
  index?: number;
  board?: BoardType;
  markedForDelete?: boolean;
  editIndex?: number;
  removeIndex?: number;
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
