const fs = require('fs');
const path = require('path');

const carddb = require('./serverjs/cards');
const updatecards = require('./serverjs/updatecards');
const cubefixture = require('./fixtures/examplecube');

const dataPath = 'private';
const fixturesPath = 'fixtures';
const cardsPath = path.join(dataPath, 'cards.json');
const cardsFixturePath = path.join(fixturesPath, 'cards_small.json');
const cardsConvertedPath = path.join(fixturesPath, 'cards_small_converted.json');
const err = 1;
const success = 0;

// rebuild the fixtures based on the previous subset of cards
(async function() {
  console.log('Attempting to read', cardsPath);
  const cardJSON = JSON.parse(fs.readFileSync(cardsPath));
  // make id based list
  let cardJSONById = {};
  cardJSON.forEach((card) => (cardJSONById[card.id] = card));

  await carddb.initializeCardDb(dataPath, true);

  console.log('Cards initialized');

  if (carddb.allCards().length == 0) {
    throw 'Could not find existing cards to update from';
  }

  let contents = fs.readFileSync(cardsFixturePath);
  if (!contents) {
    throw 'Could not find fixtures file:' + cardsFixturePath;
  }

  let fixtureCards = JSON.parse(contents);
  if (fixtureCards.length == 0) {
    throw 'No existing fixtures found';
  }

  let convertedCards = [];
  let updatedCards = fixtureCards.map((card) => {
    let id = card.id || card._id; // internally we use '_id', but scryfall uses 'id'
    let newcard = carddb.cardFromId(id);
    if (!newcard) {
      throw 'Error finding card with id' + id;
    }
    // do not add special cards
    // RK: only needed once to change the fixtures to use most reasonable, but included
    //     to illustrate if that every eneds to happen again
    //newcard = carddb.getMostReasonable(updatecards.convertName(card));

    updatecards.addCardToCatalog(newcard); // need to set catalog so we can write it later

    // also track converted cards so we can save those for easier debugging
    convertedCards.push(newcard);

    // find the card json and return that
    return cardJSONById[newcard._id];
  });
  if (updatedCards.length == 0) {
    throw 'Error finding updated cards';
  }

  console.log('Saving new fixtures');
  res = await updatecards.writeCatalog(fixturesPath);

  console.log('Writing:', cardsFixturePath);
  res = await fs.writeFileSync(cardsFixturePath, JSON.stringify(updatedCards, null, 2));

  console.log('Writing:', cardsConvertedPath);
  res = await fs.writeFileSync(cardsConvertedPath, JSON.stringify(convertedCards, null, 2));

  //fixExampleCube();

  console.log('Finished');
})().catch((e) => {
  console.log('Error:', e);
  process.exit(err);
});

// one time update of example cube:
const fixExampleCube = () => {
  let exampleCube = JSON.parse(JSON.stringify(cubefixture.exampleCube));
  let reasonableCards = [];
  carddb.initializeCardDb('private', true).then(() => {
    exampleCube.cards.forEach(function(card, index) {
      let name = carddb.cardFromId(card.cardID).name;
      let reasonable = carddb.getMostReasonable(name);
      if (card.cardID !== reasonable._id) {
        console.log('updating', name, '(', card.cardID, ') with more reasonable id:', reasonable._id);
      }
      card.cardID = reasonable._id;
    });
    // copy and paste this into examplecube.js
    console.log(exampleCube.cards);
  });
};
