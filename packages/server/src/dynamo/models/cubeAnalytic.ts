// migrated to /dao/CubeDynamoDao.ts

import { getObject, putObject } from '../s3client';

interface CubeAnalytics {
  [key: string]: any; // Replace `any` with a more specific type if known
}

const cubeAnalytic = {
  getByCube: async (cubeId: string): Promise<any> => {
    try {
      return await getObject(process.env.DATA_BUCKET as string, `cube_analytic/${cubeId}.json`);
    } catch {
      return {};
    }
  },
  batchPut: async (dict: CubeAnalytics): Promise<void> => {
    await Promise.all(
      Object.keys(dict).map(async (cubeId) => {
        await putObject(process.env.DATA_BUCKET as string, `cube_analytic/${cubeId}.json`, dict[cubeId]);
      }),
    );
  },
};

module.exports = cubeAnalytic;
export default cubeAnalytic;
