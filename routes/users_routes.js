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
const PasswordReset = require('../models/passwordreset');
const Cube = require('../dynamo/models/cube');
const Deck = require('../models/deck');
const Blog = require('../models/blog');
const Patron = require('../models/patron');
const FeaturedCubes = require('../models/featuredCubes');
const Notification = require('../dynamo/models/notification');

const router = express.Router();

const { ensureAuth, csrfProtection, flashValidationErrors } = require('./middleware');
const { fillBlogpostChangelog } = require('../serverjs/blogpostUtils');

// For consistency between different forms, validate username through this function.
const usernameValid = [
  body('username', 'Username is required').notEmpty(),
  body('username', 'Username must be between 5 and 24 characters.').isLength({
    min: 5,
    max: 24,
  }),
  body('username', 'Username must only contain alphanumeric characters.').matches(/^[0-9a-zA-Z]*$/, 'i'),
  body('username', 'Username may not use profanity.').custom((value) => !util.hasProfanity(value)),
];

function checkPasswordsMatch(value, { req }) {
  if (value !== req.body.password2) {
    throw new Error('Password confirmation does not match password');
  }

  return true;
}

function addMinutes(date, minutes) {
  return new Date(new Date(date).getTime() + minutes * 60000);
}

router.use(csrfProtection);

router.get('/notification/:id', ensureAuth, async (req, res) => {
  try {
    const notification = await Notification.getById(req.params.id);

    if (!notification) {
      req.flash('danger', 'Not Found');
      return res.redirect('/404');
    }

    if (notification.Status === Notification.STATUS.UNREAD) {
      notification.Status = Notification.STATUS.READ;
      await notification.update(notification);
    }

    return res.redirect(notification.Url);
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
    const notifications = Notification.getByToAndStatus(`${req.user.Id}`, Notification.STATUS.UNREAD);
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

    if (!other.UsersFollowing.some((id) => id === user.Id)) {
      other.UsersFollowing.push(user.Id);
    }
    if (!user.FollowedUsers.some((id) => id.equals(other.Id))) {
      user.FollowedUsers.push(other.Id);
    }

    await util.addNotification(other, user, `/user/view/${user.Id}`, `${user.Username} has followed you!`);

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

    other.UsersFollowing = other.UsersFollowing.filter((id) => !req.user.Id === id);
    user.FollowedUsers = user.FollowedUsers.filter((id) => !id.equals(req.params.id));

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
  [body('email', 'Email is required').isEmail()],
  flashValidationErrors,
  async (req, res) => {
    try {
      if (!req.validated) {
        return render(req, res, 'LostPasswordPage');
      }
      const recoveryEmail = req.body.email.toLowerCase();
      await PasswordReset.deleteOne({
        email: recoveryEmail,
      });

      const passwordReset = new PasswordReset();
      passwordReset.expires = addMinutes(Date.now(), 15);
      passwordReset.email = recoveryEmail;
      passwordReset.code = Math.floor(1000000000 + Math.random() * 9000000000);
      await passwordReset.save();

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
          code: passwordReset.code,
        },
      });

      req.flash('success', `Password recovery email sent to ${recoveryEmail}`);
      return res.redirect('/user/lostpassword');
    } catch (err) {
      return util.handleRouteError(req, res, err, `/user/lostpassword`);
    }
  },
);

router.get('/passwordreset/:id', (req, res) => {
  // create a password reset page and return it here
  PasswordReset.findById(req.params.id, (err, passwordreset) => {
    if (!passwordreset || Date.now() > passwordreset.expires) {
      req.flash('danger', 'Password recovery link expired');
      return res.redirect('/');
    }
    return render(req, res, 'PasswordResetPage');
  });
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
    body('email', 'Email is required').notEmpty(),
    body('email', 'Email is not valid').isEmail(),
    body('email', 'Email must be between 5 and 100 characters.').isLength({
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
      req.flash('danger', 'Username already taken.');
      return render(req, res, 'RegisterPage', attempt);
    }

    // check if user exists
    const emailQuery = await User.getByEmail(req.body.email.toLowerCase());

    if (emailQuery.items.length > 0) {
      req.flash('danger', 'Email already associated with an existing account.');
      return render(req, res, 'RegisterPage', attempt);
    }

    const newUser = {
      Email: email,
      Username: username,
      Confirmed: false,
    };

    return bcrypt.genSalt(10, (err3, salt) => {
      bcrypt.hash(password, salt, async (err4, hash) => {
        if (err4) {
          req.logger.error(err4);
        } else {
          newUser.PasswordHash = hash;
          await User.put(newUser);

          const smtpTransport = mailer.createTransport({
            name: 'CubeCobra.com',
            secure: true,
            service: 'Gmail',
            auth: {
              user: process.env.EMAIL_CONFIG_USERNAME,
              pass: process.env.EMAIL_CONFIG_PASSWORD,
            },
          });

          const confirmEmail = new Email({
            message: {
              from: 'Cube Cobra Team <support@cubecobra.com>',
              to: email,
              subject: 'Confirm Account',
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

          confirmEmail
            .send({
              template: 'confirm_email',
              locals: {
                id: newUser.Id,
              },
            })
            .then(() => {
              req.flash('success', 'Account successfully created. You are now able to login.');
              res.redirect('/user/login');
            });
        }
      });
    });
  },
);

// Register confirm
router.get('/register/confirm/:id', async (req, res) => {
  const user = await User.getById(req.params.id);

  if (user.Confirmed) {
    req.flash('success', 'User already confirmed.');
    return res.redirect('/user/login');
  }

  user.Confirmed = true;
  await User.update(user);
  req.flash('success', 'User successfully confirmed');
  return res.redirect('/user/login');
});

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
    req.body.username = user.Username;
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

    const followers = await User.batchGet(user.UsersFollowing);

    for (const follower of followers) {
      // don't leak this info
      delete follower.PasswordHash;
      delete follower.Email;
    }

    const following = req.user && user.UsersFollowing && user.UsersFollowing.some((id) => id === req.user.Id);
    user.UsersFollowing = []; // don't want to leak this info
    delete user.PasswordHash;
    delete user.Email;

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

router.get('/decks/:userid', (req, res) => {
  res.redirect(`/user/decks/${req.params.userid}/0`);
});

router.get('/notifications', ensureAuth, async (req, res) => {
  const notifications = await Notification.getByTo(`${req.user.Id}`);

  return render(req, res, 'NotificationsPage', {
    notifications: notifications.items,
    lastKey: notifications.lastKey,
  });
});

router.post('/getusernotifications', ensureAuth, async (req, res) => {
  const { lastKey } = req.body;
  const notifications = await Notification.getByToAndStatus(`${req.user.Id}`, Notification.STATUS.UNREAD, lastKey);

  return res.status(200).send({
    success: 'true',
    notifications: notifications.items,
    lastKey: notifications.lastKey,
  });
});

router.post('/getmorenotifications', ensureAuth, async (req, res) => {
  const { lastKey } = req.body;
  const notifications = await Notification.getByTo(`${req.user.Id}`, lastKey);

  return res.status(200).send({
    success: 'true',
    notifications: notifications.items,
    lastKey: notifications.lastKey,
  });
});

router.get('/decks/:userid/:page', async (req, res) => {
  try {
    const { userid } = req.params;
    const pagesize = 30;

    const user = await User.getById(userid);

    const decksQ = Deck.find(
      {
        owner: userid,
      },
      '_id seats date cube owner cubeOwner',
    )
      .sort({
        date: -1,
      })
      .skip(pagesize * Math.max(req.params.page, 0))
      .limit(pagesize)
      .lean();
    const numDecksQ = Deck.countDocuments({
      owner: userid,
    });

    const [numDecks, decks] = await Promise.all([numDecksQ, decksQ]);

    if (!user) {
      req.flash('danger', 'User not found');
      return res.redirect('/404');
    }

    const followers = await User.batchGet(user.UsersFollowing);

    for (const follower of followers) {
      // don't leak this info
      delete follower.PasswordHash;
      delete follower.Email;
    }

    delete user.UsersFollowing; // don't leak this info
    delete user.PasswordHash;
    delete user.Email;

    return render(req, res, 'UserDecksPage', {
      owner: user,
      followers,
      following: req.user && req.user.FollowedUsers.some((id) => id === user.Id),
      decks: decks || [],
      pages: Math.ceil(numDecks / pagesize),
      activePage: Math.max(req.params.page, 0),
    });
  } catch (err) {
    return util.handleRouteError(req, res, err, '/404');
  }
});

router.get('/blog/:userid', (req, res) => {
  res.redirect(`/user/blog/${req.params.userid}/0`);
});

router.get('/blog/:userid/:page', async (req, res) => {
  try {
    const pagesize = 30;

    const user = await User.getById(req.params.userid);

    const postsq = Blog.find({
      owner: user.Id,
    })
      .sort({
        date: -1,
      })
      .skip(Math.max(req.params.page, 0) * pagesize)
      .limit(pagesize)
      .lean();

    const numBlogsq = Blog.countDocuments({
      owner: user.Id,
    });

    const followers = await User.batchGet(user.UsersFollowing);

    for (const follower of followers) {
      // don't leak this info
      delete follower.PasswordHash;
      delete follower.Email;
    }

    const [posts, numBlogs] = await Promise.all([postsq, numBlogsq]);
    posts.forEach(fillBlogpostChangelog);

    delete user.UsersFollowing; // don't leak this info
    delete user.PasswordHash;
    delete user.Email;
    return render(
      req,
      res,
      'UserBlogPage',
      {
        owner: user,
        posts,
        canEdit: req.user && req.user.Id === user.Id,
        followers,
        following: req.user && req.user.FollowedUsers.some((id) => id === user.Id),
        pages: Math.ceil(numBlogs / pagesize),
        activePage: Math.max(req.params.page, 0),
      },
      {
        title: user.Username,
      },
    );
  } catch (err) {
    return util.handleRouteError(req, res, err, '/404');
  }
});

// account page
router.get('/account', ensureAuth, async (req, res) => {
  const patron = await Patron.findOne({ user: req.user.Id });
  const featured = await FeaturedCubes.getSingleton();
  const i = featured.queue.findIndex((f) => f.ownerID.equals(req.user.Id));
  let myFeatured;
  if (i !== -1) {
    const cube = await Cube.getById(featured.queue[i].cubeID);
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
    const user = await User.getById(req.user.Id);

    if (!user) {
      req.flash('danger', 'User not found');
      return res.redirect('/user/account?nav=password');
    }

    return bcrypt.compare(req.body.password, user.PasswordHash, (err2, isMatch) => {
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
          user.PasswordHash = hash;
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

    usernameQuery.items = usernameQuery.items.filter((item) => item.Id !== user.Id);

    if (usernameQuery.items.length > 0) {
      req.flash('danger', 'Username already taken.');
      return res.redirect('/user/account');
    }

    user.Username = req.body.username;
    user.UsernameLower = req.body.username.toLowerCase();
    user.About = req.body.body;
    if (req.body.image) {
      user.ImageName = req.body.image;
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

  emailQuery.items = emailQuery.items.filter((item) => item.Id !== req.user.Id);

  if (emailQuery.items.length > 0) {
    req.flash('danger', 'Username already taken.');
    return res.redirect('/user/account');
  }

  const user = await User.getById(req.params.Id);

  user.Email = req.body.email;
  await User.update(user);

  req.flash('success', 'Your profile has been updated.');
  return res.redirect('/user/account');
});

router.post('/changedisplay', ensureAuth, async (req, res) => {
  try {
    const user = await User.getById(req.user.Id);

    user.Theme = req.body.theme;
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
    const followedCubes = await Cube.batchGet(req.user.FollowedCubes);
    const followers = await User.batchGet(req.user.UsersFollowing);
    const followedUsers = await User.batchGet(req.user.FollowedUsers);

    for (const follower of [...followers, ...followedUsers]) {
      // don't leak this info
      delete follower.PasswordHash;
      delete follower.Email;
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
  if (cube.Owner !== req.user.Id) {
    req.flash('danger', 'Only an owner of a cube can add it to the queue');
    return res.redirect(redirect);
  }

  if (cube.Visibility === Cube.VISIBILITY.PRIVATE) {
    req.flash('danger', 'Private cubes cannot be featured');
    return res.redirect(redirect);
  }

  const patron = await Patron.findOne({ user: req.user.Id }).lean();
  if (!fq.canBeFeatured(patron)) {
    req.flash('danger', 'Insufficient Patreon status for featuring a cube');
    return res.redirect(redirect);
  }

  const update = await fq.updateFeatured(async (featured) => {
    const currentIndex = featured.queue.findIndex((f) => f.ownerID.equals(req.user.Id));
    if (currentIndex === 0 || currentIndex === 1) {
      throw new Error('Cannot change currently featured cube');
    }
    let message;
    if (currentIndex === -1) {
      featured.queue.push({ cubeID: cube.Id, ownerID: req.user.Id });
      message = 'Successfully added cube to queue';
    } else {
      featured.queue[currentIndex].cubeID = cube.Id;
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
    const index = featured.queue.findIndex((f) => f.ownerID.equals(req.user.Id));
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
