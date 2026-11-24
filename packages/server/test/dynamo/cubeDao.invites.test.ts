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

import { BatchWriteCommand, GetCommand, PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';

import { CubeDynamoDao } from '../../src/dynamo/dao/CubeDynamoDao';

const TABLE = 'TEST_TABLE';

const inviteRow = (cubeId: string, userId: string, invitedAt: number) => ({
  PK: `HASH#CUBE#${cubeId}`,
  SK: `INVITE#${userId}`,
  GSI1PK: `INVITE-FOR#${userId}`,
  GSI1SK: `DATE#${String(invitedAt).padStart(15, '0')}`,
  cubeId,
  userId,
  invitedBy: 'owner-1',
  invitedAt,
});

describe('CubeDynamoDao collaborator invites', () => {
  let send: jest.Mock;
  let dao: CubeDynamoDao;

  beforeEach(() => {
    jest.clearAllMocks();
    send = jest.fn(async () => ({}));
    dao = new CubeDynamoDao({ send } as any, {} as any, TABLE);
  });

  const sent = (type: any) => send.mock.calls.map(([c]) => c).filter((c: any) => c instanceof type);

  it('writes an invite row on the cube hash partition, indexed for the invitee', async () => {
    await dao.writeInvite('cube-1', 'user-2', 'owner-1', 1234);
    const put: any = sent(PutCommand)[0];
    expect(put.input.Item).toEqual({
      PK: 'HASH#CUBE#cube-1',
      SK: 'INVITE#user-2',
      GSI1PK: 'INVITE-FOR#user-2',
      GSI1SK: 'DATE#000000000001234',
      cubeId: 'cube-1',
      userId: 'user-2',
      invitedBy: 'owner-1',
      invitedAt: 1234,
    });
  });

  it('lists invites for a cube by SK prefix, paging until done', async () => {
    send
      .mockResolvedValueOnce({ Items: [inviteRow('cube-1', 'user-2', 1)], LastEvaluatedKey: { k: 1 } })
      .mockResolvedValueOnce({ Items: [inviteRow('cube-1', 'user-3', 2)] });

    const invites = await dao.queryInvitesForCube('cube-1');

    const queries: any[] = sent(QueryCommand);
    expect(queries).toHaveLength(2);
    expect(queries[0].input.KeyConditionExpression).toContain('begins_with');
    expect(queries[0].input.ExpressionAttributeValues[':pk']).toBe('HASH#CUBE#cube-1');
    expect(queries[0].input.ExpressionAttributeValues[':prefix']).toBe('INVITE#');
    expect(queries[1].input.ExclusiveStartKey).toEqual({ k: 1 });
    expect(invites).toEqual([
      { cubeId: 'cube-1', userId: 'user-2', invitedBy: 'owner-1', invitedAt: 1 },
      { cubeId: 'cube-1', userId: 'user-3', invitedBy: 'owner-1', invitedAt: 2 },
    ]);
  });

  it('lists invites for a user from GSI1 newest first', async () => {
    send.mockResolvedValueOnce({ Items: [inviteRow('cube-9', 'user-2', 5), inviteRow('cube-1', 'user-2', 3)] });

    const invites = await dao.queryInvitesForUser('user-2');

    const query: any = sent(QueryCommand)[0];
    expect(query.input.IndexName).toBe('GSI1');
    expect(query.input.ExpressionAttributeValues[':pk']).toBe('INVITE-FOR#user-2');
    expect(query.input.ScanIndexForward).toBe(false);
    expect(invites.map((i) => i.cubeId)).toEqual(['cube-9', 'cube-1']);
  });

  it('getInvite returns the invite when a row exists', async () => {
    send.mockResolvedValueOnce({ Item: inviteRow('cube-1', 'user-2', 7) });

    expect(await dao.getInvite('cube-1', 'user-2')).toEqual({
      cubeId: 'cube-1',
      userId: 'user-2',
      invitedBy: 'owner-1',
      invitedAt: 7,
    });
    const get: any = sent(GetCommand)[0];
    expect(get.input.Key).toEqual({ PK: 'HASH#CUBE#cube-1', SK: 'INVITE#user-2' });
  });

  it('getInvite returns undefined when no row exists', async () => {
    expect(await dao.getInvite('cube-1', 'user-2')).toBeUndefined();
  });

  it('deleteInvitesForUser deletes every invite found on GSI1', async () => {
    send.mockResolvedValueOnce({ Items: [inviteRow('cube-9', 'user-2', 5), inviteRow('cube-1', 'user-2', 3)] });

    await dao.deleteInvitesForUser('user-2');

    const deletes = sent(BatchWriteCommand).flatMap((c: any) => c.input.RequestItems[TABLE]);
    expect(deletes).toEqual([
      { DeleteRequest: { Key: { PK: 'HASH#CUBE#cube-9', SK: 'INVITE#user-2' } } },
      { DeleteRequest: { Key: { PK: 'HASH#CUBE#cube-1', SK: 'INVITE#user-2' } } },
    ]);
  });

  it('deleteInvitesForCube chunks deletes into batches of 25', async () => {
    const rows = Array.from({ length: 30 }, (_, i) => inviteRow('cube-1', `user-${i}`, i));
    send.mockResolvedValueOnce({ Items: rows });

    await dao.deleteInvitesForCube('cube-1');

    const batches: any[] = sent(BatchWriteCommand);
    expect(batches.map((b) => b.input.RequestItems[TABLE].length)).toEqual([25, 5]);
  });

  it('getHashesForCube skips INVITE# rows', async () => {
    const hex = 'a'.repeat(64);
    send.mockResolvedValueOnce({ Items: [{ PK: 'HASH#CUBE#cube-1', SK: hex }, inviteRow('cube-1', 'x', 1)] });

    const { hashes } = await dao.getHashesForCube('cube-1');

    expect(hashes.map((h) => h.hash)).toEqual([hex]);
  });
});
