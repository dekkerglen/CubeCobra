/*
cache: {
  'key': {
    'value': 'value',
    'date': 'date',
    'size': 'size',
  },
}
*/
const cache = {};
let cacheSize = 0;
const MAX_CACHE_SIZE = 1000000;

const evict = (key) => {
  if (cache[key]) {
    cacheSize -= cache[key].size;
    delete cache[key];
  }
};

const evictOldest = () => {
  let oldestKey = null;
  let oldestDate = null;
  for (const key in cache) {
    if (cache[key].date < oldestDate) {
      oldestKey = key;
      oldestDate = cache[key].date;
    }
  }
  evict(oldestKey);
};

// Load the AWS SDK for Node.js
const AWS = require('aws-sdk');

// Set the region
AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: 'us-east-2',
});

const autoscaling = new AWS.AutoScaling();
const ec2 = new AWS.EC2();

const invalidate = async (key) => {
  try {
    if (process.env.AUTOSCALING_GROUP && process.env.AUTOSCALING_GROUP !== '') {
      // get all ip addresses of all nodes in auto scaling group
      const groups = await autoscaling
        .describeAutoScalingGroups({ AutoScalingGroupNames: [process.env.AUTOSCALING_GROUP] })
        .promise();

      const instances = groups.AutoScalingGroups[0].Instances;

      // get ip from ec2 instance id
      const ips = await Promise.all(
        instances.map((instance) =>
          ec2
            .describeInstances({
              InstanceIds: [instance.InstanceId],
            })
            .promise()
            .then((res) => res.Reservations[0].Instances[0].PublicIpAddress),
        ),
      );

      // send invalidate request to each ip address
      await Promise.all(
        ips.map((ip) =>
          fetch(`http://${ip}:80/cache/invalidate`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              secret: process.env.CACHE_SECRET,
              key,
            }),
          }),
        ),
      );
    } else {
      evict(key);
    }
  } catch (err) {
    console.log(err);
  }
};

const put = (key, value) => {
  if (process.env.CACHE_ENABLED !== 'true') {
    return;
  }

  const size = JSON.stringify(value).length;
  if (size > MAX_CACHE_SIZE) {
    return;
  }

  while (size + cacheSize > MAX_CACHE_SIZE) {
    evictOldest();
  }

  cache[key] = {
    value,
    date: new Date().valueOf(),
    size,
  };
  cacheSize += size;
};

const get = (key) => {
  if (process.env.CACHE_ENABLED !== 'true') {
    return null;
  }

  const item = cache[key];
  if (item) {
    return {
      fromCache: [],
      ...item.value,
    };
  }

  return null;
};

module.exports = {
  put,
  get,
  evict,
  invalidate,
};
