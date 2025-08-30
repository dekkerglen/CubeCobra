import { CardDetails } from '../datatypes/Card';
import { cardFromId, getReasonableCardByOracle } from './carddb';

export function hydrateP1P1Cards(cardIds: string[]): CardDetails[] {
  return cardIds.map((cardId) => {
    try {
      // Try to get the exact card by ID first (preserves specific printing)
      const cardDetails = cardFromId(cardId);
      if (cardDetails) {
        return cardDetails;
      }
      // Fallback: if cardId doesn't work, try as oracle ID for backwards compatibility
      const oracleDetails = getReasonableCardByOracle(cardId);
      return oracleDetails || getPlaceholderCard(cardId);
    } catch {
      // If card database isn't loaded, return placeholder
      return getPlaceholderCard(cardId);
    }
  });
}

function getPlaceholderCard(cardId: string): CardDetails {
  return {
    scryfall_id: '',
    oracle_id: cardId, // Use cardId as fallback oracle_id for placeholder
    released_at: '',
    isToken: false,
    finishes: [],
    set: '',
    setIndex: -1,
    collector_number: '',
    promo: false,
    reprint: false,
    digital: false,
    full_name: 'Unknown Card',
    name: 'Unknown Card',
    name_lower: 'unknown card',
    artist: '',
    scryfall_uri: '',
    rarity: '',
    legalities: {},
    oracle_text: '',
    image_normal: 'https://img.scryfall.com/errors/missing.jpg',
    cmc: 0,
    type: '',
    colors: [],
    color_identity: [],
    parsed_cost: [],
    colorcategory: 'Colorless',
    border_color: 'black',
    language: 'en',
    mtgo_id: 0,
    layout: '',
    tcgplayer_id: '',
    power: '',
    toughness: '',
    loyalty: '',
    error: true,
    full_art: false,
    prices: {},
    tokens: [],
    set_name: '',
    produced_mana: [],
    keywords: [],
  };
}

