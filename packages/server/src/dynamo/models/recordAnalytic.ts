import { RecordAnalytic } from '@utils/datatypes/RecordAnalytic';

import { getObject, putObject } from '../s3client';

const recordAnalytic = {
  getByCube: async (cubeId: string): Promise<RecordAnalytic> => {
    try {
      return await getObject(process.env.DATA_BUCKET as string, `record_analytic/${cubeId}.json`);
    } catch {
      return {};
    }
  },
  put: async (cubeId: string, analytic: RecordAnalytic): Promise<void> => {
    await putObject(process.env.DATA_BUCKET as string, `record_analytic/${cubeId}.json`, analytic);
  },
};

export default recordAnalytic;
