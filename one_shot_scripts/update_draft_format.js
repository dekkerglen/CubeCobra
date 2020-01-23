const mongoose = require('mongoose');
const Draft = require('../models/draft');
const mongosecrets = require('../../cubecobrasecrets/mongodb');
var carddb = require('../serverjs/cards.js');

const batch_size = 100;

async function update(deck) {
  

  deck.seats = [];
  deck.unopenedPacks = [];

  //add player
  const playerSeat = {
    bot: null,
    userid: deck.owner,  
    name:deck.username,
    pickorder: deck.pickOrder,
    drafted: deck.picks[0], 
    packbacklog: (deck.packs[0] && deck.packs[0][0]) ? [deck.packs[0][0]] : [],
  };

  deck.seats.push(playerSeat);
  deck.unopenedPacks.push(deck.packs[0] ? deck.packs[0].slice(1) : []);

  //add bots
  for(let i = 1; i < deck.picks.length; i++) {
    const bot = {
      bot: deck.bots[i-1],
      name: 'Bot ' + (i) + ': ' + deck.bots[i-1][0] + ', ' + deck.bots[i-1][1],
      pickorder: deck.picks[i],
      drafted: [],
      packbacklog: (deck.packs[i] && deck.packs[i][0]) ? [deck.packs[i][0]] : [],
    }

    //now we need to build picks from the pickorder ids
    for(let j = 0; j < 16; j++) {
      bot.drafted.push([]);
    }

    bot.pickorder.forEach(function(cardid, index) {
      //insert basic card object into correct cmc column
      const card = {
        cardId: cardid,
        details: carddb.cardFromId(cardid),
      }
      const col = Math.min(7, card.details.cmc) + (card.details.type.toLowerCase().includes('creature') ? 0 : 8);
      bot.drafted[col].push(card);
    });

    deck.seats.push(bot);
  deck.unopenedPacks.push(deck.packs[i] ? deck.packs[i].slice(1) : []);
  }
  return deck.save();
}

(async () => {
  await carddb.initializeCardDb();

  var i = 0;
  mongoose.connect(mongosecrets.connectionString).then(async (db) => {
    const count = await Draft.countDocuments();
    const cursor = Draft.find().cursor();

    //batch them in 100
    for (var i = 0; i < count; i += batch_size) {
      const drafts = [];
      for (var j = 0; j < batch_size; j++) {
        if (i + j < count) {
          let draft = await cursor.next();
          if (draft) {
            drafts.push(draft);
          }
        }
      }
      await Promise.all(drafts.map((draft) => update(draft)));
      console.log('Finished: ' + Math.min(count, (i+batch_size)) + ' of ' + count + ' drafts');
    }
    mongoose.disconnect();
    console.log('done');
  });
})();

/*
const Seat = {
  bot: [], //null bot value means human player
  name: String,
  userid: String,
  drafted: [[]], //organized draft picks
  pickOrder: [],
  packbacklog: [[]],
};

// Cube schema
let draftSchema = mongoose.Schema({
  cube: String,
  ratings: {},
  initial_state: [[[]]],
  
  //new format, will convert to
  seats: [Seat],
  unopenedPacks: [[]],

  //deprecated
  picks: [[]],
  packs: [[[]]],
  bots: [[]],
  pickOrder: [],
  pickNumber: Number,
  packNumber: Number,
});
*/