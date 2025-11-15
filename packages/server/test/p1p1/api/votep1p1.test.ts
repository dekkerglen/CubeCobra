import p1p1PackModel from '../../../src/dynamo/models/p1p1Pack';
import { voteP1P1Handler } from '../../../src/router/routes/tool/api/votep1p1';
import { createUser } from '../../test-utils/data';
import { call } from '../../test-utils/transport';
import { P1P1Pack } from '@utils/datatypes/P1P1Pack';

const uuid = jest.requireActual('uuid');

jest.mock('../../../src/dynamo/models/p1p1Pack', () => ({
  ...jest.requireActual('../../../src/dynamo/models/p1p1Pack'),
  getById: jest.fn(),
  addVote: jest.fn(),
  getVoteSummary: jest.fn(),
}));

const createP1P1Pack = (overrides?: Partial<P1P1Pack>): P1P1Pack => ({
  id: uuid.v4(),
  cubeId: uuid.v4(),
  cards: [
    { oracle_id: 'oracle-1', name: 'Test Card 1' } as any,
    { oracle_id: 'oracle-2', name: 'Test Card 2' } as any,
    { oracle_id: 'oracle-3', name: 'Test Card 3' } as any,
  ],
  seed: 'test-seed',
  date: Date.now(),
  createdBy: 'test-user',
  createdByUsername: 'testuser',
  votesByUser: {},
  botPick: 0,
  botWeights: [0.8, 0.6, 0.4],
  ...overrides,
});

describe('Vote P1P1 API', () => {
  const mockFlash = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return 401 if user is not authenticated', async () => {
    const res = await call(voteP1P1Handler).withFlash(mockFlash).withBody({ packId: uuid.v4(), cardIndex: 0 }).send();

    expect(res.status).toEqual(401);
    expect(res.body).toEqual({
      error: 'Authentication required',
    });
  });

  it('should return 404 if pack is not found', async () => {
    const user = createUser();
    const packId = uuid.v4();

    (p1p1PackModel.getById as jest.Mock).mockResolvedValue(undefined);

    const res = await call(voteP1P1Handler).as(user).withFlash(mockFlash).withBody({ packId, cardIndex: 0 }).send();

    expect(p1p1PackModel.getById).toHaveBeenCalledWith(packId);
    expect(res.status).toEqual(404);
    expect(res.body).toEqual({
      error: 'P1P1 pack not found',
    });
  });

  it('should successfully add vote and return vote summary', async () => {
    const user = createUser({ username: 'testuser' });
    const pack = createP1P1Pack();
    const updatedPack = {
      ...pack,
      votes: [
        {
          userId: user.id,
          userName: 'testuser',
          cardIndex: 1,
          date: Date.now(),
        },
      ],
    };
    const voteSummary = {
      totalVotes: 1,
      results: [
        { cardIndex: 0, voteCount: 0, percentage: 0 },
        { cardIndex: 1, voteCount: 1, percentage: 100 },
        { cardIndex: 2, voteCount: 0, percentage: 0 },
      ],
      userVote: 1,
      botPick: 0,
      botWeights: [0.8, 0.6, 0.4],
    };

    (p1p1PackModel.getById as jest.Mock).mockResolvedValue(pack);
    (p1p1PackModel.addVote as jest.Mock).mockResolvedValue(updatedPack);
    (p1p1PackModel.getVoteSummary as jest.Mock).mockReturnValue(voteSummary);

    const res = await call(voteP1P1Handler)
      .as(user)
      .withFlash(mockFlash)
      .withBody({ packId: pack.id, cardIndex: 1 })
      .send();

    expect(p1p1PackModel.getById).toHaveBeenCalledWith(pack.id);
    expect(p1p1PackModel.addVote).toHaveBeenCalledWith(pack, user.id, 1);
    expect(p1p1PackModel.getVoteSummary).toHaveBeenCalledWith(updatedPack, user.id);
    expect(res.status).toEqual(200);
    expect(res.body).toEqual({
      success: true,
      votes: voteSummary,
    });
  });

  it('should return 404 if vote update fails', async () => {
    const user = createUser({ username: 'testuser' });
    const pack = createP1P1Pack();

    (p1p1PackModel.getById as jest.Mock).mockResolvedValue(pack);
    (p1p1PackModel.addVote as jest.Mock).mockResolvedValue(null);

    const res = await call(voteP1P1Handler)
      .as(user)
      .withFlash(mockFlash)
      .withBody({ packId: pack.id, cardIndex: 0 })
      .send();

    expect(res.status).toEqual(404);
    expect(res.body).toEqual({
      error: 'Failed to update pack with vote',
    });
  });

  it('should return 500 on unexpected error', async () => {
    const user = createUser();
    const packId = uuid.v4();

    (p1p1PackModel.getById as jest.Mock).mockRejectedValue(new Error('Database error'));

    const res = await call(voteP1P1Handler).as(user).withFlash(mockFlash).withBody({ packId, cardIndex: 0 }).send();

    expect(res.status).toEqual(500);
    expect(res.body).toEqual({
      error: 'Error submitting vote',
    });
  });
});
