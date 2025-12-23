import Card, { CardStatus } from './Card';
import { DraftFormat } from './Draft';
import User from './User';

export const CUBE_VISIBILITY = {
  PUBLIC: 'pu',
  PRIVATE: 'pr',
  UNLISTED: 'un',
};

export const PRICE_VISIBILITY = {
  PUBLIC: 'pu',
  PRIVATE: 'pr',
};

export interface CubeImage {
  uri: string;
  artist: string;
  id: string;
  imageName: string;
}

export interface TagColor {
  color: string | null;
  tag: string;
}

export interface CubeCards {
  mainboard: Card[];
  maybeboard: Card[];
}

export const CUBE_CATEGORIES = [
  'Vintage',
  'Legacy+',
  'Legacy',
  'Modern',
  'Premodern',
  'Pioneer',
  'Historic',
  'Standard',
  'Set',
  'Custom',
];
export type CubeCategory = (typeof CUBE_CATEGORIES)[number];

interface Cube {
  id: string;
  shortId: string;
  owner: User;
  name: string;
  visibility: string;
  priceVisibility: string;
  featured: boolean;
  categoryOverride?: CubeCategory;
  categoryPrefixes: any[];
  tagColors: TagColor[];
  defaultFormat: number;
  numDecks: number;
  description: string;
  imageName: string;
  date: number; // Legacy field - this is dateLastUpdated, kept for backwards compatibility
  dateCreated: number;
  dateLastUpdated: number;
  defaultSorts: string[];
  showUnsorted?: boolean;
  collapseDuplicateCards?: boolean;
  formats: DraftFormat[];
  following: string[];
  defaultStatus: CardStatus;
  defaultPrinting: string;
  disableAlerts: boolean;
  basics: string[];
  tags: any[];
  keywords: string[];
  cardCount: number;
  image: CubeImage;
  version: number;
}

export default Cube;
