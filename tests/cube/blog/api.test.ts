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
import * as render from '../../../src/util/render';
import * as util from '../../../src/util/util';
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

jest.mock('../../../src/util/util', () => ({
  ...jest.requireActual('../../../src/util/util'),
  getSafeReferrer: jest.fn(),
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
    const cube = createCube({ id: 'cube-id' });
    (Cube.getById as jest.Mock).mockResolvedValue(cube);
    (util.getSafeReferrer as jest.Mock).mockReturnValue(`/cube/blog/${cube.shortId}`);

    await call(createBlogHandler).withFlash(flashMock).withParams({ id: 'cube-id' }).withBody({ title: 'Hi' }).send();

    expect(render.redirect).toHaveBeenCalledWith(expect.anything(), expect.anything(), `/cube/blog/${cube.shortId}`);
    expect(flashMock).toHaveBeenCalledWith('danger', 'Blog title length must be between 5 and 100 characters.');
  });

  it('should fail if the blog title is too long', async () => {
    const cube = createCube({ id: 'cube-id' });
    (Cube.getById as jest.Mock).mockResolvedValue(cube);
    (util.getSafeReferrer as jest.Mock).mockReturnValue(`/cube/blog/${cube.shortId}`);

    await call(createBlogHandler)
      .withFlash(flashMock)
      .withParams({ id: 'cube-id' })
      .withBody({ title: 'Very long blog title'.repeat(50) })
      .send();

    expect(render.redirect).toHaveBeenCalledWith(expect.anything(), expect.anything(), `/cube/blog/${cube.shortId}`);
    expect(flashMock).toHaveBeenCalledWith('danger', 'Blog title length must be between 5 and 100 characters.');
  });

  it(`should fail if the cube isn't visible to the user`, async () => {
    const cube = createCube({ visibility: Cube.VISIBILITY.PRIVATE });
    (Cube.getById as jest.Mock).mockResolvedValue(cube);
    (util.getSafeReferrer as jest.Mock).mockReturnValue(`/cube/blog/${cube.shortId}`);

    await call(createBlogHandler)
      .as(createUser({ id: 'random' }))
      .withFlash(flashMock)
      .withBody({ title: 'My blog title' })
      .withParams({ id: 'cube-id' })
      .send();

    expect(flashMock).toHaveBeenCalledWith('danger', 'Cube not found');
    expect(render.redirect).toHaveBeenCalledWith(expect.anything(), expect.anything(), '/cube/blog/404');
  });

  it('should fail if the cube is empty', async () => {
    const owner = createUser({ id: 'cube-owner' });
    const cube = createCube({ owner, cardCount: 0 });
    (util.getSafeReferrer as jest.Mock).mockReturnValue(`/cube/blog/${cube.shortId}`);

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
    expect(render.redirect).toHaveBeenCalledWith(expect.anything(), expect.anything(), `/cube/blog/${cube.shortId}`);
  });

  it('should fail if the user is not the cube owner', async () => {
    const owner = createUser({ id: 'cube-owner' });
    const cube = createCube({ owner, cardCount: 100 });
    (util.getSafeReferrer as jest.Mock).mockReturnValue(`/cube/blog/${cube.shortId}`);

    (Cube.getById as jest.Mock).mockResolvedValue(cube);

    await call(createBlogHandler)
      .as(createUser({ id: 'random-user' }))
      .withFlash(flashMock)
      .withBody({ title: 'My blog title' })
      .withParams({ id: cube.id })
      .send();

    expect(flashMock).toHaveBeenCalledWith('danger', 'Unable to post this blog post: Unauthorized.');
    expect(render.redirect).toHaveBeenCalledWith(expect.anything(), expect.anything(), `/cube/blog/${cube.shortId}`);
  });

  it('should should create a blog post', async () => {
    const owner = createUser({ following: ['user-1', 'user-2'] });
    const cube = createCube({ owner });

    (Cube.getById as jest.Mock).mockResolvedValue(cube);
    (Blog.put as jest.Mock).mockResolvedValueOnce('blog-id');
    (Feed.batchPut as jest.Mock).mockResolvedValue(undefined);
    (util.getSafeReferrer as jest.Mock).mockReturnValue(`/cube/blog/${cube.shortId}`);

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
    expect(render.redirect).toHaveBeenCalledWith(expect.anything(), expect.anything(), `/cube/blog/${cube.shortId}`);
  });

  it('should redirect using cube id if short id isnt set', async () => {
    const owner = createUser({ following: ['user-1', 'user-2'] });
    const cube = createCube({ owner, shortId: undefined });

    (Cube.getById as jest.Mock).mockResolvedValue(cube);
    (Blog.put as jest.Mock).mockResolvedValueOnce('blog-id');
    (Feed.batchPut as jest.Mock).mockResolvedValue(undefined);
    (util.getSafeReferrer as jest.Mock).mockReturnValue(`/cube/blog/${cube.id}`);

    await call(createBlogHandler)
      .as(owner)
      .withFlash(flashMock)
      .withBody({ title: 'My blog title', markdown: 'My blog content' })
      .withParams({ id: cube.id })
      .send();

    expect(Blog.put).toHaveBeenCalled();

    expect(Feed.batchPut).toHaveBeenCalled();

    expect(flashMock).toHaveBeenCalledWith('success', 'Blog post successful');
    expect(render.redirect).toHaveBeenCalledWith(expect.anything(), expect.anything(), `/cube/blog/${cube.id}`);
  });

  it('should handle errors gracefully', async () => {
    const owner = createUser();
    const error = new Error('something went wrong');
    (Cube.getById as jest.Mock).mockRejectedValue(error);
    (util.getSafeReferrer as jest.Mock).mockReturnValue(`/cube/blog/12345`);

    await call(createBlogHandler)
      .as(owner)
      .withFlash(flashMock)
      .withBody({ title: 'My blog title', markdown: 'My blog content' })
      .withParams({ id: '12345' })
      .send();

    expect(render.handleRouteError).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      error,
      '/cube/blog/12345',
    );
  });
});

describe('Edit Blog Post', () => {
  const flashMock = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should 404 when trying to edit a missing blog post', async () => {
    const cube = createCube({ id: 'cube-id' });
    (Cube.getById as jest.Mock).mockResolvedValue(cube);
    (Blog.getUnhydrated as jest.Mock).mockResolvedValue(undefined);
    (util.getSafeReferrer as jest.Mock).mockReturnValue(`/cube/blog/${cube.id}`);

    await call(createBlogHandler)
      .as(createUser())
      .withFlash(flashMock)
      .withBody({ title: 'My blog title', id: 'not-real' })
      .send();

    expect(flashMock).toHaveBeenCalledWith('danger', 'Blog not found.');
    expect(render.redirect).toHaveBeenCalledWith(expect.anything(), expect.anything(), '/404');
  });

  it('should update a blog post, from the cube blog page', async () => {
    const cube = createCube({ id: 'cube-id' });
    (Cube.getById as jest.Mock).mockResolvedValue(cube);
    const user = createUser();
    const blog = createBlogPost({ owner: user, title: 'My blog title' });
    (util.getSafeReferrer as jest.Mock).mockReturnValue(`/cube/blog/${cube.shortId}`);

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
    expect(render.redirect).toHaveBeenCalledWith(expect.anything(), expect.anything(), `/cube/blog/${cube.shortId}`);
  });

  it('should redirect to dashboard when updating a blog post for non-existent cube', async () => {
    const user = createUser();
    const blog = createBlogPost({ owner: user, title: 'My blog title' });

    (Blog.getUnhydrated as jest.Mock).mockResolvedValue({ ...blog, owner: user.id });
    (Blog.put as jest.Mock).mockResolvedValue(undefined);
    (Cube.getById as jest.Mock).mockResolvedValue(undefined);
    //This would happen if the cube was deleted in one tab and then edit occurred in another
    (util.getSafeReferrer as jest.Mock).mockReturnValue(`/cube/blog/888-666-444`);

    await call(createBlogHandler)
      .as(user)
      .withFlash(flashMock)
      .withParams({ id: 'non-existent-cube' })
      .withBody({ title: blog.title, id: blog.id, markdown: 'Updated content' })
      .send();

    expect(Blog.put).toHaveBeenCalled();
    expect(flashMock).toHaveBeenCalledWith('success', 'Blog update successful');
    expect(render.redirect).toHaveBeenCalledWith(expect.anything(), expect.anything(), '/dashboard');
  });

  it('should redirect to blogpost if edited from there', async () => {
    const user = createUser();
    const blog = createBlogPost({ owner: user, title: 'My blog title' });

    (Blog.getUnhydrated as jest.Mock).mockResolvedValue({ ...blog, owner: user.id });
    (Blog.put as jest.Mock).mockResolvedValue(undefined);
    (Cube.getById as jest.Mock).mockResolvedValue(undefined);
    (util.getSafeReferrer as jest.Mock).mockReturnValue(`/cube/blog/blogpost/${blog.id}`);

    await call(createBlogHandler)
      .as(user)
      .withFlash(flashMock)
      .withParams({ id: 'non-existent-cube' })
      .withBody({ title: blog.title, id: blog.id, markdown: 'Updated content' })
      .send();

    expect(Blog.put).toHaveBeenCalled();
    expect(flashMock).toHaveBeenCalledWith('success', 'Blog update successful');
    expect(render.redirect).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      `/cube/blog/blogpost/${blog.id}`,
    );
  });

  it('should redirect to blog page of the users profile if edited from there', async () => {
    const user = createUser();
    const blog = createBlogPost({ owner: user, title: 'My blog title' });

    (Blog.getUnhydrated as jest.Mock).mockResolvedValue({ ...blog, owner: user.id });
    (Blog.put as jest.Mock).mockResolvedValue(undefined);
    (Cube.getById as jest.Mock).mockResolvedValue(undefined);
    (util.getSafeReferrer as jest.Mock).mockReturnValue(`/user/blog/${user.id}`);

    await call(createBlogHandler)
      .as(user)
      .withFlash(flashMock)
      .withParams({ id: 'non-existent-cube' })
      .withBody({ title: blog.title, id: blog.id, markdown: 'Updated content' })
      .send();

    expect(Blog.put).toHaveBeenCalled();
    expect(flashMock).toHaveBeenCalledWith('success', 'Blog update successful');
    expect(render.redirect).toHaveBeenCalledWith(expect.anything(), expect.anything(), `/user/blog/${user.id}`);
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
    (Blog.getById as jest.Mock).mockRejectedValue(error);

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
    (Blog.getById as jest.Mock).mockResolvedValue(undefined);
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
    (Blog.getById as jest.Mock).mockResolvedValue(blog);
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

    (Blog.getById as jest.Mock).mockResolvedValue(blog);
    (Blog.delete as jest.Mock).mockResolvedValue(undefined);

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

    (Blog.getById as jest.Mock).mockResolvedValue(blog);
    (Blog.delete as jest.Mock).mockResolvedValue(undefined);

    await call(deleteBlogHandler).as(owner).withFlash(flashMock).withParams({ id: blog.id }).send();

    expect(flashMock).toHaveBeenCalledWith('success', 'Post Removed');
    expect(render.redirect).toHaveBeenCalledWith(expect.anything(), expect.anything(), `/cube/blog/${cube.shortId}`);
  });

  it('should delete a blog and go to the dashboard, if now both the cube and blog are gone', async () => {
    (Cube.getById as jest.Mock).mockResolvedValue(undefined);
    const owner = createUser({ id: 'blogger' });
    const blog = createBlogPost({ owner, cube: 'cube-id' });
    (util.getSafeReferrer as jest.Mock).mockReturnValue(`/cube/blog/blogpost/${blog.id}`);

    (Blog.getById as jest.Mock).mockResolvedValue(blog);
    (Blog.delete as jest.Mock).mockResolvedValue(undefined);

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

    (Blog.getById as jest.Mock).mockResolvedValue(blog);
    (Blog.delete as jest.Mock).mockResolvedValue(undefined);
    (Cube.getById as jest.Mock).mockResolvedValue(undefined);

    await call(deleteBlogHandler).as(owner).withFlash(flashMock).withParams({ id: blog.id }).send();

    expect(Blog.delete).toHaveBeenCalledWith(blog.id);
    expect(flashMock).toHaveBeenCalledWith('success', 'Post Removed');
    expect(render.redirect).toHaveBeenCalledWith(expect.anything(), expect.anything(), '/dashboard');
  });

  it('should redirect to blog page of the users profile if deleted from there', async () => {
    const owner = createUser({ id: 'blogger' });
    const blog = createBlogPost({ owner, cube: 'non-existent-cube' });
    (util.getSafeReferrer as jest.Mock).mockReturnValue(`/user/blog/${owner.id}`);

    (Blog.getById as jest.Mock).mockResolvedValue(blog);
    (Blog.delete as jest.Mock).mockResolvedValue(undefined);
    (Cube.getById as jest.Mock).mockResolvedValue(undefined);

    await call(deleteBlogHandler).withFlash(flashMock).as(owner).withParams({ id: blog.id }).send();

    expect(Blog.delete).toHaveBeenCalledWith(blog.id);
    expect(flashMock).toHaveBeenCalledWith('success', 'Post Removed');
    expect(render.redirect).toHaveBeenCalledWith(expect.anything(), expect.anything(), `/user/blog/${owner.id}`);
  });
});

describe('Blog Posts Pagination', () => {
  it('should retrieve more blog posts', async () => {
    const items = [createBlogPost(), createBlogPost()];
    const lastKey = { id: '12345', timestamp: 1234567 };

    (Blog.getByCube as jest.Mock).mockResolvedValue({ items, lastKey });

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
    (Blog.getByCube as jest.Mock).mockResolvedValue({ items: posts, lastKey });

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
