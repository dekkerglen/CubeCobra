import { RetrainMode, RetrainTask, RetrainTaskStatus } from '@utils/datatypes/RetrainTask';

import { toClientRun, versionFolderNames } from '../../src/serverutils/mlRetraining';

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
