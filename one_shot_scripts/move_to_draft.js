// Load Environment Variables
require('dotenv').config();

const mongoose = require('mongoose');

const Article = require('../models/article');

const id = '602abb5969cb75105e271d4e';

(async () => {
  mongoose.connect(process.env.MONGODB_URL).then(async () => {
    const article = await Article.findById(id);
    article.status = 'draft';
    await article.save();

    process.exit();
  });
})();
