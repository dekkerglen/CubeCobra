import { CreateTableCommandOutput } from '@aws-sdk/client-dynamodb';
import { v4 as uuidv4 } from 'uuid';

import PasswordReset, { UnhydratedPasswordReset } from '../../datatypes/PasswordReset';
import createClient from '../util';

const client = createClient({
  name: 'RESETS',
  partitionKey: 'id',
  attributes: {
    id: 'S',
  },
});

const passwordReset = {
  getById: async (id: string): Promise<PasswordReset> => (await client.get(id)).Item as PasswordReset,
  put: async (document: UnhydratedPasswordReset) => {
    const id = document.id || uuidv4();
    await client.put({
      id: id,
      owner: document.owner,
      date: document.date,
    });
    return id;
  },
  batchPut: async (documents: PasswordReset[]): Promise<void> => {
    await client.batchPut(documents);
  },
  createTable: async (): Promise<CreateTableCommandOutput> => client.createTable(),
};

module.exports = passwordReset;
export default passwordReset;
