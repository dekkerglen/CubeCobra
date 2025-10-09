import { ART_SERIES_CARD_SUFFIX } from '../../client/utils/cardutil';
import { Legality, LegalityFormats } from '../../datatypes/Card';

//Add formats to pull into card details, before making them ready in the UI
export type ScryfallLegalityFormats = LegalityFormats;

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
  printed_name?: string;
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
  printed_name?: string;
  flavor_name?: string;
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
  legalities: Record<LegalityFormats, Legality>;
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

const ALLOWED_PRINTED_LANGUAGES = ['en'];

export function convertName(card: ScryfallCard, preflipped: boolean) {
  const isAllowedPrintedLanguage = ALLOWED_PRINTED_LANGUAGES.includes(card.lang);

  // Prefer flavor_name if present, then follow the existing logic
  let str: string;
  if (card.flavor_name) {
    str = card.flavor_name;
  } else {
    const nameField = isAllowedPrintedLanguage ? 'printed_name' : 'name';
    str = card[nameField] || card.name;
  }

  const faces = card?.card_faces || [];

  //In src/jobs/update_cards.ts preflipped cards have their faces reduced to just the backside face
  if (preflipped) {
    // For preflipped cards, check face flavor_name first, then follow existing logic
    const face = faces[0];
    if (face) {
      if (card.flavor_name) {
        // If card has flavor_name, use it even for preflipped
        str = card.flavor_name;
      } else {
        const nameField = isAllowedPrintedLanguage ? 'printed_name' : 'name';
        str = face[nameField] || face.name;
      }
    }
  } else if (card.layout !== 'split' && faces.length > 1) {
    // NOTE: we want split cards to include both names
    // but other double face to use the first name
    // For multi-face cards, prefer card-level flavor_name, then face name
    if (!card.flavor_name) {
      const face = faces[0];
      const nameField = isAllowedPrintedLanguage ? 'printed_name' : 'name';
      str = face[nameField] || face.name;
    }
  }

  //Trim the card name here before potentially adding art series suffix.
  //Important the first or second name was extracted
  str = str.trim();

  if (card.layout === 'art_series') {
    str = `${str} ${ART_SERIES_CARD_SUFFIX}`;
  }

  return str;
}
