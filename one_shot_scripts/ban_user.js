// Load Environment Variables
require('dotenv').config();

const Cube = require('../dynamo/models/cube');
const User = require('../dynamo/models/user');
const Blog = require('../dynamo/models/blog');
const Draft = require('../dynamo/models/draft');
const Comment = require('../dynamo/models/comment');

const usersToBan = [
"330c637d-12ef-434b-b65f-99b135379c01",
"327e6f57-9115-4c64-b12a-7cdbf6d9a940",
"90c0bd63-d163-432e-b47f-e77799f7d593",
"42485873-c872-4d3a-8fe5-19597b807358",
];

(async () => {
  for (const userToBan of usersToBan) {
    console.log(`Banning user ${userToBan}`);

    // delete all cubes
    const response = await Cube.getByOwner(userToBan);

    console.log(`Deleting ${response.items.length} cubes`);
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

    console.log(`Deleting ${blogIds.length} blog posts`);
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

    console.log(`Deleting ${draftIds.length} drafts`);
    for (const draftId of draftIds) {
      await Draft.deleteById(draftId);
    }


    // delete user
    await User.deleteById(userToBan);
  }

  process.exit();
})();
