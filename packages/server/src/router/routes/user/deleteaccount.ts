import bcrypt from 'bcryptjs';
import { blogDao, commentDao, cubeDao, draftDao } from 'dynamo/daos';
import User from 'dynamo/models/user';
import { body } from 'express-validator';
import { csrfProtection, ensureAuth, flashValidationErrors } from 'router/middleware';
import { redirect } from 'serverutils/render';

import { Request, Response } from '../../../types/express';

export const handler = async (req: Request, res: Response) => {
  if (!req.validated) {
    return redirect(req, res, '/user/account?tab=5');
  }

  if (!req.user) {
    req.flash('danger', 'User not found');
    return redirect(req, res, '/user/account?tab=5');
  }

  const user = await User.getByIdWithSensitiveData(req.user.id);

  if (!user) {
    req.flash('danger', 'User not found');
    return redirect(req, res, '/user/account?tab=5');
  }

  // Verify password
  const isMatch = await bcrypt.compare(req.body.password, user.passwordHash);
  if (!isMatch) {
    req.flash('danger', 'Password is incorrect');
    return redirect(req, res, '/user/account?tab=5');
  }

  // Check if user has any cubes
  const cubesResponse = await cubeDao.queryByOwner(user.id);
  if (cubesResponse.items && cubesResponse.items.length > 0) {
    req.flash('danger', 'You must delete all of your cubes before deleting your account');
    return redirect(req, res, '/user/account?tab=5');
  }

  try {
    const aggregates = {
      commentsWiped: 0,
      blogPostsDeleted: 0,
      draftsDeleted: 0,
    };

    // Delete all blog posts
    const blogResponse = await blogDao.queryByOwner(user.id);
    let lastKey = blogResponse.lastKey;
    let blogIds = blogResponse.items.map((blog) => blog.id);

    aggregates.blogPostsDeleted += blogResponse.items.length;
    for (const blog of blogResponse.items) {
      await blogDao.delete(blog);
    }

    while (lastKey) {
      const nextResponse = await blogDao.queryByOwner(user.id, lastKey);
      lastKey = nextResponse.lastKey;
      blogIds = blogIds.concat(nextResponse.items.map((blog) => blog.id));
      aggregates.blogPostsDeleted += nextResponse.items.length;
      for (const blog of nextResponse.items) {
        await blogDao.delete(blog);
      }
    }

    // Delete all drafts
    const draftResponse = await draftDao.queryByOwner(user.id);
    lastKey = draftResponse.lastKey;
    let draftIds = draftResponse.items.map((draft: any) => draft.id);

    while (lastKey) {
      const nextResponse = await draftDao.queryByOwner(user.id, lastKey, 100);
      lastKey = nextResponse.lastKey;
      draftIds = draftIds.concat(nextResponse.items.map((draft: any) => draft.id));
    }

    aggregates.draftsDeleted += draftIds.length;
    for (const draftId of draftIds) {
      await draftDao.deleteById(draftId);
    }

    // Wipe all comments (mark as deleted, don't remove)
    const commentResponse = await commentDao.queryByOwner(user.id);
    let commentLastkey = commentResponse.lastKey;
    let comments = commentResponse.items || [];

    while (commentLastkey) {
      const nextResponse = await commentDao.queryByOwner(user.id, commentLastkey);
      commentLastkey = nextResponse.lastKey;
      comments = comments.concat(nextResponse.items || []);
    }

    aggregates.commentsWiped += comments.length;
    for (const comment of comments) {
      comment.owner = undefined;
      comment.body = '[deleted]';
      await commentDao.put(comment);
    }

    // Delete the user
    await User.deleteById(user.id);

    // Log the user out by destroying the session
    req.logout((err) => {
      if (err) {
        req.logger.error('Error logging out user after account deletion', err);
      }
    });

    req.flash(
      'success',
      `Your account has been successfully deleted. ${aggregates.blogPostsDeleted} blog posts, ${aggregates.draftsDeleted} drafts, and ${aggregates.commentsWiped} comments were removed.`,
    );
    return redirect(req, res, '/');
  } catch (err) {
    const error = err as Error;
    req.logger.error('Error deleting user account', error);
    req.flash('danger', 'An error occurred while deleting your account. Please try again or contact support.');
    return redirect(req, res, '/user/account?tab=5');
  }
};

export const routes = [
  {
    path: '/',
    method: 'post',
    handler: [
      csrfProtection,
      ensureAuth,
      body('password', 'Password must be provided').notEmpty(),
      flashValidationErrors,
      handler,
    ],
  },
];
