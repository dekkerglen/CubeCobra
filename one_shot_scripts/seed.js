// Load Environment Variables
require('dotenv').config();

const seeder = require('mongoose-seed');

const blogs = require(`../seeds/blogs.json`);
const cardratings = require(`../seeds/cardratings.json`);
const cubes = require(`../seeds/cubes.json`);
const decks = require(`../seeds/decks.json`);
const drafts = require(`../seeds/drafts.json`);
const users = require(`../seeds/users.json`);

// Data array containing seed data - documents organized by Model
const data = [
  {
    model: 'User',
    documents: users,
  },
  {
    model: 'Blog',
    documents: blogs,
  },
  {
    model: 'CardRating',
    documents: cardratings,
  },
  {
    model: 'Cube',
    documents: cubes,
  },
  {
    model: 'Deck',
    documents: decks,
  },
  {
    model: 'Draft',
    documents: drafts,
  },
];

seeder.connect(process.env.MONGODB_URL, () => {
  // Load Mongoose models
  const modelPath = 'models/';
  seeder.loadModels([
    `${modelPath}blog.js`,
    `${modelPath}cardrating.js`,
    `${modelPath}cube.js`,
    `${modelPath}deck.js`,
    `${modelPath}draft.js`,
    `${modelPath}user.js`,
  ]);

  // Populate databases, then close seeder
  seeder.populateModels(data, () => {
    seeder.disconnect();
  });
});
