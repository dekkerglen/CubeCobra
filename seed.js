var seeder = require('mongoose-seed');

const seedsPath = './seeds/'
var blogs = require(seedsPath + 'blogs.json');
var cardratings = require(seedsPath + 'cardratings.json');
var decks = require(seedsPath + 'decks.json');
var drafts = require(seedsPath + 'drafts.json');
var users = require(seedsPath + 'users.json');

seeder.connect('mongodb://localhost/nodecube', function() {
  // Load Mongoose models
  const modelPath = 'models/';
  seeder.loadModels([
    modelPath + 'blog.js',
    modelPath + 'cardrating.js',
    modelPath + 'deck.js',
    modelPath + 'draft.js',
    modelPath + 'user.js'
  ]);

  // Populate databases, then close seeder
  seeder.populateModels(data, function() {
    seeder.disconnect();
  });
});

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
    'model': 'Deck',
    'documents': decks
  },
  {
    'model': 'Draft',
    'documents': drafts
  }
]