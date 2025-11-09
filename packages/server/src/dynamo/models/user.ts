import { NativeAttributeValue } from '@aws-sdk/lib-dynamodb';

import { DefaultPrintingPreference } from '@utils/datatypes/Card';
import User, {
  DefaultGridTightnessPreference,
  UnhydratedUser,
  UserWithSensitiveInformation,
} from '@utils/datatypes/User';
import { getImageData } from 'serverutils/imageutil';
import createClient from 'dynamo/util';

const idAttr: keyof UnhydratedUser = 'id';
const usernameLowerAttr: keyof UnhydratedUser = 'usernameLower';
const emailAttr: keyof UnhydratedUser = 'email';

const client = createClient({
  name: 'USERS',
  partitionKey: idAttr,
  attributes: {
    [idAttr]: 'S',
    [usernameLowerAttr]: 'S',
    [emailAttr]: 'S',
  },
  indexes: [
    {
      partitionKey: usernameLowerAttr,
      name: 'ByUsername',
    },
    {
      partitionKey: emailAttr,
      name: 'ByEmail',
    },
  ],
});

const stripSensitiveData = (user: UserWithSensitiveInformation): UnhydratedUser => {
  const sanitized = { ...user };
  //@ts-expect-error -- Typescript says property must be optional to delete, but we are switching types so not relevant
  delete sanitized.passwordHash;
  //@ts-expect-error --  Ditto
  delete sanitized.email;

  return sanitized;
};

const batchStripSensitiveData = (users: UserWithSensitiveInformation[]): UnhydratedUser[] =>
  users.map(stripSensitiveData);

const hydrate = (user: UnhydratedUser): User => {
  const hydrated = { ...user } as User;
  hydrated.image = getImageData(hydrated.imageName || 'Ambush Viper');

  if (!hydrated.defaultPrinting) {
    hydrated.defaultPrinting = DefaultPrintingPreference;
  }
  if (typeof user.autoBlog === 'undefined') {
    user.autoBlog = false;
  }

  if (!hydrated.gridTightness) {
    hydrated.gridTightness = DefaultGridTightnessPreference;
  }

  return hydrated;
};

const batchHydrate = (users: UnhydratedUser[]): User[] => users.map(hydrate);

const getByUsername = async (
  username: string,
  lastKey?: Record<string, NativeAttributeValue>,
): Promise<User | null> => {
  const result = await client.query({
    IndexName: 'ByUsername',
    KeyConditionExpression: `#p1 = :uname`,
    ExpressionAttributeValues: {
      ':uname': username.toLowerCase(),
    },
    ExpressionAttributeNames: {
      '#p1': usernameLowerAttr,
    },
    ExclusiveStartKey: lastKey,
  });

  if (result.Items && result.Items.length > 0) {
    return hydrate(stripSensitiveData(result.Items[0] as UserWithSensitiveInformation));
  }

  return null;
};

const user = {
  getById: async (id: string): Promise<User | undefined> => {
    const result = await client.get(id);
    if (!result.Item) {
      return undefined;
    }
    return hydrate(stripSensitiveData(result.Item as UserWithSensitiveInformation));
  },

  getByIdWithSensitiveData: async (id: string): Promise<UserWithSensitiveInformation | undefined> =>
    (await client.get(id)).Item as UserWithSensitiveInformation,

  getByUsername,

  getByIdOrUsername: async (idOrUsername: string): Promise<User | null> => {
    const result = await client.get(idOrUsername);

    if (result.Item) {
      return hydrate(stripSensitiveData(result.Item as UserWithSensitiveInformation));
    }

    return getByUsername(idOrUsername);
  },

  getByEmail: async (email: string, lastKey?: Record<string, NativeAttributeValue>): Promise<User | null> => {
    const result = await client.query({
      IndexName: 'ByEmail',
      KeyConditionExpression: `#p1 = :email`,
      ExpressionAttributeValues: {
        ':email': email.toLowerCase(),
      },
      ExpressionAttributeNames: {
        '#p1': emailAttr,
      },
      ExclusiveStartKey: lastKey,
    });

    if (result.Items && result.Items.length > 0) {
      return hydrate(stripSensitiveData(result.Items[0] as UserWithSensitiveInformation));
    }

    return null;
  },

  update: async (document: User): Promise<string | NativeAttributeValue> => {
    if (!document.id) {
      throw new Error('Invalid document: No partition key provided');
    }

    const existing = await client.get(document.id);

    if (!existing.Item) {
      throw new Error('Invalid document: No existing document found');
    }

    for (const [key, value] of Object.entries(document)) {
      if (key !== idAttr) {
        existing.Item[key] = value;
      }
    }

    delete existing.Item.image;

    return client.put(existing.Item);
  },

  put: async (document: User): Promise<string | NativeAttributeValue> => {
    delete document.image;
    return client.put({
      usernameLower: document.username.toLowerCase(),
      ...document,
    });
  },

  batchPut: async (documents: User[]): Promise<void> => {
    const existing = await client.batchGet(documents.map((doc) => doc.id));

    for (const item of existing) {
      const document = documents.find((doc) => doc.id === item.id);

      if (!document) {
        continue;
      }

      for (const [key, value] of Object.entries(document)) {
        if (key !== idAttr) {
          item[key] = value;
        }
      }
    }

    return client.batchPut(existing);
  },

  batchAdd: async (documents: User[]): Promise<void> => {
    return client.batchPut(documents);
  },

  deleteById: async (id: string): Promise<void> => client.delete({ id }),

  batchGet: async (ids: string[]): Promise<User[]> =>
    batchHydrate(batchStripSensitiveData(await client.batchGet(ids.map((id) => `${id}`)))),

  createTable: async () => client.createTable(),
};

module.exports = user;
export default user;
