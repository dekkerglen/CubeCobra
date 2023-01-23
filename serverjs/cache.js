const { hset, hget, expire, exists } = require('./redis');

const User = require('../dynamo/models/user');

const getUserFromId = async (id) => {
  const entryExixts = await exists(`userscache:${id}`);
  if (!entryExixts) {
    const user = await User.getById(id);

    delete user.passwordHash;
    delete user.email;

    const flattened = JSON.stringify(user);
    await hset(`userscache:${id}`, 'value', flattened);
    await expire(`userscache:${id}`, 60 * 60 * 24); // 1 day
  }

  return JSON.parse(await hget(`userscache:${id}`, 'value'));
};

module.exports = {
  getUserFromId,
};
