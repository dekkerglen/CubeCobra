// dotenv
require('dotenv').config();
const { getObject, putObject } = require('../s3client');

module.exports = {
  getByCube: async (cubeId) => {
    try {
      return await getObject(process.env.DATA_BUCKET, `cube_analytic/${cubeId}.json`);
    } catch {
      return {};
    }
  },
  batchPut: async (dict) => {
    await Promise.all(
      Object.keys(dict).map(async (cubeId) => {
        await putObject(process.env.DATA_BUCKET, `cube_analytic/${cubeId}.json`, dict[cubeId]);
      }),
    );
  },
};
