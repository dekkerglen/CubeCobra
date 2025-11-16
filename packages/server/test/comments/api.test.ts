import { isCommentType, isNotifiableCommentType } from '@utils/datatypes/Comment';
import { NoticeType } from '@utils/datatypes/Notice';
import * as util from 'serverutils/render';
import * as routeUtil from 'serverutils/util';

import Notice from '../../src/dynamo/models/notice';
import DynamoUser from '../../src/dynamo/models/user';
import {
  addCommentHandler,
  editCommentHandler,
  getCommentsHandler,
  getHandler,
  reportHandler,
} from '../../src/router/routes/comment';
import { createUser } from '../test-utils/data';
import { expectRegisteredRoutes } from '../test-utils/route';
import { call } from '../test-utils/transport';

// Mock the commentDao from dynamo/daos
jest.mock('../../src/dynamo/daos', () => ({
  commentDao: {
    getById: jest.fn(),
    queryByParent: jest.fn(),
    put: jest.fn(),
    createComment: jest.fn(),
  },
}));

// Import the mocked commentDao
import { commentDao } from '../../src/dynamo/daos';

jest.mock('../../src/dynamo/models/user', () => ({
  getByUsername: jest.fn(),
}));

jest.mock('@utils/datatypes/Comment', () => ({
  ...jest.requireActual('@utils/datatypes/Comment'),
  isCommentType: jest.fn() as unknown as (value: unknown) => value is ReturnType<typeof isCommentType>,
  isNotifiableCommentType: jest.fn() as unknown as (
    value: unknown,
  ) => value is ReturnType<typeof isNotifiableCommentType>,
}));

jest.mock('../../src/dynamo/models/notice', () => {
  return {
    ...jest.requireActual('../../src/dynamo/models/notice'),
    put: jest.fn(),
  };
});

jest.mock('serverutils/render', () => ({
  handleRouteError: jest.fn(),
  redirect: jest.fn(),
  render: jest.fn(),
}));

jest.mock('serverutils/util', () => ({
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

    (commentDao.getById as jest.Mock).mockResolvedValue(mockComment);

    await call(getHandler)
      .withFlash(flashMock)
      .withRequest({ params: { id: mockComment.id } })
      .send();

    expect(commentDao.getById).toHaveBeenCalledWith(mockComment.id);
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
    (commentDao.getById as jest.Mock).mockResolvedValue(undefined);

    await call(getHandler)
      .withFlash(flashMock)
      .withRequest({ params: { id: '12345' } })
      .send();

    expect(commentDao.getById).toHaveBeenCalledWith('12345');
    expect(util.render).not.toHaveBeenCalled();
    expect(flashMock).toHaveBeenCalled();
    expect(util.redirect).toHaveBeenCalledWith(expect.anything(), expect.anything(), '/404');
  });

  it('handles errors gracefully', async () => {
    const error = new Error('Something went wrong');
    (commentDao.getById as jest.Mock).mockRejectedValue(error);
    (util.handleRouteError as jest.Mock).mockImplementation(() => {});

    await call(getHandler)
      .withFlash(flashMock)
      .withRequest({ params: { id: '12345' } })
      .send();

    expect(commentDao.getById).toHaveBeenCalledWith('12345');
    expect(util.handleRouteError).toHaveBeenCalledWith(expect.anything(), expect.anything(), error, '/404');
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
        type: NoticeType.COMMENT_REPORT,
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

    expect(util.handleRouteError).toHaveBeenCalledWith(expect.anything(), expect.anything(), error, '/404');
  });
});

describe('Get Comments', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should return comments successfully', async () => {
    const mockComments = {
      items: [{ id: '12345', body: 'Test comment' }],
      lastKey: 'nextLastKey',
    };

    (commentDao.queryByParent as jest.Mock).mockResolvedValue(mockComments);

    const res = await call(getCommentsHandler)
      .withRequest({
        body: {
          parent: 'parent123',
          lastKey: 'lastKey123',
        },
      })
      .send();

    expect(commentDao.queryByParent).toHaveBeenCalledWith('parent123', 'lastKey123');
    expect(res.status).toEqual(200);
    expect(res.body).toEqual({
      success: 'true',
      comments: mockComments.items,
      lastKey: mockComments.lastKey,
    });
  });

  it('should handle errors gracefully', async () => {
    const mockError = new Error('Something went wrong');
    (commentDao.queryByParent as jest.Mock).mockRejectedValue(mockError);

    await call(getCommentsHandler)
      .withRequest({
        body: {
          parent: 'parent123',
          lastKey: 'lastKey123',
        },
      })
      .send();

    expect(commentDao.queryByParent).toHaveBeenCalledWith('parent123', 'lastKey123');
    expect(util.handleRouteError).toHaveBeenCalledWith(expect.anything(), expect.anything(), mockError, '/404');
  });
});

describe('Edit Comment', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should return 404 if the comment does not exist', async () => {
    (commentDao.getById as jest.Mock).mockResolvedValue(null);

    const res = await call(editCommentHandler)
      .withRequest({
        body: {
          comment: {
            id: '123',
            content: 'This is the updated comment content.',
            remove: false,
          },
        },
      })
      .send();

    expect(commentDao.getById).toHaveBeenCalledWith('123');
    expect(res.status).toEqual(404);
    expect(res.body).toEqual({
      success: 'false',
      message: 'Comment not found.',
    });
  });

  it('should return 404 if the user is not the owner of the comment', async () => {
    (commentDao.getById as jest.Mock).mockResolvedValue({
      id: '123',
      owner: createUser({ id: 'commenter' }),
    });

    const res = await call(editCommentHandler)
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
      .send();

    expect(commentDao.getById).toHaveBeenCalledWith('123');
    expect(res.status).toEqual(404);
    expect(res.body).toEqual({
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

    (commentDao.getById as jest.Mock).mockResolvedValue(comment);
    (commentDao.put as jest.Mock).mockResolvedValue(undefined);

    const res = await call(editCommentHandler)
      .as(commenter)
      .withRequest({
        body: { comment: { ...comment, remove: true } },
      })
      .send();

    expect(res.status).toEqual(200);
    expect(res.body).toEqual({ success: 'true' });
    expect(commentDao.put).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'comment-to-delete',
        owner: expect.objectContaining({ id: '404' }),
      }),
    );
  });

  it('should update the comment successfully', async () => {
    const commenter = createUser({ id: 'commenter' });

    (commentDao.getById as jest.Mock).mockResolvedValue({
      id: '123',
      body: 'Original content',
      owner: commenter,
    });
    (commentDao.put as jest.Mock).mockResolvedValue(undefined);

    const res = await call(editCommentHandler)
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
      .send();

    expect(commentDao.getById).toHaveBeenCalledWith('123');
    expect(commentDao.put).toHaveBeenCalledWith(
      expect.objectContaining({
        id: '123',
        body: 'This is the updated comment content.',
        owner: commenter,
      }),
    );
    expect(res.status).toEqual(200);
    expect(res.body).toEqual({ success: 'true' });
  });
});

describe('Add Comment', () => {
  const mockCreatedComment = {
    id: 'comment-id',
    body: 'This is a new comment',
    parent: 'parent-id',
    type: 'comment',
    owner: createUser(),
    date: Date.now(),
  };

  beforeEach(() => {
    (commentDao.createComment as jest.Mock).mockResolvedValue(mockCreatedComment);
    (routeUtil.addNotification as jest.Mock).mockResolvedValue(undefined);

    (commentDao.getById as jest.Mock).mockResolvedValue({
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

    const res = await call(addCommentHandler)
      .as(createUser())
      .withRequest({
        body: {
          body: 'This is a new comment',
          parent: 'parent-id',
          type: 'invalid',
        },
      })
      .send();

    expect(res.status).toEqual(400);
    expect(res.body).toEqual({
      success: 'false',
      message: 'Invalid comment parent type.',
    });
  });

  it('should create a comment and return the comment data', async () => {
    const commenter = createUser();

    (isCommentType as jest.MockedFunction<typeof isCommentType>).mockReturnValue(true);
    (isNotifiableCommentType as jest.MockedFunction<typeof isNotifiableCommentType>).mockReturnValue(true);

    const res = await call(addCommentHandler)
      .as(commenter)
      .withRequest({
        body: {
          body: 'This is a new comment',
          parent: 'parent-id',
          type: 'comment',
        },
      })
      .send();

    expect(commentDao.createComment).toHaveBeenCalledWith(
      expect.objectContaining({
        owner: commenter,
        body: 'This is a new comment',
        parent: 'parent-id',
        type: 'comment',
      }),
    );

    expect(res.status).toEqual(200);
    expect(res.body).toEqual({
      success: 'true',
      comment: expect.objectContaining({
        owner: commenter,
        id: 'comment-id',
        body: 'This is a new comment',
        parent: 'parent-id',
        type: 'comment',
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
          mentions: 'mentionuser1;mentionuser2',
        },
      })
      .send();

    expect(routeUtil.addNotification).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'another-user' }),
      commenter,
      '/comment/comment-id',
      `${commenter.username} left a comment in response to your comment.`,
    );

    expect(routeUtil.addNotification).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ username: 'mentionuser1' }),
      commenter,
      '/comment/comment-id',
      `${commenter.username} mentioned you in their comment`,
    );

    expect(routeUtil.addNotification).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({ username: 'mentionuser2' }),
      commenter,
      '/comment/comment-id',
      `${commenter.username} mentioned you in their comment`,
    );
  });

  it('no mentioned users', async () => {
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
          mentions: '',
        },
      })
      .send();

    expect(routeUtil.addNotification).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'another-user' }),
      commenter,
      '/comment/comment-id',
      `${commenter.username} left a comment in response to your comment.`,
    );

    expect(routeUtil.addNotification).toHaveBeenCalledTimes(1);
  });
});

describe('Comment Routes', () => {
  it('should register its own routes', async () => {
    expectRegisteredRoutes([
      {
        path: '/comment/:id',
        method: 'get',
      },
      {
        path: '/comment/report',
        method: 'post',
      },
      {
        path: '/comment/getcomments',
        method: 'post',
      },
      {
        path: '/comment/edit',
        method: 'post',
      },
      {
        path: '/comment/addcomment',
        method: 'post',
      },
    ]);
  });
});
