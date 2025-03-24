jest.mock('../../src/util/imageutil');

const getMockClient = () => ({
  createTable: jest.fn(),
  get: jest.fn(),
  scan: jest.fn(),
  put: jest.fn(),
  query: jest.fn(),
  delete: jest.fn(),
  batchGet: jest.fn(),
  batchPut: jest.fn(),
  batchDelete: jest.fn(),
});

const mockClient = getMockClient();
const mockCreateClient = jest.fn(() => mockClient);

// Move the test for client creation into a separate describe block that runs first
describe('User Model Initialization', () => {
  it('user table created with proper configuration', async () => {
    // Now import the User module which will trigger createClient
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('../../src/dynamo/models/user');

    expect(mockCreateClient).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'USERS',
        partitionKey: 'id',
        attributes: {
          id: 'S',
          usernameLower: 'S',
          email: 'S',
        },
        indexes: [
          {
            partitionKey: 'usernameLower',
            name: 'ByUsername',
          },
          {
            partitionKey: 'email',
            name: 'ByEmail',
          },
        ],
      }),
    );
  });
});

// Mock needs to be before User import, in order for the mocked createClient to be set
jest.mock('../../src/dynamo/util', () => mockCreateClient);

import { DefaultPrintingPreference, PrintingPreference } from '../../src/datatypes/Card';
import UserType, { DefaultGridTightnessPreference, GridTightnessPreference } from '../../src/datatypes/User';
import User from '../../src/dynamo/models/user';
import * as imageutil from '../../src/util/imageutil';
import { createUser } from '../test-utils/data';

describe('User Model', () => {
  const mockImage = {
    uri: 'https://example.com/image.png',
    artist: 'Alan Pollack',
    id: 'abcd-efgh',
    imageName: 'Ambush Viper',
  };

  const mockImageTwo = {
    uri: 'https://example.com/bowmasters.png',
    artist: 'Maxim Kostin',
    id: '1234-5678',
    imageName: 'Orcish Bowmasters',
  };

  const mockPasswordHash = 'aaaaaaaa';
  //User including sensitive fields (not all of which exist in the type)
  let mockFullUser: UserType;
  //User as hydrated and without sensitive fields
  let mockUser: UserType;

  beforeEach(() => {
    jest.clearAllMocks();

    (imageutil.getImageData as jest.Mock).mockReturnValue(mockImage);

    mockFullUser = createUser({
      id: 'test-id',
      username: 'TestUser',
      email: 'test@example.com',
      following: ['user1', 'user2'],
      imageName: undefined,
      defaultPrinting: undefined,
      gridTightness: undefined,
    });
    //@ts-expect-error -- Dynamo contains passwordHash but it is sensitive data so stripped
    mockFullUser.passwordHash = mockPasswordHash;

    mockUser = createUser({
      id: 'test-id2',
      username: 'TestUser2',
      email: undefined,
      following: ['user3', 'user3'],
      image: mockImage,
      defaultPrinting: undefined,
      gridTightness: undefined,
    });
  });

  describe('getByUsername', () => {
    it('returns null when no user found', async () => {
      (mockClient.query as jest.Mock).mockResolvedValueOnce({ Items: [] });
      const result = await User.getByUsername('nonexistent');
      expect(result).toBeNull();
    });

    it('returns hydrated user without sensitive data', async () => {
      (mockClient.query as jest.Mock).mockResolvedValueOnce({
        Items: [{ ...mockFullUser }],
      });

      const result = await User.getByUsername('TestUser');

      expect(result.passwordHash).toBeUndefined();
      expect(result.email).toBeUndefined();
      expect(result.image).toEqual(mockImage);
      expect(result.defaultPrinting).toBe(DefaultPrintingPreference);
      expect(result.gridTightness).toBe(DefaultGridTightnessPreference);

      expect(mockClient.query).toHaveBeenCalledWith(
        expect.objectContaining({
          IndexName: 'ByUsername',
          ExpressionAttributeValues: {
            ':uname': mockFullUser.username.toLowerCase(),
          },
          ExpressionAttributeNames: {
            '#p1': 'usernameLower',
          },
        }),
      );
    });

    it('returns with non-default hydrated fields', async () => {
      const user: UserType = mockFullUser;
      user.imageName = mockImageTwo.imageName;
      user.defaultPrinting = PrintingPreference.RECENT;
      user.gridTightness = GridTightnessPreference.TIGHT;

      const image = mockImageTwo;

      (imageutil.getImageData as jest.Mock).mockReturnValue(image);

      (mockClient.query as jest.Mock).mockResolvedValueOnce({
        Items: [user],
      });

      const result = await User.getByUsername('TestUser');

      expect(result.image).toEqual(image);
      expect(result.defaultPrinting).toBe(PrintingPreference.RECENT);
      expect(result.gridTightness).toBe(GridTightnessPreference.TIGHT);
    });
  });

  describe('getByEmail', () => {
    it('returns null when no user found', async () => {
      (mockClient.query as jest.Mock).mockResolvedValueOnce({ Items: [] });
      const result = await User.getByEmail('nonexistent@example.com');
      expect(result).toBeNull();
    });

    it('returns hydrated user with sensitive data', async () => {
      (mockClient.query as jest.Mock).mockResolvedValueOnce({
        Items: [{ ...mockFullUser }],
      });

      const result = await User.getByEmail('TEST@example.com');

      expect(result.email).toEqual(mockFullUser.email);
      expect(result.passwordHash).toEqual(mockPasswordHash);
      expect(result.image).toEqual(mockImage);
      expect(result.defaultPrinting).toBe(DefaultPrintingPreference);

      expect(mockClient.query).toHaveBeenCalledWith(
        expect.objectContaining({
          IndexName: 'ByEmail',
          ExpressionAttributeValues: {
            ':email': mockFullUser.email?.toLowerCase(),
          },
          ExpressionAttributeNames: {
            '#p1': 'email',
          },
        }),
      );
    });
  });

  describe('getByIdWithSensitiveData', () => {
    it('returns undefined when no user found', async () => {
      (mockClient.get as jest.Mock).mockResolvedValueOnce({ Item: undefined });

      const result = await User.getByIdWithSensitiveData('abcdefg');
      expect(result).toBeUndefined();
      expect(mockClient.get as jest.Mock).toHaveBeenCalledWith('abcdefg');
    });

    it('returns raw user', async () => {
      (mockClient.get as jest.Mock).mockResolvedValueOnce({ Item: mockFullUser });

      const result = await User.getByIdWithSensitiveData('abcdefg');

      expect(result).toEqual(mockFullUser);
      expect(mockClient.get as jest.Mock).toHaveBeenCalledWith('abcdefg');
    });
  });

  describe('getById', () => {
    it('returns undefined when no user found', async () => {
      mockClient.get.mockResolvedValueOnce({ Item: undefined });

      const result = await User.getById('nonexistent-id');
      expect(result).toBeUndefined();
      expect(mockClient.get).toHaveBeenCalledWith('nonexistent-id');
    });

    it('returns hydrated user without sensitive data', async () => {
      mockClient.get.mockResolvedValueOnce({ Item: { ...mockFullUser } });

      const result = await User.getById(mockFullUser.id);

      expect(mockClient.get).toHaveBeenCalledWith(mockFullUser.id);
      expect(result.passwordHash).toBeUndefined();
      expect(result.email).toBeUndefined();
      expect(result.image).toEqual(mockImage);
      expect(result.defaultPrinting).toBe(DefaultPrintingPreference);
      expect(result.gridTightness).toBe(DefaultGridTightnessPreference);
    });
  });

  describe('getByIdOrUsername', () => {
    it('returns null if neither are found', async () => {
      mockClient.get.mockResolvedValue({ Item: undefined });
      mockClient.query.mockResolvedValueOnce({ Items: [] });

      const result = await User.getByIdOrUsername('nonexistent-id');
      expect(result).toBeNull();
      expect(mockClient.get).toHaveBeenCalledWith('nonexistent-id');
    });

    it('returns hydrated user if found by id', async () => {
      mockClient.get.mockResolvedValueOnce({ Item: { ...mockFullUser } });

      const result = await User.getByIdOrUsername(mockFullUser.id);

      expect(mockClient.get).toHaveBeenCalledWith(mockFullUser.id);
      expect(result.passwordHash).toBeUndefined();
      expect(result.email).toBeUndefined();
      expect(result.image).toEqual(mockImage);
      expect(result.defaultPrinting).toBe(DefaultPrintingPreference);
      expect(result.gridTightness).toBe(DefaultGridTightnessPreference);
    });

    it('returns hydrated user if found by username and not id', async () => {
      mockClient.get.mockResolvedValueOnce({ Item: undefined });
      mockClient.query.mockResolvedValueOnce({ Items: [mockUser] });

      const result = await User.getByIdOrUsername('Nonexistent-ID');

      expect(mockClient.get).toHaveBeenCalledWith('Nonexistent-ID');

      expect(result.passwordHash).toBeUndefined();
      expect(result.email).toBeUndefined();
      expect(result.image).toEqual(mockImage);
      expect(result.defaultPrinting).toBe(DefaultPrintingPreference);
      expect(result.gridTightness).toBe(DefaultGridTightnessPreference);

      expect(mockClient.query).toHaveBeenCalledWith(
        expect.objectContaining({
          IndexName: 'ByUsername',
          ExpressionAttributeValues: {
            ':uname': 'nonexistent-id',
          },
          ExpressionAttributeNames: {
            '#p1': 'usernameLower',
          },
        }),
      );
    });
  });

  describe('batchGet', () => {
    it('returns empty array when no ids provided', async () => {
      mockClient.batchGet.mockResolvedValueOnce([]);

      const result = await User.batchGet([]);
      expect(result).toEqual([]);
    });

    it('returns hydrated users without sensitive data', async () => {
      const users = [
        { ...mockFullUser, id: 'user1' },
        { ...mockFullUser, id: 'user2' },
      ];
      mockClient.batchGet.mockResolvedValueOnce(users);

      const result = await User.batchGet(['user1', 'user2']);

      expect(result).toHaveLength(2);
      result.forEach((user: UserType) => {
        //@ts-expect-error -- Password hash is in dynamo but not the User type, since it is sensitive
        expect(user.passwordHash).toBeUndefined();
        expect(user.email).toBeUndefined();
        expect(user.image).toEqual(mockImage);
        expect(user.defaultPrinting).toBe(DefaultPrintingPreference);
      });
    });
  });

  describe('deleteById', () => {
    it('deletes user by id', async () => {
      await User.deleteById(mockFullUser.id);
      expect(mockClient.delete).toHaveBeenCalledWith({ id: mockFullUser.id });
    });
  });

  describe('put', () => {
    it('saves with username lower', async () => {
      await User.put(mockUser);

      expect(mockClient.put).toHaveBeenCalledWith(
        expect.objectContaining({
          username: mockUser.username,
          usernameLower: mockUser.username.toLowerCase(),
        }),
      );
    });

    it('image details are not saved', async () => {
      await User.put(mockUser);

      expect(mockClient.put).toHaveBeenCalledWith(
        expect.not.objectContaining({
          image: undefined,
        }),
      );
      expect(mockClient.put).toHaveBeenCalledWith(
        expect.objectContaining({
          imageName: mockImage.imageName,
        }),
      );
    });
  });

  describe('update', () => {
    it('throws error when input is missing id', async () => {
      await expect(User.update({ foobar: 'non-existent' })).rejects.toThrow(
        'Invalid document: No partition key provided',
      );
    });

    it('throws error when user not found', async () => {
      mockClient.get.mockResolvedValueOnce({ Item: null });

      await expect(User.update({ id: 'non-existent' })).rejects.toThrow('Invalid document: No existing document found');
      expect(mockClient.get).toHaveBeenCalledWith('non-existent');
    });

    it('updates only specified fields', async () => {
      mockClient.get.mockResolvedValueOnce({ Item: mockUser });

      const updates = {
        id: mockUser.id,
        about: 'New about text',
        theme: 'dark',
      };

      await User.update(updates);

      expect(mockClient.get).toHaveBeenCalledWith(mockUser.id);
      expect(mockClient.put).toHaveBeenCalledWith(
        expect.objectContaining({
          ...mockUser,
          about: 'New about text',
          theme: 'dark',
        }),
      );
    });

    it('image details are not saved', async () => {
      mockClient.get.mockResolvedValueOnce({ Item: mockUser });

      const updates = {
        id: mockUser.id,
        about: 'New about text',
        hideFeatured: true,
      };

      await User.update(updates);

      expect(mockClient.put).toHaveBeenCalledWith(
        expect.not.objectContaining({
          image: undefined,
        }),
      );
      expect(mockClient.put).toHaveBeenCalledWith(
        expect.objectContaining({
          imageName: mockImage.imageName,
        }),
      );
    });
  });

  describe('batchPut', () => {
    it('no existing users found', async () => {
      mockClient.batchGet.mockResolvedValueOnce([]);
      await User.batchPut([
        {
          id: 'user1',
        },
        {
          id: 'user2',
        },
      ]);

      expect(mockClient.batchGet).toHaveBeenCalledWith(['user1', 'user2']);
    });

    it('when input documents are missing id field', async () => {
      mockClient.batchGet.mockResolvedValueOnce([]);
      await User.batchPut([
        {
          foo: 'user1',
        },
        {
          foo: 'user2',
        },
      ]);

      expect(mockClient.batchGet).toHaveBeenCalledWith([undefined, undefined]);
    });

    it('updates fields correctly', async () => {
      const user1: UserType = { ...mockUser };
      user1.id = 'user1';
      user1.about = undefined;

      const user2: UserType = { ...mockUser };
      user2.id = 'user2';
      user2.about = 'I am a bad boy';

      mockClient.batchGet.mockResolvedValueOnce([user2, user1]);
      await User.batchPut([
        {
          id: 'user1',
          about: 'This is me',
        },
        {
          id: 'user2',
          about: 'Not me',
        },
      ]);

      expect(mockClient.batchGet).toHaveBeenCalledWith(['user1', 'user2']);

      const sortById = (a: { id: string }, b: { id: string }) => a.id.localeCompare(b.id);

      //We don't care the order of the items in the batchPut call. expect(mockClient.batchPut).toHaveBeenCalledWith cares
      const batchPutArray = mockClient.batchPut.mock.calls[0][0];
      expect(batchPutArray.sort(sortById)).toEqual(
        [
          {
            ...user1,
            about: 'This is me',
          },
          {
            ...user2,
            about: 'Not me',
          },
        ].sort(sortById),
      );
    });

    it('image details are not stripped', async () => {
      const user1: UserType = { ...mockUser };
      user1.id = 'user1';
      user1.about = undefined;
      user1.imageName = mockImageTwo.imageName;
      //batchGet isn't hydrated
      user1.image = undefined;

      const user2: UserType = { ...mockUser };
      user2.id = 'user2';
      user2.about = 'I am a bad boy';
      user1.imageName = mockImage.imageName;
      user1.image = undefined;

      mockClient.batchGet.mockResolvedValueOnce([user2, user1]);
      await User.batchPut([
        {
          id: 'user1',
          about: 'This is me',
          imageName: mockImageTwo.imageName,
          image: mockImageTwo,
        },
        {
          id: 'user2',
          about: 'Not me',
          imageName: mockImage.imageName,
          image: mockImage,
        },
      ]);

      expect(mockClient.batchGet).toHaveBeenCalledWith(['user1', 'user2']);

      const sortById = (a: { id: string }, b: { id: string }) => a.id.localeCompare(b.id);

      //We don't care the order of the items in the batchPut call. expect(mockClient.batchPut).toHaveBeenCalledWith cares
      const batchPutArray = mockClient.batchPut.mock.calls[0][0];
      expect(batchPutArray.sort(sortById)).toEqual(
        [
          {
            ...user1,
            about: 'This is me',
            imageName: mockImageTwo.imageName,
            image: mockImageTwo,
          },
          {
            ...user2,
            about: 'Not me',
            imageName: mockImage.imageName,
            image: mockImage,
          },
        ].sort(sortById),
      );
    });
  });

  describe('batchAdd', () => {
    it('should put all the users', async () => {
      const user1: UserType = { ...mockUser };
      user1.id = 'user1';
      user1.about = undefined;

      const user2: UserType = { ...mockUser };
      user2.id = 'user2';
      user2.about = 'I am a bad boy';

      await User.batchAdd([user1, user2]);

      expect(mockClient.batchPut).toHaveBeenCalledWith([user1, user2]);
    });

    it('does not strip image details', async () => {
      const user1: UserType = { ...mockUser };
      user1.id = 'user1';
      user1.about = undefined;
      user1.imageName = mockImageTwo.imageName;
      user1.image = mockImageTwo;

      const user2: UserType = { ...mockUser };
      user2.id = 'user2';
      user2.about = 'I am a bad boy';
      user1.imageName = mockImage.imageName;
      user1.image = mockImage;

      await User.batchAdd([user1, user2]);

      expect(mockClient.batchPut).toHaveBeenCalledWith([user1, user2]);
    });
  });

  describe('batchGet', () => {
    it('returns empty array when no users found', async () => {
      mockClient.batchGet.mockResolvedValueOnce([]);

      const result = await User.batchGet(['aaaaa', 'bbbbb']);
      expect(result).toEqual([]);
      expect(mockClient.batchGet).toHaveBeenCalledWith(['aaaaa', 'bbbbb']);
    });

    it('returns hydrated users without sensitive data', async () => {
      const user1: UserType = { ...mockFullUser };
      user1.id = 'aaaaa';
      user1.defaultPrinting = PrintingPreference.RECENT;
      user1.imageName = mockImageTwo.imageName;

      const user2: UserType = { ...mockFullUser };
      user2.id = 'bbbbb';
      user2.gridTightness = GridTightnessPreference.TIGHT;
      user2.imageName = mockImage.imageName;

      mockClient.batchGet.mockResolvedValueOnce([user1, user2]);
      (imageutil.getImageData as jest.Mock).mockReturnValueOnce(mockImageTwo);
      (imageutil.getImageData as jest.Mock).mockReturnValueOnce(mockImage);

      const result = await User.batchGet(['aaaaa', 'bbbbb']);

      expect(mockClient.batchGet).toHaveBeenCalledWith(['aaaaa', 'bbbbb']);

      const resultOne = result[0];
      expect(resultOne.passwordHash).toBeUndefined();
      expect(resultOne.email).toBeUndefined();
      expect(resultOne.image).toEqual(mockImageTwo);
      expect(resultOne.defaultPrinting).toBe(PrintingPreference.RECENT);
      expect(resultOne.gridTightness).toBe(DefaultGridTightnessPreference);

      const resultTwo = result[1];
      expect(resultTwo.passwordHash).toBeUndefined();
      expect(resultTwo.email).toBeUndefined();
      expect(resultTwo.image).toEqual(mockImage);
      expect(resultTwo.defaultPrinting).toBe(DefaultPrintingPreference);
      expect(resultTwo.gridTightness).toBe(GridTightnessPreference.TIGHT);
    });
  });

  describe('createTable', () => {
    it('calls client to crate table', async () => {
      await User.createTable();

      expect(mockClient.createTable).toHaveBeenCalled();
    });
  });

  describe('convertUser', () => {
    it('converts legacy user format', () => {
      const legacyUser = {
        _id: 'user-id',
        username: 'Legacy',
        username_lower: 'legacy',
        email: 'LEGACY@EXAMPLE.COM',
        password: 'old-hash',
        hide_tag_colors: true,
        followed_cubes: ['cube1'],
        followed_users: ['user1'],
        users_following: ['user2'],
        image_name: 'avatar.jpg',
        roles: ['Admin'],
      };

      const result = User.convertUser(legacyUser);

      expect(result).toEqual({
        id: 'user-id',
        username: 'Legacy',
        usernameLower: 'legacy',
        email: 'legacy@example.com',
        passwordHash: 'old-hash',
        hideTagColors: true,
        followedCubes: ['cube1'],
        followedUsers: ['user1'],
        following: ['user2'],
        imageName: 'avatar.jpg',
        roles: ['Admin'],
      });
    });
  });
});
