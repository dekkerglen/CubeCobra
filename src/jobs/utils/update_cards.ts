import { ART_SERIES_CARD_SUFFIX } from '../../client/utils/cardutil';

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
  card_faces?: ScryfallCard[];
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
}

export function convertName(card: ScryfallCard, preflipped: boolean) {
  let str = card.name;

  if (preflipped) {
    str = str.substring(str.indexOf('/') + 2); // second name
  } else if (card.name.includes('/') && card.layout !== 'split') {
    // NOTE: we want split cards to include both names
    // but other double face to use the first name
    str = str.substring(0, str.indexOf('/')); // first name
  }

  if (card.layout === 'art_series') {
    str = `${str} ${ART_SERIES_CARD_SUFFIX}`;
  }

  return str.trim();
}
