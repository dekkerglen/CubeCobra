// Metadata for a single Magic set, sourced from Scryfall's /sets endpoint by the
// card-update job and served to the Explore -> Sets page. Kept intentionally
// small: only the fields the sets listing renders or links on.
export interface SetInfo {
  code: string; // Scryfall set code, e.g. "mh3"
  name: string; // Full set name, e.g. "Modern Horizons 3"
  setType: string; // Scryfall set_type: expansion, core, masters, commander, etc.
  releasedAt: string | null; // YYYY-MM-DD, or null when Scryfall has no date
  cardCount: number;
  parentSetCode?: string; // Set this is a child of (tokens, promos, etc.)
  digital: boolean; // Digital-only (Arena/MTGO) set
  // Symbol URL: our R2-cached copy when SET_SYMBOL_BASE_URL is configured,
  // otherwise a Scryfall hotlink fallback.
  icon: string;
}

export default SetInfo;
