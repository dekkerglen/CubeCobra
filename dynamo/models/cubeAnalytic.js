// dotenv
require('dotenv').config();
const s3 = require('../s3client');

module.exports = {
  getByCube: async (cubeId) => {
    try {
      const res = await s3
        .getObject({
          Bucket: process.env.DATA_BUCKET,
          Key: `cube_analytic/${cubeId}.json`,
        })
        .promise();
      return JSON.parse(res.Body.toString());
    } catch (e) {
      return {};
    }
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
