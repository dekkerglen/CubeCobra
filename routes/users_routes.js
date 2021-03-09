const express = require('express');

const bcrypt = require('bcryptjs');
const passport = require('passport');
const mailer = require('nodemailer');
const { body } = require('express-validator');
const Email = require('email-templates');
const path = require('path');
const util = require('../serverjs/util.js');
const carddb = require('../serverjs/cards.js');
const { render } = require('../serverjs/render');

// Bring in models
const User = require('../models/user');
const PasswordReset = require('../models/passwordreset');
const Cube = require('../models/cube');
const Deck = require('../models/deck');
const Blog = require('../models/blog');

const router = express.Router();

const { ensureAuth, csrfProtection, flashValidationErrors } = require('./middleware');

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

router.get('/notification/:index', ensureAuth, async (req, res) => {
  try {
    const { user } = req;

    if (req.params.index > user.notifications.length) {
      req.flash('danger', 'Not Found');
      return res.redirect('/404');
    }

    const notification = user.notifications.splice(req.params.index, 1)[0];
    await user.save();

    if (!notification) {
      req.flash('danger', 'Not Found');
      return res.redirect('/404');
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
    const { user } = req;

    user.notifications = [];
    await user.save();

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
    const other = await User.findById(req.params.id).exec();

    if (!other) {
      req.flash('danger', 'User not found');
      return res.redirect('/404');
    }

    if (!other.users_following.includes(user.id)) {
      other.users_following.push(user.id);
    }
    if (!user.followed_users.includes(other.id)) {
      user.followed_users.push(other.id);
    }

    await util.addNotification(other, user, `/user/view/${user.id}`, `${user.username} has followed you!`);

    await Promise.all([user.save(), other.save()]);

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
    const other = await User.findById(req.params.id).exec();

    if (!other) {
      req.flash('danger', 'User not found');
      return res.redirect('/404');
    }

    other.users_following = other.users_following.filter((id) => !req.user._id.equals(id));
    user.followed_users = user.followed_users.filter((id) => id !== req.params.id);

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
      const user = await User.findOne({
        email: recoveryEmail,
      });

      if (!user) {
        req.flash('danger', 'No user with that email found! Are you sure you created an account?');
        return render(req, res, 'PasswordResetPage');
      }

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
          user.password = hash;
          try {
            await user.save();
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
    const user = await User.findOne({
      username_lower: req.body.username.toLowerCase(),
    });

    if (user) {
      req.flash('danger', 'Username already taken.');
      return render(req, res, 'RegisterPage', attempt);
    }

    // check if user exists
    const user2 = await User.findOne({
      email: req.body.email.toLowerCase(),
    });

    if (user2) {
      req.flash('danger', 'Email already associated with an existing account.');
      return render(req, res, 'RegisterPage', attempt);
    }
    const newUser = new User({
      email,
      username,
      username_lower: username.toLowerCase(),
      password,
      confirm: 'false',
    });

    return bcrypt.genSalt(10, (err3, salt) => {
      bcrypt.hash(newUser.password, salt, (err4, hash) => {
        if (err4) {
          req.logger.error(err4);
        } else {
          newUser.password = hash;
          newUser.confirmed = 'false';
          newUser.save((err5) => {
            if (err5) {
              req.logger.error(err5);
            } else {
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
                    id: newUser._id,
                  },
                })
                .then(() => {
                  // req.flash('success','Please check your email for confirmation link. It may be filtered as spam.');
                  req.flash('success', 'Account successfully created. You are now able to login.');
                  res.redirect('/user/login');
                });
            }
          });
        }
      });
    });
  },
);

// Register confirm
router.get('/register/confirm/:id', (req, res) => {
  User.findById(req.params.id, (err, user) => {
    if (err) {
      req.flash('danger', 'Invalid confirmation link.');
      res.redirect('/');
    } else if (user.confirmed === 'true') {
      req.flash('success', 'User already confirmed.');
      res.redirect('/user/login');
    } else {
      user.confirmed = true;
      user.save((err2) => {
        if (err2) {
          req.flash('danger', 'Failed to confirm user.');
          res.redirect('/');
        } else {
          req.flash('success', 'User successfully confirmed');
          res.redirect('/user/login');
        }
      });
    }
  });
});

// Login route
router.get('/login', (req, res) => {
  return render(req, res, 'LoginPage');
});

// Login post
router.post('/login', (req, res, next) => {
  const query = {
    [req.body.username.includes('@') ? 'email' : 'username_lower']: req.body.username.toLowerCase(),
  };
  // find by email
  User.findOne(query, (err, user) => {
    if (!user) {
      req.flash('danger', 'Incorrect username or email address.');
      res.redirect('/user/login');
    } else {
      req.body.username = user.username;
      // TODO: fix confirmation and check it here.
      let redirect = '/';
      if (req.body.loginCallback) {
        redirect = req.body.loginCallback;
      }
      passport.authenticate('local', {
        successRedirect: redirect,
        failureRedirect: '/user/Login',
        failureFlash: true,
      })(req, res, next);
    }
  });
});

// logout
router.get('/logout', (req, res) => {
  req.logout();
  req.flash('success', 'You have been logged out');
  res.redirect('/');
});

router.get('/view/:id', async (req, res) => {
  try {
    let user = null;
    try {
      user = await User.findById(req.params.id, '_id username about users_following image_name image artist').lean();
      // eslint-disable-next-line no-empty
    } catch (err) {}

    if (!user) {
      user = await User.findOne(
        {
          username_lower: req.params.id.toLowerCase(),
        },
        '_id username about users_following image_name image artist',
      ).lean();
      if (!user) {
        req.flash('danger', 'User not found');
        return res.redirect('/404');
      }
    }

    const cubesQ = Cube.find({
      owner: user._id,
      ...(req.user && req.user._id.equals(user._id)
        ? {}
        : {
            isListed: true,
          }),
    }).lean();
    const followersQ = User.find(
      { _id: { $in: user.users_following } },
      '_id username image_name image artist users_following',
    ).lean();

    const [cubes, followers] = await Promise.all([cubesQ, followersQ]);

    const following = req.user && user.users_following ? user.users_following.includes(req.user.id) : false;
    delete user.users_following;

    return render(req, res, 'UserCubePage', {
      owner: user,
      cubes,
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
  return render(req, res, 'NotificationsPage', {
    notifications: req.user.old_notifications,
  });
});

router.get('/decks/:userid/:page', async (req, res) => {
  try {
    const { userid } = req.params;
    const pagesize = 30;

    const page = parseInt(req.params.page, 10);

    const userQ = User.findById(userid, '_id username users_following').lean();

    const decksQ = Deck.find(
      {
        owner: userid,
      },
      '_id seats date cube',
    )
      .sort({
        date: -1,
      })
      .skip(pagesize * page)
      .limit(pagesize)
      .lean();
    const numDecksQ = Deck.countDocuments({
      owner: userid,
    });

    const [user, numDecks, decks] = await Promise.all([userQ, numDecksQ, decksQ]);

    if (!user) {
      req.flash('danger', 'User not found');
      return res.redirect('/404');
    }

    const followers = await User.find(
      { _id: { $in: user.users_following } },
      '_id username image_name image artist users_following',
    );

    delete user.users_following;

    return render(req, res, 'UserDecksPage', {
      owner: user,
      followers,
      following: req.user && req.user.followed_users.includes(user.id),
      decks: decks || [],
      pages: Math.ceil(numDecks / pagesize),
      activePage: page,
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

    const user = await User.findById(req.params.userid, '_id username users_following').lean();

    const postsq = Blog.find({
      owner: user._id,
    })
      .sort({
        date: -1,
      })
      .skip(req.params.page * pagesize)
      .limit(pagesize)
      .lean();

    const numBlogsq = Blog.countDocuments({
      owner: user._id,
    });

    const followersq = User.find(
      { _id: { $in: user.users_following } },
      '_id username image_name image artist users_following',
    );

    const [posts, numBlogs, followers] = await Promise.all([postsq, numBlogsq, followersq]);

    delete user.users_following;

    return render(
      req,
      res,
      'UserBlogPage',
      {
        owner: user,
        posts,
        canEdit: req.user && req.user._id.equals(user._id),
        followers,
        following: req.user && req.user.followed_users.includes(user.id),
        pages: Math.ceil(numBlogs / pagesize),
        activePage: req.params.page,
      },
      {
        title: user.username,
      },
    );
  } catch (err) {
    return util.handleRouteError(req, res, err, '/404');
  }
});

// account page
router.get('/account', ensureAuth, (req, res) => {
  return render(
    req,
    res,
    'UserAccountPage',
    {
      defaultNav: req.query.nav || 'profile',
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
  (req, res) => {
    if (!req.validated) {
      User.findById(req.user._id, () => {
        res.redirect('/user/account');
      });
    } else {
      User.findById(req.user._id, (err, user) => {
        if (user) {
          bcrypt.compare(req.body.password, user.password, (err2, isMatch) => {
            if (!isMatch) {
              req.flash('danger', 'Password is incorrect');
              return res.redirect('/user/account?nav=password');
            }
            if (req.body.password2 !== req.body.password3) {
              req.flash('danger', "New passwords don't match");
              return res.redirect('/user/account?nav=password');
            }
            return bcrypt.genSalt(10, (err3, salt) => {
              bcrypt.hash(req.body.password2, salt, (err4, hash) => {
                if (err4) {
                  req.logger.error(err4);
                } else {
                  user.password = hash;
                  user.save((err5) => {
                    if (err5) {
                      req.logger.error(err5);
                      req.flash('danger', 'Error saving user.');
                      return res.redirect('/user/account?nav=password');
                    }

                    req.flash('success', 'Password updated successfully');
                    return res.redirect('/user/account?nav=password');
                  });
                }
              });
            });
          });
        }
      });
    }
  },
);

router.post('/updateuserinfo', ensureAuth, [...usernameValid], flashValidationErrors, async (req, res) => {
  try {
    const { user } = req;
    if (!req.validated) {
      return res.redirect('/user/account');
    }

    const duplicate = await User.findOne({
      username_lower: req.body.username.toLowerCase(),
      _id: {
        $ne: req.user._id,
      },
    });
    if (duplicate) {
      req.flash('danger', 'Username already taken.');
      return res.redirect('/user/account');
    }

    user.username = req.body.username;
    user.username_lower = req.body.username.toLowerCase();
    user.about = req.body.body;
    if (req.body.image) {
      const imageData = carddb.imagedict[req.body.image];
      if (imageData) {
        user.image = imageData.uri;
        user.artist = imageData.artist;
        user.image_name = req.body.image.replace(/ \[[^\]]*\]$/, '');
      }
    }
    const userQ = user.save();
    const cubesQ = Cube.updateMany(
      {
        owner: req.user._id,
      },
      {
        owner_name: req.body.username,
      },
    );
    await Promise.all([userQ, cubesQ]);

    req.flash('success', 'User information updated.');
    return res.redirect('/user/account');
  } catch (err) {
    return util.handleRouteError(req, res, err, '/user/account');
  }
});

router.post('/updateemail', ensureAuth, (req, res) => {
  User.findOne(
    {
      email: req.body.email.toLowerCase(),
    },
    (err, user) => {
      if (user) {
        req.flash('danger', 'Email already associated with an existing account.');
        res.redirect('/user/account?nav=email');
      } else if (req.user) {
        req.user.email = req.body.email;
        req.user.save((err2) => {
          if (err2) {
            req.logger.error(err2);
            req.flash('danger', 'Error saving user.');
            res.redirect('/user/account');
          } else {
            req.flash('success', 'Your profile has been updated.');
            res.redirect('/user/account');
          }
        });
      } else {
        req.flash('danger', 'Not logged in.');
        res.redirect('/user/account?nav=email');
      }
    },
  );
});

router.post('/changedisplay', ensureAuth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);

    user.theme = req.body.theme;
    user.hide_featured = req.body.hideFeatured === 'on';

    await user.save();

    req.flash('success', 'Your display preferences have been updated.');
    res.redirect('/user/account');
  } catch (err) {
    req.flash('danger', `Could not save preferences: ${err.message}`);
    res.redirect('/user/account?nav=display');
  }
});

router.get('/social', ensureAuth, async (req, res) => {
  try {
    const followedCubesQ = Cube.find({ _id: { $in: req.user.followed_cubes } }, Cube.PREVIEW_FIELDS).lean();
    const followedUsersQ = User.find(
      { _id: { $in: req.user.followed_users } },
      '_id username image artist users_following',
    ).lean();
    const followersQ = User.find(
      { _id: { $in: req.user.users_following } },
      '_id username image artist users_following',
    ).lean();

    const [followedCubes, followedUsers, followers] = await Promise.all([followedCubesQ, followedUsersQ, followersQ]);

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

module.exports = router;
