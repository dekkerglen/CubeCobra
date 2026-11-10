jest.mock('../../src/dynamo/daos', () => ({
  retrainTaskDao: {
    listNeedingAttention: jest.fn(),
  },
}));

import { RetrainMode, RetrainTask, RetrainTaskStatus } from '@utils/datatypes/RetrainTask';

import { retrainTaskDao } from '../../src/dynamo/daos';
import {
  clearAdminAlertsCache,
  getAdminAlerts,
  toClientRun,
  versionFolderNames,
} from '../../src/serverutils/mlRetraining';

const createRun = (overrides: Partial<RetrainTask> = {}): RetrainTask => ({
  id: '20270206-153000',
  mode: RetrainMode.TRAIN,
  status: RetrainTaskStatus.AWAITING_APPROVAL,
  timestamp: 1,
  step: 'Awaiting approval',
  completedSteps: [],
  stepTimestamps: {},
  version: '20270206-153000',
  promotedTo: [],
  taskToken: 'secret-token',
  dateCreated: 1,
  dateLastUpdated: 1,
  ...overrides,
});

describe('toClientRun', () => {
  it('drops the Step Functions task token', () => {
    const run = toClientRun(createRun());
    expect(run).not.toHaveProperty('taskToken');
    expect(run.status).toBe(RetrainTaskStatus.AWAITING_APPROVAL);
  });
});

describe('versionFolderNames', () => {
  it('keeps version folders and skips the legacy layout folders', () => {
    const prefixes = ['model/20270206-153000/', 'model/v3/', 'model/encoder/', 'model/draft_decoder/', 'model/a b/'];
    expect(versionFolderNames(prefixes)).toEqual(['20270206-153000', 'v3']);
  });
});

describe('getAdminAlerts', () => {
  const listNeedingAttention = retrainTaskDao.listNeedingAttention as jest.Mock;

  beforeEach(() => {
    clearAdminAlertsCache();
    listNeedingAttention.mockReset();
    process.env.ML_PIPELINE_STATE_MACHINE_ARN = 'arn:aws:states:us-east-2:123456789012:stateMachine:ml';
  });

  afterAll(() => {
    delete process.env.ML_PIPELINE_STATE_MACHINE_ARN;
  });

  it('is null where there is no pipeline', async () => {
    delete process.env.ML_PIPELINE_STATE_MACHINE_ARN;
    await expect(getAdminAlerts()).resolves.toBeNull();
    expect(listNeedingAttention).not.toHaveBeenCalled();
  });

  it('counts the runs needing attention and reuses the result', async () => {
    listNeedingAttention.mockResolvedValue([createRun(), createRun({ id: 'b', status: RetrainTaskStatus.FAILED })]);
    await expect(getAdminAlerts()).resolves.toEqual({ count: 2, ids: ['20270206-153000', 'b'] });
    await getAdminAlerts();
    expect(listNeedingAttention).toHaveBeenCalledTimes(1);
  });

  it('reports nothing rather than failing when the query fails', async () => {
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    listNeedingAttention.mockRejectedValue(new Error('DynamoDB unavailable'));
    await expect(getAdminAlerts()).resolves.toEqual({ count: 0, ids: [] });
  });
});
