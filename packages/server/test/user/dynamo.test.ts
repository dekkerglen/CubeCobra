jest.mock('serverutils/imageutil');

// Move the test for client creation into a separate describe block that runs first
describe('User Model Initialization', () => {
  it('user table created with proper configuration', async () => {
    // Now import the User module which will trigger createClient
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('../../src/dynamo/models/user');

    expect(mockDynamoCreateClient).toHaveBeenCalledWith(
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

import { DefaultPrintingPreference, PrintingPreference } from '@utils/datatypes/Card';
import UserType, { DefaultGridTightnessPreference, GridTightnessPreference } from '@utils/datatypes/User';
import * as imageutil from 'serverutils/imageutil';

import User from '../../src/dynamo/models/user';
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

  const assertValidUser = (
    result: UserType | undefined | null,
    assertionOverrides: Partial<Record<keyof UserType, any>> = {},
  ) => {
    expect(result).not.toBeUndefined();
    expect(result).not.toBeNull();
    if (!result) return; // TypeScript guard

    const assertions = {
      passwordHash: undefined,
      email: undefined,
      image: mockImage,
      defaultPrinting: DefaultPrintingPreference,
      gridTightness: DefaultGridTightnessPreference,
      ...assertionOverrides,
    };

    for (const [property, value] of Object.entries(assertions)) {
      const prop = property as keyof UserType;
      expect(result[prop]).toEqual(value);
    }
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetAllMocks();

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
      (mockDynamoClient.query as jest.Mock).mockResolvedValueOnce({ Items: [] });
      const result = await User.getByUsername('nonexistent');
      expect(result).toBeNull();
    });

    it('returns hydrated user without sensitive data', async () => {
      (mockDynamoClient.query as jest.Mock).mockResolvedValueOnce({
        Items: [{ ...mockFullUser }],
      });

      const result = await User.getByUsername('TestUser');

      assertValidUser(result);

      expect(mockDynamoClient.query).toHaveBeenCalledWith(
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

      (mockDynamoClient.query as jest.Mock).mockResolvedValueOnce({
        Items: [user],
      });

      const result = await User.getByUsername('TestUser');

      assertValidUser(result, {
        image,
        defaultPrinting: PrintingPreference.RECENT,
        gridTightness: GridTightnessPreference.TIGHT,
      });
    });
  });

  describe('getByEmail', () => {
    it('returns null when no user found', async () => {
      (mockDynamoClient.query as jest.Mock).mockResolvedValueOnce({ Items: [] });
      const result = await User.getByEmail('nonexistent@example.com');
      expect(result).toBeNull();
    });

    it('returns hydrated user without sensitive data', async () => {
      (mockDynamoClient.query as jest.Mock).mockResolvedValueOnce({
        Items: [{ ...mockFullUser }],
      });

      const result = await User.getByEmail('TEST@example.com');

      assertValidUser(result);

      expect(mockDynamoClient.query).toHaveBeenCalledWith(
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
      (mockDynamoClient.get as jest.Mock).mockResolvedValueOnce({ Item: undefined });

      const result = await User.getByIdWithSensitiveData('abcdefg');
      expect(result).toBeUndefined();
      expect(mockDynamoClient.get as jest.Mock).toHaveBeenCalledWith('abcdefg');
    });

    it('returns raw user', async () => {
      (mockDynamoClient.get as jest.Mock).mockResolvedValueOnce({ Item: mockFullUser });

      const result = await User.getByIdWithSensitiveData('abcdefg');

      expect(result).toEqual(mockFullUser);
      expect(mockDynamoClient.get as jest.Mock).toHaveBeenCalledWith('abcdefg');
    });
  });

  describe('getById', () => {
    it('returns undefined when no user found', async () => {
      mockDynamoClient.get.mockResolvedValueOnce({ Item: undefined });

      const result = await User.getById('nonexistent-id');
      expect(result).toBeUndefined();
      expect(mockDynamoClient.get).toHaveBeenCalledWith('nonexistent-id');
    });

    it('returns hydrated user without sensitive data', async () => {
      mockDynamoClient.get.mockResolvedValueOnce({ Item: { ...mockFullUser } });

      const result = await User.getById(mockFullUser.id);

      expect(mockDynamoClient.get).toHaveBeenCalledWith(mockFullUser.id);
      assertValidUser(result);
    });
  });

  describe('getByIdOrUsername', () => {
    it('returns null if neither are found', async () => {
      mockDynamoClient.get.mockResolvedValue({ Item: undefined });
      mockDynamoClient.query.mockResolvedValueOnce({ Items: [] });

      const result = await User.getByIdOrUsername('nonexistent-id');
      expect(result).toBeNull();
      expect(mockDynamoClient.get).toHaveBeenCalledWith('nonexistent-id');
    });

    it('returns hydrated user if found by id', async () => {
      mockDynamoClient.get.mockResolvedValueOnce({ Item: { ...mockFullUser } });

      const result = await User.getByIdOrUsername(mockFullUser.id);

      expect(mockDynamoClient.get).toHaveBeenCalledWith(mockFullUser.id);

      assertValidUser(result);
    });

    it('returns hydrated user if found by username and not id', async () => {
      mockDynamoClient.get.mockResolvedValueOnce({ Item: undefined });
      mockDynamoClient.query.mockResolvedValueOnce({ Items: [mockUser] });

      const result = await User.getByIdOrUsername('Nonexistent-ID');

      expect(mockDynamoClient.get).toHaveBeenCalledWith('Nonexistent-ID');

      assertValidUser(result);

      expect(mockDynamoClient.query).toHaveBeenCalledWith(
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
      mockDynamoClient.batchGet.mockResolvedValueOnce([]);

      const result = await User.batchGet([]);
      expect(result).toEqual([]);
    });

    it('returns hydrated users without sensitive data', async () => {
      const users = [
        { ...mockFullUser, id: 'user1' },
        { ...mockFullUser, id: 'user2' },
      ];
      mockDynamoClient.batchGet.mockResolvedValueOnce(users);

      const result = await User.batchGet(['user1', 'user2']);

      expect(result).toHaveLength(2);
      result.forEach((user: UserType | undefined) => {
        assertValidUser(user);
      });
    });
  });

  describe('deleteById', () => {
    it('deletes user by id', async () => {
      await User.deleteById(mockFullUser.id);
      expect(mockDynamoClient.delete).toHaveBeenCalledWith({ id: mockFullUser.id });
    });
  });

  describe('put', () => {
    it('saves with username lower', async () => {
      await User.put(mockUser);

      expect(mockDynamoClient.put).toHaveBeenCalledWith(
        expect.objectContaining({
          username: mockUser.username,
          usernameLower: mockUser.username.toLowerCase(),
        }),
      );
    });

    it('image details are not saved', async () => {
      await User.put(mockUser);

      expect(mockDynamoClient.put).toHaveBeenCalledWith(
        expect.not.objectContaining({
          image: undefined,
        }),
      );
      expect(mockDynamoClient.put).toHaveBeenCalledWith(
        expect.objectContaining({
          imageName: mockImage.imageName,
        }),
      );
    });
  });

  describe('update', () => {
    it('throws error when input is missing id', async () => {
      //@ts-expect-error -- Invalid user being passed in
      await expect(User.update({ foobar: 'non-existent' })).rejects.toThrow(
        'Invalid document: No partition key provided',
      );
    });

    it('throws error when user not found', async () => {
      mockDynamoClient.get.mockResolvedValueOnce({ Item: null });

      await expect(User.update(createUser({ id: 'non-existent' }))).rejects.toThrow(
        'Invalid document: No existing document found',
      );
      expect(mockDynamoClient.get).toHaveBeenCalledWith('non-existent');
    });

    it('updates only specified fields', async () => {
      mockDynamoClient.get.mockResolvedValueOnce({ Item: mockUser });

      const updates = createUser({
        id: mockUser.id,
        about: 'New about text',
        theme: 'dark',
      });

      await User.update(updates);

      expect(mockDynamoClient.get).toHaveBeenCalledWith(mockUser.id);
      expect(mockDynamoClient.put).toHaveBeenCalledWith(
        expect.objectContaining({
          ...mockUser,
          about: 'New about text',
          theme: 'dark',
        }),
      );
    });

    it('image details are not saved', async () => {
      mockDynamoClient.get.mockResolvedValueOnce({ Item: mockUser });

      const updates = createUser({
        id: mockUser.id,
        about: 'New about text',
        hideFeatured: true,
      });

      await User.update(updates);

      expect(mockDynamoClient.put).toHaveBeenCalledWith(
        expect.not.objectContaining({
          image: undefined,
        }),
      );
      expect(mockDynamoClient.put).toHaveBeenCalledWith(
        expect.objectContaining({
          imageName: mockImage.imageName,
        }),
      );
    });
  });

  describe('batchPut', () => {
    const sortById = (a: { id: string }, b: { id: string }) => a.id.localeCompare(b.id);

    it('no existing users found', async () => {
      mockDynamoClient.batchGet.mockResolvedValueOnce([]);
      await User.batchPut([
        createUser({
          id: 'user1',
        }),
        createUser({
          id: 'user2',
        }),
      ]);

      expect(mockDynamoClient.batchGet).toHaveBeenCalledWith(['user1', 'user2']);
    });

    it('when input documents are missing id field', async () => {
      mockDynamoClient.batchGet.mockResolvedValueOnce([]);
      await User.batchPut([
        {
          //@ts-expect-error -- Invalid user being passed in
          foo: 'user1',
        },
        {
          //@ts-expect-error -- Invalid user being passed in
          foo: 'user2',
        },
      ]);

      expect(mockDynamoClient.batchGet).toHaveBeenCalledWith([undefined, undefined]);
    });

    it('updates fields correctly', async () => {
      const user1: UserType = { ...mockUser };
      user1.id = 'user1';
      user1.about = undefined;

      const user2: UserType = { ...mockUser };
      user2.id = 'user2';
      user2.about = 'I am a bad boy';

      mockDynamoClient.batchGet.mockResolvedValueOnce([user2, user1]);
      await User.batchPut([
        createUser({
          id: 'user1',
          about: 'This is me',
        }),
        createUser({
          id: 'user2',
          about: 'Not me',
        }),
      ]);

      expect(mockDynamoClient.batchGet).toHaveBeenCalledWith(['user1', 'user2']);

      //We don't care the order of the items in the batchPut call. expect(mockDynamoClient.batchPut).toHaveBeenCalledWith cares
      const batchPutArray = mockDynamoClient.batchPut.mock.calls[0][0];
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

    it('a user to update isnt found', async () => {
      const user2: UserType = { ...mockUser };
      user2.id = 'user2';
      user2.about = 'I am a bad boy';

      mockDynamoClient.batchGet.mockResolvedValueOnce([user2]);
      await User.batchPut([
        createUser({
          id: 'user1',
          about: 'This is me',
        }),
        createUser({
          id: 'user2',
          about: 'Not me',
        }),
      ]);

      expect(mockDynamoClient.batchGet).toHaveBeenCalledWith(['user1', 'user2']);

      //We don't care the order of the items in the batchPut call. expect(mockDynamoClient.batchPut).toHaveBeenCalledWith cares
      const batchPutArray = mockDynamoClient.batchPut.mock.calls[0][0];
      expect(batchPutArray.sort(sortById)).toEqual(
        [
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

      mockDynamoClient.batchGet.mockResolvedValueOnce([user2, user1]);
      await User.batchPut([
        createUser({
          id: 'user1',
          about: 'This is me',
          imageName: mockImageTwo.imageName,
          image: mockImageTwo,
        }),
        createUser({
          id: 'user2',
          about: 'Not me',
          imageName: mockImage.imageName,
          image: mockImage,
        }),
      ]);

      expect(mockDynamoClient.batchGet).toHaveBeenCalledWith(['user1', 'user2']);

      //We don't care the order of the items in the batchPut call. expect(mockDynamoClient.batchPut).toHaveBeenCalledWith cares
      const batchPutArray = mockDynamoClient.batchPut.mock.calls[0][0];
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

      expect(mockDynamoClient.batchPut).toHaveBeenCalledWith([user1, user2]);
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

      expect(mockDynamoClient.batchPut).toHaveBeenCalledWith([user1, user2]);
    });
  });

  describe('batchGet', () => {
    it('returns empty array when no users found', async () => {
      mockDynamoClient.batchGet.mockResolvedValueOnce([]);

      const result = await User.batchGet(['aaaaa', 'bbbbb']);
      expect(result).toEqual([]);
      expect(mockDynamoClient.batchGet).toHaveBeenCalledWith(['aaaaa', 'bbbbb']);
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

      mockDynamoClient.batchGet.mockResolvedValueOnce([user1, user2]);
      (imageutil.getImageData as jest.Mock).mockReturnValueOnce(mockImageTwo);
      (imageutil.getImageData as jest.Mock).mockReturnValueOnce(mockImage);

      const result = await User.batchGet(['aaaaa', 'bbbbb']);

      expect(mockDynamoClient.batchGet).toHaveBeenCalledWith(['aaaaa', 'bbbbb']);

      assertValidUser(result[0], {
        image: mockImageTwo,
        defaultPrinting: PrintingPreference.RECENT,
        gridTightness: DefaultGridTightnessPreference,
      });

      assertValidUser(result[1], {
        image: mockImage,
        defaultPrinting: DefaultPrintingPreference,
        gridTightness: GridTightnessPreference.TIGHT,
      });
    });
  });

  describe('createTable', () => {
    it('calls client to create table', async () => {
      await User.createTable();

      expect(mockDynamoClient.createTable).toHaveBeenCalled();
    });
  });
});
