import { isCommentType, isNotifiableCommentType } from '../../src/datatypes/Comment';
import Comment from '../../src/dynamo/models/comment';
import Notice from '../../src/dynamo/models/notice';
import * as DynamoUser from '../../src/dynamo/models/user';
import {
  addCommentHandler,
  editCommentHandler,
  getCommentsHandler,
  getHandler,
  reportHandler,
} from '../../src/router/routes/comment';
import { Response } from '../../src/types/express';
import * as util from '../../src/util/render';
import * as routeUtil from '../../src/util/util';
import { createUser } from '../test-utils/data';
import { call } from '../test-utils/transport';

jest.mock('../../src/dynamo/models/comment', () => ({
  ...jest.requireActual('../../src/dynamo/models/comment'),
  getById: jest.fn(),
  queryByParentAndType: jest.fn(),
  put: jest.fn(),
}));

jest.mock('../../src/dynamo/models/user', () => ({
  getByUsername: jest.fn(),
}));

jest.mock('../../src/datatypes/Comment', () => ({
  ...jest.requireActual('../../src/datatypes/Comment'),
  isCommentType: jest.fn() as unknown as (value: unknown) => value is ReturnType<typeof isCommentType>,
  isNotifiableCommentType: jest.fn() as unknown as (
    value: unknown,
  ) => value is ReturnType<typeof isNotifiableCommentType>,
}));

jest.mock('../../src/dynamo/models/user', () => ({
  getByUsername: jest.fn(),
}));

jest.mock('../../src/dynamo/models/notice', () => {
  return {
    ...jest.requireActual('../../src/dynamo/models/notice'),
    put: jest.fn(),
  };
});

jest.mock('../../src/util/render', () => ({
  redirect: jest.fn(),
  render: jest.fn(),
}));

jest.mock('../../src/util/util', () => ({
  handleRouteError: jest.fn(),
  addNotification: jest.fn(),
}));

describe('Get Comment', () => {
  const flashMock = jest.fn();

  afterEach(async () => {
    jest.clearAllMocks();
  });

  it('fetches an existing comment and renders', async () => {
    const mockComment = {
      id: '12345',
      body: 'Hello World',
    };

    (Comment.getById as jest.Mock).mockResolvedValue(mockComment);

    await call(getHandler)
      .withFlash(flashMock)
      .withRequest({ params: { id: mockComment.id } })
      .send();

    expect(Comment.getById).toHaveBeenCalledWith(mockComment.id);
    expect(util.render).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      'CommentPage',
      { comment: mockComment },
      { title: 'Comment' },
    );

    expect(flashMock).not.toHaveBeenCalled();
    expect(util.redirect).not.toHaveBeenCalled();
  });

  it('alerts when comment is not found', async () => {
    (Comment.getById as jest.Mock).mockResolvedValue(undefined);

    await call(getHandler)
      .withFlash(flashMock)
      .withRequest({ params: { id: '12345' } })
      .send();

    expect(Comment.getById).toHaveBeenCalledWith('12345');
    expect(util.render).not.toHaveBeenCalled();
    expect(flashMock).toHaveBeenCalled();
    expect(util.redirect).toHaveBeenCalledWith(expect.anything(), expect.anything(), '/404');
  });

  it('handles errors gracefully', async () => {
    const error = new Error('Something went wrong');
    (Comment.getById as jest.Mock).mockRejectedValue(error);
    (routeUtil.handleRouteError as jest.Mock).mockImplementation(() => {});

    await call(getHandler)
      .withFlash(flashMock)
      .withRequest({ params: { id: '12345' } })
      .send();

    expect(Comment.getById).toHaveBeenCalledWith('12345');
    expect(routeUtil.handleRouteError).toHaveBeenCalledWith(expect.anything(), expect.anything(), error, '/404');
    expect(flashMock).not.toHaveBeenCalled();
    expect(util.redirect).not.toHaveBeenCalled();
    expect(util.render).not.toHaveBeenCalled();
  });
});

describe('Report Comment', () => {
  const flashMock = jest.fn();

  it('handles a report', async () => {
    const reporter = createUser({ username: 'reporter' });
    (Notice.put as jest.Mock).mockResolvedValue(undefined);

    await call(reportHandler)
      .as(reporter)
      .withFlash(flashMock)
      .withRequest({
        body: {
          commentid: '12345',
          info: 'Report info',
          reason: 'Report reason',
        },
      })
      .send();

    expect(Notice.put).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: '12345',
        body: 'Report reason\n\nReport info',
        user: reporter.id,
        type: Notice.TYPE.COMMENT_REPORT,
      }),
    );

    expect(flashMock).toHaveBeenCalledWith('success', expect.anything());
  });

  it('should handle errors gracefully', async () => {
    const error = new Error('Something went wrong');
    (Notice.put as jest.Mock).mockRejectedValue(error);

    await call(reportHandler)
      .withFlash(flashMock)
      .withRequest({
        body: {
          commentid: '12345',
          info: 'Report info',
          reason: 'Report reason',
        },
      })
      .send();

    expect(routeUtil.handleRouteError).toHaveBeenCalledWith(expect.anything(), expect.anything(), error, '/404');
  });
});

describe('Get Comments', () => {
  let res: Partial<Response>;

  beforeEach(() => {
    res = {
      status: jest.fn().mockReturnThis(),
      send: jest.fn(),
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should return comments successfully', async () => {
    const mockComments = {
      items: [{ id: '12345', body: 'Test comment' }],
      lastKey: 'nextLastKey',
    };

    (Comment.queryByParentAndType as jest.Mock).mockResolvedValue(mockComments);

    await call(getCommentsHandler)
      .withRequest({
        body: {
          parent: 'parent123',
          lastKey: 'lastKey123',
        },
      })
      .withResponse(res)
      .send();

    expect(Comment.queryByParentAndType).toHaveBeenCalledWith('parent123', 'lastKey123');
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.send).toHaveBeenCalledWith({
      success: 'true',
      comments: mockComments.items,
      lastKey: mockComments.lastKey,
    });
  });

  it('should handle errors gracefully', async () => {
    const mockError = new Error('Something went wrong');
    (Comment.queryByParentAndType as jest.Mock).mockRejectedValue(mockError);

    await call(getCommentsHandler)
      .withRequest({
        body: {
          parent: 'parent123',
          lastKey: 'lastKey123',
        },
      })
      .withResponse(res)
      .send();

    expect(Comment.queryByParentAndType).toHaveBeenCalledWith('parent123', 'lastKey123');
    expect(routeUtil.handleRouteError).toHaveBeenCalledWith(expect.anything(), expect.anything(), mockError, '/404');
    expect(res.status).not.toHaveBeenCalledWith(200);
  });
});

describe('Edit Comment', () => {
  let res: Partial<Response>;

  beforeEach(() => {
    res = {
      status: jest.fn().mockReturnThis(),
      send: jest.fn(),
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should return 404 if the comment does not exist', async () => {
    (Comment.getById as jest.Mock).mockResolvedValue(null);

    await call(editCommentHandler)
      .withRequest({
        body: {
          comment: {
            id: '123',
            content: 'This is the updated comment content.',
            remove: false,
          },
        },
      })
      .withResponse(res)
      .send();

    expect(Comment.getById).toHaveBeenCalledWith('123');
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.send).toHaveBeenCalledWith({
      success: 'false',
      message: 'Comment not found.',
    });
  });

  it('should return 404 if the user is not the owner of the comment', async () => {
    (Comment.getById as jest.Mock).mockResolvedValue({
      id: '123',
      owner: createUser({ id: 'commenter' }),
    });

    await call(editCommentHandler)
      .as(createUser({ id: 'editor', username: 'editor' }))
      .withRequest({
        body: {
          comment: {
            id: '123',
            content: 'This is a comment',
            remove: false,
          },
        },
      })
      .withResponse(res)
      .send();

    expect(Comment.getById).toHaveBeenCalledWith('123');
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.send).toHaveBeenCalledWith({
      success: 'false',
      message: 'Comment not found.',
    });
  });

  it('should delete a comment successfully', async () => {
    const commenter = createUser({ id: 'commenter' });
    const comment = {
      id: 'comment-to-delete',
      content: 'My comment to delete!',
      owner: commenter,
    };

    (Comment.getById as jest.Mock).mockResolvedValue(comment);
    (Comment.put as jest.Mock).mockResolvedValue(undefined);

    await call(editCommentHandler)
      .as(commenter)
      .withRequest({
        body: { comment: { ...comment, remove: true } },
      })
      .withResponse(res)
      .send();

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.send).toHaveBeenCalledWith({ success: 'true' });
    expect(Comment.put).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'comment-to-delete',
        owner: expect.objectContaining({ id: '404' }),
      }),
    );
  });

  it('should update the comment successfully', async () => {
    const commenter = createUser({ id: 'commenter' });

    (Comment.getById as jest.Mock).mockResolvedValue({
      id: '123',
      body: 'Original content',
      owner: commenter,
    });
    (Comment.put as jest.Mock).mockResolvedValue(undefined);

    await call(editCommentHandler)
      .as(commenter)
      .withRequest({
        body: {
          comment: {
            id: '123',
            content: 'This is the updated comment content.',
            remove: false,
          },
        },
      })
      .withResponse(res)
      .send();

    expect(Comment.getById).toHaveBeenCalledWith('123');
    expect(Comment.put).toHaveBeenCalledWith(
      expect.objectContaining({
        id: '123',
        body: 'This is the updated comment content.',
        owner: commenter,
      }),
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.send).toHaveBeenCalledWith({ success: 'true' });
  });
});

describe('Add Comment', () => {
  let res: Partial<Response>;

  beforeEach(() => {
    res = {
      status: jest.fn().mockReturnThis(),
      send: jest.fn(),
    };

    (Comment.put as jest.Mock).mockResolvedValue('comment-id');
    (routeUtil.addNotification as jest.Mock).mockResolvedValue(undefined);

    (Comment.getById as jest.Mock).mockResolvedValue({
      id: '12345',
      body: 'Hello World',
      owner: { id: 'another-user' },
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should return 400 for an invalid comment type', async () => {
    (isCommentType as jest.MockedFunction<typeof isCommentType>).mockReturnValue(false);

    await call(addCommentHandler)
      .as(createUser())
      .withRequest({
        body: {
          body: 'This is a new comment',
          parent: 'parent-id',
          type: 'invalid',
        },
      })
      .withResponse(res)
      .send();

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.send).toHaveBeenCalledWith({
      success: 'false',
      message: 'Invalid comment parent type.',
    });
  });

  it('should create a comment and return the comment data', async () => {
    const commenter = createUser();

    (isCommentType as jest.MockedFunction<typeof isCommentType>).mockReturnValue(true);
    (isNotifiableCommentType as jest.MockedFunction<typeof isNotifiableCommentType>).mockReturnValue(true);

    await call(addCommentHandler)
      .as(commenter)
      .withRequest({
        body: {
          body: 'This is a new comment',
          parent: 'parent-id',
          type: 'comment',
        },
      })
      .withResponse(res)
      .send();

    expect(Comment.put).toHaveBeenCalledWith(
      expect.objectContaining({
        owner: commenter.id,
        body: 'This is a new comment',
        parent: 'parent-id',
        type: 'comment',
      }),
    );

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.send).toHaveBeenCalledWith({
      success: 'true',
      comment: expect.objectContaining({
        owner: commenter,
        id: 'comment-id',
      }),
    });
  });

  it('should notify the owner of the parent resource if it is a notifiable comment type', async () => {
    const commenter = createUser();

    (routeUtil.addNotification as jest.Mock).mockResolvedValue(undefined);
    (isCommentType as jest.MockedFunction<typeof isCommentType>).mockReturnValue(true);
    (isNotifiableCommentType as jest.MockedFunction<typeof isNotifiableCommentType>).mockReturnValue(true);

    await call(addCommentHandler)
      .as(commenter)
      .withRequest({
        body: {
          body: 'This is a new comment',
          parent: 'parent-id',
          type: 'comment',
        },
      })
      .withResponse(res)
      .send();

    expect(routeUtil.addNotification).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'another-user' }),
      commenter,
      '/comment/comment-id',
      `${commenter.username} left a comment in response to your comment.`,
    );
  });

  it('should notify mentioned users', async () => {
    const commenter = createUser();

    (routeUtil.addNotification as jest.Mock).mockResolvedValue(undefined);
    (isCommentType as jest.MockedFunction<typeof isCommentType>).mockReturnValue(true);
    (isNotifiableCommentType as jest.MockedFunction<typeof isNotifiableCommentType>).mockReturnValue(true);
    (DynamoUser.getByUsername as jest.Mock).mockImplementation((username: string) =>
      Promise.resolve({ id: `id-${username}`, username: username }),
    );

    await call(addCommentHandler)
      .as(commenter)
      .withRequest({
        body: {
          body: 'This is a new comment',
          parent: 'parent-id',
          type: 'comment',
          mentions: ['mention-user-1', 'mention-user-2'],
        },
      })
      .withResponse(res)
      .send();

    expect(routeUtil.addNotification).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'another-user' }),
      commenter,
      '/comment/comment-id',
      `${commenter.username} left a comment in response to your comment.`,
    );

    expect(routeUtil.addNotification).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ username: 'mention-user-1' }),
      commenter,
      '/comment/comment-id',
      `${commenter.username} mentioned you in their comment`,
    );

    expect(routeUtil.addNotification).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({ username: 'mention-user-2' }),
      commenter,
      '/comment/comment-id',
      `${commenter.username} mentioned you in their comment`,
    );
  });
});
