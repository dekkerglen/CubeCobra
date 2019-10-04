var seeder = require('mongoose-seed');
const mongosecrets = require('../cubecobrasecrets/mongodb');

const seedsPath = './seeds/'
var blogs = require(seedsPath + 'blogs.json');
var cardratings = require(seedsPath + 'cardratings.json');
var cubes = require(seedsPath + 'cubes.json');
var decks = require(seedsPath + 'decks.json');
var drafts = require(seedsPath + 'drafts.json');
var users = require(seedsPath + 'users.json');

// Data array containing seed data - documents organized by Model
var data = [{
    'model': 'User',
    'documents': users
  },
  {
    'model': 'Blog',
    'documents': blogs
  },
  {
    'model': 'CardRating',
    'documents': cardratings
  },
  {
    'model': 'Cube',
    'documents': cubes
  },
  {
    'model': 'Deck',
    'documents': decks
  },
  {
    'model': 'Draft',
    'documents': drafts
  }
];

seeder.connect(mongosecrets.connectionString, function() {
  // Load Mongoose models
  const modelPath = 'models/';
  seeder.loadModels([
    modelPath + 'blog.js',
    modelPath + 'cardrating.js',
    modelPath + 'cube.js',
    modelPath + 'deck.js',
    modelPath + 'draft.js',
    modelPath + 'user.js'
  ]);

  // Populate databases, then close seeder
  seeder.populateModels(data, function() {
    seeder.disconnect();
  });
});