// Load Environment Variables
require('dotenv').config();

const mongoose = require('mongoose');
const User = require('../models/user');
const Cube = require('../models/cube');
const Deck = require('../models/deck');
const BlogPost = require('../models/blog');
const Comment = require('../models/comment');

const userid = '6233d9870aa72f0feddbaa68';

(async () => {
  mongoose.connect(process.env.MONGODB_URL).then(async () => {
    // delete user
    await User.deleteOne({ _id: mongoose.Types.ObjectId(userid) });

    // delete all cubes owned by user
    const cubes = await Cube.find({ owner: userid });
    for (const cube of cubes) {
      await Cube.deleteOne({ _id: cube._id });
    }

    // delete all decks owned by user
    const decks = await Deck.find({ owner: userid });
    for (const deck of decks) {
      await Deck.deleteOne({ _id: deck._id });
    }

    // delete all blog posts owned by user
    const blogPosts = await BlogPost.find({ owner: userid });
    for (const blogPost of blogPosts) {
      await BlogPost.deleteOne({ _id: blogPost._id });
    }

    // delete all comments owned by user
    const comments = await Comment.find({ owner: userid });
    for (const comment of comments) {
      await Comment.deleteOne({ _id: comment._id });
    }

    console.log('done');
    process.exit();
  });
})();
