/* eslint-disable no-await-in-loop */
const express = require('express');

const bcrypt = require('bcryptjs');
const passport = require('passport');
const mailer = require('nodemailer');
const { body } = require('express-validator');
const Email = require('email-templates');
const path = require('path');
const util = require('../serverjs/util');
const fq = require('../serverjs/featuredQueue');
const { render } = require('../serverjs/render');

// Bring in models
const User = require('../dynamo/models/user');
const PasswordReset = require('../dynamo/models/passwordReset');
const Cube = require('../dynamo/models/cube');
const Blog = require('../dynamo/models/blog');
const Patron = require('../dynamo/models/patron');
const FeaturedQueue = require('../dynamo/models/featuredQueue');
const Notification = require('../dynamo/models/notification');
const Draft = require('../dynamo/models/draft');

const router = express.Router();

const { ensureAuth, csrfProtection, flashValidationErrors } = require('./middleware');

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
      return res.redirect('/404');
    }

    if (notification.status === Notification.STATUS.UNREAD) {
      notification.status = Notification.STATUS.READ;
      await Notification.update(notification);
    }

    return res.redirect(notification.url);
  } catch (err) {
    req.logger.error(err);
    return res.status(500).send({
      success: 'false',
      message: err,
    });
  }
});

router.post('/clearnotifications', ensureAuth, async (req, res) => {
  try {
    const notifications = Notification.getByToAndStatus(`${req.user.id}`, Notification.STATUS.UNREAD);
    await Notification.batchPut(
      notifications.map((notification) => {
        notification.STATUS = Notification.STATUS.READ;
        return notification;
      }),
    );

    return res.status(200).send({
      success: 'true',
    });
  } catch (err) {
    req.logger.error(err);
    return res.status(500).send({
      success: 'false',
    });
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
      return res.redirect('/404');
    }

    if (!other.following.some((id) => id === user.id)) {
      other.following.push(user.id);
    }
    if (!user.followedUsers.some((id) => id.equals(other.id))) {
      user.followedUsers.push(other.id);
    }

    await util.addNotification(other, user, `/user/view/${user.id}`, `${user.username} has followed you!`);

    await User.batchPut([other, user]);

    return res.redirect(`/user/view/${req.params.id}`);
  } catch (err) {
    req.logger.error(err);
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
      return res.redirect('/404');
    }

    other.following = other.following.filter((id) => !req.user.id === id);
    user.followedUsers = user.followedUsers.filter((id) => !id.equals(req.params.id));

    await User.batchPut([user, other]);
    await Promise.all([user.save(), other.save()]);

    return res.redirect(`/user/view/${req.params.id}`);
  } catch (err) {
    req.logger.error(err);
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

      const user = await User.getByEmail(recoveryEmail);

      const passwordReset = {
        owner: user.id,
        date: new Date(),
      };

      await PasswordReset.put(passwordReset);

      const smtpTransport = mailer.createTransport({
        name: 'CubeCobra.com',
        secure: true,
        service: 'Gmail',
        auth: {
          user: process.env.EMAIL_CONFIG_USERNAME,
          pass: process.env.EMAIL_CONFIG_PASSWORD,
        },
      });

      const email = new Email({
        message: {
          from: 'Cube Cobra Team <support@cubecobra.com>',
          to: passwordReset.email,
          subject: 'Password Reset',
        },
        send: true,
        juiceResources: {
          webResources: {
            relativeTo: path.join(__dirname, '..', 'public'),
            images: true,
          },
        },
        transport: smtpTransport,
      });

      await email.send({
        template: 'password_reset',
        locals: {
          id: passwordReset.id,
          code: passwordReset.Code,
        },
      });

      req.flash('success', `Password recovery email sent to ${recoveryEmail}`);
      return res.redirect('/user/lostpassword');
    } catch (err) {
      return util.handleRouteError(req, res, err, `/user/lostpassword`);
    }
  },
);

router.get('/passwordreset/:id', async (req, res) => {
  const document = await PasswordReset.getById();
  if (!document || Date.now().valueOf() > document.date + 6 * 60 * 60 * 1000) {
    req.flash('danger', 'Password recovery link expired');
    return res.redirect('/');
  }
  return render(req, res, 'PasswordResetPage');
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
        return render(req, res, 'PasswordResetPage');
      }
      const recoveryEmail = req.body.email.toLowerCase();
      const passwordreset = await PasswordReset.findOne({
        code: req.body.code,
        email: recoveryEmail,
      });

      if (!passwordreset) {
        req.flash('danger', 'Incorrect email and recovery code combination.');
        return render(req, res, 'PasswordResetPage');
      }
      const query = await User.getByEmail(recoveryEmail);

      if (query.items.length !== 1) {
        req.flash('danger', 'No user with that email found! Are you sure you created an account?');
        return render(req, res, 'PasswordResetPage');
      }

      const user = query.items[0];

      if (req.body.password2 !== req.body.password) {
        req.flash('danger', "New passwords don't match");
        return render(req, res, 'PasswordResetPage');
      }

      return bcrypt.genSalt(10, (err4, salt) => {
        if (err4) {
          return util.handleRouteError(req, res, err4, `/`);
        }
        return bcrypt.hash(req.body.password2, salt, async (err5, hash) => {
          if (err5) {
            return util.handleRouteError(req, res, err5, `/`);
          }
          user.Password = hash;
          try {
            await User.update(user);
            req.flash('success', 'Password updated successfully');
            return res.redirect('/user/login');
          } catch (err6) {
            return util.handleRouteError(req, res, err6, `/`);
          }
        });
      });
    } catch (err) {
      return util.handleRouteError(req, res, err, `/`);
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
    ...usernameValid,
  ],
  flashValidationErrors,
  async (req, res) => {
    const email = req.body.email.toLowerCase();
    const { username, password } = req.body;

    const attempt = { email, username };

    if (!req.validated) {
      return render(req, res, 'RegisterPage', attempt);
    }

    const usernameQuery = await User.getByUsername(req.body.username.toLowerCase());

    if (usernameQuery.items.length > 0) {
      req.flash('danger', 'username already taken.');
      return render(req, res, 'RegisterPage', attempt);
    }

    // check if user exists
    const emailQuery = await User.getByEmail(req.body.email.toLowerCase());

    if (emailQuery.items.length > 0) {
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
    };

    return bcrypt.genSalt(10, (err3, salt) => {
      bcrypt.hash(password, salt, async (err4, hash) => {
        if (err4) {
          req.logger.error(err4);
        } else {
          newUser.passwordHash = hash;
          await User.put(newUser);

          req.flash('success', 'Account successfully created. You are now able to login.');
          res.redirect('/user/login');
        }
      });
    });
  },
);

// Login route
router.get('/login', (req, res) => {
  return render(req, res, 'LoginPage');
});

// Login post
router.post('/login', async (req, res, next) => {
  let query;

  if (req.body.username.includes('@')) {
    query = await User.getByEmail(req.body.username.toLowerCase());
  } else {
    query = await User.getByUsername(req.body.username.toLowerCase());
  }

  if (query.items.length !== 1) {
    req.flash('danger', 'Incorrect username or email address.');
    res.redirect('/user/login');
  } else {
    const user = query.items[0];
    req.body.username = user.username;
    // TODO: fix confirmation and check it here.
    let redirect = '/';
    if (req.body.loginCallback) {
      redirect = req.body.loginCallback;
    }
    passport.authenticate('local', {
      successRedirect: redirect,
      failureRedirect: '/user/login',
      failureFlash: { type: 'danger' },
    })(req, res, next);
  }
});

// logout
router.get('/logout', (req, res) => {
  req.logout();
  req.flash('success', 'You have been logged out');
  res.redirect('/');
});

router.get('/view/:id', async (req, res) => {
  try {
    let user = await User.getById(req.params.id);

    // eslint-disable-next-line no-empty
    if (!user) {
      const query = await User.getByUsername(req.params.id.toLowerCase());

      if (query.items.length !== 1) {
        req.flash('danger', 'User not found');
        return res.redirect('/404');
      }

      [user] = query.items;
    }

    const cubes = await Cube.getByOwner(req.params.id);

    const followers = await User.batchGet(user.following || []);

    for (const follower of followers) {
      // don't leak this info
      delete follower.passwordHash;
      delete follower.email;
    }

    const following = req.user && user.following && user.following.some((id) => id === req.user.id);
    user.following = []; // don't want to leak this info
    delete user.passwordHash;
    delete user.email;

    return render(req, res, 'UserCubePage', {
      owner: user,
      cubes: cubes.items,
      followers,
      following,
    });
  } catch (err) {
    req.logger.error(err);
    return res.status(500).send(err);
  }
});

router.get('/decks/:userid', async (req, res) => {
  try {
    const { userid } = req.params;

    const user = await User.getById(userid);
    const decks = await Draft.getByOwner(userid);

    if (!user) {
      req.flash('danger', 'User not found');
      return res.redirect('/404');
    }

    const followers = await User.batchGet(user.following || []);

    for (const follower of followers) {
      // don't leak this info
      delete follower.passwordHash;
      delete follower.email;
    }

    delete user.passwordHash;
    delete user.email;

    return render(req, res, 'UserDecksPage', {
      owner: user,
      followers,
      following: req.user && (req.user.followedUsers || []).some((id) => id === user.id),
      decks: decks.items,
      lastKey: decks.lastKey,
    });
  } catch (err) {
    return util.handleRouteError(req, res, err, '/404');
  }
});

router.get('/notifications', ensureAuth, async (req, res) => {
  const notifications = await Notification.getByTo(`${req.user.id}`);

  return render(req, res, 'NotificationsPage', {
    notifications: notifications.items,
    lastKey: notifications.lastKey,
  });
});

router.post('/getusernotifications', ensureAuth, async (req, res) => {
  const { lastKey } = req.body;
  const notifications = await Notification.getByToAndStatus(`${req.user.id}`, Notification.STATUS.UNREAD, lastKey);

  return res.status(200).send({
    success: 'true',
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
    let user = await User.getById(req.params.userid);

    if (!user) {
      const userQuery = await User.getByUsername(req.params.userid.toLowerCase());

      if (userQuery.items.length !== 1) {
        req.flash('danger', 'User not found');
        return res.redirect('/404');
      }

      [user] = userQuery.items;
    }

    const posts = await Blog.getByOwner(req.params.userid, 10);
    const followers = await User.batchGet(user.following || []);

    for (const follower of [user, ...followers]) {
      // don't leak this info
      delete follower.passwordHash;
      delete follower.email;
    }

    return render(
      req,
      res,
      'UserBlogPage',
      {
        owner: user,
        posts: posts.items,
        lastKey: posts.lastKey,
        followers,
        following: req.user && (req.user.followedUsers || []).some((id) => id === user.id),
      },
      {
        title: user.username,
      },
    );
  } catch (err) {
    return util.handleRouteError(req, res, err, '/404');
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
    const cube = await Cube.getById(entireQueue[i].cubeID);
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
      return res.redirect('/user/account');
    }
    const user = await User.getById(req.user.id);

    if (!user) {
      req.flash('danger', 'User not found');
      return res.redirect('/user/account?nav=password');
    }

    return bcrypt.compare(req.body.password, user.passwordHash, (err2, isMatch) => {
      if (!isMatch) {
        req.flash('danger', 'Password is incorrect');
        return res.redirect('/user/account?nav=password');
      }
      if (req.body.password2 !== req.body.password3) {
        req.flash('danger', "New passwords don't match");
        return res.redirect('/user/account?nav=password');
      }
      return bcrypt.genSalt(10, (err3, salt) => {
        bcrypt.hash(req.body.password2, salt, async (err4, hash) => {
          if (err4) {
            return req.logger.error(err4);
          }
          user.passwordHash = hash;
          await User.update(user);
          req.flash('success', 'Password updated successfully');
          return res.redirect('/user/account?nav=password');
        });
      });
    });
  },
);

router.post('/updateuserinfo', ensureAuth, [...usernameValid], flashValidationErrors, async (req, res) => {
  try {
    const { user } = req;
    if (!req.validated) {
      return res.redirect('/user/account');
    }

    const usernameQuery = await User.getByUsername(req.body.username.toLowerCase());

    usernameQuery.items = usernameQuery.items.filter((item) => item.id !== user.id);

    if (usernameQuery.items.length > 0) {
      req.flash('danger', 'username already taken.');
      return res.redirect('/user/account');
    }

    user.username = req.body.username;
    user.usernameLower = req.body.username.toLowerCase();
    user.about = req.body.body;
    if (req.body.image) {
      user.imageName = req.body.image;
    }
    await User.update(user);

    req.flash('success', 'User information updated.');
    return res.redirect('/user/account');
  } catch (err) {
    return util.handleRouteError(req, res, err, '/user/account');
  }
});

router.post('/updateemail', ensureAuth, async (req, res) => {
  const emailQuery = await User.getByEmail(req.body.email.toLowerCase());

  emailQuery.items = emailQuery.items.filter((item) => item.id !== req.user.id);

  if (emailQuery.items.length > 0) {
    req.flash('danger', 'username already taken.');
    return res.redirect('/user/account');
  }

  const user = await User.getById(req.params.id);

  user.email = req.body.email;
  await User.update(user);

  req.flash('success', 'Your profile has been updated.');
  return res.redirect('/user/account');
});

router.post('/changedisplay', ensureAuth, async (req, res) => {
  try {
    const user = await User.getById(req.user.id);

    user.theme = req.body.theme;
    user.hideFeatured = req.body.hideFeatured === 'on';

    await User.update(user);

    req.flash('success', 'Your display preferences have been updated.');
    res.redirect('/user/account');
  } catch (err) {
    req.flash('danger', `Could not save preferences: ${err.message}`);
    res.redirect('/user/account?nav=display');
  }
});

router.get('/social', ensureAuth, async (req, res) => {
  try {
    const followedCubes = await Cube.batchGet(req.user.followedCubes || []);
    const followers = await User.batchGet(req.user.following || []);
    const followedUsers = await User.batchGet(req.user.followedUsers || []);

    for (const follower of [...followers, ...followedUsers]) {
      // don't leak this info
      delete follower.passwordHash;
      delete follower.email;
    }

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
    return util.handleRouteError(req, res, err, '/');
  }
});

router.post('/queuefeatured', ensureAuth, async (req, res) => {
  const redirect = '/user/account?nav=patreon';
  if (!req.body.cubeId) {
    req.flash('danger', 'Cube ID not sent');
    return res.redirect(redirect);
  }

  const cube = await Cube.getById(req.body.cubeId);
  if (!cube) {
    req.flash('danger', 'Cube not found');
    return res.redirect(redirect);
  }
  if (cube.owner !== req.user.id) {
    req.flash('danger', 'Only an owner of a cube can add it to the queue');
    return res.redirect(redirect);
  }

  if (cube.visibility === Cube.VISIBILITY.PRIVATE) {
    req.flash('danger', 'Private cubes cannot be featured');
    return res.redirect(redirect);
  }

  const patron = await Patron.getById(req.user.id);
  if (!fq.canBeFeatured(patron)) {
    req.flash('danger', 'Insufficient Patreon status for featuring a cube');
    return res.redirect(redirect);
  }

  const update = await fq.updateFeatured(async (featured) => {
    const currentIndex = featured.queue.findIndex((f) => f.ownerID.equals(req.user.id));
    if (currentIndex === 0 || currentIndex === 1) {
      throw new Error('Cannot change currently featured cube');
    }
    let message;
    if (currentIndex === -1) {
      featured.queue.push({ cubeID: cube.id, ownerID: req.user.id });
      message = 'Successfully added cube to queue';
    } else {
      featured.queue[currentIndex].cubeID = cube.id;
      message = 'Successfully replaced cube in queue';
    }
    return message;
  });

  if (!update.ok) req.flash('danger', update.message);
  else req.flash('success', update.return);
  return res.redirect(redirect);
});

router.post('/unqueuefeatured', ensureAuth, async (req, res) => {
  const redirect = '/user/account?nav=patreon';

  const update = await fq.updateFeatured(async (featured) => {
    const index = featured.queue.findIndex((f) => f.ownerID.equals(req.user.id));
    if (index === -1) {
      throw new Error('Nothing to remove');
    }
    if (index === 0 || index === 1) {
      throw new Error('Cannot remove currently featured cube');
    }
    featured.queue.splice(index, 1);
  });

  if (!update.ok) req.flash('danger', update.message);
  else req.flash('success', 'Successfully removed cube from queue');
  return res.redirect(redirect);
});

module.exports = router;
