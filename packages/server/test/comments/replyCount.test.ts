import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { REPLY_COUNT_CAP } from '@utils/datatypes/Comment';

import { CommentDynamoDao } from '../../src/dynamo/dao/CommentDynamoDao';
import { UserDynamoDao } from '../../src/dynamo/dao/UserDynamoDao';

describe('CommentDynamoDao.countRepliesByParent', () => {
  const mockSend = jest.fn();
  const dao = new CommentDynamoDao(
    { send: mockSend } as unknown as DynamoDBDocumentClient,
    {} as UserDynamoDao,
    'test-table',
  );

  beforeEach(() => {
    mockSend.mockReset();
  });

  it('counts replies with a single bounded COUNT query', async () => {
    mockSend.mockResolvedValueOnce({ Count: 3 });

    expect(await dao.countRepliesByParent('comment-1')).toBe(3);

    const { input } = mockSend.mock.calls[0][0];
    expect(input.IndexName).toBe('GSI1');
    expect(input.KeyConditionExpression).toBe('GSI1PK = :parent');
    expect(input.ExpressionAttributeValues[':parent']).toBe('COMMENT#PARENT#comment-1');
    expect(input.Select).toBe('COUNT');
    expect(input.Limit).toBe(REPLY_COUNT_CAP);
  });

  it('never pages past the cap', async () => {
    // Every other COUNT helper in this codebase loops on LastEvaluatedKey. This one must not:
    // a comment with ten thousand replies has to cost the same as one with three.
    mockSend.mockResolvedValue({ Count: REPLY_COUNT_CAP, LastEvaluatedKey: { PK: 'COMMENT#x' } });

    expect(await dao.countRepliesByParent('comment-1')).toBe(REPLY_COUNT_CAP);
    expect(mockSend).toHaveBeenCalledTimes(1);
  });

  it('returns zero when the partition is empty', async () => {
    mockSend.mockResolvedValueOnce({});

    expect(await dao.countRepliesByParent('comment-1')).toBe(0);
  });

  it('caps at eleven so the UI can say "more than ten" without a full scan', () => {
    expect(REPLY_COUNT_CAP).toBe(11);
  });
});
