import { ART_SERIES_CARD_SUFFIX } from '../../client/utils/cardutil';

export interface ScryfallCardFace {
  artist?: string;
  artist_id?: string;
  cmc?: number;
  colors?: string[];
  flavor_text?: string;
  illustration_id?: string;
  image_uris?: {
    small: string;
    normal: string;
    art_crop: string;
  };
  layout?: string;
  loyalty?: string;
  mana_cost: string;
  name: string;
  object: 'card_face';
  oracle_id?: string;
  oracle_text?: string;
  power?: string;
  toughness?: string;
  type_line?: string;
}

export interface ScryfallCard {
  id: string;
  name: string;
  lang: string;
  set: string;
  collector_number: string;
  set_name: string;
  released_at: string;
  reprint: boolean;
  border_color: string;
  promo: boolean;
  promo_types: string[];
  digital: boolean;
  finishes: string[];
  prices: {
    usd: string | null;
    usd_foil: string | null;
    usd_etched: string | null;
    eur: string | null;
    tix: string | null;
  };
  image_uris: {
    small: string;
    normal: string;
    art_crop: string;
  };
  card_faces?: ScryfallCardFace[];
  loyalty?: string;
  power?: string;
  toughness?: string;
  type_line: string;
  oracle_text: string;
  mana_cost: string;
  cmc: number;
  colors: string[];
  color_identity: string[];
  keywords: string[];
  produced_mana: string[];
  legalities: {
    legacy: string;
    modern: string;
    standard: string;
    pioneer: string;
    pauper: string;
    brawl: string;
    historic: string;
    commander: string;
    penny: string;
    vintage: string;
  };
  layout: string;
  rarity: string;
  artist: string;
  scryfall_uri: string;
  mtgo_id: number;
  textless: boolean;
  tcgplayer_id: string;
  oracle_id: string;
  full_art: boolean;
  flavor_text: string;
  frame_effects: string[];
  frame: string;
  card_back_id: string;
  artist_id: string;
  illustration_id: string;
  content_warning: boolean;
  variation: boolean;
  preview: {
    source: string;
    source_uri: string;
    previewed_at: string;
  };
  related_uris: {
    gatherer: string;
    tcgplayer_decks: string;
    edhrec: string;
    mtgtop8: string;
  };
  all_parts: {
    object: string;
    id: string;
    component: string;
    name: string;
    type_line: string;
    uri: string;
  }[];
  object: 'card';
}

//See https://scryfall.com/docs/api/sets/all and https://scryfall.com/docs/api/sets
export interface ScryfallSet {
  object: 'set';
  id: string;
  code: string;
  name: string;
  set_type: string;
  uri: string;
  scryfall_uri: string;
  search_uri: string;
  released_at?: string; //YYYY-MM-DD format
  card_count: number;
  parent_set_code?: string;
  digital: boolean;
  nonfoil_only: boolean;
  foil_only: boolean;
  icon_svg_uri: string;
  mtgo_code?: string;
  arena_code?: string;
  tcgplayer_id?: number;
  block_code?: string;
  block?: string;
  printed_size?: number;
}

export function convertName(card: ScryfallCard, preflipped: boolean) {
  let str = card.name;
  const faceNameSeperator = '//';

  if (preflipped) {
    str = str.substring(str.indexOf(faceNameSeperator) + faceNameSeperator.length + 1); // second name
  } else if (card.name.includes(faceNameSeperator) && card.layout !== 'split') {
    // NOTE: we want split cards to include both names
    // but other double face to use the first name
    str = str.substring(0, str.indexOf(faceNameSeperator)); // first name
  }

  //Trim the card name here before potentially adding art series suffix.
  //Important the first or second name was extracted
  str = str.trim();

  if (card.layout === 'art_series') {
    str = `${str} ${ART_SERIES_CARD_SUFFIX}`;
  }

  return str;
}
