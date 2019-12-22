const fs = require('fs');
const path = require('path');
const https = require('https');
const cardutil = require('../dist/util/Card.js');

const util = require('./util.js');
const carddb = require('./cards.js');

const _catalog = {};

function initializeCatalog() {
  _catalog.dict = {};
  _catalog.names = [];
  _catalog.nameToId = {};
  _catalog.full_names = [];
  _catalog.imagedict = {};
  _catalog.cardimages = {};
}

initializeCatalog();

function downloadDefaultCards() {
  var file = fs.createWriteStream('private/cards.json');
  var promise = new Promise((resolve, reject) => {
    https.get('https://archive.scryfall.com/json/scryfall-default-cards.json', function(response) {
      let stream = response.pipe(file);
      stream.on('finish', function() {
        resolve();
      });
    });
  });
  return promise;
}

function updateCardbase(filepath) {
  if (filepath === undefined) {
    filepath = 'private/cards.json';
  }
  if (!fs.existsSync('private')) {
    fs.mkdirSync('private');
  }
  return module.exports.downloadDefaultCards().then(function() {
    var contents = fs.readFileSync(filepath);
    var cards = JSON.parse(contents);
    saveAllCards(cards);
    console.log('Finished cardbase update...');
  });
}

function addCardToCatalog(card, isExtra) {
  _catalog.dict[card._id] = card;
  const normalizedFullName = cardutil.normalizeName(card.full_name);
  const normalizedName = cardutil.normalizeName(card.name);
  _catalog.imagedict[normalizedFullName] = {
    uri: card.art_crop,
    artist: card.artist,
  };
  if (isExtra !== true) {
    let card_images = {
      image_normal: card.image_normal,
    };
    if (card.image_flip) {
      card_images.image_flip = card.image_flip;
    }
    if (carddb.notPromoOrDigitalCard(card)) {
      _catalog.cardimages[normalizedName] = card_images;
    }
  }
  //only add if it doesn't exist, this makes the default the newest edition
  if (!_catalog.nameToId[normalizedName]) {
    _catalog.nameToId[normalizedName] = [];
  }
  _catalog.nameToId[normalizedName].push(card._id);
  util.binaryInsert(normalizedName, _catalog.names);
  util.binaryInsert(normalizedFullName, _catalog.full_names);
}

function writeFile(filepath, data) {
  return new Promise((resolve, reject) => {
    fs.writeFile(filepath, data, 'utf8', function(err) {
      if (err) {
        console.log('An error occured while writing ' + filepath);
        console.log(err);
        reject(err);
      } else {
        resolve(data);
      }
    });
  });
}

function addTokens(card) {
  var mentionedTokens = [];

  if (Object.keys(specialCaseCardsList).includes(_catalog.dict[card.id].name)) {
    _catalog.dict[card.id].tokens = getTokensForSpecialCaseCard(_catalog.dict[card.id]._id, card);
  } else if (_catalog.dict[card.id].oracle_text != null) {
    if (_catalog.dict[card.id].oracle_text.includes(' token')) {
      //find the ability that generates the token to reduce the amount of text to get confused by.
      var abilities = _catalog.dict[card.id].oracle_text.split('\n');
      for (const ability of abilities) {
        if (ability.includes(' token')) {
          var reString =
            '((?:(?:([A-Za-z ,]+), a (legendary))|[Xa-z ]+))(?: ([0-9X]+/[0-9X]+))? ((?:red|colorless|green|white|black|blue| and )+)?(?: ?((?:(?:[A-Z][a-z]+ )+)|[a-z]+))?((?:legendary|artifact|creature|Aura|enchantment| )*)?tokens?( that are copies of)?(?: named ((?:[A-Z][a-z]+ ?|of ?)+(?:\'s \\w+)?)?)?(?:(?: with |\\. It has )?((?:(".*")|[a-z]+| and )+)+)?(?:.*(a copy of))?';
          var re = new RegExp(reString);
          var result = re.exec(ability);
          if (result == undefined) continue;

          var tokenPowerAndToughness = result[4];
          var tokenColorString = result[5] ? result[5] : result[1];
          var tokenSubTypesString = result[6] ? result[6].trim() : '';
          var tokenSuperTypesString = result[7] ? result[7].trim() : '';
          if (result[3]) tokenSuperTypesString = 'legendary ' + tokenSuperTypesString;
          var tokenName = result[9] ? result[9].trim() : result[2] ? result[2] : tokenSubTypesString; //if not specificaly named, use the type

          var tokenAbilities = [];
          if (result[10]) {
            var tmpTokenKeywords = result[10]
              .toLowerCase()
              .replace(/ *\"[^"]*\" */g, '')
              .replace(' and ', ',')
              .split(',');
            tmpTokenKeywords.forEach((part) => {
              if (part.length > 0) tokenAbilities.push(part);
            });
          }

          if (result[11]) {
            var tmpTokenAbilities = result[11].toLowerCase().split('"');
            tmpTokenAbilities.forEach((part) => {
              if (part.length > 0) tokenAbilities.push(part);
            });
          }

          var isACopy = result[12] || result[8] ? true : false;

          if (specialCaseTokensList.includes(tokenName)) {
            mentionedTokens.push({
              tokenId: getTokenIDForSpecialCaseToken(tokenName),
              sourceCardId: _catalog.dict[card.id]._id,
            });
            continue;
          }

          if (isACopy) {
            // most likely a token that could be a copy of any creature but it could have a specific token
            if (ability.toLowerCase().includes("create a token that's a copy of a creature token you control."))
              //populate
              continue;

            var cardTokens = getTokensFromCard(card);

            if (cardTokens.length > 0) {
              cardTokens.forEach((element) => {
                mentionedTokens.push({
                  tokenId: element,
                  sourceCardId: _catalog.dict[card.id]._id,
                });
              });
            } //if there is no specified tokens for the card use the generic copy token
            else
              mentionedTokens.push({
                tokenId: 'a020dc47-3747-4123-9954-f0e87a858b8c',
                sourceCardId: _catalog.dict[card.id]._id,
              });

            continue;
          }

          var tokenColor = [];
          if (tokenColorString) {
            var colorStrings = tokenColorString.trim().split(' ');
            colorStrings.forEach((rawColor) => {
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
              }
            });
          }
          var tokenPower;
          var tokenToughness;
          if (tokenPowerAndToughness) {
            if (tokenPowerAndToughness.length > 0) {
              tokenPowerAndToughness = tokenPowerAndToughness.replace(/X/g, '*');
              tokenPower = tokenPowerAndToughness.split('/')[0];
              tokenToughness = tokenPowerAndToughness.split('/')[1];
            }
          } else if (ability.includes('power and toughness are each equal')) {
            tokenPower = '*';
            tokenToughness = '*';
          }

          var dbHits = _catalog.nameToId[tokenName.toLowerCase()];
          if (dbHits == undefined) {
            // for all the cards that produce tokens but do not have any in the database
            result.push({
              tokenId: '',
              sourceCardId: _catalog.dict[card.id]._id,
            });
            continue;
          }
          for (const dbHit of dbHits) {
            var candidate = _catalog.dict[dbHit];
            var areColorsValid = CheckContentsEqualityOfArray(tokenColor, candidate.colors);

            var candidateTypes = candidate.type
              .toLowerCase()
              .replace(' —', '')
              .replace('token ', '')
              .split(' ');

            var creatureTypes = [];
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
            var areTypesValid = CheckContentsEqualityOfArray(creatureTypes, candidateTypes);

            var areAbilitiesValid = false;
            if (candidate.oracle_text != undefined && candidate.oracle_text.length > 0) {
              areAbilitiesValid = CheckContentsEqualityOfArray(
                tokenAbilities,
                candidate.oracle_text
                  .toLowerCase()
                  .replace(/ *\([^)]*\) */g, '')
                  .split(', '),
              );
            } else {
              areAbilitiesValid = CheckContentsEqualityOfArray(tokenAbilities, []);
            }

            if (
              candidate.power == tokenPower &&
              candidate.toughness == tokenToughness &&
              areColorsValid &&
              areTypesValid &&
              areAbilitiesValid
            ) {
              mentionedTokens.push({
                tokenId: candidate._id,
                sourceCardId: _catalog.dict[card.id]._id,
              });
              break;
            }
          }
        }
      }
    }
    if (_catalog.dict[card.id].oracle_text.includes('Ascend (')) {
      mentionedTokens.push({
        tokenId: getTokenIDForSpecialCaseToken("City's Blessing"),
        sourceCardId: _catalog.dict[card.id]._id,
      });
    }
    if (_catalog.dict[card.id].oracle_text.includes('poison counter')) {
      mentionedTokens.push({
        tokenId: getTokenIDForSpecialCaseToken('Poison'),
        sourceCardId: _catalog.dict[card.id]._id,
      });
    }
    if (_catalog.dict[card.id].oracle_text.includes('you become the monarch')) {
      mentionedTokens.push({
        tokenId: getTokenIDForSpecialCaseToken('Monarch'),
        sourceCardId: _catalog.dict[card.id]._id,
      });
    }
    if (_catalog.dict[card.id].oracle_text.includes('{E}')) {
      mentionedTokens.push({
        tokenId: getTokenIDForSpecialCaseToken('Energy'),
        sourceCardId: _catalog.dict[card.id]._id,
      });
    }

    if (_catalog.dict[card.id].oracle_text.includes('emblem')) {
      var hits = _catalog.nameToId[card.name.toLowerCase() + ' emblem'];
      if (hits != undefined) {
        mentionedTokens.push({
          tokenId: hits[0],
          sourceCardId: _catalog.dict[card.id]._id,
        });
      }
    }

    if (mentionedTokens.length == 0) {
      var cardTokens = getTokensFromCard(card);

      if (cardTokens.length > 0) {
        cardTokens.forEach((element) => {
          mentionedTokens.push({
            tokenId: element,
            sourceCardId: _catalog.dict[card.id]._id,
          });
        });
      }
    }

    if (mentionedTokens.length > 0) {
      _catalog.dict[card.id].tokens = mentionedTokens;
    }
  }
}

function saveAllCards(arr, basePath = 'private') {
  arr.forEach(function(card, index) {
    if (card.layout == 'transform') {
      addCardToCatalog(convertCard(card, true), true);
    }
    addCardToCatalog(convertCard(card));
  });
  arr.forEach(function(card, index) {
    addTokens(card);
  });
  return writeCatalog(basePath);
}

function writeCatalog(basePath = 'private') {
  if (!fs.existsSync(basePath)) {
    fs.mkdirSync(basePath);
  }
  var pendingWrites = [];
  pendingWrites.push(writeFile(path.join(basePath, 'names.json'), JSON.stringify(_catalog.names)));
  pendingWrites.push(writeFile(path.join(basePath, 'cardtree.json'), JSON.stringify(util.turnToTree(_catalog.names))));
  pendingWrites.push(writeFile(path.join(basePath, 'carddict.json'), JSON.stringify(_catalog.dict)));
  pendingWrites.push(writeFile(path.join(basePath, 'nameToId.json'), JSON.stringify(_catalog.nameToId)));
  pendingWrites.push(
    writeFile(path.join(basePath, 'full_names.json'), JSON.stringify(util.turnToTree(_catalog.full_names))),
  );
  pendingWrites.push(writeFile(path.join(basePath, 'imagedict.json'), JSON.stringify(_catalog.imagedict)));
  pendingWrites.push(writeFile(path.join(basePath, 'cardimages.json'), JSON.stringify(_catalog.cardimages)));
  var allWritesPromise = Promise.all(pendingWrites);
  allWritesPromise.then(function() {
    console.log('All JSON files saved.');
  });
  return allWritesPromise;
}

function convertCmc(card, isExtra) {
  if (isExtra) {
    return 0;
  }
  return card.cmc;
}

function convertLegalities(card, isExtra) {
  if (isExtra) {
    return {
      Legacy: false,
      Modern: false,
      Standard: false,
      Pauper: false,
      Pioneer: false,
    };
  }
  return {
    Legacy: card.legalities.legacy === 'legal',
    Modern: card.legalities.modern === 'legal' || card.legalities.modern === 'banned',
    Standard: card.legalities.standard === 'legal' || card.legalities.standard === 'banned',
    Pioneer: card.legalities.pioneer === 'legal' || card.legalities.pioneer === 'banned',
    Pauper: card.legalities.pauper === 'legal' || card.legalities.pauper === 'banned',
  };
}

function convertParsedCost(card, isExtra = false) {
  if (isExtra) {
    return [];
  }

  if (!card.mana_cost) {
    return [''];
  }

  let parsed_cost = [];
  if (typeof card.card_faces === 'undefined' || card.layout == 'flip') {
    parsed_cost = card.mana_cost
      .substr(1, card.mana_cost.length - 2)
      .toLowerCase()
      .split('}{')
      .reverse();
  } else if (card.layout == 'split' || card.layout == 'adventure') {
    parsed_cost = card.mana_cost
      .substr(1, card.mana_cost.length - 2)
      .replace(' // ', '{split}')
      .toLowerCase()
      .split('}{')
      .reverse();
  } else if (card.card_faces[0].colors) {
    parsed_cost = card.card_faces[0].mana_cost
      .substr(1, card.card_faces[0].mana_cost.length - 2)
      .toLowerCase()
      .split('}{')
      .reverse();
  } else {
    console.log('Error converting parsed colors: (isExtra:', isExtra, ')', card.name);
  }

  if (parsed_cost) {
    parsed_cost.forEach(function(item, index) {
      parsed_cost[index] = item.replace('/', '-');
    });
  }
  return parsed_cost;
}

function convertColors(card, isExtra = false) {
  if (isExtra) {
    if (typeof card.card_faces === 'undefined' || card.card_faces.length < 2) {
      console.log('Error converting colors: (isExtra:', isExtra, ')', card.name);
      return [];
    }
    // special case: Adventure faces currently do not have colors on Scryfall (but probably should)
    if (card.layout == 'adventure') {
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
  }

  // otherwise use the colors from the first face
  if (card.card_faces[0].colors) {
    return Array.from(card.card_faces[0].colors);
  }

  console.log('Error converting colors: (isExtra:', isExtra, ')', card.name);
  console.log(card);
  return [];
}

function convertType(card, isExtra) {
  let _type = card.type_line;
  if (isExtra) {
    _type = _type.substring(_type.indexOf('/') + 2);
  } else if (_type.includes('//')) {
    _type = _type.substring(0, _type.indexOf('/'));
  }
  if (_type == 'Artifact — Contraption') {
    _type = 'Artifact Contraption';
  }
  return _type.trim();
}

function convertId(card, isExtra) {
  if (isExtra) {
    return card.id + '2';
  } else {
    return card.id;
  }
}

function convertName(card, isExtra) {
  let str = card.name;

  if (isExtra) {
    str = str.substring(str.indexOf('/') + 2); // second name
  } else if (card.name.includes('/') && card.layout != 'split') {
    // NOTE: we want split cards to include both names
    // but other double face to use the first name
    str = str.substring(0, str.indexOf('/')); // first name
  }
  return str.trim();
}

function CheckContentsEqualityOfArray(target, candidate) {
  var isValid = candidate.length == target.length;
  if (!isValid) return false;

  for (idx = 0; idx < target.length; idx++) {
    if (!candidate.includes(target[idx])) {
      isValid = false;
      break;
    }
  }
  return isValid;
}

function getTokensFromCard(card) {
  var cardTokens = [];
  if (!card.all_parts) return [];
  card.all_parts.forEach((element) => {
    if (element.component == 'token') {
      cardTokens.push(element.id);
    }
  });
  return cardTokens;
}

var specialCaseCardsList = {
  "Outlaws' Merriment": [
    {
      tokenId: 'db951f76-b785-453e-91b9-b3b8a5c1cfd4',
    },
    {
      tokenId: 'cd3ca6d5-4b2c-46d4-95f3-f0f2fa47f447',
    },
    {
      tokenId: 'c994ea90-71f4-403f-9418-2b72cc2de14d',
    },
  ],

  "Trostani's Summoner": [
    {
      tokenId: '703e7ecf-3d73-40c1-8cfe-0758778817cf',
    },
    {
      tokenId: '5fc993a7-a1ce-4403-a0a0-2afc9f9eca42',
    },
    {
      tokenId: '214a48bc-4a1c-44e3-9415-a73af3d4fd95',
    },
  ],
  //These two are a bit of a problem. Normaly when an ability creates copies the scryfall tokens associated with it are fetched.
  //This works great in most cases, but these two already have a token in scryfall only it's the wrong token. It's a token refering to
  //the first ability and not the one that generates the copies.
  'Saheeli, the Gifted': [
    {
      tokenId: '761507d5-d36a-4123-a074-95d7f6ffb4c5',
    },
    {
      tokenId: 'a020dc47-3747-4123-9954-f0e87a858b8c',
    },
  ],
  'Daretti, Ingenious Iconoclast': [
    {
      tokenId: '7c82af53-2de8-4cd6-84bf-fb39d2693de2',
    },
    {
      tokenId: 'a020dc47-3747-4123-9954-f0e87a858b8c',
    },
  ],

  //There simply does not seem to exist a 3/1 red elemental token with haste but without trample so i choose the closest thing.
  'Chandra, Flamecaller': [
    {
      tokenId: 'bc6f27f7-0248-4c04-8022-41073966e4d8',
    },
  ],

  //the cards below are transform cards that are on here due to the way
  //we currently do not populate the oracle text of transform cards.
  'Arlinn Kord': [
    {
      tokenId: 'bd05e304-1a16-436d-a05c-4a38a839759b',
    },
  ],
  'Bloodline Keeper': [
    {
      tokenId: '71496671-f7ba-4014-a895-d70a27979db7',
    },
  ],
  'Docent of Perfection': [
    {
      tokenId: 'e4439a8b-ef98-428d-a274-53c660b23afe',
    },
  ],
  'Dowsing Dagger': [
    {
      tokenId: '642d1d93-22d0-43f9-8691-6790876185a0',
    },
  ],
  'Extricator of Sin': [
    {
      tokenId: '11d25bde-a303-4b06-a3e1-4ad642deae58',
    },
  ],
  'Garruk Relentless': [
    {
      tokenId: 'bd05e304-1a16-436d-a05c-4a38a839759b',
    },
    {
      tokenId: '7a49607c-427a-474c-ad77-60cd05844b3c',
    },
  ],
  'Golden Guardian': [
    {
      tokenId: 'a7820eb9-6d7f-4bc4-b421-4e4420642fb7',
    },
  ],
  'Hanweir Militia Captain': [
    {
      tokenId: '94ed2eca-1579-411d-af6f-c7359c65de30',
    },
  ],
  'Huntmaster of the Fells': [
    {
      tokenId: 'bd05e304-1a16-436d-a05c-4a38a839759b',
    },
  ],
  "Legion's Landing": [
    {
      tokenId: '09293ae7-0629-417b-9eda-9bd3f6d8e118',
    },
  ],
  'Liliana, Heretical Healer': [
    {
      tokenId: '8e214f84-01ee-49c1-8801-4e550b5ade5d',
    },
  ],
  'Mayor of Avabruck': [
    {
      tokenId: 'bd05e304-1a16-436d-a05c-4a38a839759b',
    },
  ],
  'Nissa, Vastwood Seer': [
    {
      tokenId: '0affd414-f774-48d1-af9e-bff74e58e1ca',
    },
  ],
  'Shrill Howler': [
    {
      tokenId: '11d25bde-a303-4b06-a3e1-4ad642deae58',
    },
  ],
  'Storm the Vault': [
    {
      tokenId: 'e6fa7d35-9a7a-40fc-9b97-b479fc157ab0',
    },
  ],
  'Treasure Map': [
    {
      tokenId: 'e6fa7d35-9a7a-40fc-9b97-b479fc157ab0',
    },
  ],
  'Westvale Abbey': [
    {
      tokenId: '94ed2eca-1579-411d-af6f-c7359c65de30',
    },
  ],
};
var specialCaseTokensList = ['Food', 'Treasure'];

function getTokensForSpecialCaseCard(newCardid, card) {
  var result = [];
  if (card.card_faces) {
    var result = specialCaseCardsList[card.card_faces[0].name];
  } else {
    var result = specialCaseCardsList[card.name];
  }
  result.forEach(function(card, index) {
    card.sourceCardId = newCardid;
  });
  return result;
}

function getTokenIDForSpecialCaseToken(tokenName) {
  switch (tokenName) {
    case 'Food':
      return 'bf36408d-ed85-497f-8e68-d3a922c388a0';
      break;
    case 'Treasure':
      return 'e6fa7d35-9a7a-40fc-9b97-b479fc157ab0';
      break;
    case 'Poison':
      return '470618f6-f67f-44c6-a086-285632508915';
      break;
    case "City's Blessing":
      return 'ba64ed3e-93c5-406f-a38d-65cc68472122';
      break;
    case 'Monarch':
      return '40b79918-22a7-4fff-82a6-8ebfe6e87185';
      break;
    case 'Energy':
      return 'a446b9f8-cb22-408a-93ff-bee44a0dccc0';
      break;
  }
}

function convertCard(card, isExtra) {
  var faceAttributeSource;
  let newcard = {};
  if (isExtra) {
    faceAttributeSource = card.card_faces[1];
  } else {
    if (card.card_faces) {
      faceAttributeSource = card.card_faces[0];
    } else {
      faceAttributeSource = card;
    }
  }
  var name = convertName(card, isExtra);
  newcard.color_identity = Array.from(card.color_identity);
  newcard.set = card.set;
  newcard.collector_number = card.collector_number;
  newcard.promo =
    card.promo ||
    (card.frame_effects && card.frame_effects.includes('extendedart')) ||
    (card.frame_effects && card.frame_effects.includes('showcase')) ||
    card.textless ||
    card.frame == 'art_series' ||
    card.set.toLowerCase() == 'mps' || //kaladesh masterpieces
    card.set.toLowerCase() == 'mp2' || //invocations
    card.set.toLowerCase() == 'exp'; //expeditions
  newcard.digital = card.digital;
  newcard.isToken = card.layout === 'token';
  newcard.border_color = card.border_color;
  newcard.name = name;
  newcard.name_lower = cardutil.normalizeName(name);
  newcard.full_name = name + ' [' + card.set + '-' + card.collector_number + ']';
  newcard.artist = card.artist;
  newcard.scryfall_uri = card.scryfall_uri;
  newcard.rarity = card.rarity;
  if (typeof card.card_faces === 'undefined') {
    newcard.oracle_text = card.oracle_text;
  } else {
    // concatenate all card face text to allow it to be found in searches
    newcard.oracle_text = card.card_faces.map((face) => face.oracle_text).join('\n');
  }
  newcard._id = convertId(card, isExtra);
  newcard.cmc = convertCmc(card, isExtra);
  newcard.legalities = convertLegalities(card, isExtra);
  newcard.parsed_cost = convertParsedCost(card, isExtra);
  newcard.colors = convertColors(card, isExtra);
  newcard.type = convertType(card, isExtra);
  newcard.full_art = card.full_art;
  newcard.language = card.lang;

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
  } else {
    newcard.image_small = card.image_uris.small;
    newcard.image_normal = card.image_uris.normal;
    newcard.art_crop = card.image_uris.art_crop;
  }
  if (card.card_faces && card.card_faces.length >= 2 && card.card_faces[1].image_uris) {
    newcard.image_flip = card.card_faces[1].image_uris.normal;
  }
  if (newcard.type.toLowerCase().includes('land')) {
    newcard.colorcategory = 'l';
  } else if (newcard.color_identity.length == 0) {
    newcard.colorcategory = 'c';
  } else if (newcard.color_identity.length > 1) {
    newcard.colorcategory = 'm';
  } else if (newcard.color_identity.length == 1) {
    newcard.colorcategory = newcard.color_identity[0].toLowerCase();
  }

  return newcard;
}

module.exports = {
  initializeCatalog: initializeCatalog,
  catalog: _catalog,
  addCardToCatalog: addCardToCatalog,
  updateCardbase: updateCardbase,
  downloadDefaultCards: downloadDefaultCards,
  saveAllCards: saveAllCards,
  writeCatalog: writeCatalog,
  convertCard: convertCard,
  convertName: convertName,
  convertId: convertId,
  convertLegalities: convertLegalities,
  convertType: convertType,
  convertColors: convertColors,
  convertParsedCost: convertParsedCost,
  convertCmc: convertCmc,
};
