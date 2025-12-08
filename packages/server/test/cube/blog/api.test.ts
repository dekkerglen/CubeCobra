import { FeedTypes } from '@utils/datatypes/Feed';
import * as render from 'serverutils/render';
import * as util from 'serverutils/util';

import Feed from '../../../src/dynamo/models/feed';
import {
  createBlogHandler,
  deleteBlogHandler,
  getBlogPostHandler,
  getBlogPostsForCubeHandler,
  getMoreBlogPostsForCubeHandler,
} from '../../../src/router/routes/cube/blog';
import { createBlogPost, createCube, createUser } from '../../test-utils/data';
import { expectRegisteredRoutes } from '../../test-utils/route';
import { call } from '../../test-utils/transport';

jest.mock('serverutils/util', () => ({
  ...jest.requireActual('serverutils/util'),
  addNotification: jest.fn(),
  getSafeReferrer: jest.fn(),
}));

jest.mock('serverutils/render', () => ({
  ...jest.requireActual('serverutils/render'),
  handleRouteError: jest.fn(),
  redirect: jest.fn(),
  render: jest.fn(),
}));

jest.mock('../../../src/dynamo/daos', () => ({
  cubeDao: {
    getById: jest.fn(),
  },
  blogDao: {
    createBlog: jest.fn(),
    getById: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    getByCube: jest.fn(),
    queryByCube: jest.fn(),
  },
}));

import { blogDao, cubeDao } from '../../../src/dynamo/daos';

jest.mock('../../../src/dynamo/models/feed', () => ({
  ...jest.requireActual('../../../src/dynamo/models/feed'),
  batchPut: jest.fn(),
}));

describe('Create Blog Post', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should fail if the blog title is too short', async () => {
    const cube = createCube({ id: 'cube-id' });
    (Cube.getById as jest.Mock).mockResolvedValue(cube);

    const res = await call(createBlogHandler).withParams({ id: 'cube-id' }).withBody({ title: 'Hi' }).send();

    expect(res.status).toBe(400);
    expect(res.body).toEqual({
      error: 'Blog title length must be between 5 and 100 characters.',
    });
  });

  it('should fail if the blog title is too long', async () => {
    const cube = createCube({ id: 'cube-id' });
    (Cube.getById as jest.Mock).mockResolvedValue(cube);

    const res = await call(createBlogHandler)
      .withParams({ id: 'cube-id' })
      .withBody({ title: 'Very long blog title'.repeat(50) })
      .send();

    expect(res.status).toBe(400);
    expect(res.body).toEqual({
      error: 'Blog title length must be between 5 and 100 characters.',
    });
  });

  it(`should fail if the cube isn't visible to the user`, async () => {
    const cube = createCube({ visibility: Cube.VISIBILITY.PRIVATE });
    (Cube.getById as jest.Mock).mockResolvedValue(cube);

    const res = await call(createBlogHandler)
      .as(createUser({ id: 'random' }))
      .withBody({ title: 'My blog title' })
      .withParams({ id: 'cube-id' })
      .send();

    expect(res.status).toBe(404);
    expect(res.body).toEqual({
      error: 'Cube not found',
    });
  });

  it('should fail if the cube is empty', async () => {
    const owner = createUser({ id: 'cube-owner' });
    const cube = createCube({ owner, cardCount: 0 });

    (Cube.getById as jest.Mock).mockResolvedValue(cube);

    const res = await call(createBlogHandler)
      .as(owner)
      .withBody({ title: 'My blog title' })
      .withParams({ id: 'cube-id' })
      .send();

    expect(res.status).toBe(400);
    expect(res.body).toEqual({
      error: 'Cannot post a blog for an empty cube. Please add cards to the cube first.',
    });
  });

  it('should fail if the user is not the cube owner', async () => {
    const owner = createUser({ id: 'cube-owner' });
    const cube = createCube({ owner, cardCount: 100 });

    (Cube.getById as jest.Mock).mockResolvedValue(cube);

    const res = await call(createBlogHandler)
      .as(createUser({ id: 'random-user' }))
      .withBody({ title: 'My blog title' })
      .withParams({ id: cube.id })
      .send();

    expect(res.status).toBe(403);
    expect(res.body).toEqual({
      error: 'Unable to post this blog post: Unauthorized.',
    });
  });

  it('should create a blog post', async () => {
    const owner = createUser({ following: ['user-1', 'user-2'] });
    const cube = createCube({ owner });

    (Cube.getById as jest.Mock).mockResolvedValue(cube);
    (blogDao.createBlog as jest.Mock).mockResolvedValueOnce('blog-id');
    (Feed.batchPut as jest.Mock).mockResolvedValue(undefined);
    (util.getSafeReferrer as jest.Mock).mockReturnValue(`/cube/blog/${cube.shortId}`);

    const res = await call(createBlogHandler)
      .as(owner)
      .withBody({ title: 'My blog title', markdown: 'My blog content' })
      .withParams({ id: cube.id })
      .send();

    expect(blogDao.createBlog).toHaveBeenCalledWith(
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

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      ok: 'Blog post successful, reloading...',
      redirect: `/cube/blog/${cube.shortId}`,
    });
  });

  it('should redirect using cube id if short id isnt set', async () => {
    const owner = createUser({ following: ['user-1', 'user-2'] });
    const cube = createCube({ owner, shortId: undefined });

    (Cube.getById as jest.Mock).mockResolvedValue(cube);
    (blogDao.createBlog as jest.Mock).mockResolvedValueOnce('blog-id');
    (Feed.batchPut as jest.Mock).mockResolvedValue(undefined);
    (util.getSafeReferrer as jest.Mock).mockReturnValue(`/cube/blog/${cube.id}`);

    const res = await call(createBlogHandler)
      .as(owner)
      .withBody({ title: 'My blog title', markdown: 'My blog content' })
      .withParams({ id: cube.id })
      .send();

    expect(blogDao.createBlog).toHaveBeenCalled();

    expect(Feed.batchPut).toHaveBeenCalled();

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      ok: 'Blog post successful, reloading...',
      redirect: `/cube/blog/${cube.id}`,
    });
  });

  it('should handle errors gracefully', async () => {
    const owner = createUser();
    const error = new Error('something went wrong');
    (Cube.getById as jest.Mock).mockRejectedValue(error);

    const res = await call(createBlogHandler)
      .as(owner)
      .withBody({ title: 'My blog title', markdown: 'My blog content' })
      .withParams({ id: '12345' })
      .send();

    expect(res.status).toBe(500);
    expect(res.body).toEqual({
      error: 'Unexpected error.',
    });
  });
});

describe('Edit Blog Post', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should 404 when trying to edit a missing blog post', async () => {
    const cube = createCube({ id: 'cube-id' });
    (Cube.getById as jest.Mock).mockResolvedValue(cube);
    (blogDao.getById as jest.Mock).mockResolvedValue(undefined);

    const res = await call(createBlogHandler)
      .as(createUser())
      .withBody({ title: 'My blog title', id: 'not-real' })
      .send();

    expect(res.status).toBe(404);
    expect(res.body).toEqual({
      error: 'Blog not found.',
    });
  });

  it('should update a blog post', async () => {
    const cube = createCube({ id: 'cube-id' });
    (Cube.getById as jest.Mock).mockResolvedValue(cube);
    const user = createUser();
    const blog = createBlogPost({ owner: user, title: 'My blog title' });

    (blogDao.getById as jest.Mock).mockResolvedValue({ ...blog, owner: user });
    (blogDao.update as jest.Mock).mockResolvedValue(undefined);

    const res = await call(createBlogHandler)
      .as(user)
      .withParams({ id: 'cube-id' })
      .withBody({ title: blog.title, id: blog.id, markdown: 'My updated blog post' })
      .send();

    expect(blogDao.update).toHaveBeenCalledWith(
      expect.objectContaining({
        body: 'My updated blog post',
        title: blog.title,
      }),
    );

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      ok: 'Blog update successful, reloading...',
      redirect: `/cube/blog/${cube.shortId}`,
    });
  });

  it('should redirect to dashboard when updating a blog post for non-existent cube', async () => {
    const user = createUser();
    const blog = createBlogPost({ owner: user, title: 'My blog title' });

    (blogDao.getById as jest.Mock).mockResolvedValue({ ...blog, owner: user });
    (blogDao.update as jest.Mock).mockResolvedValue(undefined);
    (Cube.getById as jest.Mock).mockResolvedValue(undefined);
    //This would happen if the cube was deleted in one tab and then edit occurred in another
    (util.getSafeReferrer as jest.Mock).mockReturnValue(`/cube/blog/888-666-444`);

    const res = await call(createBlogHandler)
      .as(user)
      .withParams({ id: 'non-existent-cube' })
      .withBody({ title: blog.title, id: blog.id, markdown: 'Updated content' })
      .send();

    expect(blogDao.update).toHaveBeenCalled();

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      ok: 'Blog update successful, reloading...',
      redirect: '/dashboard',
    });
  });

  it('should redirect to blogpost if edited from there', async () => {
    const user = createUser();
    const blog = createBlogPost({ owner: user, title: 'My blog title' });

    (blogDao.getById as jest.Mock).mockResolvedValue({ ...blog, owner: user });
    (blogDao.update as jest.Mock).mockResolvedValue(undefined);
    (Cube.getById as jest.Mock).mockResolvedValue(undefined);
    (util.getSafeReferrer as jest.Mock).mockReturnValue(`/cube/blog/blogpost/${blog.id}`);

    const res = await call(createBlogHandler)
      .as(user)
      .withParams({ id: 'non-existent-cube' })
      .withBody({ title: blog.title, id: blog.id, markdown: 'Updated content' })
      .send();

    expect(blogDao.update).toHaveBeenCalled();
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      ok: 'Blog update successful, reloading...',
      redirect: `/cube/blog/blogpost/${blog.id}`,
    });
  });

  it('should redirect to blog page of the users profile if edited from there', async () => {
    const user = createUser();
    const blog = createBlogPost({ owner: user, title: 'My blog title' });

    (blogDao.getById as jest.Mock).mockResolvedValue({ ...blog, owner: user });
    (blogDao.update as jest.Mock).mockResolvedValue(undefined);
    (Cube.getById as jest.Mock).mockResolvedValue(undefined);
    (util.getSafeReferrer as jest.Mock).mockReturnValue(`/user/blog/${user.id}`);

    const res = await call(createBlogHandler)
      .as(user)
      .withParams({ id: 'non-existent-cube' })
      .withBody({ title: blog.title, id: blog.id, markdown: 'Updated content' })
      .send();

    expect(blogDao.update).toHaveBeenCalled();
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      ok: 'Blog update successful, reloading...',
      redirect: `/user/blog/${user.id}`,
    });
  });
});

describe('Get Blog Post', () => {
  const flashMock = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it(`should return a 404 if blog post doesn't exist`, async () => {
    (blogDao.getById as jest.Mock).mockResolvedValue(undefined);

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

    (blogDao.getById as jest.Mock).mockResolvedValue(blog);
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

    (blogDao.getById as jest.Mock).mockResolvedValue(blog);
    (Cube.getById as jest.Mock).mockResolvedValue(cube);

    await call(getBlogPostHandler).withParams({ id: blog.id }).send();

    expect(render.render).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      'BlogPostPage',
      { post: blog },
      { noindex: true },
    );
  });

  it('should handle errors gracefully', async () => {
    const error = new Error('something went wrong');
    (blogDao.getById as jest.Mock).mockRejectedValue(error);

    await call(getBlogPostHandler).withParams({ id: 'blog-id' }).send();

    expect(render.handleRouteError).toHaveBeenCalledWith(expect.anything(), expect.anything(), error, '/404');
    expect(render.render).not.toHaveBeenCalled();
  });
});

describe('Delete a Blog Post', () => {
  const flashMock = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should should error out if the user is not logged in', async () => {
    (util.getSafeReferrer as jest.Mock).mockReturnValue('/cube/blog/blogpost/blog-id');
    await call(deleteBlogHandler).withFlash(flashMock).withParams({ id: 'blog-id' }).send();

    expect(flashMock).toHaveBeenCalledWith('danger', 'Please login to delete a blog post.');
    expect(render.redirect).toHaveBeenCalledWith(expect.anything(), expect.anything(), '/cube/blog/blogpost/blog-id');
  });

  it(`should return a 404 if blog post doesn't exists`, async () => {
    (blogDao.getById as jest.Mock).mockResolvedValue(undefined);
    (util.getSafeReferrer as jest.Mock).mockReturnValue('/cube/blog/blogpost/blog-id');

    await call(deleteBlogHandler)
      .as(createUser({ id: 'blogger' }))
      .withFlash(flashMock)
      .withParams({ id: 'blog-id' })
      .send();

    expect(flashMock).toHaveBeenCalledWith('danger', 'Blog post not found');
    expect(render.redirect).toHaveBeenCalledWith(expect.anything(), expect.anything(), '/404');
  });

  it(`should fail is the user isn't the author`, async () => {
    const blog = createBlogPost({ owner: createUser({ id: 'blogger' }) });
    (blogDao.getById as jest.Mock).mockResolvedValue(blog);
    (util.getSafeReferrer as jest.Mock).mockReturnValue('/cube/blog/blogpost/blog-id');

    await call(deleteBlogHandler)
      .as(createUser({ id: 'deleter' }))
      .withFlash(flashMock)
      .withParams({ id: blog.id })
      .send();

    expect(flashMock).toHaveBeenCalledWith('danger', 'Unauthorized');
    expect(render.redirect).toHaveBeenCalledWith(expect.anything(), expect.anything(), '/404');
  });

  it('should delete a blog and return to the cube', async () => {
    const cube = createCube({ id: 'cube-id' });
    (Cube.getById as jest.Mock).mockResolvedValue(cube);
    const owner = createUser({ id: 'blogger' });
    const blog = createBlogPost({ owner, cube: 'cube-id' });
    (util.getSafeReferrer as jest.Mock).mockReturnValue(`/cube/blog/${cube.shortId}`);

    (blogDao.getById as jest.Mock).mockResolvedValue(blog);
    (blogDao.delete as jest.Mock).mockResolvedValue(undefined);

    await call(deleteBlogHandler).as(owner).withFlash(flashMock).withParams({ id: blog.id }).send();

    expect(flashMock).toHaveBeenCalledWith('success', 'Post Removed');
    expect(render.redirect).toHaveBeenCalledWith(expect.anything(), expect.anything(), `/cube/blog/${cube.shortId}`);
  });

  it('should delete a blog and return to the cube, even if doing so from the post itself', async () => {
    const cube = createCube({ id: 'cube-id' });
    (Cube.getById as jest.Mock).mockResolvedValue(cube);
    const owner = createUser({ id: 'blogger' });
    const blog = createBlogPost({ owner, cube: 'cube-id' });
    (util.getSafeReferrer as jest.Mock).mockReturnValue(`/cube/blog/blogpost/${blog.id}`);

    (blogDao.getById as jest.Mock).mockResolvedValue(blog);
    (blogDao.delete as jest.Mock).mockResolvedValue(undefined);

    await call(deleteBlogHandler).as(owner).withFlash(flashMock).withParams({ id: blog.id }).send();

    expect(flashMock).toHaveBeenCalledWith('success', 'Post Removed');
    expect(render.redirect).toHaveBeenCalledWith(expect.anything(), expect.anything(), `/cube/blog/${cube.shortId}`);
  });

  it('should delete a blog and go to the dashboard, if now both the cube and blog are gone', async () => {
    (Cube.getById as jest.Mock).mockResolvedValue(undefined);
    const owner = createUser({ id: 'blogger' });
    const blog = createBlogPost({ owner, cube: 'cube-id' });
    (util.getSafeReferrer as jest.Mock).mockReturnValue(`/cube/blog/blogpost/${blog.id}`);

    (blogDao.getById as jest.Mock).mockResolvedValue(blog);
    (blogDao.delete as jest.Mock).mockResolvedValue(undefined);

    await call(deleteBlogHandler).as(owner).withFlash(flashMock).withParams({ id: blog.id }).send();

    expect(flashMock).toHaveBeenCalledWith('success', 'Post Removed');
    expect(render.redirect).toHaveBeenCalledWith(expect.anything(), expect.anything(), `/dashboard`);
  });

  //Blog posts can outlive the cube they belong to
  it('should redirect to dashboard when deleting a blog post for non-existent cube', async () => {
    const owner = createUser({ id: 'blogger' });
    const blog = createBlogPost({ owner, cube: 'non-existent-cube' });
    //This would happen if the cube was deleted in one tab and then edit occurred in another
    (util.getSafeReferrer as jest.Mock).mockReturnValue(`/cube/blog/888-ddd-555`);

    (blogDao.getById as jest.Mock).mockResolvedValue(blog);
    (blogDao.delete as jest.Mock).mockResolvedValue(undefined);
    (Cube.getById as jest.Mock).mockResolvedValue(undefined);

    await call(deleteBlogHandler).as(owner).withFlash(flashMock).withParams({ id: blog.id }).send();

    expect(blogDao.delete).toHaveBeenCalledWith(blog);
    expect(flashMock).toHaveBeenCalledWith('success', 'Post Removed');
    expect(render.redirect).toHaveBeenCalledWith(expect.anything(), expect.anything(), '/dashboard');
  });

  it('should redirect to blog page of the users profile if deleted from there', async () => {
    const owner = createUser({ id: 'blogger' });
    const blog = createBlogPost({ owner, cube: 'non-existent-cube' });
    (util.getSafeReferrer as jest.Mock).mockReturnValue(`/user/blog/${owner.id}`);

    (blogDao.getById as jest.Mock).mockResolvedValue(blog);
    (blogDao.delete as jest.Mock).mockResolvedValue(undefined);
    (Cube.getById as jest.Mock).mockResolvedValue(undefined);

    await call(deleteBlogHandler).withFlash(flashMock).as(owner).withParams({ id: blog.id }).send();

    expect(blogDao.delete).toHaveBeenCalledWith(blog);
    expect(flashMock).toHaveBeenCalledWith('success', 'Post Removed');
    expect(render.redirect).toHaveBeenCalledWith(expect.anything(), expect.anything(), `/user/blog/${owner.id}`);
  });
});

describe('Blog Posts Pagination', () => {
  it('should retrieve more blog posts', async () => {
    const items = [createBlogPost(), createBlogPost()];
    const lastKey = { id: '12345', timestamp: 1234567 };

    (blogDao.queryByCube as jest.Mock).mockResolvedValue({ items, lastKey });

    const res = await call(getMoreBlogPostsForCubeHandler)
      .withParams({ id: 'blog-id' })
      .withBody({ lastKey: 'last-key ' })
      .send();

    expect(res.status).toEqual(200);
    expect(res.body).toEqual({
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
    expect(render.redirect).toHaveBeenCalledWith(expect.anything(), expect.anything(), '/404');
  });

  it(`should return a 404 if cube doesn't exists`, async () => {
    (Cube.getById as jest.Mock).mockResolvedValue(undefined);

    await call(getBlogPostsForCubeHandler).withFlash(flashMock).withParams({ id: 'cube-id' }).send();

    expect(flashMock).toHaveBeenCalledWith('danger', 'Cube not found');
    expect(render.redirect).toHaveBeenCalledWith(expect.anything(), expect.anything(), '/404');
  });

  it('should handle errors gracefully', async () => {
    const error = new Error('something went wrong');
    (Cube.getById as jest.Mock).mockRejectedValue(error);

    await call(getBlogPostsForCubeHandler).withFlash(flashMock).withParams({ id: 'cube-id' }).send();

    expect(render.handleRouteError).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      error,
      '/cube/overview/cube-id',
    );
    expect(render.render).not.toHaveBeenCalled();
  });

  it('should retrieve and render blog posts for cube', async () => {
    const posts = [createBlogPost(), createBlogPost()];
    const lastKey = { id: '12345', timestamp: 1234567 };

    const cube = createCube();

    (Cube.getById as jest.Mock).mockResolvedValue(cube);
    (blogDao.queryByCube as jest.Mock).mockResolvedValue({ items: posts, lastKey });

    await call(getBlogPostsForCubeHandler).withFlash(flashMock).withParams({ id: cube.id }).send();

    expect(render.render).toHaveBeenCalledWith(
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
