// Load Environment Variables
require('dotenv').config();

const mongoose = require('mongoose');
const Blog = require('../models/blog');
const Cube = require('../models/cube');
const User = require('../models/user');

const batchSize = 100;

const cubeNameCache = {};
const userNameCache = {};

async function addVars(blog) {
  if (!cubeNameCache[blog.cube]) {
    const cube = await Cube.findById(blog.cube);
    cubeNameCache[blog.cube] = cube ? cube.name : 'Cube';
  }
  blog.cubename = cubeNameCache[blog.cube];

  if (!userNameCache[blog.owner]) {
    const user = await User.findById(blog.owner);
    userNameCache[blog.owner] = user ? user.username : 'User';
  }
  blog.username = userNameCache[blog.owner];

  return blog.save();
}

(async () => {
  mongoose.connect(process.env.MONGODB_URL).then(async (db) => {
    const count = await Blog.countDocuments();
    const cursor = Blog.find().cursor();

    // batch them in 100
    for (let i = 0; i < count; i += batchSize) {
      console.log(`Finished: ${i} of ${count} blogs`);
      const blogs = [];
      for (let j = 0; j < batchSize; j++) {
        if (i + j < count) {
          const blog = await cursor.next();
          if (blog) {
            blogs.push(blog);
          }
        }
      }
      await Promise.all(blogs.map((blog) => addVars(blog)));
    }
    console.log(`Finished: ${count} of ${count} blogs`);
    mongoose.disconnect();
    console.log('done');
  });
})();
