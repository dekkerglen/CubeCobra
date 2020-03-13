const mongoose = require('mongoose');
const Deck = require('../models/deck');
const Cube = require('../models/cube');
const User = require('../models/user');
const mongosecrets = require('../../cubecobrasecrets/mongodb');

const batch_size = 100;

const cubeNameCache = {};
const userNameCache = {};

async function addVars(deck) {
  if (!cubeNameCache[deck.cube]) {
    const cube = await Cube.findById(deck.cube);
    cubeNameCache[deck.cube] = cube ? cube.name : 'Cube';
  }
  deck.cubename = cubeNameCache[deck.cube];

  if (!userNameCache[deck.owner]) {
    const user = await User.findById(deck.owner);
    userNameCache[deck.owner] = user ? user.username : 'User';
  }
  deck.username = userNameCache[deck.owner];

  return await deck.save();
}

(async () => {
  var i = 0;
  mongoose.connect(mongosecrets.connectionString).then(async (db) => {
    const count = await Deck.countDocuments();
    const cursor = Deck.find().cursor();

    //batch them in 100
    for (var i = 0; i < count; i += batch_size) {
      const decks = [];
      for (var j = 0; j < batch_size; j++) {
        if (i + j < count) {
          let deck = await cursor.next();
          if (deck) {
            decks.push(deck);
          }
        }
      }
      await Promise.all(decks.map((deck) => addVars(deck)));
      console.log('Finished: ' + i + ' of ' + count + ' decks');
    }
    mongoose.disconnect();
    console.log('done');
  });
})();
