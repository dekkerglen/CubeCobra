const express = require('express');

const bcrypt = require('bcryptjs');
const passport = require('passport');
const mailer = require('nodemailer');
const serialize = require('serialize-javascript');
const { body } = require('express-validator');
const util = require('../serverjs/util.js');
const carddb = require('../serverjs/cards.js');

// Bring in models
const User = require('../models/user');
const PasswordReset = require('../models/passwordreset');
const Cube = require('../models/cube');
const Deck = require('../models/deck');
const Blog = require('../models/blog');

const router = express.Router();

const { addAutocard } = require('../serverjs/cubefn');
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
      return res.status(401).render('misc/404', {});
    }

    const notification = user.notifications.splice(req.params.index, 1)[0];
    await user.save();

    if (!notification) {
      req.flash('danger', 'Not Found');
      return res.status(401).render('misc/404', {});
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
  res.render('user/lostpassword');
});

router.get('/follow/:id', ensureAuth, async (req, res) => {
  try {
    const { user } = req;
    const other = await User.findById(req.params.id).exec();

    if (!other) {
      req.flash('danger', 'User not found');
      return res.status(404).render('misc/404', {});
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
      return res.status(404).render('misc/404', {});
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
router.post('/lostpassword', [body('email', 'Email is required').isEmail()], flashValidationErrors, (req, res) => {
  if (!req.validated) {
    res.render('user/lostpassword');
  } else {
    const recoveryEmail = req.body.email.toLowerCase();
    PasswordReset.deleteOne(
      {
        email: recoveryEmail,
      },
      () => {
        const passwordReset = new PasswordReset();
        passwordReset.expires = addMinutes(Date.now(), 15);
        passwordReset.email = recoveryEmail;
        passwordReset.code = Math.floor(1000000000 + Math.random() * 9000000000);
        passwordReset.save((err2) => {
          if (err2) {
            req.logger.error(err2);
          } else {
            // Use Smtp Protocol to send Email
            const smtpTransport = mailer.createTransport({
              service: 'Gmail',
              auth: {
                user: process.env.EMAIL_CONFIG_USERNAME,
                pass: process.env.EMAIL_CONFIG_PASSWORD,
              },
            });

            const mail = {
              from: 'Cube Cobra Team <support@cubecobra.com>',
              to: passwordReset.email,
              subject: 'Password Reset',
              html:
                `A password reset was requested for the account that belongs to this email.<br> To proceed, click <a href="https://cubecobra.com/user/passwordreset/${passwordReset._id}">here</a>.<br> Your recovery code is: ${passwordReset.code}<br> This link expires in 15 minutes.` +
                `<br> If you did not request a password reset, ignore this email.`,
              text:
                `A password reset was requested for the account that belongs to this email.\nTo proceed, go to https://cubecobra.com/user/passwordreset/${passwordReset._id}\nYour recovery code is: ${passwordReset.code}\nThis link expires in 15 minutes.` +
                `\nIf you did not request a password reset, ignore this email.`,
            };

            smtpTransport.sendMail(mail, (err3) => {
              if (err3) {
                req.logger.error(err3);
              }

              smtpTransport.close();
            });

            req.flash('success', `Password recovery email sent to ${recoveryEmail}`);
            res.redirect('/user/lostpassword');
          }
        });
      },
    );
  }
});

router.get('/passwordreset/:id', (req, res) => {
  // create a password reset page and return it here
  PasswordReset.findById(req.params.id, (err, passwordreset) => {
    if (!passwordreset || Date.now() > passwordreset.expires) {
      req.flash('danger', 'Password recovery link expired');
      res.redirect('/');
    } else {
      res.render('user/passwordreset');
    }
  });
});

router.post(
  '/lostpasswordreset',
  [
    body('password', 'Password must be between 8 and 24 characters.').isLength({ min: 8, max: 24 }),
    body('password', 'New passwords must match.').custom(checkPasswordsMatch),
  ],
  flashValidationErrors,
  (req, res) => {
    if (!req.validated) {
      res.render('user/passwordreset');
    } else {
      const recoveryEmail = req.body.email.toLowerCase();
      PasswordReset.findOne(
        {
          code: req.body.code,
          email: recoveryEmail,
        },
        (err2, passwordreset) => {
          if (!passwordreset) {
            req.flash('danger', 'Incorrect email and recovery code combination.');
            res.render('user/passwordreset');
          } else {
            User.findOne(
              {
                email: recoveryEmail,
              },
              (err3, user) => {
                if (err3) {
                  req.logger.error(err3);
                  res.sendStatus(500);
                  return;
                }
                if (!user) {
                  req.flash('danger', 'No user with that email found! Are you sure you created an account?');
                  res.render('user/passwordreset');
                  return;
                }
                if (req.body.password2 !== req.body.password) {
                  req.flash('danger', "New passwords don't match");
                  res.render('user/passwordreset');
                  return;
                }
                bcrypt.genSalt(10, (err4, salt) => {
                  if (err4) {
                    req.logger.error(err4);
                    res.sendStatus(500);
                    return;
                  }
                  bcrypt.hash(req.body.password2, salt, (err5, hash) => {
                    if (err5) {
                      req.logger.error(err5);
                      res.sendStatus(500);
                    } else {
                      user.password = hash;
                      user.save((err6) => {
                        if (err6) {
                          req.logger.error(err6);
                          return res.sendStatus(500);
                        }

                        req.flash('success', 'Password updated successfully');
                        return res.redirect('/user/login');
                      });
                    }
                  });
                });
              },
            );
          }
        },
      );
    }
  },
);

// Register form
router.get('/register', (req, res) => {
  res.render('user/register');
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
  (req, res) => {
    const email = req.body.email.toLowerCase();
    const { username, password } = req.body;

    const attempt = { email, username };

    if (!req.validated) {
      res.render('user/register', {
        attempt,
        user: null,
      });
    } else {
      User.findOne(
        {
          username_lower: req.body.username.toLowerCase(),
        },
        (err, user) => {
          if (user) {
            req.flash('danger', 'Username already taken.');
            res.render('user/register', {
              attempt,
            });
          } else {
            // check if user exists
            User.findOne(
              {
                email: req.body.email.toLowerCase(),
              },
              (err2, user2) => {
                if (user2) {
                  req.flash('danger', 'Email already associated with an existing account.');
                  res.render('user/register', {
                    attempt,
                  });
                } else {
                  const newUser = new User({
                    email,
                    username,
                    username_lower: username.toLowerCase(),
                    password,
                    confirm: 'false',
                  });

                  bcrypt.genSalt(10, (err3, salt) => {
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
                            // Use Smtp Protocol to send Email
                            const smtpTransport = mailer.createTransport({
                              name: 'CubeCobra.com',
                              secure: true,
                              service: 'Gmail',
                              auth: {
                                user: process.env.EMAIL_CONFIG_USERNAME,
                                pass: process.env.EMAIL_CONFIG_PASSWORD,
                              },
                            });

                            const mail = {
                              from: 'Cube Cobra Team <support@cubecobra.com>',
                              to: email,
                              subject: 'Confirm Account',
                              html: `Hi ${newUser.username},</br> Thanks for joining! To confirm your email, click <a href="https://cubecobra.com/user/register/confirm/${newUser._id}">here</a>.`,
                              text: `Hi ${newUser.username},\nThanks for joining! To confirm your email, go to https://cubecobra.com/user/register/confirm/${newUser._id}`,
                            };

                            smtpTransport.sendMail(mail, (error) => {
                              if (error) {
                                req.logger.error(error);
                              }

                              smtpTransport.close();
                            });

                            // req.flash('success','Please check your email for confirmation link. It may be filtered as spam.');
                            req.flash('success', 'Account successfully created. You are now able to login.');
                            res.redirect('/user/login');
                          }
                        });
                      }
                    });
                  });
                }
              },
            );
          }
        },
      );
    }
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
  res.render('user/login');
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
        return res.status(404).render('misc/404', {});
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

    const following = req.user ? user.users_following.includes(req.user.id) : false;
    delete user.users_following;
    return res.render('user/user_view', {
      reactProps: serialize({
        user,
        canEdit: req.user && req.user._id.equals(user._id),
        cubes,
        followers,
        following,
      }),
      title: user.username,
      loginCallback: `/user/view/${req.params.id}`,
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
  try {
    return res.render('user/notifications', {
      notifications: req.user.old_notifications,
    });
  } catch (err) {
    req.logger.error(err);
    return res.status(500).send(err);
  }
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
      'seats.0.userid': userid,
    });

    const [user, numDecks, decks] = await Promise.all([userQ, numDecksQ, decksQ]);

    if (!user) {
      req.flash('danger', 'User not found');
      return res.status(404).render('misc/404', {});
    }

    const followers = await User.find(
      { _id: { $in: user.users_following } },
      '_id username image_name image artist users_following',
    );

    delete user.users_following;

    const reactProps = {
      user,
      canEdit: req.user && user._id.equals(req.user._id),
      followers,
      following: req.user && req.user.followed_users.includes(user.id),
      decks: decks || [],
      pages: Math.ceil(numDecks / pagesize),
      activePage: page,
    };

    return res.render('user/user_decks', {
      reactProps: serialize(reactProps),
      title: user.username,
      loginCallback: `/user/decks/${userid}`,
    });
  } catch (err) {
    return util.handleRouteError(req, res, err, '/404');
  }
});

router.get('/blog/:userid', async (req, res) => {
  try {
    const user = await User.findById(req.params.userid, '_id username users_following').lean();

    const posts = await Blog.find({
      owner: user._id,
    }).sort({
      date: -1,
    });

    // autocard the posts
    if (posts) {
      for (const post of posts) {
        if (post.html) {
          post.html = addAutocard(post.html, carddb);
        }
      }
    }

    const followers = await User.find(
      { _id: { $in: user.users_following } },
      '_id username image_name image artist users_following',
    );

    delete user.users_following;

    const reactProps = {
      user,
      posts,
      canEdit: req.user && req.user._id.equals(user._id),
      followers,
      following: req.user && req.user.followed_users.includes(user.id),
      userId: req.user ? req.user._id : '',
    };

    return res.render('user/user_blog', {
      reactProps: serialize(reactProps),
      title: user.username,
      loginCallback: `/user/blog/${req.params.userid}`,
    });
  } catch (err) {
    return util.handleRouteError(req, res, err, '/404');
  }
});

// account page
router.get('/account', ensureAuth, (req, res) => {
  const userLimited = {
    _id: req.user._id,
    username: req.user.username,
    email: req.user.email,
    about: req.user.about,
    image: req.user.image,
    image_name: req.user.image_name,
    artist: req.user.artist,
  };
  res.render('user/user_account', {
    reactProps: serialize({
      user: userLimited,
      defaultNav: req.query.nav || 'profile',
    }),
    title: 'Account',
    loginCallback: '/user/account',
  });
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
      User.findById(req.user._id, (err, user) => {
        const userLimited = {
          username: user.username,
          email: user.email,
          about: user.about,
        };
        res.render('user/user_account', {
          selected: 'changepw',
          user: userLimited,
          loginCallback: '/user/account?nav=password',
        });
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

    const reactProps = {
      followedCubes,
      followedUsers,
      followers,
    };

    res.render('user/user_social', {
      reactProps: serialize(reactProps),
      title: 'Social',
      loginCallback: '/user/social',
    });
  } catch (err) {
    util.handleRouteError(req, res, err, '/');
  }
});

module.exports = router;
