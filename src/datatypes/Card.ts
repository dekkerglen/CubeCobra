import { ManaSymbol } from './Mana';

export const COLOR_CATEGORIES = [
  'White',
  'Blue',
  'Black',
  'Red',
  'Green',
  'Colorless',
  'Multicolored',
  'Hybrid',
  'Lands',
] as const;
export type ColorCategory = (typeof COLOR_CATEGORIES)[number];

export const DefaultElo = 1200;

export const FINISHES = ['Non-foil', 'Foil', 'Etched', 'Alt-foil'] as const;
export type Finish = (typeof FINISHES)[number];

//Supported in the UI. Sort matching the advanced filter modal
export const SUPPORTED_FORMATS = [
  'Standard',
  'Pioneer',
  'Modern',
  'Legacy',
  'Vintage',
  'Brawl',
  'Historic',
  'Pauper',
  'Penny',
  'Commander',
];
export type LegalityFormats = (typeof SUPPORTED_FORMATS)[number];

export type Legality = 'legal' | 'not_legal' | 'banned' | 'restricted';

export interface CardDetails {
  scryfall_id: string;
  oracle_id: string;
  name: string;
  set: string;
  setIndex: number; //Index of the set code when all sets are sorted by release date. eg. Alpha = 0, M10 = 12. -1 means unknown
  collector_number: string;
  released_at: string;
  promo: boolean;
  reprint: boolean;
  digital: boolean;
  isToken: boolean;
  full_name: string;
  name_lower: string;
  artist: string;
  scryfall_uri: string;
  rarity: string;
  produced_mana?: ManaSymbol[];
  legalities: Record<LegalityFormats, Legality>; // An empty object, could be more specific if needed
  oracle_text: string;
  image_small?: string;
  image_normal?: string;
  art_crop?: string;
  image_flip?: string;
  cmc: number;
  type: string;
  colors: string[];
  color_identity: string[];
  colorcategory: ColorCategory;
  keywords: string[];
  loyalty?: string;
  power?: string;
  toughness?: string;
  parsed_cost: string[];
  finishes: (Finish | string)[]; // string for backwards compatability
  promo_types?: string[];
  border_color: 'black' | 'white' | 'silver' | 'gold';
  language: string;
  tcgplayer_id?: string;
  mtgo_id: number;
  layout: string;
  full_art: boolean;
  error: boolean;
  prices: {
    usd?: number;
    eur?: number;
    usd_foil?: number;
    usd_etched?: number;
    tix?: number;
    ck?: number; // Cardkingdom price
    mp?: number; // Manapool price
  };
  tokens: string[];
  set_name: string;

  // Computed values
  elo?: number;
  popularity?: number;
  cubeCount?: number;
  pickCount?: number;
  isExtra?: boolean;
  wordCount?: number;
}

export const allFields = [
  'name',
  'oracle',
  'mv',
  'mana',
  'type',
  'set',
  'tag',
  'status',
  'finish',
  'price',
  'priceFoil',
  'priceEur',
  'priceTix',
  'elo',
  'power',
  'toughness',
  'loyalty',
  'rarity',
  'legality',
  'artist',
  'is',
  'color',
  'colorIdentity',
] as const;

export type AllField = (typeof allFields)[number];

export const numFields = [
  'mv',
  'price',
  'priceFoil',
  'priceEur',
  'priceTix',
  'elo',
  'power',
  'toughness',
  'loyalty',
  'rarity',
  'legality',
] as const;

export type NumField = (typeof numFields)[number];

export function isNumField(field: string): field is NumField {
  return numFields.includes(field as NumField);
}

export const CARD_STATUSES = ['Not Owned', 'Ordered', 'Owned', 'Premium Owned', 'Proxied', 'Borrowed'] as const;

export const colorFields = ['color', 'colorIdentity'] as const;

export type ColorField = (typeof colorFields)[number];

export type CardStatus = (typeof CARD_STATUSES)[number];

export function isColorField(field: string): field is ColorField {
  return colorFields.includes(field as ColorField);
}

export type FilterValues = {
  [K in AllField]: K extends ColorField ? string[] : string;
} & {
  [K in `${AllField}Op`]: ':' | '=' | '!=' | '<>' | '<' | '<=' | '>' | '>=';
};

export const boardTypes = ['mainboard', 'maybeboard'] as const;
export type BoardType = (typeof boardTypes)[number];

export type CubeCardChange = { index: number; oldCard: Card };
export type CubeCardRemove = CubeCardChange;
export type CubeCardSwap = CubeCardChange & { card: Card };
export type CubeCardEdit = CubeCardChange & { newCard: Card };

export type BoardChanges = {
  adds?: Card[];
  removes?: CubeCardRemove[];
  swaps?: CubeCardSwap[];
  edits?: CubeCardEdit[];
};

export interface Changes {
  mainboard?: BoardChanges;
  maybeboard?: BoardChanges;
  version?: number;
}

export const BasicLands = ['Plains', 'Island', 'Swamp', 'Mountain', 'Forest', 'Waste'] as const;
export type BasicLand = (typeof BasicLands)[number];

export enum PrintingPreference {
  RECENT = 'recent',
  FIRST = 'first',
}
export const DefaultPrintingPreference = PrintingPreference.FIRST;

export default interface Card {
  index?: number;
  board?: BoardType;
  markedForDelete?: boolean;
  editIndex?: number;
  removeIndex?: number;
  imgUrl?: string;
  imgBackUrl?: string;
  cardID: string;
  colors?: Exclude<ManaSymbol, 'C'>[];
  colorCategory?: ColorCategory;
  tags?: string[];
  finish?: Finish | string; //string for backwards compatability in case data ever got weird
  status?: string;
  cmc?: string | number;
  type_line?: string;
  rarity?: string;
  addedTmsp?: string;
  notes?: string;
  details?: CardDetails;
  asfan?: number;
  custom_name?: string;
}
