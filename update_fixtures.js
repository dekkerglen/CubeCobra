const fs = require('fs');
const path = require('path');

const carddb = require('./serverjs/cards');
const updatecards = require('./serverjs/updatecards');

const dataPath = 'private';
const fixturesPath = 'fixtures';
const cardsPath = path.join(dataPath, 'cards.json');
const emptyPath = path.join(fixturesPath, 'empty.json');
const cardsFixturePath = path.join(fixturesPath, 'cards_small.json');
const cardsConvertedPath = path.join(fixturesPath, 'cards_small_converted.json');
const err = 1;

// rebuild the fixtures based on the previous subset of cards
(async function updateFixtures() {
  const cardJSON = JSON.parse(fs.readFileSync(cardsPath));
  // make id based list
  const cardJSONById = {};
  cardJSON.forEach((card) => {
    cardJSONById[card.id] = card;
  });

  await carddb.initializeCardDb(dataPath, true);

  console.log('Cards initialized');

  if (carddb.allCards().length === 0) {
    throw new Error('Could not find existing cards to update from');
  }

  const contents = fs.readFileSync(cardsFixturePath);
  if (!contents) {
    throw new Error(`Could not find fixtures file:${cardsFixturePath}`);
  }

  const fixtureCards = JSON.parse(contents);
  if (fixtureCards.length === 0) {
    throw new Error('No existing fixtures found');
  }

  const convertedCards = [];
  const updatedCards = fixtureCards.map((card) => {
    const id = card.id || card._id; // internally we use '_id', but scryfall uses 'id'
    const newcard = carddb.cardFromId(id);
    if (!newcard) {
      throw new Error(`Error finding card with id${id}`);
    }
    // do not add special cards
    // RK: only needed once to change the fixtures to use most reasonable, but included
    //     to illustrate if that every eneds to happen again
    // newcard = carddb.getMostReasonable(updatecards.convertName(card));

    updatecards.addCardToCatalog(newcard); // need to set catalog so we can write it later

    // also track converted cards so we can save those for easier debugging
    convertedCards.push(newcard);

    // find the card json and return that
    return cardJSONById[newcard._id];
  });
  if (updatedCards.length === 0) {
    throw new Error('Error finding updated cards');
  }

  console.log('Saving new fixtures');
  await updatecards.writeCatalog(fixturesPath);

  console.log('Writing:', cardsFixturePath);
  await fs.writeFileSync(cardsFixturePath, JSON.stringify(updatedCards, null, 2));

  console.log('Writing:', cardsConvertedPath);
  await fs.writeFileSync(cardsConvertedPath, JSON.stringify(convertedCards, null, 2));

  await fs.writeFileSync(emptyPath, '{}\n');

  // fixExampleCube();

  console.log('Finished');
})().catch((e) => {
  console.log('Error:', e);
  process.exit(err);
});
