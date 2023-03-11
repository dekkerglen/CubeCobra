const clone = require('clone');

let peers = [];

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

const updatePeers = async () => {
  try {
    if (process.env.AUTOSCALING_GROUP && process.env.AUTOSCALING_GROUP !== '') {
      // get all ip addresses of all nodes in auto scaling group
      const groups = await autoscaling
        .describeAutoScalingGroups({ AutoScalingGroupNames: [process.env.AUTOSCALING_GROUP] })
        .promise();

      const instances = groups.AutoScalingGroups[0].Instances;

      // get ip from ec2 instance id
      peers = await Promise.all(
        instances.map((instance) =>
          ec2
            .describeInstances({
              InstanceIds: [instance.InstanceId],
            })
            .promise()
            .then((res) => res.Reservations[0].Instances[0].PublicIpAddress),
        ),
      );
    }
  } catch (err) {
    console.log(err);
  }
};

const alertPeers = async () => {
  try {
    if (process.env.AUTOSCALING_GROUP && process.env.AUTOSCALING_GROUP !== '') {
      // send invalidate request to each ip address
      await Promise.all(
        peers.map((ip) =>
          fetch(`http://${ip}:80/cache/newpeer`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              secret: process.env.CACHE_SECRET,
            }),
          }),
        ),
      );
    }
  } catch (err) {
    console.log(err);
  }
};

const fetchWithTimeout = async (url, options, timeout = 5000) => {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  const response = await fetch(url, {
    ...options,
    signal: controller.signal,
  });
  clearTimeout(id);
  return response;
};

const invalidate = async (key) => {
  try {
    if (process.env.AUTOSCALING_GROUP && process.env.AUTOSCALING_GROUP !== '') {
      // send invalidate request to each ip address
      await Promise.all(
        peers.map((ip) =>
          fetchWithTimeout(
            `http://${ip}:80/cache/invalidate`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                secret: process.env.CACHE_SECRET,
                key,
              }),
            },
            1000,
          ),
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
  if (size > MAX_CACHE_SIZE / 10) {
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
    return clone(item.value);
  }

  return null;
};

module.exports = {
  put,
  get,
  evict,
  invalidate,
  updatePeers,
  alertPeers,
};
