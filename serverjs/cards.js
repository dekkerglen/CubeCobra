const fs = require('fs');

//read files
var data = {
  cardtree: {},
  imagedict: {},
  cardimages: {},
  cardnames: [],
  full_names: [],
  carddict: {},
  nameToId: {},
  normalizedName: card => card.name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim(),
  allIds: card => data.nameToId[data.normalizedName(card)]
}
fs.readFile('private/carddict.json', 'utf8', function(err, contents) {
  data.carddict = JSON.parse(contents);
  console.log("carddict loaded");
});
fs.readFile('private/cardtree.json', 'utf8', function(err, contents) {
  data.cardtree = JSON.parse(contents);
  console.log("cardtree loaded");
});
fs.readFile('private/names.json', 'utf8', function(err, contents) {
  data.cardnames = JSON.parse(contents);
  console.log("names loaded");
});
fs.readFile('private/nameToId.json', 'utf8', function(err, contents) {
  data.nameToId = JSON.parse(contents);
  console.log("nameToId loaded");
});
fs.readFile('private/full_names.json', 'utf8', function(err, contents) {
  data.full_names = JSON.parse(contents);
  console.log("full_names loaded");
});
fs.readFile('private/imagedict.json', 'utf8', function(err, contents) {
  data.imagedict = JSON.parse(contents);
  console.log("imagedict loaded");
});
fs.watchFile('private/imagedict.json', (curr, prev) => {
  console.log('File Changed: imagedict');
  fs.readFile('private/imagedict.json', 'utf8', function(err, contents) {
    data.imagedict = JSON.parse(contents);
    console.log("imagedict reloaded");
  });
});
fs.readFile('private/cardimages.json', 'utf8', function(err, contents) {
  data.cardimages = JSON.parse(contents);
  console.log("cardimages loaded");
});
fs.watchFile('private/cardimages.json', (curr, prev) => {
  console.log('File Changed: cardimages');
  fs.readFile('private/cardimages.json', 'utf8', function(err, contents) {
    data.cardimages = JSON.parse(contents);
    console.log("cardimages reloaded");
  });
});
fs.watchFile('private/cardtree.json', (curr, prev) => {
  console.log('File Changed: cardtree');
  fs.readFile('private/cardtree.json', 'utf8', function(err, contents) {
    data.cardtree = JSON.parse(contents);
    console.log("cardtree reloaded");
  });
});
fs.watchFile('private/names.json', (curr, prev) => {
  console.log('File Changed: names');
  fs.readFile('private/names.json', 'utf8', function(err, contents) {
    data.cardnames = JSON.parse(contents);
    console.log("names reloaded");
  });
});
fs.watchFile('private/carddict.json', (curr, prev) => {
  console.log('File Changed: carddict');
  fs.readFile('private/carddict.json', 'utf8', function(err, contents) {
    data.carddict = JSON.parse(contents);
    console.log("carddict reloaded");
  });
});
fs.watchFile('private/nameToId.json', (curr, prev) => {
  console.log('File Changed: nameToId');
  fs.readFile('private/nameToId.json', 'utf8', function(err, contents) {
    data.nameToId = JSON.parse(contents);
    console.log("nameToId reloaded");
  });
});
fs.watchFile('private/full_names.json', (curr, prev) => {
  console.log('File Changed: full_names');
  fs.readFile('private/full_names.json', 'utf8', function(err, contents) {
    data.full_names = JSON.parse(contents);
    console.log("full_names reloaded");
  });
});

module.exports = data;
