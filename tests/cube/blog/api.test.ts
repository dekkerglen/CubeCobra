import { FeedTypes } from '../../../src/datatypes/Feed';
import Blog from '../../../src/dynamo/models/blog';
import Cube from '../../../src/dynamo/models/cube';
import Feed from '../../../src/dynamo/models/feed';
import {
  createBlogHandler,
  deleteBlogHandler,
  getBlogPostHandler,
  getBlogPostsForCubeHandler,
  getMoreBlogPostsForCubeHandler,
} from '../../../src/router/routes/cube/blog';
import { Response } from '../../../src/types/express';
import * as util from '../../../src/util/render';
import { createBlogPost, createCube, createUser } from '../../test-utils/data';
import { expectRegisteredRoutes } from '../../test-utils/route';
import { call } from '../../test-utils/transport';

jest.mock('../../../src/util/util', () => ({
  ...jest.requireActual('../../../src/util/util'),
  addNotification: jest.fn(),
}));

jest.mock('../../../src/util/render', () => ({
  ...jest.requireActual('../../../src/util/render'),
  handleRouteError: jest.fn(),
  redirect: jest.fn(),
  render: jest.fn(),
}));

jest.mock('../../../src/dynamo/models/cube', () => ({
  ...jest.requireActual('../../../src/dynamo/models/cube'),
  getById: jest.fn(),
}));

jest.mock('../../../src/dynamo/models/blog', () => ({
  ...jest.requireActual('../../../src/dynamo/models/blog'),
  put: jest.fn(),
  getById: jest.fn(),
  delete: jest.fn(),
  getByCube: jest.fn(),
  getUnhydrated: jest.fn(),
}));

jest.mock('../../../src/dynamo/models/feed', () => ({
  ...jest.requireActual('../../../src/dynamo/models/feed'),
  batchPut: jest.fn(),
}));

describe('Create Blog Post', () => {
  const flashMock = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should fail if the blog title is too short', async () => {
    await call(createBlogHandler).withFlash(flashMock).withParams({ id: 'cube-id' }).withBody({ title: 'Hi' }).send();

    expect(util.redirect).toHaveBeenCalledWith(expect.anything(), expect.anything(), '/cube/blog/cube-id');
    expect(flashMock).toHaveBeenCalledWith('danger', 'Blog title length must be between 5 and 100 characters.');
  });

  it('should fail if the blog title is too long', async () => {
    await call(createBlogHandler)
      .withFlash(flashMock)
      .withParams({ id: 'cube-id' })
      .withBody({ title: 'Very long blog title'.repeat(50) })
      .send();

    expect(util.redirect).toHaveBeenCalledWith(expect.anything(), expect.anything(), '/cube/blog/cube-id');
    expect(flashMock).toHaveBeenCalledWith('danger', 'Blog title length must be between 5 and 100 characters.');
  });

  it(`should fail if the cube isn't visible to the user`, async () => {
    const cube = createCube({ visibility: Cube.VISIBILITY.PRIVATE });
    (Cube.getById as jest.Mock).mockResolvedValue(cube);

    await call(createBlogHandler)
      .as(createUser({ id: 'random' }))
      .withFlash(flashMock)
      .withBody({ title: 'My blog title' })
      .withParams({ id: 'cube-id' })
      .send();

    expect(flashMock).toHaveBeenCalledWith('danger', 'Cube not found');
    expect(util.redirect).toHaveBeenCalledWith(expect.anything(), expect.anything(), '/cube/blog/404');
  });

  it('should fail if the cube is empty', async () => {
    const owner = createUser({ id: 'cube-owner' });
    const cube = createCube({ owner, cardCount: 0 });

    (Cube.getById as jest.Mock).mockResolvedValue(cube);

    await call(createBlogHandler)
      .as(owner)
      .withFlash(flashMock)
      .withBody({ title: 'My blog title' })
      .withParams({ id: 'cube-id' })
      .send();

    expect(flashMock).toHaveBeenCalledWith(
      'danger',
      'Cannot post a blog for an empty cube. Please add cards to the cube first.',
    );
    expect(util.redirect).toHaveBeenCalledWith(expect.anything(), expect.anything(), `/cube/blog/${cube.id}`);
  });

  it('should fail if the user is not the cube owner', async () => {
    const owner = createUser({ id: 'cube-owner' });
    const cube = createCube({ owner, cardCount: 100 });

    (Cube.getById as jest.Mock).mockResolvedValue(cube);

    await call(createBlogHandler)
      .as(createUser({ id: 'random-user' }))
      .withFlash(flashMock)
      .withBody({ title: 'My blog title' })
      .withParams({ id: cube.id })
      .send();

    expect(flashMock).toHaveBeenCalledWith('danger', 'Unable to post this blog post: Unauthorized.');
    expect(util.redirect).toHaveBeenCalledWith(expect.anything(), expect.anything(), `/cube/blog/${cube.id}`);
  });

  it('should should create a blog post', async () => {
    const owner = createUser({ following: ['user-1', 'user-2'] });
    const cube = createCube({ owner });

    (Cube.getById as jest.Mock).mockResolvedValue(cube);
    (Blog.put as jest.Mock).mockResolvedValueOnce('blog-id');
    (Feed.batchPut as jest.Mock).mockResolvedValue(undefined);

    await call(createBlogHandler)
      .as(owner)
      .withFlash(flashMock)
      .withBody({ title: 'My blog title', markdown: 'My blog content' })
      .withParams({ id: cube.id })
      .send();

    expect(Blog.put).toHaveBeenCalledWith(
      expect.objectContaining({
        body: 'My blog content',
        owner: owner.id,
        cube: cube.id,
        title: 'My blog title',
      }),
    );

    expect(Feed.batchPut).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'blog-id',
          to: 'user-1',
          type: FeedTypes.BLOG,
        }),
        expect.objectContaining({
          id: 'blog-id',
          to: 'user-2',
          type: FeedTypes.BLOG,
        }),
      ]),
    );

    expect(flashMock).toHaveBeenCalledWith('success', 'Blog post successful');
  });

  it('should handle errors gracefully', async () => {
    const owner = createUser();
    const error = new Error('something went wrong');
    (Cube.getById as jest.Mock).mockRejectedValue(error);

    await call(createBlogHandler)
      .as(owner)
      .withFlash(flashMock)
      .withBody({ title: 'My blog title', markdown: 'My blog content' })
      .withParams({ id: '12345' })
      .send();

    expect(util.handleRouteError).toHaveBeenCalledWith(expect.anything(), expect.anything(), error, '/cube/blog/12345');
  });
});

describe('Edit Blog Post', () => {
  const flashMock = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should 404 when trying to edit a missing blog post', async () => {
    (Blog.getUnhydrated as jest.Mock).mockResolvedValue(undefined);

    await call(createBlogHandler)
      .as(createUser())
      .withFlash(flashMock)
      .withBody({ title: 'My blog title', id: 'not-real' })
      .send();

    expect(flashMock).toHaveBeenCalledWith('danger', 'Blog not found.');
    expect(util.redirect).toHaveBeenCalledWith(expect.anything(), expect.anything(), '/404');
  });

  it('should update a blog post', async () => {
    const user = createUser();
    const blog = createBlogPost({ owner: user, title: 'My blog title' });

    (Blog.getUnhydrated as jest.Mock).mockResolvedValue({ ...blog, owner: user.id });
    (Blog.put as jest.Mock).mockResolvedValue(undefined);

    await call(createBlogHandler)
      .as(user)
      .withFlash(flashMock)
      .withParams({ id: 'cube-id' })
      .withBody({ title: blog.title, id: blog.id, markdown: 'My updated blog post' })
      .send();

    expect(Blog.put).toHaveBeenCalledWith(
      expect.objectContaining({
        body: 'My updated blog post',
        owner: user.id,
        title: blog.title,
      }),
    );

    expect(flashMock).toHaveBeenCalledWith('success', 'Blog update successful');
    expect(util.redirect).toHaveBeenCalledWith(expect.anything(), expect.anything(), '/cube/blog/cube-id');
  });
});

describe('Get Blog Post', () => {
  const flashMock = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it(`should return a 404 if blog post doesn't exist`, async () => {
    (Blog.getById as jest.Mock).mockResolvedValue(undefined);

    await call(getBlogPostHandler).withFlash(flashMock).withParams({ id: 'blog-id' }).send();

    expect(flashMock).toHaveBeenCalledWith('danger', 'Blog post not found');
  });

  it('should should 404 if the cube is private', async () => {
    const cube = createCube({
      id: 'cube-id',
      visibility: Cube.VISIBILITY.PRIVATE,
      owner: createUser({ id: 'cube-owner' }),
    });
    const blog = createBlogPost({ cube: cube.id });

    (Blog.getById as jest.Mock).mockResolvedValue(blog);
    (Cube.getById as jest.Mock).mockResolvedValue(cube);

    await call(getBlogPostHandler)
      .as(createUser({ id: 'visitor' }))
      .withFlash(flashMock)
      .withParams({ id: blog.id })
      .send();

    expect(flashMock).toHaveBeenCalledWith('danger', 'Blog post not found');
  });

  it('should render a blog post', async () => {
    const cube = createCube({ id: 'cube-id', owner: createUser({ id: 'cube-owner' }) });
    const blog = createBlogPost({ cube: cube.id });

    (Blog.getById as jest.Mock).mockResolvedValue(blog);
    (Cube.getById as jest.Mock).mockResolvedValue(cube);

    await call(getBlogPostHandler).withParams({ id: blog.id }).send();

    expect(util.render).toHaveBeenCalledWith(expect.anything(), expect.anything(), 'BlogPostPage', { post: blog });
  });

  it('should handle errors gracefully', async () => {
    const error = new Error('something went wrong');
    (Blog.getById as jest.Mock).mockRejectedValue(error);

    await call(getBlogPostHandler).withParams({ id: 'blog-id' }).send();

    expect(util.handleRouteError).toHaveBeenCalledWith(expect.anything(), expect.anything(), error, '/404');
    expect(util.render).not.toHaveBeenCalled();
  });
});

describe('Delete a Blog Post', () => {
  const flashMock = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should should error out if the user is not logged in', async () => {
    await call(deleteBlogHandler).withFlash(flashMock).withParams({ id: 'blog-id' }).send();

    expect(flashMock).toHaveBeenCalledWith('danger', 'Please login to delete a blog post.');
    expect(util.redirect).toHaveBeenCalledWith(expect.anything(), expect.anything(), '/cube/blog/blog-id');
  });

  it(`should return a 404 if blog post doesn't exists`, async () => {
    (Blog.getById as jest.Mock).mockResolvedValue(undefined);

    await call(deleteBlogHandler)
      .as(createUser({ id: 'blogger' }))
      .withFlash(flashMock)
      .withParams({ id: 'blog-id' })
      .send();

    expect(flashMock).toHaveBeenCalledWith('danger', 'Blog post not found');
    expect(util.redirect).toHaveBeenCalledWith(expect.anything(), expect.anything(), '/404');
  });

  it(`should fail is the user isn't the author`, async () => {
    const blog = createBlogPost({ owner: createUser({ id: 'blogger' }) });
    (Blog.getById as jest.Mock).mockResolvedValue(blog);

    await call(deleteBlogHandler)
      .withFlash(flashMock)
      .as(createUser({ id: 'deleter' }))
      .withParams({ id: blog.id })
      .send();

    expect(flashMock).toHaveBeenCalledWith('danger', 'Unauthorized');
    expect(util.redirect).toHaveBeenCalledWith(expect.anything(), expect.anything(), '/404');
  });

  it('should delete a blog and return to the cube', async () => {
    const owner = createUser({ id: 'blogger' });
    const blog = createBlogPost({ owner, cube: 'cube-id' });

    (Blog.getById as jest.Mock).mockResolvedValue(blog);
    (Blog.delete as jest.Mock).mockResolvedValue(undefined);

    await call(deleteBlogHandler).withFlash(flashMock).as(owner).withParams({ id: blog.id }).send();

    expect(flashMock).toHaveBeenCalledWith('success', 'Post Removed');
    expect(util.redirect).toHaveBeenCalledWith(expect.anything(), expect.anything(), '/cube/blog/cube-id');
  });
});

describe('Blog Posts Pagination', () => {
  it('should retrieve more blog posts', async () => {
    const res: Partial<Response> = {
      status: jest.fn().mockReturnThis(),
      send: jest.fn(),
    };

    const items = [createBlogPost(), createBlogPost()];
    const lastKey = { id: '12345', timestamp: 1234567 };

    (Blog.getByCube as jest.Mock).mockResolvedValue({ items, lastKey });

    await call(getMoreBlogPostsForCubeHandler)
      .withParams({ id: 'blog-id' })
      .withBody({ lastKey: 'last-key ' })
      .withResponse(res)
      .send();

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.send).toHaveBeenCalledWith({
      success: 'true',
      items,
      lastKey,
    });
  });
});

describe('View Blog Posts', () => {
  const flashMock = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should should 404 if the cube is private', async () => {
    const cube = createCube({
      id: 'cube-id',
      visibility: Cube.VISIBILITY.PRIVATE,
      owner: createUser({ id: 'cube-owner' }),
    });

    (Cube.getById as jest.Mock).mockResolvedValue(cube);

    await call(getBlogPostsForCubeHandler)
      .as(createUser({ id: 'visitor' }))
      .withFlash(flashMock)
      .withParams({ id: cube.id })
      .send();

    expect(flashMock).toHaveBeenCalledWith('danger', 'Cube not found');
    expect(util.redirect).toHaveBeenCalledWith(expect.anything(), expect.anything(), '/404');
  });

  it(`should return a 404 if cube doesn't exists`, async () => {
    (Cube.getById as jest.Mock).mockResolvedValue(undefined);

    await call(getBlogPostsForCubeHandler).withFlash(flashMock).withParams({ id: 'cube-id' }).send();

    expect(flashMock).toHaveBeenCalledWith('danger', 'Cube not found');
    expect(util.redirect).toHaveBeenCalledWith(expect.anything(), expect.anything(), '/404');
  });

  it('should handle errors gracefully', async () => {
    const error = new Error('something went wrong');
    (Cube.getById as jest.Mock).mockRejectedValue(error);

    await call(getBlogPostsForCubeHandler).withFlash(flashMock).withParams({ id: 'cube-id' }).send();

    expect(util.handleRouteError).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      error,
      '/cube/overview/cube-id',
    );
    expect(util.render).not.toHaveBeenCalled();
  });

  it('should retrieve and render blog posts for cube', async () => {
    const posts = [createBlogPost(), createBlogPost()];
    const lastKey = { id: '12345', timestamp: 1234567 };

    const cube = createCube();

    (Cube.getById as jest.Mock).mockResolvedValue(cube);
    (Blog.getByCube as jest.Mock).mockResolvedValue({ items: posts, lastKey });

    await call(getBlogPostsForCubeHandler).withFlash(flashMock).withParams({ id: cube.id }).send();

    expect(util.render).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      'CubeBlogPage',
      {
        cube,
        posts,
        lastKey,
      },
      expect.anything(),
    );
  });
});

describe('Blog Routes', () => {
  it('should register its own routes', async () => {
    expectRegisteredRoutes([
      {
        method: 'post',
        path: '/cube/blog/post/:id',
      },
      {
        method: 'get',
        path: '/cube/blog/blogpost/:id',
      },
      {
        method: 'get',
        path: '/cube/blog/remove/:id',
      },
      {
        method: 'post',
        path: '/cube/blog/getmoreblogsbycube/:id',
      },
      {
        method: 'get',
        path: '/cube/blog/:id',
      },
    ]);
  });
});
