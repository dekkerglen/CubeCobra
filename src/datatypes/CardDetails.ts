export default interface CardDetails {
  scryfall_id: string;
  oracle_id: string;
  name: string;
  set: string;
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
  legalities: Record<string, "legal" | "not_legal" | "banned" | "restricted">;  // An empty object, could be more specific if needed
  oracle_text: string;
  image_small?: string;
  image_normal?: string;
  art_crop?: string;
  image_flip?: string;
  cmc: number;
  type: string;
  colors: string[];
  color_identity: string[];
  colorcategory: 'w' | 'u' | 'b' | 'r' | 'g' | 'h' | 'l' | 'c' | 'm';
  loyalty?: string;
  power?: string;
  toughness?: string;
  parsed_cost: string[]; 
  finishes: string[];
  border_color: "black" | "white" | "silver" | "gold";
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
  };
  tokens: string[];

  // Computed values
  elo?: number;
  popularity?: string;
  cubeCount?: number;
  pickCount?: number;
}