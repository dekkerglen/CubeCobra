const Blog = require('../models/blog');
const carddb = require('./cards');

function fillBlogpostChangelog(blog) {
  if (!blog.changed_cards) return blog;
  for (const change of blog.changed_cards) {
    if (change.addedID) {
      change.added = carddb.cardFromId(change.addedID);
    }
    if (change.removedID) {
      change.removed = carddb.cardFromId(change.removedID);
    }
  }

  return blog;
}

const getBlogFeedItems = (user, skip, limit) =>
  Blog.find({
    $or: [
      {
        cube: {
          $in: user.followed_cubes,
        },
      },
      {
        owner: {
          $in: user.FollowedUsers,
        },
      },
      {
        dev: 'true',
      },
    ],
  })
    .sort({
      date: -1,
    })
    .skip(skip)
    .limit(limit);

module.exports = {
  getBlogFeedItems,
  fillBlogpostChangelog,
};
