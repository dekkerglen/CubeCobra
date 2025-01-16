// Load Environment Variables
require('dotenv').config();

const Cube = require('../src/dynamo/models/cube');
const User = require('../src/dynamo/models/user');
const Blog = require('../src/dynamo/models/blog');
const Draft = require('../src/dynamo/models/draft');
const Comment = require('../src/dynamo/models/comment');

const usersToBan = [];

let aggregates = {
  commentsWiped: 0,
  cubesDeleted: 0,
  blogPostsDeleted: 0,
  draftsDeleted: 0,
  failed: [],
};

const wipeComment = async (comment) => {
  delete comment.owner;
  comment.body = '[deleted]';

  await Comment.put(comment);
};

const scanAllComments = async () => {
  let items = [];
  let lastKey = null;

  do {
    const response = await Comment.scan(lastKey);
    items = items.concat(response.items);
    lastKey = response.lastKey;

    console.log(`Scanned ${items.length} comments`);
  } while (lastKey);

  // aggregate by owner
  const ownerToComments = {};

  for (const comment of items) {
    if (!ownerToComments[comment.owner]) {
      ownerToComments[comment.owner] = [];
    }

    ownerToComments[comment.owner].push(comment);
  }

  return ownerToComments;
};

const banUser = async (userToBan, comments) => {
  try {
    console.log(`Banning user ${userToBan}`);

    // delete all cubes
    const response = await Cube.getByOwner(userToBan);

    aggregates.cubesDeleted += response.items.length;
    console.log(`${userToBan}: Deleting ${response.items.length} cubes`);
    for (const cube of response.items) {
      await Cube.deleteById(cube.id);
    }

    // delete all blog posts
    const blogResponse = await Blog.getByOwner(userToBan);

    let lastKey = blogResponse.LastEvaluatedKey;
    let blogIds = blogResponse.items.map((blog) => blog.id);

    while (lastKey) {
      const nextResponse = await Blog.getByOwner(userToBan, 100, lastKey);
      lastKey = nextResponse.LastEvaluatedKey;
      blogIds = blogIds.concat(nextResponse.items.map((blog) => blog.id));
    }

    aggregates.blogPostsDeleted += blogIds.length;
    console.log(`${userToBan}: Deleting ${blogIds.length} blog posts`);
    for (const blogId of blogIds) {
      await Blog.delete(blogId);
    }

    // delete all drafts
    const draftResponse = await Draft.getByOwner(userToBan);

    lastKey = draftResponse.LastEvaluatedKey;
    let draftIds = draftResponse.items.map((draft) => draft.id);

    while (lastKey) {
      const nextResponse = await Draft.getByOwner(userToBan, 100, lastKey);
      lastKey = nextResponse.LastEvaluatedKey;
      draftIds = draftIds.concat(nextResponse.items.map((draft) => draft.id));
    }

    aggregates.draftsDeleted += draftIds.length;
    console.log(`${userToBan}: Deleting ${draftIds.length} drafts`);
    for (const draftId of draftIds) {
      await Draft.delete(draftId);
    }

    // delete all comments
    aggregates.commentsWiped += comments.length;
    console.log(`${userToBan}: Deleting ${comments.length} comments`);

    for (const comment of comments) {
      await wipeComment(comment);
    }

    // ban user
    const user = await User.getById(userToBan);

    user.roles = ['Banned'];

    await User.put(user);
  } catch (err) {
    aggregates.failed.push(userToBan);
    console.error(`Failed to ban user ${userToBan}`, err);
  }
};

(async () => {
  const commentsByOwner = await scanAllComments();

  await Promise.all(
    usersToBan.map(async (userToBan) => {
      await banUser(userToBan, commentsByOwner[userToBan] || []);
    }),
  );

  console.log('Aggregates:', aggregates);

  process.exit();
})();
