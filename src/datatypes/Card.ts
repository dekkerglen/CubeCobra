import CardDetails, { ColorCategory } from 'datatypes/CardDetails';

export const boardTypes = ['mainboard', 'maybeboard'] as const;
export type BoardType = (typeof boardTypes)[number];

export type BoardChanges = {
  adds: Card[];
  removes: { index: number; oldCard: Card }[];
  swaps: { index: number; card: Card; oldCard: Card }[];
  edits: { index: number; newCard: Card; oldCard: Card }[];
};

export interface Changes {
  mainboard?: BoardChanges;
  maybeboard?: BoardChanges;
  version?: number;
}

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
  colorCategory?: ColorCategory;
  tags?: string[];
  finish?: string;
  status?: string;
  cmc?: string | number;
  type_line?: string;
  rarity?: string;
  addedTmsp?: string;
  notes?: string;
  details?: CardDetails;
  asfan?: number;
}

export default Card;
