require('dotenv').config();
const redis = require('redis');

const client = redis.createClient(process.env.REDIS_HOST);

client.on('ready', () => {
  // we wrap this in try/catch because you cannot edit this value if using elasticache, but in development it's fine
  try {
    client.config('set', 'notify-keyspace-events', 'Elh');
  } catch (err) {
    console.log(err);
  }
  // Elh => see https://redis.io/topics/notifications to understand the configuration
  // l means we are interested in list events
  // h means we are interested in hash events
});
