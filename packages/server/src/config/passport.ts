import type UserType from '@utils/datatypes/User';
import { UserRoles } from '@utils/datatypes/User';
import { userDao } from 'dynamo/daos';
import { PassportStatic } from 'passport';
import { Strategy as LocalStrategy } from 'passport-local';
import { comparePassword } from 'serverutils/passwordPolicy';

import { Request } from '../types/express';

// Unknown accounts and wrong passwords get the same answer, so the login form can't be used to
// find out which usernames and email addresses are registered.
export const LOGIN_FAILED_MESSAGE = 'Incorrect username or password.';
export const BANNED_MESSAGE =
  'Your account has been banned, please contact CubeCobra staff if you believe this is in error.';
export const UNVERIFIED_MESSAGE = 'Your account is not verified. Please check your email for a verification link.';

type VerifyDone = (err: any, user?: Express.User | false, info?: { message: string }) => void;

export const verifyLogin = async (username: string, password: string, done: VerifyDone): Promise<void> => {
  try {
    const found = (await userDao.getByUsername(username)) ?? (await userDao.getByEmail(username));
    const user = found ? await userDao.getByIdWithSensitiveData(found.id) : undefined;

    // Runs the full bcrypt comparison even when there's no account (against a dummy hash).
    const isMatch = await comparePassword(password, user?.passwordHash);

    if (!found || !user || !isMatch) {
      return done(null, false, { message: LOGIN_FAILED_MESSAGE });
    }

    // Only reachable with the right password, so these don't reveal anything to a guesser.
    if (user.roles?.includes(UserRoles.BANNED)) {
      return done(null, false, { message: BANNED_MESSAGE });
    }
    if (user.emailVerified === false) {
      return done(null, false, { message: UNVERIFIED_MESSAGE });
    }

    // Return the user without sensitive data. The session version rides along only so
    // serializeUser can pin it into the session.
    return done(null, { ...found, sessionVersion: user.sessionVersion ?? 0 });
  } catch (err) {
    return done(err);
  }
};

// The session stores "<user id>:<sessionVersion>". Bumping a user's sessionVersion (password
// reset or change, email change) signs out every session created before the bump.
export const serializeSessionUser = (user: Express.User, done: (err: any, id?: string) => void): void => {
  const { id, sessionVersion } = user as UserType;
  done(null, `${id}:${sessionVersion ?? 0}`);
};

export const deserializeSessionUser = async (
  serialized: unknown,
  done: (err: any, user?: Express.User | false) => void,
): Promise<void> => {
  try {
    if (typeof serialized !== 'string' || serialized.length === 0) {
      return done(null, false);
    }

    // Sessions from before versioning hold the bare user id. Those count as version 0, so they
    // stay valid only until the user's first password or email change.
    const separator = serialized.lastIndexOf(':');
    const id = separator === -1 ? serialized : serialized.slice(0, separator);
    const version = separator === -1 ? 0 : Number(serialized.slice(separator + 1));

    const found = await userDao.getByIdForSession(id);

    // Returning `false` (not undefined, which makes passport throw "Failed to deserialize user
    // out of session") tells passport the session is invalid, so it clears it and continues as
    // anonymous — what we want for a deleted account, a table reset, a stale cookie, or a
    // session signed out by a password or email change.
    if (!found || !Number.isInteger(version)) {
      return done(null, false);
    }

    // Versions only go up, so a session ahead of the stored version is a fresh bump racing an
    // eventually consistent read, not a forgery (the session content lives server side).
    if (version < found.sessionVersion) {
      return done(null, false);
    }

    return done(null, found.user);
  } catch (_err) {
    return done(null, false);
  }
};

/**
 * Re-issues the acting session at a newly bumped sessionVersion, so whoever changed the
 * password or email stays signed in while every other session is signed out. Does nothing
 * when the request isn't signed in as that user (a reset link or confirmation link opened
 * elsewhere). Never rejects: the change itself has already been saved.
 */
export const renewSession = (req: Request, userId: string, sessionVersion: number): Promise<void> =>
  new Promise((resolve) => {
    if (!req.user || req.user.id !== userId) {
      return resolve();
    }
    return req.login({ ...req.user, sessionVersion }, { session: true, keepSessionInfo: true }, (err: any) => {
      if (err) {
        req.logger.error('Failed to renew the session after a credential change', err);
      }
      resolve();
    });
  });

export default (passport: PassportStatic): void => {
  // Local Strategy
  passport.use(new LocalStrategy(verifyLogin));

  passport.serializeUser(serializeSessionUser);

  passport.deserializeUser(deserializeSessionUser);
};
