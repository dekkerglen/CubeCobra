const mongoose = require('mongoose');
const Draft = require('../models/draft');
const mongosecrets = require('../../cubecobrasecrets/mongodb');
var carddb = require('../serverjs/cards.js');

const batch_size = 100;

async function update(draft) {
  try {
    draft.seats = [];
    draft.unopenedPacks = [];

    //add player
    const playerSeat = {
      bot: null,
      userid: draft.owner,
      name: draft.username,
      pickorder: draft.pickOrder,
      drafted: draft.picks[0],
      packbacklog: draft.packs[0] && draft.packs[0][0] ? [draft.packs[0][0]] : [],
    };

    draft.seats.push(playerSeat);
    draft.unopenedPacks.push(draft.packs[0] ? draft.packs[0].slice(1) : []);

    //add bots
    for (let i = 1; i < draft.picks.length; i++) {
      const bot = {
        bot: draft.bots[i - 1],
        name: 'Bot ' + i + ': ' + draft.bots[i - 1][0] + ', ' + draft.bots[i - 1][1],
        pickorder: draft.picks[i],
        drafted: [],
        packbacklog: draft.packs[i] && draft.packs[i][0] ? [draft.packs[i][0]] : [],
      };

      //now we need to build picks from the pickorder ids
      for (let j = 0; j < 16; j++) {
        bot.drafted.push([]);
      }

      bot.pickorder.forEach(function(cardid, index) {
        if (cardid) {
          //inconsistent formats... find the card id
          if (cardid[0] && cardid[0].cardID) {
            cardid = cardid[0].cardID;
          } else if (cardid.cardID) {
            cardid = cardid.cardID;
          }
          //insert basic card object into correct cmc column
          const card = {
            cardId: cardid,
            details: carddb.cardFromId(cardid),
          };
          const col = Math.min(7, card.details.cmc) + (card.details.type.toLowerCase().includes('creature') ? 0 : 8);
          bot.drafted[col].push(card);
        }
      });

      draft.seats.push(bot);
      draft.unopenedPacks.push(draft.packs[i] ? draft.packs[i].slice(1) : []);
    }
    return Draft.updateOne({ _id: draft._id }, draft);
  } catch(err) {
    console.log(`Error updating:${draft.name}`);
  }
}

(async () => {
  await carddb.initializeCardDb();

  var i = 0;
  mongoose.connect(mongosecrets.connectionString).then(async (db) => {
    const count = await Draft.countDocuments();
    const cursor = Draft.find().lean().cursor();

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
      try{
        await Promise.all(drafts.map((draft) => update(draft)));
      } catch (err) {
        console.error(err);
      }
      console.log('Finished: ' + Math.min(count, i + batch_size) + ' of ' + count + ' drafts');
    }
    mongoose.disconnect();
    console.log('done');
    process.exit();
  });
})();
