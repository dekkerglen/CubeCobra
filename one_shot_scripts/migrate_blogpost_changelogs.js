// Load Environment Variables
require('dotenv').config();

const mongoose = require('mongoose');
const cheerio = require('cheerio');
const Blog = require('../models/blog');
const carddb = require('../serverjs/cards');

const batchSize = 100;

function nextLink(node) {
  let a = node.next;
  while (a && (a.type !== 'tag' || a.name !== 'a')) a = a.next;
  return a;
}

const nameFromLink = (node) => node.children[0].data;
const cardId = (name) => {
  const card = carddb.getMostReasonable(name);
  if (card) return card._id;
  throw new Error(`Couldn't find card named "${name}"`);
};

async function processPost(post, errors) {
  if (!post.changelist) return post;
  console.log(`Post ${post.title}`);
  console.log(post._id);
  const changes = [];

  try {
    // parse HTML
    const $ = cheerio.load(post.changelist);
    // go through all <span> badges
    for (const x of $('.badge').toArray()) {
      const cl = x.attribs.class || '';
      // determine type of change based on badge class and create changelog entry
      if (cl.includes('badge-success')) {
        const n = nameFromLink(nextLink(x));
        console.log(`+ ${n} : ${cardId(n)}`);
        changes.push({ addedID: cardId(n), removedID: null });
      } else if (cl.includes('badge-danger')) {
        const n = nameFromLink(nextLink(x));
        console.log(`- ${n} : ${cardId(n)}`);
        changes.push({ addedID: null, removedID: cardId(n) });
      } else if (cl.includes('badge-primary')) {
        const a = nextLink(x);
        const na = nameFromLink(a);
        const nb = nameFromLink(nextLink(a));
        changes.push({ addedID: cardId(na), removedID: cardId(nb) });
      } else throw new Error('Unknown tag on span');
    }
    // replace property
    post.changed_cards = changes;
    post.changelist = undefined;
    return post.save();
  } catch (e) {
    console.error(`Couldn't convert post ${post._id}: ${e.message}`);
    errors.push(post._id);
    return post;
  }
}

(async () => {
  await carddb.initializeCardDb(undefined, true);
  await mongoose.connect(process.env.MONGODB_URL);
  const count = await Blog.countDocuments();
  const cursor = Blog.find().cursor();

  const failedIDs = [];
  for (let i = 0; i < count; i += batchSize) {
    const posts = [];
    for (let j = 0; j < batchSize; j++) {
      try {
        if (i + j < count) {
          const post = await cursor.next();
          if (post) posts.push(post);
        }
      } catch (err) {
        console.error(err.message);
      }
    }
    await Promise.all(posts.map((post) => processPost(post, failedIDs)));
    console.log(`Finished ${i} of ${count} posts`);
  }

  await mongoose.disconnect();
  console.log('Done');
  console.error('Failed IDs:');
  for (const failedID of failedIDs) {
    console.error(failedID);
  }
  process.exit();
})();
