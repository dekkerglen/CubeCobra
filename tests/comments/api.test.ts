import {
  addCommentHandler,
  editCommentHandler,
  getCommentsHandler,
  getHandler,
  reportHandler,
} from 'src/router/routes/comment';
import { Request, Response } from 'src/types/express';

import { isCommentType, isNotifiableCommentType } from '../../src/datatypes/Comment';
import Comment from '../../src/dynamo/models/comment';
import Notice from '../../src/dynamo/models/notice';
import * as DynamoUser from '../../src/dynamo/models/user';
import * as util from '../../src/util/render';
import * as routeUtil from '../../src/util/util';

jest.mock('../../src/dynamo/models/comment', () => ({
  getById: jest.fn(),
  queryByParentAndType: jest.fn(),
  put: jest.fn(),
}));

jest.mock('../../src/dynamo/models/user', () => ({
  getByUsername: jest.fn(),
}));

jest.mock('../../src/datatypes/Comment', () => {
  return {
    ...jest.requireActual('../../src/datatypes/Comment'),
    isCommentType: jest.fn() as unknown as (value: unknown) => value is ReturnType<typeof isCommentType>,
    isNotifiableCommentType: jest.fn() as unknown as (
      value: unknown,
    ) => value is ReturnType<typeof isNotifiableCommentType>,
  };
});

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
  let req: Partial<Request>;
  const flashMock = jest.fn();

  beforeEach(async () => {
    req = {
      params: { id: '12345' },
      flash: flashMock,
    };
  });

  afterEach(async () => {
    jest.clearAllMocks();
  });

  it('fetches an existing comment and renders', async () => {
    const mockComment = {
      id: '12345',
      body: 'Hello World',
    };

    (Comment.getById as jest.Mock).mockResolvedValue(mockComment);

    await getHandler(req as Request, {} as Response);

    expect(Comment.getById).toHaveBeenCalledWith('12345');
    expect(util.render).toHaveBeenCalledWith(req, {}, 'CommentPage', { comment: mockComment }, { title: 'Comment' });

    expect(flashMock).not.toHaveBeenCalled();
    expect(util.redirect).not.toHaveBeenCalled();
  });

  it('alerts when comment is not found', async () => {
    (Comment.getById as jest.Mock).mockResolvedValue(undefined);

    await getHandler(req as Request, {} as Response);

    expect(Comment.getById).toHaveBeenCalledWith('12345');
    expect(util.render).not.toHaveBeenCalled();
    expect(flashMock).toHaveBeenCalled();
    expect(util.redirect).toHaveBeenCalledWith(req, {}, '/404');
  });

  it('handles errors gracefully', async () => {
    const error = new Error('Something went wrong');
    (Comment.getById as jest.Mock).mockRejectedValue(error);
    (routeUtil.handleRouteError as jest.Mock).mockImplementation(() => {});

    await getHandler(req as Request, {} as Response);
    expect(Comment.getById).toHaveBeenCalledWith('12345');
    expect(routeUtil.handleRouteError).toHaveBeenCalledWith(req, {}, error, '/404');
    expect(flashMock).not.toHaveBeenCalled();
    expect(util.redirect).not.toHaveBeenCalled();
    expect(util.render).not.toHaveBeenCalled();
  });
});

describe('Report Comment', () => {
  const flashMock = jest.fn();
  let req: Partial<Request>;

  beforeEach(async () => {
    req = {
      flash: flashMock,
      body: {
        commentid: '12345',
        info: 'Report info',
        reason: 'Report reason',
      },
      user: { id: '123', username: 'reporter' },
    };
  });

  it('handles a report', async () => {
    (Notice.put as jest.Mock).mockResolvedValue(undefined);

    await reportHandler(req as Request, {} as Response);

    expect(Notice.put).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: '12345',
        body: 'Report reason\n\nReport info',
        user: '123',
        type: Notice.TYPE.COMMENT_REPORT,
      }),
    );

    expect(flashMock).toHaveBeenCalledWith('success', expect.anything());
  });
});

describe('Get Comments', () => {
  let req: Partial<Request>;
  let res: Partial<Response>;

  beforeEach(() => {
    req = {
      body: {
        parent: 'parent123',
        lastKey: 'lastKey123',
      },
    };

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

    await getCommentsHandler(req as Request, res as Response);

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

    await getCommentsHandler(req as Request, res as Response);

    expect(Comment.queryByParentAndType).toHaveBeenCalledWith('parent123', 'lastKey123');
    expect(routeUtil.handleRouteError).toHaveBeenCalledWith(req, res, mockError, '/404');
    expect(res.status).not.toHaveBeenCalledWith(200);
  });
});

describe('Edit Comment', () => {
  let req: Partial<Request>;
  let res: Partial<Response>;

  const mockComment = {
    id: '123',
    body: 'Original content',
    owner: { id: '123' },
  };

  beforeEach(() => {
    req = {
      body: {
        comment: {
          id: '123',
          content: 'This is the updated comment content.',
          remove: false,
        },
      },
      user: { id: '123', username: 'commenter' },
    };

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

    await editCommentHandler(req as Request, res as Response);

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
      owner: { id: 'another-user' },
    });

    await editCommentHandler(req as Request, res as Response);

    expect(Comment.getById).toHaveBeenCalledWith('123');
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.send).toHaveBeenCalledWith({
      success: 'false',
      message: 'Comment not found.',
    });
  });

  it('should update the comment successfully', async () => {
    (Comment.getById as jest.Mock).mockResolvedValue(mockComment);
    (Comment.put as jest.Mock).mockResolvedValue(undefined);

    await editCommentHandler(req as Request, res as Response);

    expect(Comment.getById).toHaveBeenCalledWith('123');
    expect(Comment.put).toHaveBeenCalledWith(
      expect.objectContaining({
        id: '123',
        body: 'This is the updated comment content.',
        owner: { id: '123' },
      }),
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.send).toHaveBeenCalledWith({ success: 'true' });

    // Edit to delete
    req.body.comment.remove = true;
    await editCommentHandler(req as Request, res as Response);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.send).toHaveBeenCalledWith({ success: 'true' });
    expect(Comment.put).toHaveBeenCalledWith(
      expect.objectContaining({
        id: '123',
        body: 'This is the updated comment content.',
      }),
    );
  });
});

describe('Add Comment', () => {
  let req: Partial<Request>;
  let res: Partial<Response>;

  beforeEach(() => {
    req = {
      body: {
        body: 'This is a new comment',
        mentions: ['mentionUser'],
        parent: 'parent-id',
        type: 'comment',
      },
      user: { id: 'user-id', username: 'commenter', imageName: 'test-image' },
    };

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

    req.body.type = 'invalid';
    await addCommentHandler(req as Request, res as Response);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.send).toHaveBeenCalledWith({
      success: 'false',
      message: 'Invalid comment parent type.',
    });
  });

  it('should create a comment and return the comment data', async () => {
    (isCommentType as jest.MockedFunction<typeof isCommentType>).mockReturnValue(true);
    (isNotifiableCommentType as jest.MockedFunction<typeof isNotifiableCommentType>).mockReturnValue(true);

    await addCommentHandler(req as Request, res as Response);

    expect(Comment.put).toHaveBeenCalledWith(
      expect.objectContaining({
        owner: 'user-id',
        body: 'This is a new comment',
        parent: 'parent-id',
        type: 'comment',
      }),
    );

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.send).toHaveBeenCalledWith({
      success: 'true',
      comment: expect.objectContaining({
        owner: req.user,
        id: 'comment-id',
      }),
    });
  });

  it('should notify the owner of the parent resource if it is a notifiable comment type', async () => {
    (routeUtil.addNotification as jest.Mock).mockResolvedValue(undefined);
    (isCommentType as jest.MockedFunction<typeof isCommentType>).mockReturnValue(true);
    (isNotifiableCommentType as jest.MockedFunction<typeof isNotifiableCommentType>).mockReturnValue(true);

    await addCommentHandler(req as Request, res as Response);

    expect(routeUtil.addNotification).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'another-user' }),
      req.user,
      '/comment/comment-id',
      `${req.user?.username} left a comment in response to your comment.`,
    );
  });

  it('should notify mentioned users', async () => {
    (routeUtil.addNotification as jest.Mock).mockResolvedValue(undefined);
    (isCommentType as jest.MockedFunction<typeof isCommentType>).mockReturnValue(true);
    (isNotifiableCommentType as jest.MockedFunction<typeof isNotifiableCommentType>).mockReturnValue(true);
    (DynamoUser.getByUsername as jest.Mock).mockImplementation((username: string) =>
      Promise.resolve({ id: `id-${username}`, username: username }),
    );

    req.body.mentions = ['mention-user-1', 'mention-user-2'];

    await addCommentHandler(req as Request, res as Response);

    expect(routeUtil.addNotification).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'another-user' }),
      req.user,
      '/comment/comment-id',
      `${req.user?.username} left a comment in response to your comment.`,
    );

    expect(routeUtil.addNotification).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ username: 'mention-user-1' }),
      req.user,
      '/comment/comment-id',
      `${req.user?.username} mentioned you in their comment`,
    );

    expect(routeUtil.addNotification).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({ username: 'mention-user-2' }),
      req.user,
      '/comment/comment-id',
      `${req.user?.username} mentioned you in their comment`,
    );
  });
});
