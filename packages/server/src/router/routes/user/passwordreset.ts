import bcrypt from 'bcryptjs';
import { passwordResetDao, userDao } from 'dynamo/daos';
import { body } from 'express-validator';
import { csrfProtection, flashValidationErrors } from 'router/middleware';
import { handleRouteError, redirect, render } from 'serverutils/render';

import { Request, Response } from '../../../types/express';

// A reset link is single use and good for six hours from the moment it was issued.
export const PASSWORD_RESET_TTL_MS = 6 * 60 * 60 * 1000;

const isExpired = (issuedAt: number): boolean => Date.now() > issuedAt + PASSWORD_RESET_TTL_MS;

function checkPasswordsMatch(value: string, { req }: any) {
  if (value !== req.body.password2) {
    throw new Error('Password confirmation does not match password');
  }
  return true;
}

// Shared by this route and /user/lostpasswordreset, which the reset form posts to.
export const passwordValidators = [
  body('password', 'Password must be between 8 and 24 characters.').isLength({ min: 8, max: 24 }),
  body('password', 'New passwords must match.').custom(checkPasswordsMatch),
];

export const getHandler = async (req: Request, res: Response) => {
  if (!req.params.id) {
    req.flash('danger', 'Invalid password reset link');
    return redirect(req, res, '/');
  }

  const document = await passwordResetDao.getById(req.params.id);
  if (!document || isExpired(document.date)) {
    req.flash('danger', 'Password recovery link expired');
    return redirect(req, res, '/');
  }
  return render(req, res, 'PasswordResetPage', { code: req.params.id });
};

export const postHandler = async (req: Request, res: Response) => {
  try {
    if (!req.validated) {
      return render(req, res, 'PasswordResetPage', { code: req.body.code });
    }

    const passwordreset = await passwordResetDao.getById(req.body.code);

    // The code is the credential: it was mailed to the address on the account, so it alone
    // decides whose password changes. Resolving the account from anything the form submits
    // would let a holder of any valid code reset an unrelated user's password.
    if (!passwordreset || isExpired(passwordreset.date)) {
      req.flash('danger', 'Password recovery link expired. Please request a new one.');
      return redirect(req, res, '/user/lostpassword');
    }

    const user = await userDao.getByIdWithSensitiveData(passwordreset.owner);

    if (!user) {
      req.flash('danger', 'User not found');
      return render(req, res, 'PasswordResetPage', { code: req.body.code });
    }

    const salt = await bcrypt.genSalt(10);
    user.passwordHash = await bcrypt.hash(req.body.password2, salt);
    await userDao.update(user as any);

    // Burn the code so the link can't be replayed.
    await passwordResetDao.deleteById(passwordreset.id);

    req.flash('success', 'Password updated successfully');
    return redirect(req, res, '/user/login');
  } catch (err) {
    return handleRouteError(req, res, err, `/user/login`);
  }
};

export const routes = [
  {
    path: '/:id',
    method: 'get',
    handler: [csrfProtection, getHandler],
  },
  {
    path: '/',
    method: 'post',
    handler: [csrfProtection, ...passwordValidators, flashValidationErrors, postHandler],
  },
];
