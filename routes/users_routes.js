const express = require('express');

const router = express.Router();
const bcrypt = require('bcryptjs');
const passport = require('passport');
const mailer = require('nodemailer');
const fs = require('fs');
const emailconfig = require('../../cubecobrasecrets/email');
const util = require('../serverjs/util.js');

// Bring in models
const User = require('../models/user');
const PasswordReset = require('../models/passwordreset');
const Cube = require('../models/cube');
const Deck = require('../models/deck');

const { ensureAuth, csrfProtection } = require('./middleware');

// For consistency between different forms, validate username through this function.
function checkUsernameValid(req) {
  req.checkBody('username', 'Username is required').notEmpty();
  req.checkBody('username', 'Username must be between 5 and 24 characters.').isLength({
    min: 5,
    max: 24,
  });
  req.checkBody('username', 'Username must only contain alphanumeric characters.').matches(/^[0-9a-zA-Z]*$/, 'i');
  req.checkBody('username', 'Username may not use profanity.').custom(function(value) {
    return !util.has_profanity(value);
  });
  return req;
}

router.use(csrfProtection);

router.get('/notification/:index', ensureAuth, async (req, res) => {
  try {
    if (!req.user._id) {
      req.flash('danger', 'Not Authorized');
      return res.status(401).render('misc/404', {});
    }

    const user = await User.findById(req.user._id);

    if (req.params.index > user.notifications.length) {
      req.flash('danger', 'Not Found');
      return res.status(401).render('misc/404', {});
    }

    const notification = user.notifications.splice(req.params.index, 1)[0];
    await user.save();

    return res.redirect(notification.url);
  } catch (err) {
    res.status(500).send({
      success: 'false',
      message: err,
    });
    console.error(err);
  }
});

router.post('/clearnotifications', ensureAuth, async (req, res) => {
  try {
    if (!req.user._id) {
      req.flash('danger', 'Not Authorized');
      return res.status(401).render('misc/404', {});
    }

    const user = await User.findById(req.user._id);

    user.notifications = [];
    await user.save();

    res.status(200).send({
      success: 'true',
    });
  } catch (err) {
    res.status(500).send({
      success: 'false',
    });
    console.error(err);
  }
});

// Lost password form
router.get('/lostpassword', function(req, res) {
  res.render('user/lostpassword');
});

router.get('/follow/:id', ensureAuth, async (req, res) => {
  try {
    if (!req.user._id) {
      req.flash('danger', 'Not Authorized');
      return res.status(401).render('misc/404', {});
    }

    const userq = User.findById(req.user._id).exec();
    const otherq = User.findById(req.params.id).exec();

    const [user, other] = await Promise.all([userq, otherq]);

    if (!other) {
      req.flash('danger', 'User not found');
      return res.status(404).render('misc/404', {});
    }

    if (!other.users_following.includes(user._id)) {
      other.users_following.push(user._id);
    }
    if (!user.followed_users.includes(other._id)) {
      user.followed_users.push(other._id);
    }

    await util.addNotification(other, user, `/user/view/${user._id}`, `${user.username} has followed you!`);

    await Promise.all([user.save(), other.save()]);

    return res.redirect(`/user/view/${req.params.id}`);
  } catch (err) {
    res.status(500).send({
      success: 'false',
    });
    console.error(err);
  }
});

router.get('/unfollow/:id', ensureAuth, async (req, res) => {
  try {
    if (!req.user._id) {
      req.flash('danger', 'Not Authorized');
      return res.status(401).render('misc/404', {});
    }

    const userq = User.findById(req.user._id).exec();
    const otherq = User.findById(req.params.id).exec();

    const [user, other] = await Promise.all([userq, otherq]);

    if (!other) {
      req.flash('danger', 'User not found');
      return res.status(404).render('misc/404', {});
    }

    while (other.users_following.includes(user._id)) {
      other.users_following.splice(other.users_following.indexOf(user._id), 1);
    }
    while (user.followed_users.includes(other._id)) {
      user.followed_users.splice(user.followed_users.indexOf(other._id), 1);
    }

    await Promise.all([user.save(), other.save()]);

    return res.redirect(`/user/view/${req.params.id}`);
  } catch (err) {
    res.status(500).send({
      success: 'false',
    });
    console.error(err);
  }
});

// Lost password submit
router.post('/lostpassword', function(req, res) {
  req.checkBody('email', 'Email is required').notEmpty();

  // handle error checks
  const errors = req.validationErrors();

  if (errors) {
    res.render('user/lostpassword', {
      errors,
    });
  } else {
    PasswordReset.deleteOne(
      {
        email: req.body.email.toLowerCase(),
      },
      function(err) {
        const passwordReset = new PasswordReset();
        passwordReset.expires = addMinutes(Date.now(), 15);
        passwordReset.email = req.body.email;
        passwordReset.code = Math.floor(1000000000 + Math.random() * 9000000000);

        passwordReset.save(function(err) {
          if (err) {
            console.error(err);
          } else {
            // Use Smtp Protocol to send Email
            const smtpTransport = mailer.createTransport({
              service: 'Gmail',
              auth: {
                user: emailconfig.username,
                pass: emailconfig.password,
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

            smtpTransport.sendMail(mail, (err, response) => {
              if (err) {
                console.error(err);
              }

              smtpTransport.close();
            });

            req.flash('success', 'Password recovery email sent');
            res.redirect('/user/lostpassword');
          }
        });
      },
    );
  }
});

router.get('/passwordreset/:id', function(req, res) {
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

router.post('/lostpasswordreset', function(req, res) {
  req.checkBody('password', 'Password must be between 8 and 24 characters.').isLength({
    min: 8,
    max: 24,
  });
  const errors = req.validationErrors();

  if (errors) {
    res.render('user/passwordreset', {
      errors,
    });
  } else {
    PasswordReset.findOne(
      {
        code: req.body.code,
        email: req.body.email,
      },
      (err, passwordreset) => {
        if (!passwordreset) {
          req.flash('danger', 'Incorrect email and recovery code combination.');
          res.render('user/passwordreset');
        } else {
          User.findOne(
            {
              email: req.body.email,
            },
            (err, user) => {
              if (err) {
                console.error('Password reset find user error:', err);
                res.sendStatus(500);
                return;
              }
              if (!user) {
                req.flash('danger', 'No user with that email found! Are you sure you created an account?');
                res.render('user/passwordreset');
                return;
              }
              if (req.body.password2 != req.body.password) {
                req.flash('danger', "New passwords don't match");
                res.render('user/passwordreset');
                return;
              }
              bcrypt.genSalt(10, (err, salt) => {
                if (err) {
                  console.error('Password reset genSalt error:', err);
                  res.sendStatus(500);
                  return;
                }
                bcrypt.hash(req.body.password2, salt, (err, hash) => {
                  if (err) {
                    console.error('Password reset hashing error:', err);
                    res.sendStatus(500);
                  } else {
                    user.password = hash;
                    user.save(function(err) {
                      if (err) {
                        console.error('Password reset user save error:', err);
                        res.sendStatus(500);
                      } else {
                        req.flash('success', 'Password updated succesfully');
                        return res.redirect('/user/login');
                      }
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
});

// Register form
router.get('/register', function(req, res) {
  res.render('user/register');
});

// Register process
router.post('/register', function(req, res) {
  const email = req.body.email.toLowerCase();
  const { username } = req.body;
  const { password } = req.body;
  const { password2 } = req.body;

  const attempt = {
    email,
    username,
  };

  req = checkUsernameValid(req);
  req.checkBody('email', 'Email is required').notEmpty();
  req.checkBody('email', 'Email is not valid').isEmail();
  req.checkBody('password', 'Password is required').notEmpty();
  req.checkBody('password2', 'Passwords do not match').equals(req.body.password);

  req.checkBody('email', 'Email must be between 5 and 100 characters.').isLength({
    min: 5,
    max: 100,
  });
  req.checkBody('password', 'Password must be between 8 and 24 characters.').isLength({
    min: 8,
    max: 24,
  });
  const errors = req.validationErrors();

  if (errors) {
    res.render('user/register', {
      errors,
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
            (err, user) => {
              if (user) {
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

                bcrypt.genSalt(10, (err, salt) => {
                  bcrypt.hash(newUser.password, salt, (err, hash) => {
                    if (err) {
                      console.error(err);
                    } else {
                      newUser.password = hash;
                      newUser.confirmed = 'false';
                      newUser.save(function(err) {
                        if (err) {
                          console.error(err);
                        } else {
                          // Use Smtp Protocol to send Email
                          const smtpTransport = mailer.createTransport({
                            name: 'CubeCobra.com',
                            secure: true,
                            service: 'Gmail',
                            auth: {
                              user: emailconfig.username,
                              pass: emailconfig.password,
                            },
                          });

                          const mail = {
                            from: 'Cube Cobra Team <support@cubecobra.com>',
                            to: email,
                            subject: 'Confirm Account',
                            html: `Hi ${newUser.username},</br> Thanks for joining! To confirm your email, click <a href="https://cubecobra.com/user/register/confirm/${newUser._id}">here</a>.`,
                            text: `Hi ${newUser.username},\nThanks for joining! To confirm your email, go to https://cubecobra.com/user/register/confirm/${newUser._id}`,
                          };

                          smtpTransport.sendMail(mail, function(error, response) {
                            if (error) {
                              console.error(error);
                            }

                            smtpTransport.close();
                          });

                          // req.flash('success','Please check your email for confirmation link. It may be filtered as spam.');
                          req.flash('success', 'Account succesfully created. You are now able to login.');
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
});

// Register confirm
router.get('/register/confirm/:id', function(req, res) {
  User.findById(req.params.id, (err, user) => {
    if (err) {
      req.flash('danger', 'Invalid confirmation link.');
      res.redirect('/');
    } else if (user.confirmed == 'true') {
      req.flash('success', 'User already confirmed.');
      res.redirect('/user/login');
    } else {
      const user = {
        confirmed: 'true',
      };
      const query = {
        _id: req.params.id,
      };

      User.updateOne(query, user, function(err) {
        if (err) {
          req.flash('danger', 'Invalid confirmation link.');
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
router.get('/login', function(req, res) {
  res.render('user/login');
});

// Login post
router.post('/login', function(req, res, next) {
  if (req.body.username.includes('@')) {
    // find by email
    User.findOne(
      {
        email: req.body.username,
      },
      (err, user) => {
        if (!user) {
          req.flash('danger', 'Incorrect username or email address.');
          res.redirect('/user/login');
        } else {
          req.body.username = user.username;
          // TODO: fix confirmation
          if (true || user.confirmed == 'true') {
            let redirect = '/';
            if (req.body.loginCallback) {
              redirect = req.body.loginCallback;
            }
            passport.authenticate('local', {
              successRedirect: redirect,
              failureRedirect: '/user/Login',
              failureFlash: true,
            })(req, res, next);
          } else {
            req.flash('danger', 'User not confirmed. Please check your email for confirmation link.');
            res.redirect('/user/login');
          }
        }
      },
    );
  } else {
    req.body.username = req.body.username.toLowerCase();
    // find by username
    User.findOne(
      {
        username_lower: req.body.username,
      },
      (err, user) => {
        if (!user) {
          req.flash('danger', 'Incorrect username or email address.');
          res.redirect('/user/login');
        } else {
          // TODO: fix confirmation
          if (true || user.confirmed == 'true') {
            let redirect = '/';
            if (req.body.loginCallback) {
              redirect = req.body.loginCallback;
            }
            passport.authenticate('local', {
              successRedirect: redirect,
              failureRedirect: '/user/Login',
              failureFlash: true,
            })(req, res, next);
          } else {
            req.flash('danger', 'User not confirmed. Please check your email for confirmation link.');
            res.redirect('/user/login');
          }
        }
      },
    );
  }
});

// logout
router.get('/logout', function(req, res) {
  req.logout();
  req.flash('success', 'You have been logged out');
  res.redirect('/');
});

router.get('/view/:id', async (req, res) => {
  try {
    let user;
    try {
      user = await User.findById(req.params.id);
    } catch (err) {
      user = await User.findOne({
        username_lower: req.params.id.toLowerCase(),
      });
      if (!user) {
        req.flash('danger', 'User not found');
        return res.status(404).render('misc/404', {});
      }
    }

    const cubes = await Cube.find({
      owner: user._id,
    });

    return res.render('user/user_view', {
      user_limited: {
        username: user.username,
        email: user.email,
        about: user.about,
        id: user._id,
      },
      cubes,
      loginCallback: `/user/view/${req.params.id}`,
      followers: user.users_following.length,
      following: req.user ? user.users_following.includes(req.user._id) : false,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).send(err);
  }
});

router.get('/decks/:userid', function(req, res) {
  res.redirect(`/user/decks/${req.params.userid}/0`);
});

router.get('/notifications', ensureAuth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);

    if (!user) {
      res.redirect('/404');
    }

    return res.render('user/notifications', {
      notifications: user.old_notifications,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).send(err);
  }
});
2;
router.get('/decks/:userid/:page', async (req, res) => {
  try {
    const { userid } = req.params;
    const { page } = req.params;
    const pagesize = 30;

    const userq = User.findById(userid).exec();
    const decksq = Deck.find({
      owner: userid,
    })
      .sort({
        date: -1,
      })
      .skip(pagesize * page)
      .limit(pagesize)
      .exec();
    const numDecksq = await Deck.countDocuments({
      owner: userid,
    }).exec();

    const [user, decks, numDecks] = await Promise.all([userq, decksq, numDecksq]);

    if (!user) {
      req.flash('danger', 'User not found');
      return res.status(404).render('misc/404', {});
    }

    const pages = [];
    for (let i = 0; i < numDecks / pagesize; i++) {
      if (page == i) {
        pages.push({
          url: `/user/decks/${userid}/${i}`,
          content: i + 1,
          active: true,
        });
      } else {
        pages.push({
          url: `/user/decks/${userid}/${i}`,
          content: i + 1,
        });
      }
    }

    return res.render('user/user_decks', {
      user_limited: {
        username: user.username,
        email: user.email,
        about: user.about,
        id: user._id,
      },
      loginCallback: `/user/decks/${userid}`,
      decks: decks || [],
      pages: pages || null,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).send(err);
  }
});

// account page
router.get('/account', ensureAuth, function(req, res) {
  User.findById(req.user._id, (err, user) => {
    user_limited = {
      username: user.username,
      email: user.email,
      about: user.about,
      id: user._id,
    };
    res.render('user/user_account', {
      selected: 'info',
      user: user_limited,
      loginCallback: '/user/account',
    });
  });
});

// account page, password reset
router.get('/account/changepassword', ensureAuth, function(req, res) {
  User.findById(req.user._id, (err, user) => {
    user_limited = {
      username: user.username,
      email: user.email,
      about: user.about,
      id: user._id,
    };
    res.render('user/user_account', {
      selected: 'changepw',
      user: user_limited,
      loginCallback: '/user/account/changepassword',
    });
  });
});

// account page, password reset
router.get('/account/updateemail', ensureAuth, function(req, res) {
  User.findById(req.user._id, (err, user) => {
    user_limited = {
      username: user.username,
      email: user.email,
      about: user.about,
      id: user._id,
    };
    res.render('user/user_account', {
      selected: 'changeemail',
      user: user_limited,
      loginCallback: '/user/updateemail',
    });
  });
});

router.post('/resetpassword', ensureAuth, function(req, res, next) {
  req.checkBody('password2', 'Password must be between 8 and 24 characters.').isLength({
    min: 8,
    max: 24,
  });

  const errors = req.validationErrors();

  if (errors) {
    User.findById(req.user._id, (err, user) => {
      user_limited = {
        username: user.username,
        email: user.email,
        about: user.about,
      };
      res.render('user/user_account', {
        selected: 'changepw',
        user: user_limited,
        errors,
        loginCallback: '/user/account/changepassword',
      });
    });
  } else {
    User.findById(req.user._id, (err, user) => {
      if (user) {
        bcrypt.compare(req.body.password, user.password, (err, isMatch) => {
          if (!isMatch) {
            req.flash('danger', 'Password is incorrect');
            return res.redirect('/user/account/changepassword');
          }
          if (req.body.password2 != req.body.password3) {
            req.flash('danger', "New passwords don't match");
            return res.redirect('/user/account/changepassword');
          }
          bcrypt.genSalt(10, (err, salt) => {
            bcrypt.hash(req.body.password2, salt, (err, hash) => {
              if (err) {
                console.error(err);
              } else {
                user.password = hash;
                user.save(function(err) {
                  if (err) {
                    console.error(err);
                  } else {
                    req.flash('success', 'Password updated succesfully');
                    return res.redirect('/user/account/changepassword');
                  }
                });
              }
            });
          });
        });
      }
    });
  }
});

router.post('/updateuserinfo', ensureAuth, function(req, res, next) {
  User.findById(req.user._id, (err, user) => {
    if (user) {
      User.findOne(
        {
          username_lower: req.body.username.toLowerCase(),
          _id: {
            $ne: req.user._id,
          },
        },
        (err, duplicate_user) => {
          if (user.username !== req.body.username) {
            req = checkUsernameValid(req);
            const errors = req.validationErrors();
            if (errors) {
              for (let i = 0; i < errors.length; i++) {
                req.flash('danger', errors[i].msg);
              }
              return res.redirect('/user/account');
            }
            if (duplicate_user) {
              req.flash('danger', 'Username already taken.');
              return res.redirect('/user/account');
            }
            user.username = req.body.username;
            user.username_lower = req.body.username.toLowerCase();
            Cube.find(
              {
                owner: req.user._id,
              },
              (err, cubes) => {
                cubes.forEach((item, index) => {
                  item.owner_name = req.body.username;
                  Cube.updateOne(
                    {
                      _id: item._id,
                    },
                    item,
                    function(err) {},
                  );
                });
              },
            );
          }

          user.about = req.body.body;

          const query = {
            _id: req.user._id,
          };

          User.updateOne(query, user, function(err) {
            if (err) {
              console.error(err);
            } else {
              req.flash('success', 'Your profile has been updated.');
              res.redirect('/user/account');
            }
          });
        },
      );
    }
  });
});

router.post('/updateemail', ensureAuth, function(req, res, next) {
  User.findOne(
    {
      email: req.body.email.toLowerCase(),
    },
    (err, user) => {
      if (user) {
        req.flash('danger', 'Email already associated with an existing account.');
        res.redirect('/user/account/updateemail');
      } else {
        User.findById(req.user._id, (err, user) => {
          if (user) {
            user.email = req.body.email;

            const query = {
              _id: req.user._id,
            };

            User.updateOne(query, user, function(err) {
              if (err) {
                console.error(err);
              } else {
                req.flash('success', 'Your profile has been updated.');
                res.redirect('/user/account');
              }
            });
          }
        });
      }
    },
  );
});

function addMinutes(date, minutes) {
  return new Date(new Date(date).getTime() + minutes * 60000);
}

module.exports = router;
