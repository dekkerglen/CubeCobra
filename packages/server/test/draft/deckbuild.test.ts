import { startHandler, stepHandler } from '../../src/router/routes/draft/deckbuild';
import { createUser } from '../test-utils/data';
import { call } from '../test-utils/transport';

jest.mock('serverutils/carddb', () => ({
  __esModule: true,
  default: {},
  cardFromId: jest.fn(),
  getOracleForMl: jest.fn((oracle: string) => oracle),
  getReasonableCardByOracle: jest.fn(),
}));

jest.mock('serverutils/ml', () => ({
  batchBuild: jest.fn().mockResolvedValue([[]]),
  batchDraft: jest.fn().mockResolvedValue([[]]),
}));

jest.mock('serverutils/draftbots', () => ({ calculateBasics: jest.fn().mockReturnValue([]) }));
jest.mock('serverutils/buildLandMetaLookup', () => ({ buildLandMetaLookup: jest.fn() }));

jest.mock('../../src/dynamo/daos', () => ({
  cubeDao: { getById: jest.fn().mockResolvedValue(undefined) },
  draftDao: { getById: jest.fn() },
}));

import { draftDao } from '../../src/dynamo/daos';

describe('POST /draft/deckbuild/start/:id', () => {
  const owner = createUser();

  beforeEach(() => {
    (draftDao.getById as jest.Mock).mockResolvedValue({
      id: 'draft-1',
      owner: owner.id,
      basics: [],
      cards: [{ details: { oracle_id: 'oracle-a' } }, { details: { oracle_id: 'oracle-b' } }],
      seats: [{}, {}],
    });
  });

  const start = (user: ReturnType<typeof createUser>) =>
    call(startHandler)
      .as(user)
      .withParams({ id: 'draft-1' })
      .withBody({ state: { seats: [{ picks: [] }, { picks: [0, 1] }] } })
      .send();

  it("doesn't let another user cancel the owner's in-progress build", async () => {
    const started = await start(owner);
    expect(started.body).toMatchObject({ success: true, complete: false });

    const intruder = await start(createUser());
    expect(intruder.status).toBe(401);

    const step = await call(stepHandler).as(owner).withParams({ id: 'draft-1' }).send();
    expect(step.status).not.toBe(404);
  });
});
