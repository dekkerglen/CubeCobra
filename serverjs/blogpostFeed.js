const Blog = require('../models/blog');

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
          $in: user.followed_users,
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

/* {
  // aggregation returns POJO results, so no .lean() needed
  return Blog.aggregate([
    {
      // filter for cubes that the user follows (and dev blog)
      $match: {
        $or: [{ cube: { $in: user.followed_cubes } }, { owner: { $in: user.followed_users } }, { dev: 'true' }],
      },
    },
    {
      // join parent cube
      $lookup: {
        from: 'cubes',
        localField: 'cube',
        foreignField: '_id',
        as: 'cubes',
      },
    },
    {
      // filter out posts from private cubes
      $match: { 'cubes.0.isPrivate': { $ne: true } },
    },
    {
      // _id included in sort to guarantee it's stable
      $sort: { date: -1, _id: 1 },
    },
    {
      $skip: skip,
    },
    {
      $limit: limit,
    },
    {
      // we don't want to include the joined cube in output
      $project: { cubes: 0 },
    },
  ]).allowDiskUse(true);
} */

module.exports = {
  getBlogFeedItems,
};
