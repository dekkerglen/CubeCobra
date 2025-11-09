const express = require('express');

const bcrypt = require('bcryptjs');
const passport = require('passport');
const { body } = require('express-validator');
const { isCubeListed } = require('../util/cubefn');
const util = require('../util/util');
const fq = require('../util/featuredQueue');
import sendEmail from '../util/email';
const { handleRouteError, render, redirect } = require('../util/render');
const { getSafeReferrer } = require('../util/util');

// Bring in models
const User = require('../dynamo/models/user');
const PasswordReset = require('../dynamo/models/passwordReset');
const Cube = require('../dynamo/models/cube');
const Blog = require('../dynamo/models/blog');
const Patron = require('../dynamo/models/patron');
const FeaturedQueue = require('../dynamo/models/featuredQueue');
const Notification = require('../dynamo/models/notification');
const Draft = require('../dynamo/models/draft');
const Notice = require('../dynamo/models/notice');
const uuid = require('uuid');

import { DefaultPrintingPreference, PrintingPreference } from '@utils/datatypes/Card';
import { NoticeType } from '@utils/datatypes/Notice';
import { NotificationStatus } from '@utils/datatypes/Notification';
import { DefaultGridTightnessPreference, GridTightnessPreference } from '@utils/datatypes/User';

const router = express.Router();

const { ensureAuth, csrfProtection, flashValidationErrors, recaptcha } = require('./middleware');

// For consistency between different forms, validate username through this function.
const usernameValid = [
  body('username', 'username is required').notEmpty(),
  body('username', 'username must be between 5 and 24 characters.').isLength({
    min: 5,
    max: 24,
  }),
  body('username', 'username must only contain alphanumeric characters.').matches(/^[0-9a-zA-Z]*$/, 'i'),
  body('username', 'username may not use profanity.').custom((value) => !util.hasProfanity(value)),
];

function checkPasswordsMatch(value, { req }) {
  if (value !== req.body.password2) {
    throw new Error('Password confirmation does not match password');
  }

  return true;
}
router.use(csrfProtection);

router.get('/notification/:id', ensureAuth, async (req, res) => {
  try {
    const notification = await Notification.getById(req.params.id);

    if (!notification) {
      req.flash('danger', 'Not Found');
      return redirect(req, res, '/404');
    }

    if (notification.status === NotificationStatus.UNREAD) {
      notification.status = NotificationStatus.READ;
      await Notification.update(notification);
    }

    return redirect(req, res, notification.url);
  } catch (err) {
    req.logger.error(err.message, err.stack);
    return res.status(500).send({
      success: 'false',
      message: err,
    });
  }
});

router.post('/clearnotifications', ensureAuth, async (req, res) => {
  try {
    let items, lastKey;

    do {
      const result = await Notification.getByToAndStatus(`${req.user.id}`, NotificationStatus.UNREAD, lastKey);

      items = result.items;
      lastKey = result.lastKey;

      await Notification.batchPut(
        items.map((notification) => ({
          ...notification,
          status: NotificationStatus.READ,
        })),
      );
    } while (lastKey);

    return res.status(200).send({
      success: 'true',
    });
  } catch (err) {
    req.logger.error(err.message, err.stack);
    return res.status(500).send({
      success: 'false',
    });
  }
});

router.get('/report/:id', ensureAuth, async (req, res) => {
  try {
    const user = await User.getById(req.params.id);

    if (!user) {
      req.flash('danger', 'User not found');
      return redirect(req, res, '/404');
    }
    const report = {
      subject: user.id,
      body: `"${user.username}" was reported by ${req.user.username}`,
      user: req.user ? req.user.id : null,
      date: Date.now().valueOf(),
      type: NoticeType.CUBE_REPORT,
    };

    await Notice.put(report);

    req.flash(
      'success',
      'Thank you for the report! Our moderators will review the report and decide whether to take action.',
    );

    return redirect(req, res, `/user/view/${req.params.id}`);
  } catch (err) {
    return handleRouteError(req, res, err, `/user/view/${req.params.id}`);
  }
});

// Lost password form
router.get('/lostpassword', (req, res) => {
  return render(req, res, 'LostPasswordPage');
});

router.get('/follow/:id', ensureAuth, async (req, res) => {
  try {
    const { user } = req;
    const other = await User.getById(req.params.id);

    if (!other) {
      req.flash('danger', 'User not found');
      return redirect(req, res, '/404');
    }

    if (!other.following.some((id) => id === user.id)) {
      other.following.push(user.id);
    }
    if (!user.followedUsers.some((id) => id.equals === other.id)) {
      user.followedUsers.push(other.id);
    }

    await util.addNotification(other, user, `/user/view/${user.id}`, `${user.username} has followed you!`);

    await User.batchPut([other, user]);

    return redirect(req, res, `/user/view/${req.params.id}`);
  } catch (err) {
    req.logger.error(err.message, err.stack);
    return res.status(500).send({
      success: 'false',
    });
  }
});

router.get('/unfollow/:id', ensureAuth, async (req, res) => {
  try {
    const { user } = req;
    const other = await User.getById(req.params.id);

    if (!other) {
      req.flash('danger', 'User not found');
      return redirect(req, res, '/404');
    }

    other.following = other.following.filter((id) => req.user.id !== id);
    user.followedUsers = user.followedUsers.filter((id) => id !== req.params.id);

    await User.batchPut([user, other]);

    return redirect(req, res, `/user/view/${req.params.id}`);
  } catch (err) {
    req.logger.error(err.message, err.stack);
    return res.status(500).send({
      success: 'false',
    });
  }
});

// Lost password submit
router.post(
  '/lostpassword',
  [body('email', 'email is required').isEmail()],
  flashValidationErrors,
  async (req, res) => {
    try {
      if (!req.validated) {
        return render(req, res, 'LostPasswordPage');
      }
      const recoveryEmail = req.body.email.toLowerCase();

      const userByEmail = await User.getByEmail(recoveryEmail);

      if (!userByEmail) {
        req.flash('danger', 'No user with that email found.');
        return render(req, res, 'LostPasswordPage');
      }

      const user = await User.getByIdWithSensitiveData(userByEmail.id);

      const passwordReset = {
        owner: user.id,
        date: new Date().valueOf(),
      };

      const id = await PasswordReset.put(passwordReset);

      await sendEmail(user.email, 'Password Reset', 'password_reset', {
        id,
      });

      req.flash('success', `Password recovery email sent to ${recoveryEmail}`);
      return redirect(req, res, '/user/lostpassword');
    } catch (err) {
      return handleRouteError(req, res, err, `/user/lostpassword`);
    }
  },
);

router.get('/passwordreset/:id', async (req, res) => {
  const document = await PasswordReset.getById(req.params.id);
  if (!document || Date.now().valueOf() > document.date + 6 * 60 * 60 * 1000) {
    req.flash('danger', 'Password recovery link expired');
    return redirect(req, res, '/');
  }
  return render(req, res, 'PasswordResetPage', { code: req.params.id });
});

router.post(
  '/lostpasswordreset',
  [
    body('password', 'Password must be between 8 and 24 characters.').isLength({ min: 8, max: 24 }),
    body('password', 'New passwords must match.').custom(checkPasswordsMatch),
  ],
  flashValidationErrors,
  async (req, res) => {
    try {
      if (!req.validated) {
        return render(req, res, 'PasswordResetPage', { code: req.body.code });
      }
      const recoveryEmail = req.body.email.toLowerCase();
      const passwordreset = await PasswordReset.getById(req.body.code);

      if (!passwordreset) {
        req.flash('danger', 'Incorrect email and recovery code combination.');
        return render(req, res, 'PasswordResetPage', { code: req.body.code });
      }
      const userByEmail = await User.getByEmail(recoveryEmail);

      if (!userByEmail) {
        req.flash('danger', 'No user with that email found! Are you sure you created an account?');
        return render(req, res, 'PasswordResetPage', { code: req.body.code });
      }

      const user = await User.getByIdWithSensitiveData(userByEmail.id);

      if (req.body.password2 !== req.body.password) {
        req.flash('danger', "New passwords don't match");
        return render(req, res, 'PasswordResetPage', { code: req.body.code });
      }

      const salt = await bcrypt.genSalt(10);
      user.passwordHash = await bcrypt.hash(req.body.password2, salt);
      await User.update(user);

      req.flash('success', 'Password updated successfully');
      return redirect(req, res, '/user/login');
    } catch (err) {
      return handleRouteError(req, res, err, `/user/login`);
    }
  },
);

// Register form
router.get('/register', (req, res) => {
  return render(req, res, 'RegisterPage');
});

// Register process
router.post(
  '/register',
  [
    body('email', 'email is required').notEmpty(),
    body('email', 'email is not valid').isEmail(),
    body('email', 'email must be between 5 and 100 characters.').isLength({
      min: 5,
      max: 100,
    }),
    body('password', 'Password is required').notEmpty(),
    body('password', 'Password must be between 8 and 24 characters.').isLength({
      min: 8,
      max: 24,
    }),
    body('password2', 'Confirm Password is required').notEmpty(),
    body('password2', 'Confirm Password must match password.').custom((value, { req }) => {
      return value === req.body.password;
    }),
    ...usernameValid,
  ],
  recaptcha,
  flashValidationErrors,
  async (req, res) => {
    try {
      const email = req.body.email.toLowerCase();
      const { username, password } = req.body;

      const attempt = { email, username };

      if (!req.validated) {
        return render(req, res, 'RegisterPage', attempt);
      }

      try {
        util.validateEmail(email);
      } catch (err) {
        req.flash('danger', err.message);
        return render(req, res, 'RegisterPage', attempt);
      }

      const userByName = await User.getByUsername(req.body.username.toLowerCase());

      if (userByName) {
        req.flash('danger', 'username already taken.');
        return render(req, res, 'RegisterPage', attempt);
      }

      // check if user exists
      const user = await User.getByEmail(req.body.email.toLowerCase());

      if (user) {
        req.flash('danger', 'email already associated with an existing account.');
        return render(req, res, 'RegisterPage', attempt);
      }

      const newUser = {
        email,
        username,
        followedCubes: [],
        followedUsers: [],
        following: [],
        hideFeatured: false,
        hideTagColors: false,
        imageName: 'Ambush Viper',
        roles: [],
        theme: 'default',
        emailVerified: false,
        token: uuid.v4(),
        dateCreated: new Date().valueOf(),
        defaultPrinting: DefaultPrintingPreference,
        gridTightness: DefaultGridTightnessPreference,
        autoBlog: false,
      };

      const salt = await bcrypt.genSalt(10);
      newUser.passwordHash = await bcrypt.hash(password, salt);
      const id = await User.put(newUser);

      await sendEmail(email, 'Please verify your new Cube Cobra account', 'confirm_email', {
        id,
        token: newUser.token,
      });

      req.flash('success', 'Account successfully created. Please check your email for a verification link to login.');
      return redirect(req, res, '/user/login');
    } catch (err) {
      handleRouteError(req, res, err, '/user/register');
    }
  },
);

router.get('/register/confirm/:id/:token', async (req, res) => {
  try {
    const user = await User.getById(req.params.id);

    if (!user) {
      req.flash('danger', 'User not found');
      return redirect(req, res, '/user/login');
    }

    if (user.token !== req.params.token) {
      req.flash('danger', 'Invalid token');
      return redirect(req, res, '/user/login');
    }

    user.emailVerified = true;
    await User.update(user);

    req.flash('success', 'Email verified. You can now login.');
    return redirect(req, res, '/user/login');
  } catch (err) {
    return handleRouteError(req, res, err, '/user/login');
  }
});

// Login route
router.get('/login', (req, res) => {
  return render(req, res, 'LoginPage');
});

const getLoginRedirect = (req) => {
  const redirectRoute = getSafeReferrer(req) || '/';

  //Landing is the public default page, dashboard is the logged in one
  if (redirectRoute === '/landing' || redirectRoute === '/user/login') {
    return '/dashboard';
  } else {
    return redirectRoute;
  }
};

// Login post
router.post('/login', async (req, res) => {
  let user;

  if (!req.body.username || req.body.username.toLowerCase().length === 0) {
    req.flash('danger', 'Incorrect Username or email address.');
    return redirect(req, res, '/user/login');
  }

  if (req.body.username.includes('@')) {
    user = await User.getByEmail(req.body.username.toLowerCase());
  } else {
    user = await User.getByUsername(req.body.username.toLowerCase());
  }

  if (!user) {
    req.flash('danger', 'Incorrect Username or email address.');
    return redirect(req, res, '/user/login');
  }

  if (user.emailVerified === false) {
    req.flash('danger', 'Your account is not verified. Please check your email for a verification link.');
    return redirect(req, res, '/user/login');
  }

  req.body.username = user.username;
  passport.authenticate('local', {
    successRedirect: getLoginRedirect(req),
    failureRedirect: '/user/login',
    failureFlash: { type: 'danger' },
  })(req, res, () => {
    return redirect(req, res, '/');
  });
});

// logout
router.get('/logout', (req, res) => {
  req.session.destroy(() => {
    return redirect(req, res, '/');
  });
});

router.get('/view/:id', async (req, res) => {
  try {
    const user = await User.getByIdOrUsername(req.params.id);

    if (!user) {
      req.flash('danger', 'User not found');
      return redirect(req, res, '/404');
    }

    const cubes = (await Cube.getByOwner(user.id)).items.filter((cube) => isCubeListed(cube, req.user));

    const following = req.user && user.following && user.following.some((id) => id === req.user.id);

    return render(req, res, 'UserCubePage', {
      owner: user,
      cubes,
      followersCount: (user.following || []).length,
      following,
    });
  } catch (err) {
    return handleRouteError(req, res, err, '/404');
  }
});

router.get('/decks/:userid', async (req, res) => {
  try {
    const { userid } = req.params;

    const user = await User.getById(userid);
    const decks = await Draft.getByOwner(userid);

    if (!user) {
      req.flash('danger', 'User not found');
      return redirect(req, res, '/404');
    }

    return render(req, res, 'UserDecksPage', {
      owner: user,
      followersCount: (user.following || []).length,
      following: req.user && (req.user.followedUsers || []).some((id) => id === user.id),
      decks: decks.items,
      lastKey: decks.lastEvaluatedKey,
    });
  } catch (err) {
    return handleRouteError(req, res, err, '/404');
  }
});

router.post('/getmoredecks', ensureAuth, async (req, res) => {
  const { lastKey } = req.body;
  const decks = await Draft.getByOwner(req.user.id, lastKey);

  return res.status(200).send({
    success: 'true',
    decks: decks.items,
    lastKey: decks.lastEvaluatedKey,
  });
});

router.get('/notifications', ensureAuth, async (req, res) => {
  const notifications = await Notification.getByTo(`${req.user.id}`);

  return render(req, res, 'NotificationsPage', {
    notifications: notifications.items,
    lastKey: notifications.lastKey,
  });
});

router.post('/getmorenotifications', ensureAuth, async (req, res) => {
  const { lastKey } = req.body;
  const notifications = await Notification.getByTo(`${req.user.id}`, lastKey);

  return res.status(200).send({
    success: 'true',
    notifications: notifications.items,
    lastKey: notifications.lastKey,
  });
});

router.get('/blog/:userid', async (req, res) => {
  try {
    const user = await User.getByIdOrUsername(req.params.userid);

    if (!user) {
      req.flash('danger', 'User not found');
      return redirect(req, res, '/404');
    }

    const posts = await Blog.getByOwner(req.params.userid, 10);

    return render(
      req,
      res,
      'UserBlogPage',
      {
        owner: user,
        posts: posts.items,
        lastKey: posts.lastKey,
        followersCount: (user.following || []).length,
        following: req.user && (req.user.followedUsers || []).some((id) => id === user.id),
      },
      {
        title: user.username,
      },
    );
  } catch (err) {
    return handleRouteError(req, res, err, '/404');
  }
});

router.post('/getmoreblogs', ensureAuth, async (req, res) => {
  const { lastKey, owner } = req.body;
  const posts = await Blog.getByOwner(owner, 10, lastKey);

  return res.status(200).send({
    success: 'true',
    posts: posts.items,
    lastKey: posts.lastKey,
  });
});

// account page
router.get('/account', ensureAuth, async (req, res) => {
  const patron = await Patron.getById(req.user.id);

  const entireQueue = [];

  if (patron) {
    let lastKey;

    do {
      const result = await FeaturedQueue.querySortedByDate(lastKey);
      lastKey = result.lastKey;
      entireQueue.push(...result.items);
    } while (lastKey);
  }

  const i = entireQueue.findIndex((f) => f.owner === req.user.id);
  let myFeatured;
  if (i !== -1) {
    const cube = await Cube.getById(entireQueue[i].cube);
    myFeatured = { cube, position: i + 1 };
  }

  return render(
    req,
    res,
    'UserAccountPage',
    {
      defaultNav: req.query.nav || 'profile',
      patreonRedirectUri: process.env.PATREON_REDIRECT || '',
      patreonClientId: process.env.PATREON_CLIENT_ID || '',
      patron,
      featured: myFeatured,
    },
    {
      title: 'Account',
    },
  );
});

router.post(
  '/resetpassword',
  ensureAuth,
  [
    body('password', 'Password must be between 8 and 24 characters.').isLength({
      min: 8,
      max: 24,
    }),
  ],
  flashValidationErrors,
  async (req, res) => {
    if (!req.validated) {
      return redirect(req, res, '/user/account');
    }
    const user = await User.getByIdWithSensitiveData(req.user.id);

    if (!user) {
      req.flash('danger', 'User not found');
      return redirect(req, res, '/user/account?nav=password');
    }

    return bcrypt.compare(req.body.password, user.passwordHash, (err2, isMatch) => {
      if (!isMatch) {
        req.flash('danger', 'Password is incorrect');
        return redirect(req, res, '/user/account?nav=password');
      }
      if (req.body.password2 !== req.body.password3) {
        req.flash('danger', "New passwords don't match");
        return redirect(req, res, '/user/account?nav=password');
      }
      return bcrypt.genSalt(10, (err3, salt) => {
        bcrypt.hash(req.body.password2, salt, async (err4, hash) => {
          if (err4) {
            return req.logger.error(err4.message, err4.stack);
          }
          user.passwordHash = hash;
          await User.update(user);
          req.flash('success', 'Password updated successfully');
          return redirect(req, res, '/user/account?nav=password');
        });
      });
    });
  },
);

router.post('/updateuserinfo', ensureAuth, [...usernameValid], flashValidationErrors, async (req, res) => {
  try {
    const { user } = req;
    if (!req.validated) {
      return redirect(req, res, '/user/account');
    }

    if (req.body.username.toLowerCase() !== user.username.toLowerCase()) {
      const userByName = await User.getByUsername(req.body.username.toLowerCase());

      if (userByName) {
        req.flash('danger', 'username already taken.');
        return redirect(req, res, '/user/account');
      }
    }

    if (util.hasProfanity(req.body.username)) {
      req.flash('danger', 'username may not use profanity. If you believe this is in error, please contact us.');
      return redirect(req, res, '/user/account');
    }

    if (util.hasProfanity(req.body.body)) {
      req.flash('danger', 'About me may not use profanity. If you believe this is in error, please contact us.');
      return redirect(req, res, '/user/account');
    }

    user.username = req.body.username;
    user.usernameLower = req.body.username.toLowerCase();
    user.about = req.body.body;
    if (req.body.image) {
      user.imageName = req.body.image;
    }
    await User.update(user);

    req.flash('success', 'User information updated.');
    return redirect(req, res, '/user/account');
  } catch (err) {
    return handleRouteError(req, res, err, '/user/account');
  }
});

router.post('/updateemail', ensureAuth, async (req, res) => {
  const emailUser = await User.getByEmail(req.body.email.toLowerCase());

  if (emailUser && emailUser.id === req.user.id) {
    req.flash('danger', 'This is already your email.');
    return redirect(req, res, '/user/account');
  }

  if (emailUser) {
    req.flash('danger', 'email already taken.');
    return redirect(req, res, '/user/account');
  }

  const user = await User.getById(req.user.id);

  user.email = req.body.email;
  await User.update(user);

  req.flash('success', 'Your profile has been updated.');
  return redirect(req, res, '/user/account');
});

router.post('/changedisplay', ensureAuth, async (req, res) => {
  try {
    const user = await User.getById(req.user.id);

    const errors = [];
    if (!['default', 'dark'].includes(req.body.theme)) {
      errors.push({ msg: 'Theme must be valid.' });
    }

    if (![PrintingPreference.RECENT, PrintingPreference.FIRST].includes(req.body.defaultPrinting)) {
      errors.push({ msg: 'Printing must be valid.' });
    }

    if (![GridTightnessPreference.TIGHT, GridTightnessPreference.LOOSE].includes(req.body.gridTightness)) {
      errors.push({ msg: 'Grid tightness must be valid.' });
    }

    if (errors.length > 0) {
      req.flash('danger', 'Error updating display settings: ' + errors.map((error) => error.msg).join(', '));
      return redirect(req, res, '/user/account?nav=display');
    }

    user.theme = req.body.theme;
    user.hideFeatured = req.body.hideFeatured === 'true';
    user.defaultPrinting = req.body.defaultPrinting;
    user.gridTightness = req.body.gridTightness;
    user.autoBlog = req.body.autoBlog === 'true';

    await User.update(user);

    req.flash('success', 'Your display preferences have been updated.');
    return redirect(req, res, '/user/account');
  } catch (err) {
    req.flash('danger', `Could not save preferences: ${err.message}`);
    return redirect(req, res, '/user/account?nav=display');
  }
});

router.get('/social', ensureAuth, async (req, res) => {
  try {
    let followedCubes = (await Cube.batchGet(req.user.followedCubes || [])).filter((cube) => cube.visibility !== 'pr');
    const followers = await User.batchGet(req.user.following || []);
    const followedUsers = await User.batchGet(req.user.followedUsers || []);

    return render(
      req,
      res,
      'UserSocialPage',
      {
        followedCubes,
        followedUsers,
        followers,
      },
      {
        title: 'Social',
      },
    );
  } catch (err) {
    return handleRouteError(req, res, err, '/');
  }
});

router.post('/queuefeatured', ensureAuth, async (req, res) => {
  const redirectTo = '/user/account?nav=patreon&tab=4';
  if (!req.body.cubeId) {
    req.flash('danger', 'Cube ID not sent');
    return redirect(req, res, redirectTo);
  }

  const cube = await Cube.getById(req.body.cubeId);
  if (!cube) {
    req.flash('danger', 'Cube not found');
    return redirect(req, res, redirectTo);
  }
  if (cube.owner.id !== req.user.id) {
    req.flash('danger', 'Only an owner of a cube can add it to the queue');
    return redirect(req, res, redirectTo);
  }

  if (cube.visibility === Cube.VISIBILITY.PRIVATE) {
    req.flash('danger', 'Private cubes cannot be featured');
    return redirect(req, res, redirectTo);
  }

  const patron = await Patron.getById(req.user.id);
  if (!fq.canBeFeatured(patron)) {
    req.flash('danger', 'Insufficient Patreon status for featuring a cube');
    return redirect(req, res, redirectTo);
  }

  const shouldUpdate = await fq.doesUserHaveFeaturedCube(req.user.id);

  try {
    if (shouldUpdate) {
      await fq.replaceForUser(req.user.id, cube.id);
      req.flash('success', 'Successfully replaced cube in queue');
    } else {
      await fq.addNewCubeToQueue(req.user.id, cube.id);
      req.flash('success', 'Successfully added cube to queue');
    }
  } catch (err) {
    req.flash('danger', err.message);
  }

  return redirect(req, res, redirectTo);
});

router.post('/unqueuefeatured', ensureAuth, async (req, res) => {
  try {
    await fq.removeCubeFromQueue(req.user.id);

    req.flash('success', 'Successfully removed cube from queue');
  } catch (err) {
    req.flash('danger', err.message);
  }
  return redirect(req, res, '/user/account?nav=patreon&tab=4');
});

module.exports = router;
