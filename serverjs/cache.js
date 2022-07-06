const { hmset, hgetall, expire, exists } = require('./redis');

const User = require('../dynamo/models/user');

const flattenObject = (object) => {
  const result = [];
  for (const [key, value] of Object.entries(object)) {
    if (Array.isArray(value)) {
      for (const item of value) {
        result.push(`${key}:${item}`);
        result.push('true');
      }
    } else {
      result.push(key);
      result.push(`${value}`);
    }
  }

  return result;
};

const getUserFromId = async (id) => {
  const entryExixts = await exists(`user:${id}`);
  if (!entryExixts) {
    const user = await User.getById(id);

    delete user.UsersFollowing; // don't leak this info
    delete user.PasswordHash;
    delete user.Email;

    const flattened = flattenObject(user);
    hmset(`user:${id}`, flattened);
    expire(`user:${id}`, 60 * 60 * 24); // 1 day
    return hgetall(`user:${id}`);
  }

  return hgetall(`user:${id}`);
};

module.exports = {
  getUserFromId,
};
