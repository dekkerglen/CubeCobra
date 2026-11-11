import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

import { BlogDynamoDao } from '../../src/dynamo/dao/BlogDynamoDao';
import { ChangelogDynamoDao } from '../../src/dynamo/dao/ChangelogDynamoDao';
import { CubeDynamoDao } from '../../src/dynamo/dao/CubeDynamoDao';
import { FeedDynamoDao } from '../../src/dynamo/dao/FeedDynamoDao';
import { UserDynamoDao } from '../../src/dynamo/dao/UserDynamoDao';

// The dashboard feed merges two date-descending streams, so both must accept an upper date
// bound. Queries here return no items, which short-circuits hydration before it touches the
// stub dependencies.
describe('date-bounded stream queries', () => {
  const mockSend = jest.fn();
  const client = { send: mockSend } as unknown as DynamoDBDocumentClient;

  const blogDao = new BlogDynamoDao(
    client,
    {} as ChangelogDynamoDao,
    {} as CubeDynamoDao,
    {} as UserDynamoDao,
    'test-table',
  );
  const feedDao = new FeedDynamoDao(client, blogDao, 'test-table');

  beforeEach(() => {
    mockSend.mockReset();
  });

  it('bounds the feed query by date when before is supplied', async () => {
    mockSend.mockResolvedValueOnce({ Items: [] });

    await feedDao.getByTo('user-1', undefined, 50, 1700000000000);

    const { input } = mockSend.mock.calls[0][0];
    expect(input.KeyConditionExpression).toBe('GSI1PK = :to AND GSI1SK <= :before');
    expect(input.ExpressionAttributeValues[':before']).toBe('DATE#1700000000000');
  });

  it('leaves the feed query unbounded when before is omitted', async () => {
    mockSend.mockResolvedValueOnce({ Items: [] });

    await feedDao.getByTo('user-1');

    expect(mockSend.mock.calls[0][0].input.KeyConditionExpression).toBe('GSI1PK = :to');
    expect(mockSend.mock.calls[0][0].input.ExpressionAttributeValues).not.toHaveProperty(':before');
  });

  it('bounds the blog-by-cube query by date when before is supplied', async () => {
    mockSend.mockResolvedValueOnce({ Items: [] });

    await blogDao.queryByCube('DEVBLOG', undefined, 50, 1700000000000);

    const { input } = mockSend.mock.calls[0][0];
    expect(input.KeyConditionExpression).toBe('GSI1PK = :cube AND GSI1SK <= :before');
    expect(input.ExpressionAttributeValues[':before']).toBe('DATE#1700000000000');
  });

  it('leaves the blog-by-cube query unbounded when before is omitted', async () => {
    mockSend.mockResolvedValueOnce({ Items: [] });

    await blogDao.queryByCube('DEVBLOG');

    expect(mockSend.mock.calls[0][0].input.KeyConditionExpression).toBe('GSI1PK = :cube');
    expect(mockSend.mock.calls[0][0].input.ExpressionAttributeValues).not.toHaveProperty(':before');
  });

  it('keeps the existing page-size defaults', async () => {
    mockSend.mockResolvedValue({ Items: [] });

    await feedDao.getByTo('user-1');
    await blogDao.queryByCube('DEVBLOG');

    expect(mockSend.mock.calls[0][0].input.Limit).toBe(50);
    expect(mockSend.mock.calls[1][0].input.Limit).toBe(36);
  });
});
