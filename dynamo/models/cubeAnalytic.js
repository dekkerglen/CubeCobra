// dotenv
require('dotenv').config();
const s3 = require('../s3client');

module.exports = {
  getByCube: async (cubeId) => {
    return s3
      .getObject({
        Bucket: process.env.DATA_BUCKET,
        Key: `cube_analytic/${cubeId}.json`,
      })
      .promise();
  },
  batchPut: async (dict) => {
    await Promise.all(
      Object.keys(dict).map(async (cubeId) => {
        await s3
          .putObject({
            Bucket: process.env.DATA_BUCKET,
            Key: `cube_analytic/${cubeId}.json`,
            Body: JSON.stringify(dict[cubeId]),
          })
          .promise();
      }),
    );
  },
};
