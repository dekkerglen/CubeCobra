import { DRAFT_TYPES } from '@utils/datatypes/Draft';

jest.mock('serverutils/render', () => ({
  ...jest.requireActual('serverutils/render'),
  render: jest.fn(),
  handleRouteError: jest.fn(),
  redirect: jest.fn(),
}));

jest.mock('serverutils/carddb', () => ({
  cardFromId: jest.fn(),
  getReasonableCardByOracle: jest.fn(() => null),
  getVersionsByOracleId: jest.fn(() => []),
}));

jest.mock('serverutils/recordShareToken', () => ({
  verifyRecordToken: jest.fn(() => true),
  signRecordToken: jest.fn(),
}));

jest.mock('../../../src/dynamo/daos', () => ({
  cubeDao: { getById: jest.fn(), getCards: jest.fn(), update: jest.fn() },
  draftDao: { getById: jest.fn(), createDraft: jest.fn(), update: jest.fn() },
  recordDao: { getById: jest.fn(), update: jest.fn() },
  userDao: { getByUsername: jest.fn() },
}));

import { cubeDao, draftDao, recordDao } from '../../../src/dynamo/daos';
import { contributeSubmitHandler } from '../../../src/router/routes/cube/records/contribute';
import {
  editRecordPlayersHandler,
  routes as editPlayersRoutes,
} from '../../../src/router/routes/cube/records/edit/players';
import { associateDecksWithNewDraft, uploadDeckHandler } from '../../../src/router/routes/cube/records/uploaddeck';
import { createCube } from '../../test-utils/data';
import { call, middleware } from '../../test-utils/transport';

// This suite exists because every one of these routes writes the player list by position:
// an id that gets stripped or re-minted here silently reattributes someone else's deck, on
// a path nobody is watching. Each test checks the same invariant from a different route: a
// player's id survives a write that didn't carry it back.
describe('player id preservation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('edit/players', () => {
    const cube = createCube({ id: 'cube-edit' });
    const flash = jest.fn();

    const record = () => ({
      id: 'rec-edit',
      cube: cube.id,
      players: [
        { name: 'Alice', userId: 'user-alice', id: 'alice-id' },
        { name: 'Bob', id: 'bob-id' },
      ],
      matches: [],
      trophy: [],
      overrides: {},
      draft: undefined,
    });

    beforeEach(() => {
      (cubeDao.getById as jest.Mock).mockResolvedValue(cube);
      (recordDao.getById as jest.Mock).mockResolvedValue(record());
    });

    it('keeps an existing player id when the client posts without one', async () => {
      await call(editRecordPlayersHandler)
        .as(cube.owner)
        .withFlash(flash)
        .withParams({ id: 'rec-edit' })
        .withBody({
          players: JSON.stringify([{ name: 'Alice', userId: 'user-alice' }, { name: 'Bob' }]),
          seatOrder: JSON.stringify([0, 1]),
        })
        .send();

      const saved = (recordDao.update as jest.Mock).mock.calls[0][0];
      expect(saved.players[0].id).toBe('alice-id');
      expect(saved.players[1].id).toBe('bob-id');
    });

    it('rejects nothing when the client posts ids', async () => {
      // bodyValidation is the last-but-one handler: [csrfProtection, ensureAuth,
      // bodyValidation(recordSchema, ...), editRecordPlayersHandler].
      const validatePlayers = editPlayersRoutes[0]!.handler[2] as (req: any, res: any, next: () => void) => void;

      const { nextCalled } = await middleware(validatePlayers)
        .withFlash(flash)
        .withParams({ id: 'rec-edit' })
        .withBody({
          players: JSON.stringify([
            { name: 'Alice', userId: 'user-alice', id: 'alice-id' },
            { name: 'Bob', id: 'bob-id' },
          ]),
        })
        .send();

      expect(nextCalled).toBe(true);
    });

    // The wiring itself — reconcilePlayerIds feeding the right players into the right
    // draft write — is what Steps 3's deck-misattribution risk actually rides on, so this
    // asserts the seats draftDao.update receives, not just record.players.
    it('stamps the upload draft seats with each player id', async () => {
      (recordDao.getById as jest.Mock).mockResolvedValue({ ...record(), draft: 'draft-edit' });
      (draftDao.getById as jest.Mock).mockResolvedValue({
        id: 'draft-edit',
        type: DRAFT_TYPES.UPLOAD,
        cards: [] as any[],
        seats: [
          { title: 'Alice', owner: 'user-alice', mainboard: [], sideboard: [] },
          { title: 'Bob', mainboard: [], sideboard: [] },
        ],
      });

      await call(editRecordPlayersHandler)
        .as(cube.owner)
        .withFlash(flash)
        .withParams({ id: 'rec-edit' })
        .withBody({
          players: JSON.stringify([{ name: 'Alice', userId: 'user-alice' }, { name: 'Bob' }]),
          seatOrder: JSON.stringify([0, 1]),
        })
        .send();

      const updatedDraft = (draftDao.update as jest.Mock).mock.calls[0][0];
      expect(updatedDraft.seats[0].playerId).toBe('alice-id');
      expect(updatedDraft.seats[1].playerId).toBe('bob-id');
    });
  });

  describe('contribute', () => {
    const cube = createCube({ id: 'cube-contribute' });

    const existingDraft = () => ({
      id: 'draft-contribute',
      type: DRAFT_TYPES.UPLOAD,
      cards: [] as any[],
      seats: [{ title: 'Alice', owner: 'user-alice', mainboard: [], sideboard: [] }],
    });

    beforeEach(() => {
      (cubeDao.getById as jest.Mock).mockResolvedValue(cube);
      (cubeDao.getCards as jest.Mock).mockResolvedValue({ mainboard: [], maybeboard: [], basics: [] });
      (recordDao.getById as jest.Mock).mockResolvedValue({
        id: 'rec-contribute',
        cube: cube.id,
        players: [{ name: 'Alice', userId: 'user-alice', id: 'alice-id' }],
        draft: 'draft-contribute',
      });
      (draftDao.getById as jest.Mock).mockResolvedValue(existingDraft());
    });

    it('keeps existing ids when appending a new player', async () => {
      await call(contributeSubmitHandler)
        .withParams({ id: 'rec-contribute' })
        .withBody({
          token: 'tok',
          mainboard: JSON.stringify(['some-oracle']),
          userIndex: '1',
          newPlayer: 'Bob',
        })
        .send();

      const saved = (recordDao.update as jest.Mock).mock.calls[0][0];
      expect(saved.players[0].id).toBe('alice-id');
      expect(saved.players[1].name).toBe('Bob');
      expect(saved.players[1].id).toBeTruthy();
      expect(saved.players[1].id).not.toBe('alice-id');
    });

    // contribute.ts pushes the new seat unguarded (a separately deferred defect, out of
    // scope here) but must still stamp playerId only on the upload draft the route-level
    // mocks represent — this pins the seats draftDao.update actually receives.
    it('stamps the pushed seat with the new player id', async () => {
      await call(contributeSubmitHandler)
        .withParams({ id: 'rec-contribute' })
        .withBody({
          token: 'tok',
          mainboard: JSON.stringify(['some-oracle']),
          userIndex: '1',
          newPlayer: 'Bob',
        })
        .send();

      const draftUpdateCalls = (draftDao.update as jest.Mock).mock.calls;
      const updatedDraft = draftUpdateCalls[draftUpdateCalls.length - 1][0];
      expect(updatedDraft.seats[0].playerId).toBe('alice-id');
      expect(updatedDraft.seats[1].playerId).toBeTruthy();
      expect(updatedDraft.seats[1].playerId).not.toBe('alice-id');
    });

    it('stamps the existing seat with the player id when renaming', async () => {
      await call(contributeSubmitHandler)
        .withParams({ id: 'rec-contribute' })
        .withBody({
          token: 'tok',
          mainboard: JSON.stringify(['some-oracle']),
          userIndex: '1',
          renamePlayer: 'Alice R',
        })
        .send();

      const draftUpdateCalls = (draftDao.update as jest.Mock).mock.calls;
      const updatedDraft = draftUpdateCalls[draftUpdateCalls.length - 1][0];
      expect(updatedDraft.seats[0].playerId).toBe('alice-id');
    });
  });

  describe('uploaddeck', () => {
    const cube = createCube({ id: 'cube-upload' });

    beforeEach(() => {
      (cubeDao.getById as jest.Mock).mockResolvedValue(cube);
      (cubeDao.getCards as jest.Mock).mockResolvedValue({ mainboard: [], maybeboard: [], basics: [] });
      (draftDao.createDraft as jest.Mock).mockResolvedValue('new-draft');
      (recordDao.getById as jest.Mock).mockResolvedValue({
        id: 'rec-upload',
        cube: cube.id,
        players: [{ name: 'Alice', userId: 'user-alice', id: 'alice-id' }],
        draft: undefined,
      });
    });

    it('keeps existing ids when appending a new player', async () => {
      await call(uploadDeckHandler)
        .as(cube.owner)
        .withParams({ id: 'rec-upload' })
        .withBody({
          userIndex: '1',
          mainboard: JSON.stringify(['some-oracle']),
          newPlayer: 'Bob',
        })
        .send();

      const saved = (recordDao.update as jest.Mock).mock.calls[0][0];
      expect(saved.players[0].id).toBe('alice-id');
      expect(saved.players[1].name).toBe('Bob');
      expect(saved.players[1].id).toBeTruthy();
      expect(saved.players[1].id).not.toBe('alice-id');
    });

    // jest.fn() records call args regardless of what it's told to resolve to, so this
    // reads the draft createDraft was actually invoked with — the one place
    // associateNewDraft builds every seat from scratch.
    it('stamps a brand new upload draft with each player id', async () => {
      await call(uploadDeckHandler)
        .as(cube.owner)
        .withParams({ id: 'rec-upload' })
        .withBody({
          userIndex: '1',
          mainboard: JSON.stringify(['some-oracle']),
        })
        .send();

      const createdDraft = (draftDao.createDraft as jest.Mock).mock.calls[0][0];
      expect(createdDraft.seats[0].playerId).toBe('alice-id');
    });

    it('stamps the pushed seat with the new player id (existing draft)', async () => {
      (recordDao.getById as jest.Mock).mockResolvedValue({
        id: 'rec-upload',
        cube: cube.id,
        players: [{ name: 'Alice', userId: 'user-alice', id: 'alice-id' }],
        draft: 'draft-upload',
      });
      (draftDao.getById as jest.Mock).mockResolvedValue({
        id: 'draft-upload',
        type: DRAFT_TYPES.UPLOAD,
        cards: [] as any[],
        seats: [{ title: 'Alice', owner: 'user-alice', mainboard: [], sideboard: [] }],
      });

      await call(uploadDeckHandler)
        .as(cube.owner)
        .withParams({ id: 'rec-upload' })
        .withBody({
          userIndex: '1',
          mainboard: JSON.stringify(['some-oracle']),
          newPlayer: 'Bob',
        })
        .send();

      const draftUpdateCalls = (draftDao.update as jest.Mock).mock.calls;
      const updatedDraft = draftUpdateCalls[draftUpdateCalls.length - 1][0];
      expect(updatedDraft.seats[0].playerId).toBe('alice-id');
      expect(updatedDraft.seats[1].playerId).toBeTruthy();
      expect(updatedDraft.seats[1].playerId).not.toBe('alice-id');
    });

    // associateDecksWithNewDraft builds its own fresh seats from record.players, same as
    // associateNewDraft above, but is reached from enter.ts/importfile.ts/hedron.ts rather
    // than this route — exercised directly so that path isn't left unstamped and unwatched.
    it('stamps associateDecksWithNewDraft seats with each player id', async () => {
      (draftDao.createDraft as jest.Mock).mockResolvedValue('new-draft');

      await associateDecksWithNewDraft(
        cube,
        {
          id: 'rec-upload',
          cube: cube.id,
          date: 1,
          players: [{ name: 'Alice', userId: 'user-alice', id: 'alice-id' }],
        } as any,
        { 1: { mainboard: ['some-oracle'] } },
      );

      const createdDraft = (draftDao.createDraft as jest.Mock).mock.calls[0][0];
      expect(createdDraft.seats[0].playerId).toBe('alice-id');
    });
  });
});
