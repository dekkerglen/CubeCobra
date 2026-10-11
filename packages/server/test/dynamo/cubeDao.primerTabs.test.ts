jest.mock('serverutils/carddb', () => ({
  cardFromId: jest.fn(),
  getPlaceholderCard: jest.fn(),
}));

jest.mock('serverutils/cloudwatch', () => ({
  __esModule: true,
  default: { error: jest.fn(), info: jest.fn(), warn: jest.fn() },
}));

jest.mock('serverutils/imageutil', () => ({
  getImageData: jest.fn(() => ({ uri: 'img', artist: 'a', id: 'i', imageName: 'n' })),
}));

jest.mock('../../src/dynamo/s3client', () => ({
  getObject: jest.fn(),
  putObject: jest.fn(),
  deleteObject: jest.fn(),
  getObjectVersion: jest.fn(),
  listObjectVersions: jest.fn(),
}));

import { GetCommand, PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';

import { CubeDynamoDao } from '../../src/dynamo/dao/CubeDynamoDao';
import { createCube, createUser } from '../test-utils/data';

const TABLE = 'TEST_TABLE';
const owner = createUser();

/** A cube row as stored before primer tabs existed: a single `description` string. */
const legacyRow = (overrides: Record<string, any> = {}) => {
  const { owner: _owner, image: _image, primerTabs: _primerTabs, ...rest } = createCube();
  return { ...rest, owner: owner.id, description: 'legacy', ...overrides } as Record<string, any>;
};

/** A stored row as Dynamo hands it back. */
const stored = <T>(item: T) => ({ PK: 'CUBE#x', SK: 'CUBE', DynamoVersion: 3, item });

describe('CubeDynamoDao primer tabs', () => {
  let send: jest.Mock;
  let userDao: { getById: jest.Mock; batchGet: jest.Mock };
  let dao: CubeDynamoDao;

  beforeEach(() => {
    jest.clearAllMocks();
    send = jest.fn(async () => ({}));
    userDao = {
      getById: jest.fn(async () => owner),
      batchGet: jest.fn(async () => [owner]),
    };
    dao = new CubeDynamoDao({ send } as any, userDao as any, TABLE);
  });

  const puts = () => send.mock.calls.map(([c]) => c).filter((c: any) => c instanceof PutCommand);
  const findPutItem = () => puts().find((c: any) => c.input.Item.SK === 'CUBE')!.input.Item!.item;

  describe('single-item hydration', () => {
    it('getById converts a legacy description to one Primer tab', async () => {
      send.mockResolvedValueOnce({ Item: stored(legacyRow({ description: '# Hi' })) });

      const cube = await dao.getById('x');

      expect(cube!.primerTabs).toEqual([{ title: 'Primer', content: '# Hi' }]);
      expect(cube).not.toHaveProperty('description');
    });

    it('getById passes stored primerTabs through', async () => {
      const primerTabs = [
        { title: 'Intro', content: 'a' },
        { title: 'Rules', content: 'b' },
      ];
      const { description: _description, ...row } = legacyRow({ primerTabs });
      send.mockResolvedValueOnce({ Item: stored(row) });

      const cube = await dao.getById('x');

      expect(cube!.primerTabs).toEqual(primerTabs);
      expect(cube).not.toHaveProperty('description');
    });

    it('getById converts when the cube has no owner', async () => {
      send.mockResolvedValueOnce({ Item: stored(legacyRow({ owner: undefined })) });

      const cube = await dao.getById('x');

      expect(cube!.primerTabs).toEqual([{ title: 'Primer', content: 'legacy' }]);
      expect(cube).not.toHaveProperty('description');
    });

    it('getById converts when the owner is missing from the database', async () => {
      userDao.getById.mockResolvedValueOnce(undefined);
      send.mockResolvedValueOnce({ Item: stored(legacyRow()) });

      const cube = await dao.getById('x');

      expect(cube!.primerTabs).toEqual([{ title: 'Primer', content: 'legacy' }]);
      expect(cube).not.toHaveProperty('description');
    });

    it('batchGet converts legacy rows', async () => {
      send.mockResolvedValueOnce({ Item: stored(legacyRow()) });

      const [cube] = await dao.batchGet(['x']);

      expect(cube!.primerTabs).toEqual([{ title: 'Primer', content: 'legacy' }]);
      expect(cube).not.toHaveProperty('description');
    });
  });

  describe('list hydration', () => {
    const queried = async (rows: Record<string, any>[]) => {
      send.mockResolvedValueOnce({ Items: rows.map((row) => stored(row)) });
      const { items } = await dao.queryByOwner(owner.id);
      expect(send.mock.calls[0]![0]).toBeInstanceOf(QueryCommand);
      return items;
    };

    it('converts legacy rows with an existing owner', async () => {
      const [cube] = await queried([legacyRow({ description: '# List' })]);

      expect(cube!.primerTabs).toEqual([{ title: 'Primer', content: '# List' }]);
      expect(cube).not.toHaveProperty('description');
    });

    it('converts legacy rows whose owner is missing from the database', async () => {
      userDao.batchGet.mockResolvedValueOnce([]);

      const [cube] = await queried([legacyRow()]);

      expect(cube!.primerTabs).toEqual([{ title: 'Primer', content: 'legacy' }]);
      expect(cube).not.toHaveProperty('description');
    });

    it('converts legacy rows with no owner', async () => {
      const [cube] = await queried([legacyRow({ owner: undefined })]);

      expect(cube!.primerTabs).toEqual([{ title: 'Primer', content: 'legacy' }]);
      expect(cube).not.toHaveProperty('description');
    });

    it('passes stored primerTabs through', async () => {
      const primerTabs = [{ title: 'Intro', content: 'a' }];
      const { description: _description, ...row } = legacyRow({ primerTabs });

      const [cube] = await queried([row]);

      expect(cube!.primerTabs).toEqual(primerTabs);
    });
  });

  describe('update', () => {
    beforeEach(() => {
      send.mockImplementation(async (command: any) =>
        command instanceof GetCommand ? { Item: stored(legacyRow()) } : {},
      );
    });

    it('writes primerTabs and drops description', async () => {
      await dao.update(createCube({ primerTabs: [{ title: 'Primer', content: 'x' }] }));

      const put = findPutItem();
      expect(put.primerTabs).toEqual([{ title: 'Primer', content: 'x' }]);
      // The document client has removeUndefinedValues on, so an undefined key is not persisted.
      expect(put.description).toBeUndefined();
    });

    it('keeps the legacy description when primerTabs is missing', async () => {
      const cube = { ...createCube(), primerTabs: undefined, description: 'legacy' } as any;

      await dao.update(cube);

      expect(findPutItem().description).toBe('legacy');
    });
  });
});
