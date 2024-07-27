export default interface CardDetails {
  scryfall_id: string;
  name: string;
  set: string;
  collector_number: string;
  promo: boolean;
  reprint: boolean;
  digital: boolean;
  full_name: string;
  name_lower: string;
  artist: string;
  scryfall_uri: string;
  rarity: string;
  legalities: Record<string, "legal" | "not_legal" | "banned" | "restricted">;  // An empty object, could be more specific if needed
  oracle_text: string;
  image_small?: string;
  image_normal?: string;
  cmc: number;
  type: string;
  colors: string[];
  color_identity: string[];
  parsed_cost: string[]; 
  colorcategory: string;
  finishes: string[];
  border_color: "black" | "white" | "silver" | "gold";
  language: string;
  tcgplayer_id?: string;
  layout: string;
  full_art: boolean;
  error: boolean;
}