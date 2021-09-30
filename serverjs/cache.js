const { hmset, hgetall, expire, exists } = require('./redis');

const User = require('../models/user');

const getUserFromId = async (id) => {
  if (exists(id)) {
    const user = await hgetall(id);
    return user;
  }

  const user = await User.findById(id, User.PUBLIC_FIELDS).lean();

  user.isAdmin = user.roles.includes('Admin');
  user.isPatron = user.roles.includes('Patron');
  delete user.roles;

  if (user) {
    hmset(id, user);
    expire(id, 60 * 60 * 24); // 1 days
    return user;
  }

  return null;
};

module.exports = {
  getUserFromId,
};
