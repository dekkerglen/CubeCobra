import PasswordReset from '@utils/datatypes/PasswordReset';
import { passwordResetDao, userDao } from 'dynamo/daos';
import { body } from 'express-validator';
import { csrfProtection, flashValidationErrors } from 'router/middleware';
import { hashPassword, newPasswordValidator } from 'serverutils/passwordPolicy';
import { formLimiter } from 'serverutils/rateLimiters';
import { handleRouteError, redirect, render } from 'serverutils/render';

import { renewSession } from '../../../config/passport';
import { Request, Response } from '../../../types/express';

// A reset link is single use and good for six hours from the moment it was issued.
export const PASSWORD_RESET_TTL_MS = 6 * 60 * 60 * 1000;

const isExpired = (issuedAt: number): boolean => Date.now() > issuedAt + PASSWORD_RESET_TTL_MS;

// A link issued before the account's latest password or email change has been superseded.
// Versions only go up, so a stored version below the link's is just an eventually consistent read.
const isSuperseded = (reset: PasswordReset, sessionVersion: number | undefined): boolean =>
  (reset.sessionVersion ?? 0) < (sessionVersion ?? 0);

function checkPasswordsMatch(value: string, { req }: any) {
  if (value !== req.body.password2) {
    throw new Error('Password confirmation does not match password');
  }
  return true;
}

// Shared by this route and /user/lostpasswordreset, which the reset form posts to.
export const passwordValidators = [
  newPasswordValidator('password'),
  body('password', 'New passwords must match.').custom(checkPasswordsMatch),
];

// Shared with /user/lostpasswordreset. Codes are random UUIDs, so this mostly limits load.
export const resetLimiter = formLimiter(15 * 60 * 1000, 20, '/user/lostpassword');

export const getHandler = async (req: Request, res: Response) => {
  if (!req.params.id) {
    req.flash('danger', 'Invalid password reset link');
    return redirect(req, res, '/');
  }

  const document = await passwordResetDao.getById(req.params.id);
  const owner =
    document && !isExpired(document.date) ? await userDao.getByIdWithSensitiveData(document.owner) : undefined;
  if (!document || !owner || isSuperseded(document, owner.sessionVersion)) {
    req.flash('danger', 'Password recovery link expired');
    return redirect(req, res, '/');
  }
  return render(req, res, 'PasswordResetPage', { code: req.params.id }, { title: 'Reset Password' });
};

export const postHandler = async (req: Request, res: Response) => {
  try {
    if (!req.validated) {
      return render(req, res, 'PasswordResetPage', { code: req.body.code }, { title: 'Reset Password' });
    }

    const passwordreset = typeof req.body.code === 'string' ? await passwordResetDao.getById(req.body.code) : undefined;

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
      return render(req, res, 'PasswordResetPage', { code: req.body.code }, { title: 'Reset Password' });
    }

    if (isSuperseded(passwordreset, user.sessionVersion)) {
      await passwordResetDao.deleteById(passwordreset.id);
      req.flash('danger', 'Password recovery link expired. Please request a new one.');
      return redirect(req, res, '/user/lostpassword');
    }

    user.passwordHash = await hashPassword(req.body.password);
    // Signs out every existing session and retires every other outstanding reset link.
    user.sessionVersion = (user.sessionVersion ?? 0) + 1;
    // Whoever reset the password owns the inbox; drop any email change they didn't confirm.
    user.pendingEmail = '';
    user.pendingEmailToken = '';
    user.pendingEmailExpires = 0;
    await userDao.update(user as any);

    // Burn the code so the link can't be replayed.
    await passwordResetDao.deleteById(passwordreset.id);

    await renewSession(req, user.id, user.sessionVersion);

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
    handler: [resetLimiter, csrfProtection, getHandler],
  },
  {
    path: '/',
    method: 'post',
    handler: [resetLimiter, csrfProtection, ...passwordValidators, flashValidationErrors, postHandler],
  },
];
