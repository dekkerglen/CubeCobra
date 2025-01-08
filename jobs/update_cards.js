require('dotenv').config();

const fs = require('fs');
const path = require('path');
const https = require('https');
const JSONStream = require('JSONStream');
const es = require('event-stream');
const fetch = require('node-fetch');
const AWS = require('aws-sdk');
const json = require('big-json');
const stream = require('stream');
const cardutil = require('../dist/utils/Card');

const util = require('../src/util/util');
const carddb = require('../src/util/carddb');

const catalog = {};

/* // '?' denotes a value may be null or missing
 * cardDetailsSchema = {
 *   color_identity: [Char],
 *   set: String,
 *   set_name: String,
 *   finishes: [String],
 *   collector_number: String,
 *   released_at: Date,
 *   reprint: Boolean,
 *   promo: Boolean,
 *   prices: {
 *     usd: Float?,
 *     usd_foil: Float?,
 *     eur: Float?,
 *     tix: Float?,
 *   },
 *   elo: Integer,
 *   digital: Boolean,
 *   isToken: Boolean,
 *   border_color: String,
 *   name: String,
 *   // normalized to lowercase
 *   name_lower: String,
 *   // name [set-collector_number]
 *   full_name: String,
 *   artist: String?,
 *   scryfall_uri: URI,
 *   rarity: String,
 *   oracle_text: String?,
 *   // Scryfall ID
 *   scryfall_id: UUID,
 *   oracle_id: UUID,
 *   cmc: Float
 *   // one of "legal", "not_legal", "restricted", "banned"
 *   legalities: {
 *     Legacy: String,
 *     Modern: String,
 *     Standard: String,
 *     Pauper: String,
 *     Pioneer: String,
 *     Brawl: String,
 *     Historic: String,
 *     Commander: String,
 *     Penny: String,
 *     Vintage: String,
 *   },
 *   // Hybrid looks like w-u
 *   parsed_cost: [String],
 *   colors: [Char]?,
 *   type: String,
 *   full_art: Boolean,
 *   language: String,
 *   mtgo_id: Integer?,
 *   layout: String,
 *   tcgplayer_id: String?,
 *   loyalty: String?
 *   power: String?
 *   toughness: String?
 *   image_small: URI?
 *   image_normal: URI?
 *   art_crop: URI?
 *   image_flip: URI?
 *   // Lowercase
 *   colorcategory: Char
 *   // Card IDs
 *   tokens: [UUID]?
 */
function initializeCatalog() {
  catalog.dict = {};
  catalog.names = [];
  catalog.nameToId = {};
  catalog.full_names = [];
  catalog.imagedict = {};
  catalog.cardimages = {};
  catalog.oracleToId = {};
  catalog.english = {};
  catalog.metadatadict = {};
  catalog.indexToOracleId = [];
}

initializeCatalog();

function downloadFile(url, filePath) {
  const folder = filePath.substring(0, filePath.lastIndexOf('/'));
  const folderExists = fs.existsSync(folder);
  if (!folderExists) fs.mkdirSync(path.join(__dirname, `../${folder}`));
  const file = fs.createWriteStream(filePath);
  return new Promise((resolve, reject) => {
    https
      .get(url, (response) => {
        if (response.statusCode !== 200) {
          response.resume();
          reject(new Error(`Request to '${url}' failed with status code ${response.statusCode}`));
          return;
        }

        const pipe = response.pipe(file);
        response.on('error', (err) => {
          reject(new Error(`Response error downloading file from '${url}':\n${err.message}`));
          response.unpipe(pipe);
          pipe.destroy();
        });
        pipe.on('error', (err) => reject(new Error(`Pipe error downloading file from '${url}':\n${err.message}`)));
        pipe.on('finish', resolve);
      })
      .on('error', (err) => reject(new Error(`Download error for '${url}':\n${err.message}`)));
  });
}

async function downloadDefaultCards() {
  let defaultUrl;
  let allUrl;

  const res = await fetch('https://api.scryfall.com/bulk-data');
  if (!res.ok) throw new Error(`Download of /bulk-data failed with code ${res.status}`);
  const resjson = await res.json();

  for (const data of resjson.data) {
    if (data.type === 'default_cards') {
      defaultUrl = data.download_uri;
    } else if (data.type === 'all_cards') {
      allUrl = data.download_uri;
    }
  }

  if (!defaultUrl) throw new Error('URL for Default cards not found in /bulk-data response');
  if (!allUrl) throw new Error('URL for All cards not found in /bulk-data response');

  return Promise.all([
    downloadFile(defaultUrl, './private/cards.json'),
    downloadFile(allUrl, './private/all-cards.json'),
  ]);
}

function addCardToCatalog(card, isExtra) {
  catalog.dict[card.scryfall_id] = card;
  const normalizedFullName = cardutil.normalizeName(card.full_name);
  const normalizedName = cardutil.normalizeName(card.name);
  catalog.imagedict[normalizedFullName] = {
    uri: card.art_crop,
    artist: card.artist,
    id: card.scryfall_id,
    imageName: normalizedFullName,
  };
  if (isExtra !== true) {
    const cardImages = {
      image_normal: card.image_normal,
    };
    if (card.image_flip) {
      cardImages.image_flip = card.image_flip;
    }
    if (carddb.reasonableCard(card)) {
      catalog.cardimages[normalizedName] = cardImages;
    }
  }
  // only add if it doesn't exist, this makes the default the newest edition
  if (!catalog.nameToId[normalizedName]) {
    catalog.nameToId[normalizedName] = [];
  }
  if (!catalog.nameToId[normalizedName].includes(card.scryfall_id)) {
    catalog.nameToId[normalizedName].push(card.scryfall_id);
  }
  if (!catalog.oracleToId[card.oracle_id]) {
    catalog.oracleToId[card.oracle_id] = [];
  }
  catalog.oracleToId[card.oracle_id].push(card.scryfall_id);
  util.binaryInsert(normalizedName, catalog.names);
  util.binaryInsert(normalizedFullName, catalog.full_names);
}

async function writeFile(filepath, data) {
  return new Promise((resolve, reject) => {
    try {
      // data is too big to stringify, so we write it to a file using big-json
      const stringifyStream = json.createStringifyStream({
        body: data,
      });

      // create empty file
      const fd = fs.openSync(filepath, 'w');

      stringifyStream.on('data', (strChunk) => {
        fs.writeSync(fd, strChunk);
      });

      stringifyStream.on('end', () => {
        fs.closeSync(fd);
        resolve();
      });
    } catch (err) {
      reject(err);
    }
  });
}

const specialCaseCards = {
  "Outlaws' Merriment": [
    'db951f76-b785-453e-91b9-b3b8a5c1cfd4',
    'cd3ca6d5-4b2c-46d4-95f3-f0f2fa47f447',
    'c994ea90-71f4-403f-9418-2b72cc2de14d',
  ],

  "Trostani's Summoner": [
    '703e7ecf-3d73-40c1-8cfe-0758778817cf',
    '5fc993a7-a1ce-4403-a0a0-2afc9f9eca42',
    '214a48bc-4a1c-44e3-9415-a73af3d4fd95',
  ],

  // This card didn't have a printed token until Commander Collection: Black, and the printed version is a double-faced
  // token
  // TODO(#2196): When the card parser can handle DFC tokens, we can remove this special case
  Ophiomancer: ['13e4832d-8530-4b85-b738-51d0c18f28ec'],

  // These two are a bit of a problem. Normaly when an ability creates copies the scryfall tokens associated with it are fetched.
  // This works great in most cases, but these two already have a token in scryfall only it's the wrong token. It's a token refering to
  // the first ability and not the one that generates the copies.
  'Saheeli, the Gifted': ['761507d5-d36a-4123-a074-95d7f6ffb4c5', 'a020dc47-3747-4123-9954-f0e87a858b8c'],
  'Daretti, Ingenious Iconoclast': ['7c82af53-2de8-4cd6-84bf-fb39d2693de2', 'a020dc47-3747-4123-9954-f0e87a858b8c'],

  // There simply does not seem to exist a 3/1 red elemental token with haste but without trample so i choose the closest thing.
  'Chandra, Flamecaller': ['bc6f27f7-0248-4c04-8022-41073966e4d8'],

  // the cards below are transform cards that are on here due to the way
  // we currently do not populate the oracle text of transform cards.
  'Arlinn Kord': ['bd05e304-1a16-436d-a05c-4a38a839759b'],
  'Bloodline Keeper': ['71496671-f7ba-4014-a895-d70a27979db7'],
  'Docent of Perfection': ['e4439a8b-ef98-428d-a274-53c660b23afe'],
  'Dowsing Dagger': ['642d1d93-22d0-43f9-8691-6790876185a0'],
  'Extricator of Sin': ['11d25bde-a303-4b06-a3e1-4ad642deae58'],
  'Garruk Relentless': ['bd05e304-1a16-436d-a05c-4a38a839759b', '7a49607c-427a-474c-ad77-60cd05844b3c'],
  'Golden Guardian': ['a7820eb9-6d7f-4bc4-b421-4e4420642fb7'],
  'Hanweir Militia Captain': ['94ed2eca-1579-411d-af6f-c7359c65de30'],
  'Huntmaster of the Fells': ['bd05e304-1a16-436d-a05c-4a38a839759b'],
  "Jace, Vryn's Prodigy": ['458e37b1-a849-41ae-b63c-3e09ffd814e4'],
  "Legion's Landing": ['09293ae7-0629-417b-9eda-9bd3f6d8e118'],
  'Liliana, Heretical Healer': ['8e214f84-01ee-49c1-8801-4e550b5ade5d'],
  'Mayor of Avabruck': ['bd05e304-1a16-436d-a05c-4a38a839759b'],
  'Nissa, Vastwood Seer': ['0affd414-f774-48d1-af9e-bff74e58e1ca'],
  'Shrill Howler': ['11d25bde-a303-4b06-a3e1-4ad642deae58'],
  'Storm the Vault': ['e6fa7d35-9a7a-40fc-9b97-b479fc157ab0'],
  'Treasure Map': ['e6fa7d35-9a7a-40fc-9b97-b479fc157ab0'],
  'Westvale Abbey': ['94ed2eca-1579-411d-af6f-c7359c65de30'],
};

function getScryfallTokensForCard(card) {
  const allParts = card.all_parts || [];
  return allParts
    .filter((element) => element.component === 'token' || element.type_line.startsWith('Emblem'))
    .map(({ id }) => id);
}

function getTokensForSpecialCaseCard(card) {
  if (card.card_faces) {
    return specialCaseCards[card.card_faces[0].name] || [];
  }
  return specialCaseCards[card.name] || [];
}

const specialCaseTokens = {
  Food: 'bf36408d-ed85-497f-8e68-d3a922c388a0',
  Treasure: 'e6fa7d35-9a7a-40fc-9b97-b479fc157ab0',
  Poison: '470618f6-f67f-44c6-a086-285632508915',
  "City's Blessing": 'ba64ed3e-93c5-406f-a38d-65cc68472122',
  Monarch: '40b79918-22a7-4fff-82a6-8ebfe6e87185',
  Energy: 'a446b9f8-cb22-408a-93ff-bee44a0dccc0',
};

function arraySetEqual(target, candidate) {
  let isValid = candidate.length === target.length;
  if (!isValid) return false;

  for (let idx = 0; idx < target.length; idx++) {
    if (!candidate.includes(target[idx])) {
      isValid = false;
      break;
    }
  }
  return isValid;
}

function getTokens(card, catalogCard) {
  const mentionedTokens = [];
  const recordedTokens = getScryfallTokensForCard(card);
  const specialTokens = getTokensForSpecialCaseCard(card);
  if (specialTokens.length > 0) {
    mentionedTokens.push(...recordedTokens);
  } else if (recordedTokens.length > 0) {
    catalogCard.tokens = recordedTokens;
  } else if (catalogCard.oracle_text !== null) {
    if (catalogCard.oracle_text.includes(' token')) {
      // find the ability that generates the token to reduce the amount of text to get confused by.
      const abilities = catalogCard.oracle_text.split('\n');
      for (const ability of abilities) {
        if (ability.includes(' token')) {
          const reString =
            '((?:(?:([A-Za-z ,]+), a (legendary))|[Xa-z ]+))(?: ([0-9X]+/[0-9X]+))? ((?:red|colorless|green|white|black|blue| and )+)?(?: ?((?:(?:[A-Z][a-z]+ )+)|[a-z]+))?((?:legendary|artifact|creature|Aura|enchantment| )*)?tokens?( that are copies of)?(?: named ((?:[A-Z][a-z]+ ?|of ?)+(?:\'s \\w+)?)?)?(?:(?: with |\\. It has )?((?:(".*")|[a-z]+| and )+)+)?(?:.*(a copy of))?';
          const re = new RegExp(reString);
          const result = re.exec(ability);

          if (!result) continue;

          let tokenPowerAndToughness = result[4];
          const tokenColorString = result[5] ? result[5] : result[1];
          const tokenSubTypesString = result[6] ? result[6].trim() : '';
          let tokenSuperTypesString = result[7] ? result[7].trim() : '';
          if (result[3]) tokenSuperTypesString = `legendary ${tokenSuperTypesString}`;
          let tokenName;
          if (result[9]) {
            tokenName = result[9].trim();
          } else {
            tokenName = result[2] ? result[2] : tokenSubTypesString;
          } // if not specificaly named, use the type

          const tokenAbilities = [];
          if (result[10]) {
            const tmpTokenKeywords = result[10]
              .toLowerCase()
              .replace(/ *"[^"]*" */g, '')
              .replace(' and ', ',')
              .split(',');
            tmpTokenKeywords.forEach((part) => {
              if (part.length > 0) tokenAbilities.push(part);
            });
          }

          if (result[11]) {
            const tmpTokenAbilities = result[11].toLowerCase().split('"');
            tmpTokenAbilities.forEach((part) => {
              if (part.length > 0) tokenAbilities.push(part);
            });
          }

          const isACopy = !!(result[12] || result[8]);

          if (Object.keys(specialCaseTokens).includes(tokenName)) {
            mentionedTokens.push(specialCaseTokens[tokenName]);
            continue;
          }

          if (isACopy) {
            // most likely a token that could be a copy of any creature but it could have a specific token
            if (ability.toLowerCase().includes("create a token that's a copy of a creature token you control."))
              // populate
              continue;

            const cardTokens = getScryfallTokensForCard(card);

            if (cardTokens.length > 0) {
              mentionedTokens.push(...cardTokens);
            } // if there is no specified tokens for the card use the generic copy token
            else {
              mentionedTokens.push('a020dc47-3747-4123-9954-f0e87a858b8c');
            }
            continue;
          }

          const tokenColor = [];
          if (tokenColorString) {
            const colorStrings = tokenColorString.trim().split(' ');
            for (const rawColor of colorStrings) {
              switch (rawColor.toLowerCase()) {
                case 'red':
                  tokenColor.push('R');
                  break;
                case 'white':
                  tokenColor.push('W');
                  break;
                case 'green':
                  tokenColor.push('G');
                  break;
                case 'black':
                  tokenColor.push('B');
                  break;
                case 'blue':
                  tokenColor.push('U');
                  break;
                default:
              }
            }
          }
          let tokenPower;
          let tokenToughness;
          if (tokenPowerAndToughness) {
            if (tokenPowerAndToughness.length > 0) {
              tokenPowerAndToughness = tokenPowerAndToughness.replace(/X/g, '*');
              [tokenPower, tokenToughness] = tokenPowerAndToughness.split('/');
            }
          } else if (ability.includes('power and toughness are each equal')) {
            tokenPower = '*';
            tokenToughness = '*';
          }

          const dbHits = catalog.nameToId[tokenName.toLowerCase()];
          if (dbHits === undefined) {
            // for all the cards that produce tokens but do not have any in the database
            result.push('');
            continue;
          }
          for (const dbHit of dbHits) {
            const candidate = catalog.dict[dbHit];
            const areColorsValid = arraySetEqual(tokenColor, candidate.colors);

            const candidateTypes = candidate.type.toLowerCase().replace(' —', '').replace('token ', '').split(' ');

            const creatureTypes = [];
            tokenSuperTypesString
              .toLowerCase()
              .split(' ')
              .forEach((type) => {
                creatureTypes.push(type);
              });
            tokenSubTypesString
              .toLowerCase()
              .split(' ')
              .forEach((type) => {
                creatureTypes.push(type);
              });
            const areTypesValid = arraySetEqual(creatureTypes, candidateTypes);

            let areAbilitiesValid = false;
            if (candidate.oracle_text !== undefined && candidate.oracle_text.length > 0) {
              areAbilitiesValid = arraySetEqual(
                tokenAbilities,
                candidate.oracle_text
                  .toLowerCase()
                  .replace(/ *\([^)]*\) */g, '')
                  .split(', '),
              );
            } else {
              areAbilitiesValid = arraySetEqual(tokenAbilities, []);
            }

            if (
              candidate.power === tokenPower &&
              candidate.toughness === tokenToughness &&
              areColorsValid &&
              areTypesValid &&
              areAbilitiesValid
            ) {
              mentionedTokens.push(candidate.scryfall_id);
              break;
            }
          }
        }
      }
    }
    if (catalogCard.oracle_text.includes('Ascend (')) {
      mentionedTokens.push(specialCaseTokens["City's Blessing"]);
    }
    if (catalogCard.oracle_text.includes('poison counter')) {
      mentionedTokens.push(specialCaseTokens.Poison);
    }
    if (catalogCard.oracle_text.includes('you become the monarch')) {
      mentionedTokens.push(specialCaseTokens.Monarch);
    }
    if (catalogCard.oracle_text.includes('{E}')) {
      mentionedTokens.push(specialCaseTokens.Energy);
    }

    if (catalogCard.oracle_text.includes('emblem')) {
      const hits = catalog.nameToId[`${card.name.toLowerCase()} emblem`];
      if (Array.isArray(hits) && hits.length > 0) {
        mentionedTokens.push(hits[0]);
      }
    }
  }

  return mentionedTokens;
}

function convertCmc(card, isExtra, faceAttributeSource) {
  if (isExtra) {
    return 0;
  }
  return typeof faceAttributeSource.cmc === 'number' ? faceAttributeSource.cmc : card.cmc;
}

function convertLegalities(card, isExtra) {
  if (isExtra) {
    return {
      Legacy: 'not_legal',
      Modern: 'not_legal',
      Standard: 'not_legal',
      Pioneer: 'not_legal',
      Pauper: 'not_legal',
      Brawl: 'not_legal',
      Historic: 'not_legal',
      Commander: 'not_legal',
      Penny: 'not_legal',
      Vintage: 'not_legal',
    };
  }
  return {
    Legacy: card.legalities.legacy,
    Modern: card.legalities.modern,
    Standard: card.legalities.standard,
    Pioneer: card.legalities.pioneer,
    Pauper: card.legalities.pauper,
    Brawl: card.legalities.brawl,
    Historic: card.legalities.historic,
    Commander: card.legalities.commander,
    Penny: card.legalities.penny,
    Vintage: card.legalities.vintage,
  };
}

function convertParsedCost(card, isExtra = false) {
  if (isExtra) {
    return [];
  }

  let parsedCost = [];
  if (typeof card.card_faces === 'undefined' || card.layout === 'flip') {
    parsedCost = card.mana_cost
      .substr(1, card.mana_cost.length - 2)
      .toLowerCase()
      .split('}{')
      .reverse();
  } else if (card.layout === 'split' || card.layout === 'adventure') {
    parsedCost = card.mana_cost
      .substr(1, card.mana_cost.length - 2)
      .replace(' // ', '{split}')
      .toLowerCase()
      .split('}{')
      .reverse();
  } else if (Array.isArray(card.card_faces) && card.card_faces[0].colors) {
    parsedCost = card.card_faces[0].mana_cost
      .substr(1, card.card_faces[0].mana_cost.length - 2)
      .toLowerCase()
      .split('}{')
      .reverse();
  } else {
    console.error(`Error converting parsed colors: (isExtra:${isExtra}) ${card.name}`);
  }

  if (parsedCost) {
    parsedCost.forEach((item, index) => {
      parsedCost[index] = item.replace('/', '-');
    });
  }
  return parsedCost;
}

function convertColors(card, isExtra = false) {
  if (isExtra) {
    if (typeof card.card_faces === 'undefined' || card.card_faces.length < 2) {
      return [];
    }
    // special case: Adventure faces currently do not have colors on Scryfall (but probably should)
    if (card.layout === 'adventure') {
      return Array.from(card.colors);
    }
    // TODO: handle cards with more than 2 faces
    return Array.from(card.card_faces[1].colors);
  }

  if (typeof card.card_faces === 'undefined') {
    return Array.from(card.colors);
  }

  // card has faces
  switch (card.layout) {
    // NOTE: flip, split and Adventure cards include colors in the main details but not in the card faces
    case 'flip':
    case 'split':
    case 'adventure':
      return Array.from(card.colors);
    default:
  }

  // otherwise use the colors from the first face
  if (card.card_faces[0].colors) {
    return Array.from(card.card_faces[0].colors);
  }

  console.error(`Error converting colors: (isExtra:${isExtra}) ${card.name}`);
  return [];
}

function convertType(card, isExtra, faceAttributeSource) {
  let type = faceAttributeSource.type_line;
  if (!type) {
    type = card.type_line;
    if (isExtra) {
      type = type.substring(type.indexOf('/') + 2);
    } else if (type.includes('//')) {
      type = type.substring(0, type.indexOf('/'));
    }
  }

  if (type === 'Artifact — Contraption') {
    type = 'Artifact Contraption';
  }

  if (!type) {
    console.error(`Error converting type: (isExtra:${isExtra}) ${card.name} (id: ${card.scryfall_id})`);
    return '';
  }
  return type.trim();
}

function convertId(card, isExtra) {
  if (isExtra) {
    return `${card.id}2`;
  }
  return card.id;
}

function convertName(card, isExtra) {
  let str = card.name;

  if (isExtra) {
    str = str.substring(str.indexOf('/') + 2); // second name
  } else if (card.name.includes('/') && card.layout !== 'split') {
    // NOTE: we want split cards to include both names
    // but other double face to use the first name
    str = str.substring(0, str.indexOf('/')); // first name
  }

  if (card.layout === 'art_series') {
    str = `${str} Art Card`;
  }

  return str.trim();
}

function getFaceAttributeSource(card, isExtra) {
  let faceAttributeSource;
  if (isExtra) {
    [, faceAttributeSource] = card.card_faces;
  } else if (card.card_faces) {
    [faceAttributeSource] = card.card_faces;
  } else {
    faceAttributeSource = card;
  }
  return faceAttributeSource;
}

function convertCard(card, metadata, isExtra) {
  const faceAttributeSource = getFaceAttributeSource(card, isExtra);
  const newcard = {};
  if (isExtra) {
    card = { ...card };
    card.card_faces = [faceAttributeSource];
  }
  newcard.elo = 1200;
  newcard.popularity = 0;
  newcard.cubeCount = 0;
  newcard.pickCount = 0;
  newcard.isExtra = !!isExtra;
  if (metadata) {
    newcard.elo = metadata.elo;
    newcard.popularity = metadata.popularity;
    newcard.cubeCount = metadata.cubes;
    newcard.pickCount = metadata.picks;
  }

  const name = convertName(card, isExtra);
  newcard.color_identity = Array.from(card.color_identity);
  newcard.set = card.set;
  newcard.set_name = card.set_name;
  newcard.finishes = card.finishes;
  newcard.collector_number = card.collector_number;
  newcard.released_at = card.released_at;
  newcard.reprint = card.reprint;

  newcard.promo =
    card.promo ||
    (card.frame_effects && card.frame_effects.includes('extendedart')) ||
    (card.frame_effects && card.frame_effects.includes('showcase')) ||
    card.textless ||
    card.frame === 'art_series' ||
    card.set.toLowerCase() === 'mps' || // kaladesh masterpieces
    card.set.toLowerCase() === 'mp2' || // invocations
    card.set.toLowerCase() === 'exp' || // expeditions
    card.set.toLowerCase() === 'amh1'; // mh1 art cards
  newcard.prices = {
    usd: card.prices.usd ? parseFloat(card.prices.usd) : null,
    usd_foil: card.prices.usd_foil ? parseFloat(card.prices.usd_foil) : null,
    usd_etched: card.prices.usd_etched ? parseFloat(card.prices.usd_etched) : null,
    eur: card.prices.eur ? parseFloat(card.prices.eur) : null,
    tix: card.prices.tix ? parseFloat(card.prices.tix) : null,
  };

  newcard.digital = card.digital;
  newcard.isToken = card.layout === 'token';
  newcard.border_color = card.border_color;
  newcard.name = name;
  newcard.name_lower = cardutil.normalizeName(name);
  newcard.full_name = `${name} [${card.set}-${card.collector_number}]`;
  newcard.artist = card.artist;
  newcard.scryfall_uri = card.scryfall_uri;
  newcard.rarity = card.rarity;
  if (typeof card.card_faces === 'undefined') {
    newcard.oracle_text = card.oracle_text;
  } else {
    // concatenate all card face text to allow it to be found in searches
    newcard.oracle_text = card.card_faces.map((face) => face.oracle_text).join('\n');
  }
  newcard.scryfall_id = convertId(card, isExtra);
  // reversible cards have a separate oracle ID on each face
  newcard.oracle_id = faceAttributeSource.oracle_id || card.oracle_id;
  newcard.cmc = convertCmc(card, isExtra, faceAttributeSource);
  newcard.legalities = convertLegalities(card, isExtra);
  newcard.parsed_cost = convertParsedCost(card, isExtra);
  newcard.colors = convertColors(card, isExtra);
  newcard.type = convertType(card, isExtra, faceAttributeSource);
  newcard.full_art = card.full_art;
  newcard.language = card.lang;
  newcard.mtgo_id = card.mtgo_id;
  newcard.layout = card.layout;

  if (card.tcgplayer_id) {
    newcard.tcgplayer_id = card.tcgplayer_id;
  }
  if (faceAttributeSource.loyalty) {
    newcard.loyalty = faceAttributeSource.loyalty;
  }
  if (faceAttributeSource.power) {
    newcard.power = faceAttributeSource.power;
  }
  if (faceAttributeSource.toughness) {
    newcard.toughness = faceAttributeSource.toughness;
  }
  if (faceAttributeSource.image_uris) {
    newcard.image_small = faceAttributeSource.image_uris.small;
    newcard.image_normal = faceAttributeSource.image_uris.normal;
    newcard.art_crop = faceAttributeSource.image_uris.art_crop;
  } else if (card.image_uris) {
    newcard.image_small = card.image_uris.small;
    newcard.image_normal = card.image_uris.normal;
    newcard.art_crop = card.image_uris.art_crop;
  }
  if (card.card_faces && card.card_faces.length >= 2 && card.card_faces[1].image_uris) {
    newcard.image_flip = card.card_faces[1].image_uris.normal;
  }
  if (newcard.type.toLowerCase().includes('land')) {
    newcard.colorcategory = 'Lands';
  } else if (newcard.color_identity.length === 0) {
    newcard.colorcategory = 'Colorless';
  } else if (newcard.color_identity.length > 1) {
    newcard.colorcategory = 'Multicolored';
  } else if (newcard.color_identity.length === 1) {
    const legacyColorCategoryToCurrentMap = new Map([
      ['w', 'White'],
      ['u', 'Blue'],
      ['b', 'Black'],
      ['r', 'Red'],
      ['g', 'Green'],
    ]);

    const colorFromIdentity = newcard.color_identity[0].toLowerCase();
    if (legacyColorCategoryToCurrentMap.get(colorFromIdentity) !== undefined) {
      newcard.colorcategory = legacyColorCategoryToCurrentMap.get(colorFromIdentity);
    } else {
      newcard.colorcategory = colorFromIdentity;
    }
  }

  const tokens = getTokens(card, newcard);
  if (tokens.length > 0) {
    newcard.tokens = tokens;
  }

  return newcard;
}

function addLanguageMapping(card) {
  if (card.lang === 'en') {
    return;
  }

  const sameOracle = catalog.oracleToId[card.oracle_id] || [];
  for (const otherId of sameOracle) {
    const otherCard = catalog.dict[otherId];
    if (card.set === otherCard.set && card.collector_number === otherCard.collector_number) {
      catalog.english[card.id] = otherId;
      return;
    }
  }

  const name = cardutil.normalizeName(convertName(card));
  for (const otherId of catalog.nameToId[name]) {
    const otherCard = catalog.dict[otherId];
    if (card.set === otherCard.set && card.collector_number === otherCard.collector_number) {
      catalog.english[card.id] = otherId;
      return;
    }
  }
}

async function writeCatalog(basePath = 'private') {
  if (!fs.existsSync(basePath)) {
    fs.mkdirSync(basePath);
  }

  await writeFile(path.join(basePath, 'names.json'), catalog.names);
  await writeFile(path.join(basePath, 'cardtree.json'), util.turnToTree(catalog.names));
  await writeFile(path.join(basePath, 'carddict.json'), catalog.dict);
  await writeFile(path.join(basePath, 'nameToId.json'), catalog.nameToId);
  await writeFile(path.join(basePath, 'oracleToId.json'), catalog.oracleToId);
  await writeFile(path.join(basePath, 'english.json'), catalog.english);
  await writeFile(path.join(basePath, 'full_names.json'), util.turnToTree(catalog.full_names));
  await writeFile(path.join(basePath, 'imagedict.json'), catalog.imagedict);
  await writeFile(path.join(basePath, 'cardimages.json'), catalog.cardimages);
  await writeFile(path.join(basePath, 'metadatadict.json'), catalog.metadatadict);
  await writeFile(path.join(basePath, 'indexToOracle.json'), catalog.indexToOracle);

  console.info('All JSON files saved.');
}

function saveEnglishCard(card, metadata) {
  if (card.layout === 'transform') {
    addCardToCatalog(convertCard(card, metadata, true), true);
  }
  addCardToCatalog(convertCard(card, metadata));
}

async function saveAllCards(metadatadict, indexToOracle) {
  console.info('Processing cards...');
  await new Promise((resolve) =>
    fs
      .createReadStream('./private/cards.json')
      .pipe(JSONStream.parse('*'))
      .pipe(es.mapSync((item) => saveEnglishCard(item, metadatadict[item.oracle_id])))
      .on('close', resolve),
  );

  console.info('Creating language mappings...');
  await new Promise((resolve) =>
    fs
      .createReadStream('./private/all-cards.json')
      .pipe(JSONStream.parse('*'))
      .pipe(es.mapSync(addLanguageMapping))
      .on('close', resolve),
  );

  catalog.indexToOracle = indexToOracle;
  catalog.metadatadict = metadatadict;

  console.info('Saving cardbase files...');
  await writeCatalog('./private');
}

const downloadFromScryfall = async (metadatadict, indexToOracle) => {
  console.info('Downloading files from scryfall...');
  try {
    // the module.exports line is necessary to correctly mock this function in unit tests
    await downloadDefaultCards();
  } catch (error) {
    console.error('Downloading card data failed:');
    console.error(error.message, error);
    console.error('Cardbase was not updated');
    return;
  }

  console.info('Creating objects...');
  try {
    await saveAllCards(metadatadict, indexToOracle);
  } catch (error) {
    console.error('Updating cardbase objects failed:');
    console.error(error.message, error);
    console.error('Cardbase update may not have fully completed');
  }

  console.info('Finished cardbase update...');
};

const s3 = new AWS.S3({
  endpoint: process.env.AWS_ENDPOINT || undefined,
  s3ForcePathStyle: !!process.env.AWS_ENDPOINT,
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION || 'us-east-2',
});

const uploadStream = (key) => {
  const pass = new stream.PassThrough();
  return {
    writeStream: pass,
    promise: s3.upload({ Bucket: process.env.DATA_BUCKET, Key: key, Body: pass }).promise(),
  };
};

const uploadLargeObjectToS3 = async (file, key) => {
  await new Promise((resolve, reject) => {
    try {
      const { writeStream, promise } = uploadStream(key);
      const readStream = fs.createReadStream(file);

      readStream.pipe(writeStream);

      promise
        .then(() => {
          resolve();
        })
        .catch((err) => {
          reject(err);
        });
    } catch (error) {
      reject(error);
    }
  });
};

const uploadCardDb = async () => {
  for (const file of Object.keys(carddb.fileToAttribute)) {
    console.log(`Uploading ${file}...`);

    await uploadLargeObjectToS3(`private/${file}`, `cards/${file}`);

    console.log(`Finished ${file}`);
  }

  console.log('Uploading manifest...');
  await s3
    .upload({
      Bucket: process.env.DATA_BUCKET,
      Key: `cards/manifest.json`,
      Body: JSON.stringify({ date_exported: new Date() }),
    })
    .promise();
  console.log('Finished manifest');

  console.log('done');
};

const loadMetadatadict = async () => {
  if (fs.existsSync('./temp') && fs.existsSync('./temp/metadatadict.json')) {
    const metadatadict = JSON.parse(fs.readFileSync('./temp/metadatadict.json'));
    const indexToOracle = JSON.parse(fs.readFileSync('./temp/indexToOracle.json'));

    return {
      metadatadict,
      indexToOracle,
    };
  }

  console.log("Couldn't find metadatadict.json");
  return {
    metadatadict: {},
    indexToOracle: [],
  };
};

(async () => {
  try {
    const { metadatadict, indexToOracle } = await loadMetadatadict();
    await downloadFromScryfall(metadatadict, indexToOracle);
    await uploadCardDb();

    console.log('Complete');

    process.exit();
  } catch (error) {
    console.error(error.message, error);
  }
})();
