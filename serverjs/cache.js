const { hmset, hgetall, expire, exists } = require('./redis');

const User = require('../models/user');

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
  const entryExixts = await exists(id);

  if (!entryExixts) {
    const user = await User.findById(id, User.PUBLIC_FIELDS).lean();

    const flattened = flattenObject(user);
    hmset(id, flattened);
    expire(id, 60 * 60 * 24); // 1 day
    return hgetall(id);
  }

  return hgetall(id);
};

module.exports = {
  getUserFromId,
};
