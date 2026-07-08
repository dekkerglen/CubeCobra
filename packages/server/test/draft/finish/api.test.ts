import { cardOracleId } from '@utils/cardutil';
import { cardIsLand } from '@utils/cardutil';
import Card from '@utils/datatypes/Card';
import DraftType from '@utils/datatypes/Draft';
import User from '@utils/datatypes/User';
import * as draftutil from '@utils/draftutil';
import * as draftbots from 'serverutils/draftbots';
import * as util from 'serverutils/util';

import { handler as finishDraftHandler, validateBody } from '../../../src/router/routes/draft/finish';
import { createCompletedSoloDraft as createDraft, createCube, createUser } from '../../test-utils/data';
import { expectRegisteredRoutes } from '../../test-utils/route';
import { call, middleware } from '../../test-utils/transport';

jest.mock('serverutils/util', () => ({
  addNotification: jest.fn(),
}));

jest.mock('../../../src/dynamo/daos', () => ({
  cubeDao: {
    getById: jest.fn(),
  },
  draftDao: {
    getById: jest.fn(),
    update: jest.fn(),
  },
}));

// Import the mocked daos
import { cubeDao, draftDao } from '../../../src/dynamo/daos';

jest.mock('serverutils/draftbots', () => ({
  batchDeckbuild: jest.fn(),
}));

// Bot decks are built asynchronously now. finish.ts lays out a naive placeholder (the real
// applyNaiveBotLayout runs, using the mocked getCardDefaultRowColumn below) and enqueues the
// ML build via publishBotDeckBuild, which we mock.
jest.mock('serverutils/deckbuildQueue', () => ({
  publishBotDeckBuild: jest.fn(),
}));

jest.mock('serverutils/deckbuildJob', () => ({
  buildDeckbuildJob: jest.fn(() => ({ draftId: 'draft', seats: [], basics: [], facts: {} })),
  writeDeckbuildJob: jest.fn(),
}));

import { writeDeckbuildJob } from 'serverutils/deckbuildJob';
import { publishBotDeckBuild } from 'serverutils/deckbuildQueue';

jest.mock('@utils/cardutil', () => ({
  //Because we want to use cardIsLand in the test
  ...jest.requireActual('@utils/cardutil'),
  cardOracleId: jest.fn(),
}));

//Not bothering to mock setupPicks
jest.mock('@utils/draftutil', () => ({
  ...jest.requireActual('@utils/draftutil'),
  getCardDefaultRowColumn: jest.fn(),
}));

describe('Finish Draft validation', () => {
  const assertPassingValidation = async (body: any) => {
    const res = await middleware(validateBody).withBody(body).send();
    expect(res.nextCalled).toBeTruthy();
  };

  const assertFailingValidation = async (body: any) => {
    const res = await middleware(validateBody).withBody(body).send();
    expect(res.status).toEqual(400);
    expect(res.nextCalled).toBeFalsy();
  };

  const validBody = {
    state: {
      seats: [
        {
          picks: [1, 2, 3],
          trashed: [4, 5],
          pack: [6, 7],
        },
      ],
      pack: 1,
      pick: 2,
    },
    mainboard: [
      [[1], [2]],
      [[3], []],
    ],
    sideboard: [[[4], [5]]],
  };

  it('should pass with valid body data', async () => {
    await assertPassingValidation(validBody);
  });

  it('should fail without state', async () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { state, ...bodyWithoutState } = validBody;
    await assertFailingValidation(bodyWithoutState);
  });

  it('should fail without seats in state', async () => {
    const invalidBody = {
      ...validBody,
      state: {
        pack: 1,
        pick: 2,
      },
    };
    await assertFailingValidation(invalidBody);
  });

  it('should fail with invalid seat data', async () => {
    const invalidBody = {
      ...validBody,
      state: {
        ...validBody.state,
        seats: [
          {
            picks: 'not an array',
            trashed: [4, 5],
            pack: [6, 7],
          },
        ],
      },
    };
    await assertFailingValidation(invalidBody);
  });

  it('should fail without required seat properties', async () => {
    const invalidBody = {
      ...validBody,
      state: {
        ...validBody.state,
        seats: [
          {
            picks: [1, 2, 3],
            // missing trashed and pack
          },
        ],
      },
    };
    await assertFailingValidation(invalidBody);
  });

  it('should fail without pack number', async () => {
    const invalidBody = {
      ...validBody,
      state: {
        seats: validBody.state.seats,
        pick: 2,
        // pack is missing
      },
    };
    await assertFailingValidation(invalidBody);
  });

  it('should fail without pick number', async () => {
    const invalidBody = {
      ...validBody,
      state: {
        seats: validBody.state.seats,
        pack: 2,
        // pick is missing
      },
    };
    await assertFailingValidation(invalidBody);
  });

  it('should fail without mainboard', async () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { mainboard, ...bodyWithoutMainboard } = validBody;
    await assertFailingValidation(bodyWithoutMainboard);
  });

  it('should fail with invalid mainboard structure', async () => {
    const invalidBody = {
      ...validBody,
      mainboard: [1, 2, 3], // should be array of arrays of arrays
    };
    await assertFailingValidation(invalidBody);
  });

  it('should fail without sideboard', async () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { sideboard, ...bodyWithoutSideboard } = validBody;
    await assertFailingValidation(bodyWithoutSideboard);
  });

  it('should fail with invalid sideboard structure', async () => {
    const invalidBody = {
      ...validBody,
      sideboard: [[1, 2]], // should be array of arrays of arrays
    };
    await assertFailingValidation(invalidBody);
  });

  it('should allow additional unknown fields', async () => {
    const bodyWithExtra = {
      ...validBody,
      extraField: 'some value',
      state: {
        ...validBody.state,
        extraStateField: 'some other value',
      },
    };
    await assertPassingValidation(bodyWithExtra);
  });
});

describe('Finish Draft', () => {
  const validBody = {
    state: {
      seats: [
        {
          picks: [1, 2, 3],
          trashed: [4, 5],
          pack: [6, 7],
        },
        {
          picks: [8, 9, 10],
          trashed: [11, 12],
          pack: [13, 14],
        },
      ],
      pack: 1,
      pick: 2,
    },
    mainboard: [
      [[1], [2]],
      [[3], []],
    ],
    sideboard: [[[4], [5]]],
  };

  const owner = createUser();
  //Mock is the cube owner drafting themselves
  const draft = createDraft();

  const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

  beforeEach(() => {
    jest.clearAllMocks();

    // With the topic configured, finishing takes the async pipeline path (naive layout +
    // mark pending + enqueue) instead of building bot decks inline. The inline path has its
    // own test below.
    process.env.BOT_DECKBUILD_TOPIC_ARN = 'arn:aws:sns:us-east-2:000000000000:bot-deckbuild-test';

    // Mock getCardDefaultRowColumn to return consistent positions for lands vs non-lands
    (draftutil.getCardDefaultRowColumn as jest.Mock).mockImplementation((card: Card) =>
      cardIsLand(card) ? { row: 1, col: 0 } : { row: 0, col: 1 },
    );

    draft.owner = owner;
    draft.cubeOwner = owner;
  });

  afterEach(() => {
    consoleErrorSpy.mockClear();
    delete process.env.BOT_DECKBUILD_TOPIC_ARN;
  });

  // Helper function to set up common mocks
  const setupSuccessReturns = (draft: DraftType) => {
    (draftDao.getById as jest.Mock).mockResolvedValue(draft);
    (draftDao.update as jest.Mock).mockResolvedValue(draft.id);
    (cardOracleId as jest.Mock).mockImplementation((card) => card.details.oracle_id);
  };

  // Helper function to verify common assertions
  const verifySuccessfulDraft = async (
    owner: User,
    draft: DraftType,
    expectedMainboard: number[][][],
    expectedSideboard: number[][][],
  ) => {
    const res = await call(finishDraftHandler).as(owner).withParams({ id: draft.id }).withBody(validBody).send();

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      success: true,
    });

    expect(draftDao.update).toHaveBeenCalledWith(
      expect.objectContaining({
        complete: true,
        // Bot decks are handed off to the async pipeline, so the persisted draft is pending.
        botDecksPending: true,
        seats: [
          expect.objectContaining({
            pickorder: validBody.state.seats[0]!.picks,
            trashorder: validBody.state.seats[0]!.trashed,
            mainboard: validBody.mainboard,
            sideboard: validBody.sideboard,
          }),
          expect.objectContaining({
            pickorder: validBody.state.seats[1]!.picks,
            trashorder: validBody.state.seats[1]!.trashed,
            mainboard: expectedMainboard,
            sideboard: expectedSideboard,
          }),
        ],
      }),
    );

    // The deckbuild job is written to S3 and the build is enqueued off the request path; no
    // synchronous deckbuild happens.
    expect(writeDeckbuildJob).toHaveBeenCalled();
    expect(publishBotDeckBuild).toHaveBeenCalledWith(draft.id);
    expect(draftbots.batchDeckbuild).not.toHaveBeenCalled();
  };

  it('should fail if user is not logged in', async () => {
    (draftDao.getById as jest.Mock).mockResolvedValue(createDraft());

    const res = await call(finishDraftHandler).withParams({ id: 'draft-id' }).withBody(validBody).send();

    expect(res.status).toBe(401);
    expect(res.body).toEqual({
      success: false,
      message: 'You must be logged in to finish a draft',
    });
  });

  it('should fail if draft does not exist', async () => {
    (draftDao.getById as jest.Mock).mockResolvedValue(null);

    const res = await call(finishDraftHandler)
      .as(createUser())
      .withParams({ id: 'draft-id' })
      .withBody(validBody)
      .send();

    expect(res.status).toBe(404);
    expect(res.body).toEqual({
      success: false,
      message: 'Draft not found',
    });
  });

  it('should fail if user does not own the draft', async () => {
    const owner = createUser({ id: 'owner-id' });
    const draft = createDraft({ owner });

    (draftDao.getById as jest.Mock).mockResolvedValue(draft);

    const res = await call(finishDraftHandler)
      .as(createUser({ id: 'other-user' }))
      .withParams({ id: draft.id })
      .withBody(validBody)
      .send();

    expect(res.status).toBe(401);
    expect(res.body).toEqual({
      success: false,
      message: 'You do not own this draft',
    });
  });

  it('should successfully finish a draft, by someone that isnt the cube owner', async () => {
    const cubeOwner = createUser({ id: 'cube-owner-id' });
    const draftOwner = createUser({ id: 'draft-owner-id' });
    draft.cubeOwner = cubeOwner;
    draft.owner = draftOwner;
    const cube = createCube({
      owner: cubeOwner,
      disableAlerts: false,
    });

    setupSuccessReturns(draft);
    (cubeDao.getById as jest.Mock).mockResolvedValue(cube);

    // Naive placeholder layout: bot picks land in their default cell in pick order.
    const expectedMainboard = draftutil.setupPicks(2, 8);
    expectedMainboard[0]![1]!.push(8, 9, 10);

    await verifySuccessfulDraft(draftOwner, draft, expectedMainboard, draftutil.setupPicks(1, 8));

    // Verify notification was sent
    expect(util.addNotification).toHaveBeenCalledWith(
      cubeOwner,
      draftOwner,
      `/cube/deck/${draft.id}`,
      `${draftOwner.username} drafted your cube: ${cube.name}`,
    );
  });

  it('no notifications if the cube has them disabled', async () => {
    const cubeOwner = createUser({ id: 'cube-owner-id' });
    const draftOwner = createUser({ id: 'draft-owner-id' });
    draft.cubeOwner = cubeOwner;
    draft.owner = draftOwner;
    const cube = createCube({
      owner: cubeOwner,
      disableAlerts: true,
    });

    setupSuccessReturns(draft);
    (cubeDao.getById as jest.Mock).mockResolvedValue(cube);

    const expectedMainboard = draftutil.setupPicks(2, 8);
    expectedMainboard[0]![1]!.push(8, 9, 10);

    await verifySuccessfulDraft(draftOwner, draft, expectedMainboard, draftutil.setupPicks(1, 8));

    // Verify notification was sent
    expect(util.addNotification).not.toHaveBeenCalled();
  });

  it('should successfully finish a draft, by the owner of the cube', async () => {
    const cubeOwner = createUser({ id: 'cube-owner-id' });
    draft.cubeOwner = cubeOwner;
    draft.owner = cubeOwner;

    setupSuccessReturns(draft);

    const expectedMainboard = draftutil.setupPicks(2, 8);
    expectedMainboard[0]![1]!.push(8, 9, 10);

    await verifySuccessfulDraft(draft.owner, draft, expectedMainboard, draftutil.setupPicks(1, 8));

    expect(util.addNotification).not.toHaveBeenCalled();
  });

  it('builds bot decks inline when the async pipeline is not configured (local dev)', async () => {
    delete process.env.BOT_DECKBUILD_TOPIC_ARN;

    setupSuccessReturns(draft);
    (cubeDao.getById as jest.Mock).mockResolvedValue(createCube({ owner, disableAlerts: true }));
    (draftbots.batchDeckbuild as jest.Mock).mockResolvedValue([{ mainboard: [], sideboard: [] }]);

    const res = await call(finishDraftHandler).as(owner).withParams({ id: draft.id }).withBody(validBody).send();

    expect(res.status).toBe(200);

    // Built inline: ML was invoked, the draft is not left pending, and nothing was enqueued
    // (no job written, no event published).
    expect(draftbots.batchDeckbuild).toHaveBeenCalled();
    expect(writeDeckbuildJob).not.toHaveBeenCalled();
    expect(publishBotDeckBuild).not.toHaveBeenCalled();
    const updated = (draftDao.update as jest.Mock).mock.calls[0]![0];
    expect(updated.botDecksPending).toBe(false);
  });

  it('should handle server errors gracefully', async () => {
    const error = new Error('Database error');
    (draftDao.getById as jest.Mock).mockRejectedValue(error);

    const res = await call(finishDraftHandler)
      .as(createUser())
      .withParams({ id: 'draft-id' })
      .withBody(validBody)
      .send();

    expect(res.status).toBe(500);
    expect(res.body).toEqual({
      error: 'Error finishing draft',
    });
    expect(res.rawRequest.logger.error).toHaveBeenCalledWith('Error finishing draft', error);
  });
});

describe('Draft Finish Routes', () => {
  it('should register its own routes', async () => {
    expectRegisteredRoutes([
      {
        method: 'post',
        path: '/draft/finish/:id',
      },
    ]);
  });
});
