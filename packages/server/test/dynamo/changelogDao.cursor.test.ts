import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

import { ChangelogDynamoDao } from '../../src/dynamo/dao/ChangelogDynamoDao';

const changelogItem = (id: string, date: number) => ({
  item: { id, cube: 'cube-1', date, cubeVersion: 2 },
});

describe('ChangelogDynamoDao.queryByCubePage', () => {
  const mockSend = jest.fn();
  const dao = new ChangelogDynamoDao({ send: mockSend } as unknown as DynamoDBDocumentClient, 'test-table');

  beforeEach(() => {
    mockSend.mockReset();
  });

  it('returns an opaque cursor that round-trips to the same start key', async () => {
    const lastKey = {
      PK: 'CHANGELOG#cl-2',
      SK: 'CHANGELOG',
      GSI1PK: 'CHANGELOG#CUBE#cube-1',
      GSI1SK: 'DATE#2000',
    };
    mockSend.mockResolvedValueOnce({ Items: [changelogItem('cl-2', 2000)], LastEvaluatedKey: lastKey });

    const first = await dao.queryByCubePage('cube-1', undefined, 1);

    expect(first?.items.map((i) => i.id)).toEqual(['cl-2']);
    expect(first?.cursor).toEqual(expect.any(String));
    expect(first?.cursor).not.toContain('CHANGELOG');

    mockSend.mockResolvedValueOnce({ Items: [changelogItem('cl-1', 1000)] });
    const second = await dao.queryByCubePage('cube-1', first!.cursor, 1);

    expect(mockSend.mock.calls[1][0].input.ExclusiveStartKey).toEqual(lastKey);
    expect(second?.cursor).toBeUndefined();
  });

  it('scopes the start key to the requested cube', async () => {
    mockSend.mockResolvedValueOnce({
      Items: [],
      LastEvaluatedKey: { PK: 'CHANGELOG#cl-2', SK: 'CHANGELOG', GSI1PK: 'CHANGELOG#CUBE#cube-1', GSI1SK: 'DATE#2000' },
    });
    const { cursor } = (await dao.queryByCubePage('cube-1', undefined, 1))!;

    mockSend.mockResolvedValueOnce({ Items: [] });
    await dao.queryByCubePage('other-cube', cursor, 1);

    expect(mockSend.mock.calls[1][0].input.ExclusiveStartKey.GSI1PK).toBe('CHANGELOG#CUBE#other-cube');
  });

  it.each(['not-base64-json', Buffer.from('{"id":5,"date":"x"}').toString('base64url')])(
    'returns undefined for a malformed cursor %p',
    async (cursor) => {
      expect(await dao.queryByCubePage('cube-1', cursor, 1)).toBeUndefined();
      expect(mockSend).not.toHaveBeenCalled();
    },
  );
});
