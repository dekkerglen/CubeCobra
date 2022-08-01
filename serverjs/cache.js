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

const unpack = (object) => {
  const result = {};
  for (const [key, value] of Object.entries(object)) {
    if (key.includes(':')) {
      const [newKey, newValue] = key.split(':');
      if (!result[newKey]) {
        result[newKey] = [];
      }
      result[newKey].push(newValue);
    } else {
      result[key] = value;
    }
  }

  return result;
};

const getUserFromId = async (id) => {
  const entryExixts = await exists(`usercache:${id}`);
  if (!entryExixts) {
    const user = await User.getById(id);

    delete user.PasswordHash;
    delete user.Email;

    const flattened = flattenObject(user);
    await hmset(`usercache:${id}`, flattened);
    await expire(`usercache:${id}`, 60 * 60 * 24); // 1 day
  }

  return unpack(await hgetall(`usercache:${id}`));
};

module.exports = {
  getUserFromId,
};
