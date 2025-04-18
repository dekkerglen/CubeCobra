import { cardOracleId } from '../../../src/client/utils/cardutil';
import { cardIsLand } from '../../../src/client/utils/cardutil';
import Card, { CardDetails } from '../../../src/datatypes/Card';
import DraftType from '../../../src/datatypes/Draft';
import User from '../../../src/datatypes/User';
import Draft from '../../../src/dynamo/models/draft';
import { handler as finishDraftHandler, validateBody } from '../../../src/router/routes/draft/finish';
import * as draftbots from '../../../src/util/draftbots';
import * as draftutil from '../../../src/util/draftutil';
import { createCompletedSoloDraft as createDraft, createUser } from '../../test-utils/data';
import { expectRegisteredRoutes } from '../../test-utils/route';
import { call, middleware } from '../../test-utils/transport';

jest.mock('../../../src/dynamo/models/draft', () => ({
  getById: jest.fn(),
  put: jest.fn(),
}));

jest.mock('../../../src/util/draftbots', () => ({
  deckbuild: jest.fn(),
}));

jest.mock('../../../src/client/utils/cardutil', () => ({
  //Because we want to use cardIsLand in the test
  ...jest.requireActual('../../../src/client/utils/cardutil'),
  cardOracleId: jest.fn(),
}));

//Not bothering to mock setupPicks
jest.mock('../../../src/util/draftutil', () => ({
  ...jest.requireActual('../../../src/util/draftutil'),
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
  const draft = createDraft({
    owner,
  });

  const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock getCardDefaultRowColumn to return consistent positions for lands vs non-lands
    (draftutil.getCardDefaultRowColumn as jest.Mock).mockImplementation((card: Card) =>
      cardIsLand(card) ? { row: 1, col: 0 } : { row: 0, col: 1 },
    );
  });

  afterEach(() => {
    consoleErrorSpy.mockClear();
  });

  //Helper function to get card details from an array by a set of indices
  const getCardDetails = (source: Card[], indices: number[]): CardDetails[] => {
    return source
      .filter((_, idx) => {
        return indices.includes(idx);
      })
      .map((c) => c.details!);
  };

  // Helper function to set up common mocks
  const setupSuccessReturns = (draft: DraftType) => {
    (Draft.getById as jest.Mock).mockResolvedValue(draft);
    (Draft.put as jest.Mock).mockResolvedValue(draft.id);
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

    expect(Draft.put).toHaveBeenCalledWith(
      expect.objectContaining({
        complete: true,
        seats: [
          expect.objectContaining({
            pickorder: validBody.state.seats[0].picks,
            trashorder: validBody.state.seats[0].trashed,
            mainboard: validBody.mainboard,
            sideboard: validBody.sideboard,
          }),
          expect.objectContaining({
            pickorder: validBody.state.seats[1].picks,
            trashorder: validBody.state.seats[1].trashed,
            mainboard: expectedMainboard,
            sideboard: expectedSideboard,
          }),
        ],
      }),
    );
  };

  it('should fail if user is not logged in', async () => {
    (Draft.getById as jest.Mock).mockResolvedValue(createDraft());

    const res = await call(finishDraftHandler).withParams({ id: 'draft-id' }).withBody(validBody).send();

    expect(res.status).toBe(401);
    expect(res.body).toEqual({
      success: false,
      message: 'You must be logged in to finish a draft',
    });
  });

  it('should fail if draft does not exist', async () => {
    (Draft.getById as jest.Mock).mockResolvedValue(null);

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

    (Draft.getById as jest.Mock).mockResolvedValue(draft);

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

  it('should successfully finish a draft', async () => {
    (draftbots.deckbuild as jest.Mock).mockReturnValue({
      mainboard: [
        draft.cards[9].details?.oracle_id,
        draft.cards[8].details?.oracle_id,
        draft.cards[10].details?.oracle_id,
      ],
      sideboard: [],
    });

    setupSuccessReturns(draft);

    const expectedMainboard = draftutil.setupPicks(2, 8);
    expectedMainboard[0][1].push(9, 8, 10);

    await verifySuccessfulDraft(owner, draft, expectedMainboard, draftutil.setupPicks(1, 8));

    expect(draftbots.deckbuild).toHaveBeenCalledWith(
      getCardDetails(draft.cards, [8, 9, 10]),
      getCardDetails(draft.cards, [30, 31, 32, 33, 34]),
    );
  });

  it('should successfully finish a draft with bot decks complete with basics', async () => {
    //Only the bots have to be deck built.
    //Aligned with validBody but returning in different order because of ML preferences
    (draftbots.deckbuild as jest.Mock).mockReturnValueOnce({
      mainboard: [
        draft.cards[9].details?.oracle_id,
        draft.cards[draft.basics[3]].details?.oracle_id,
        draft.cards[8].details?.oracle_id,
        draft.cards[10].details?.oracle_id,
        draft.cards[draft.basics[1]].details?.oracle_id,
      ],
      sideboard: [],
    });

    setupSuccessReturns(draft);

    const expectedBotMainboard: number[][][] = draftutil.setupPicks(2, 8);
    expectedBotMainboard[0][1].push(9);
    expectedBotMainboard[0][1].push(8);
    expectedBotMainboard[0][1].push(10);
    //Basics are at the end of the card list and the mock draft is 30 cards plus 5 basics, thus indices.
    //The deckbuilding added the basics in order to cast the 3 cards ;)
    expectedBotMainboard[1][0].push(30 + 3);
    expectedBotMainboard[1][0].push(30 + 1);

    await verifySuccessfulDraft(owner, draft, expectedBotMainboard, draftutil.setupPicks(1, 8));

    expect(draftbots.deckbuild).toHaveBeenCalledWith(
      getCardDetails(draft.cards, [8, 9, 10]),
      getCardDetails(draft.cards, [30, 31, 32, 33, 34]), // basics array
    );
  });

  it('should successfully finish a draft with cards in the sideboard', async () => {
    //Only the bots have to be deck built.
    //Aligned with validBody but returning in different order because of ML preferences
    (draftbots.deckbuild as jest.Mock).mockReturnValueOnce({
      mainboard: [draft.cards[9].details?.oracle_id, draft.cards[10].details?.oracle_id],
      sideboard: [draft.cards[8].details?.oracle_id],
    });

    const expectedBotMainboard: number[][][] = draftutil.setupPicks(2, 8);
    expectedBotMainboard[0][1].push(9);
    expectedBotMainboard[0][1].push(10);

    const expectedSideBoard: number[][][] = draftutil.setupPicks(1, 8);
    expectedSideBoard[0][1].push(8);

    await verifySuccessfulDraft(owner, draft, expectedBotMainboard, expectedSideBoard);

    expect(draftbots.deckbuild).toHaveBeenCalledWith(
      getCardDetails(draft.cards, [8, 9, 10]),
      getCardDetails(draft.cards, [30, 31, 32, 33, 34]), // basics array
    );
  });

  it('should handle server errors gracefully', async () => {
    const error = new Error('Database error');
    (Draft.getById as jest.Mock).mockRejectedValue(error);

    const res = await call(finishDraftHandler)
      .as(createUser())
      .withParams({ id: 'draft-id' })
      .withBody(validBody)
      .send();

    expect(res.status).toBe(500);
    expect(res.body).toEqual({
      error: 'Error finishing draft',
    });
    expect(consoleErrorSpy).toHaveBeenCalledWith('Error finishing draft', error);
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
