let mongoose = require('mongoose');

// card schema for analytics only. Use card objects for most use cases
let cardSchema = mongoose.Schema({
  // Scryfall ID
  scryfall_id: {
    index: true,
    type: String,
  },
  // normalized to lowercase
  name_lower: {
    index: true,
    type: String,
  },
  color_identity: [String],
  set: String,
  collector_number: String,
  promo: Boolean,
  digital: Boolean,
  isToken: Boolean,
  border_color: String,
  name: String,
  // name [set-collector_number]
  full_name: String,
  artist: String,
  // Url
  scryfall_uri: String,
  rarity: String,
  oracle_text: String,
  oracle_id: String,
  cmc: Number,
  legalities: {
    Legacy: Boolean,
    Modern: Boolean,
    Standard: Boolean,
    Pauper: Boolean,
    Pioneer: Boolean,
  },
  // Hybrid looks like w-u
  parsed_cost: [String],
  colors: [String],
  type: String,
  full_art: Boolean,
  language: String,
  mtgo_id: String,
  tcgplayer_id: String,
  loyalty: String,
  power: String,
  toughness: String,
  // URL
  image_small: String,
  // URL
  image_normal: String,
  // URL
  art_crop: String,
  // URL
  image_flip: String,
  // Lowercase
  color_category: String,
  // Card ID's
  tokens: [String],
});

const Card = mongoose.model('Card', cardSchema);

module.exports = Card;
