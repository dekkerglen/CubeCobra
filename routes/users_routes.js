const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const passport = require('passport');
const emailconfig = require('../config/email');
const mailer = require("nodemailer");
const fs = require('fs')

// Bring in models
let User = require('../models/user')
let PasswordReset = require('../models/passwordreset')

//Lost password form
router.get('/lostpassword', function(req, res)
{
  res.render('lostpassword');
});

//Lost password submit
router.post('/lostpassword', function(req, res)
{
  req.checkBody('email', 'Email is required').notEmpty();

  //handle error checks
  let errors = req.validationErrors();

  if(errors)
  {
    res.render('lostpassword', {
      errors:errors
    });
  }
  else
  {
    PasswordReset.deleteOne({ email: req.body.email.toLowerCase()}, function (err)
    {
      let passwordReset = new PasswordReset();
      passwordReset.expires = addMinutes(Date.now(),15);
      passwordReset.email = req.body.email;
      passwordReset.code =  Math.floor(1000000000 + Math.random() * 9000000000);

      passwordReset.save(function(err)
      {
        if(err)
        {
          console.log(err);
        }
        else
        {
          // Use Smtp Protocol to send Email
          var smtpTransport = mailer.createTransport({
              service: "Gmail",
              auth: {
                  user: emailconfig.username,
                  pass: emailconfig.password
              }
          });

          var mail = {
              from: "Cube Cobra Team <cubecobrateam@gmail.com>",
              to: passwordReset.email,
              subject: "Password Reset",
              html: "A password reset was requested for the account that belongs to this email.<br> To proceed, click <a href=\"https://cubecobra.com/user/passwordreset/" +
                passwordReset._id + "\">here</a>.<br> Your recovery code is: " + passwordReset.code  +
                "<br> This link expires in 15 minutes." +
                "<br> If you did not request a password reset, ignore this email."
          }

          smtpTransport.sendMail(mail, function(err, response)
          {
              if(err)
              {
                  console.log(err);
              }

              smtpTransport.close();
          });

          req.flash('success', 'Password recovery email sent');
          res.redirect('/user/lostpassword');
        }
      });
    });
  }
});

router.get('/passwordreset/:id', function(req, res)
{
  //create a password reset page and return it here
  PasswordReset.findById(req.params.id, function(err, passwordreset)
  {
    if(!passwordreset || (Date.now() > passwordreset.expires))
    {
      req.flash('danger', 'Password recovery link expired');
      res.redirect('/');
    }
    else
    {
      res.render('passwordreset');
    }
  });
});

router.post('/lostpasswordreset', function(req, res)
{
  req.checkBody('password', 'Password must be between 8 and 24 characters.').isLength({ min: 8, max:24 });
  req.checkBody('password', 'Password must only contain alphanumeric characters, and only the following special characters: ! @ # $ % ^ &*').matches(/^[0-9a-zA-Z]*$/, "i");
  let errors = req.validationErrors();

  if(errors)
  {
    res.render('passwordreset',
    {
      errors: errors
    })
  }
  else
  {
    PasswordReset.findOne({code:req.body.code,email:req.body.email}, function(err, passwordreset)
    {
      if(!passwordreset)
      {
        req.flash('danger', 'Incorrect email and recovery code combination.');
        res.render('passwordreset');
      }
      else
      {
        User.findOne({email:req.body.email}, function (err, user)
        {
          if(user)
          {
            if(req.body.password2 != req.body.password)
            {
              req.flash('danger', 'New passwords don\'t match');
              res.render('passwordreset');
            }
            else
            {
              bcrypt.genSalt(10, function(err, salt)
              {
                bcrypt.hash(req.body.password2, salt, function(err, hash)
                {
                  if(err)
                  {
                    console.log(err);
                  }
                  else
                  {
                    user.password = hash;
                    user.save(function(err)
                    {
                      if(err)
                      {
                        console.log(err)
                        return;
                      }
                      else
                      {
                        req.flash('success', 'Password updated succesfully');
                        return res.redirect('/user/login');
                      }
                    });
                  }
                });
              });
            }
          }
        });
      }
    });
  }
});

//Register form
router.get('/register', function(req, res)
{
  res.render('register');
});

//Register process
router.post('/register', function(req, res)
{
  const email = req.body.email.toLowerCase();
  const username = req.body.username;
  const password = req.body.password;
  const password2 = req.body.password2;

  let attempt = {
    email : email,
    username: username
  }

  req.checkBody('email', 'Email is required').notEmpty();
  req.checkBody('email', 'Email is not valid').isEmail();
  req.checkBody('username', 'Username is required').notEmpty();
  req.checkBody('password', 'Password is required').notEmpty();
  req.checkBody('password2', 'Passwords do not match').equals(req.body.password);

  req.checkBody('email', 'Email must be between 5 and 100 characters.').isLength({ min: 5, max:100 });
  req.checkBody('username', 'Username must be between 5 and 24 characters.').isLength({ min: 5, max:24 });
  req.checkBody('password', 'Password must be between 8 and 24 characters.').isLength({ min: 8, max:24 });
  req.checkBody('password', 'Password must only contain alphanumeric characters, and only the following special characters: ! @ # $ % ^ &*').matches(/^[0-9a-zA-Z]*$/, "i");
  req.checkBody('username', 'Username must only contain alphanumeric characters.').matches(/^[0-9a-zA-Z]*$/, "i");
  let errors = req.validationErrors();

  if(errors)
  {
    res.render('register',
    {
      errors: errors,
      attempt: attempt
    });
  }
  else
  {
    User.findOne({ username_lower: req.body.username.toLowerCase() }, function (err, user)
    {
      if(user)
      {
        req.flash('danger','Username already taken.');
          res.render('register',
          {
            attempt: attempt
          });
      }
      else
      {
        //check if user exists
        User.findOne({ email: req.body.email.toLowerCase() }, function (err, user)
        {
          if(user)
          {
            req.flash('danger','Email already associated with an existing account.');
            res.render('register',
            {
              attempt: attempt
            });
          }
          else
          {
            let newUser = new User({
              email:email,
              username:username,
              username_lower:username.toLowerCase(),
              password:password,
              confirm:'false'
            });

            bcrypt.genSalt(10, function(err, salt)
            {
              bcrypt.hash(newUser.password, salt, function(err, hash)
              {
                if(err)
                {
                  console.log(err);
                }
                else {
                  newUser.password = hash;
                  newUser.confirmed = 'false';
                  newUser.save(function(err)
                  {
                    if(err)
                    {
                      console.log(err)
                      return;
                    }
                    else
                    {
                      // Use Smtp Protocol to send Email
                      var smtpTransport = mailer.createTransport({
                          service: "Gmail",
                          auth: {
                              user: emailconfig.username,
                              pass: emailconfig.password
                          }
                      });

                      var mail = {
                          from: "Cube Cobra Team <cubecobrateam@gmail.com>",
                          to: email,
                          subject: "Confirm Account",
                          html: "Hi " + newUser.username +
                            ",</br> Thanks for joining! To confirm your email, click <a href=\"https://cubecobra.com/user/register/confirm/" +
                            newUser._id + "\">here</a>."
                      }

                      smtpTransport.sendMail(mail, function(error, response)
                      {
                          if(error)
                          {
                              console.log(error);
                          }

                          smtpTransport.close();
                      });

                      req.flash('success','Please check your email for confirmation link.');
                      res.redirect('/user/login');
                    }
                  });
                }
              });
            });
          }
        });
      }
    });
  }
});

//Register confirm
router.get('/register/confirm/:id', function(req, res)
{
  User.findById(req.params.id, function(err, user)
  {
    if(err)
    {
      req.flash('danger', 'Invalid confirmation link.');
      res.redirect('/');
    }
    else
    {
      if(user.confirmed == 'true')
      {
        req.flash('success', 'User already confirmed.');
        res.redirect('/user/login');
      }
      else
      {
        let user = {confirmed:'true'};
        let query = {_id:req.params.id};

        User.updateOne(query, user, function(err)
        {
          if(err)
          {
            req.flash('danger', 'Invalid confirmation link.');
            res.redirect('/');
          }
          else
          {
            req.flash('success', 'User successfully confirmed');
            res.redirect('/user/login');
          }
        });
      }
    }
  });
});

//Login route
router.get('/login', function(req, res)
{
  res.render('login');
})

//Login post
router.post('/login', function(req, res, next)
{
  if(req.body.username.includes('@'))
  {
    //find by email
    User.findOne({ email: req.body.username }, function (err, user)
    {
      if(!user)
      {
        req.flash('danger', 'Incorrect username or email address.');
        res.redirect('/user/login');
      }
      else {
        req.body.username = user.username
        if(user.confirmed == 'true')
        {
          passport.authenticate('local',
          {
              successRedirect:'/',
              failureRedirect:'/user/Login',
              failureFlash:true
          })(req, res, next);
        }
        else
        {
          req.flash('danger', 'User not confirmed. Please check your email for confirmation link.');
          res.redirect('/user/login');
        }
      }
    });
  }
  else
  {
    req.body.username = req.body.username.toLowerCase();
    //find by username
    User.findOne({ username_lower: req.body.username }, function (err, user)
    {
      if(!user)
      {
        req.flash('danger', 'Incorrect username or email address.');
        res.redirect('/user/login');
      }
      else {
        if(user.confirmed == 'true')
        {
          passport.authenticate('local',
          {
              successRedirect:'/',
              failureRedirect:'/user/Login',
              failureFlash:true
          })(req, res, next);
        }
        else
        {
          req.flash('danger', 'User not confirmed. Please check your email for confirmation link.');
          res.redirect('/user/login');
        }
      }
    });
  }
})

//logout
router.get('/logout', function(req, res)
{
  req.logout();
  req.flash('success', 'You have been logged out');
  res.redirect('/');
});

//account page
router.get('/account/yourcubes', ensureAuth, function(req, res)
{
  User.findById(req.user._id, function (err, user)
  {
    user_limited=
    {
      username:user.username,
      email:user.email,
      about:user.about
    }
    res.render('user_account',
    {
      selected:'cube',
      user:user_limited
    });
  });
});

//account page
router.get('/account', ensureAuth, function(req, res)
{
  User.findById(req.user._id, function (err, user)
  {
    user_limited=
    {
      username:user.username,
      email:user.email,
      about:user.about
    }
    res.render('user_account',
    {
      selected:'info',
      user:user_limited
    });
  });
});

//account page, password reset
router.get('/account/changepassword', ensureAuth, function(req, res)
{
  User.findById(req.user._id, function (err, user)
  {
    user_limited=
    {
      username:user.username,
      email:user.email,
      about:user.about
    }
    res.render('user_account',
    {
      selected:'changepw',
      user:user_limited
    });
  });
});

//account page, password reset
router.get('/account/updateemail', ensureAuth, function(req, res)
{
  User.findById(req.user._id, function (err, user)
  {
    user_limited=
    {
      username:user.username,
      email:user.email,
      about:user.about
    }
    res.render('user_account',
    {
      selected:'changeemail',
      user:user_limited
    });
  });
});

router.post('/resetpassword', ensureAuth, function(req,res,next)
{
  req.checkBody('password2', 'Password must be between 8 and 24 characters.').isLength({ min: 8, max:24 });
  req.checkBody('password2', 'Password must only contain alphanumeric characters, and only the following special characters: ! @ # $ % ^ &*').matches(/^[0-9a-zA-Z]*$/, "i");

  let errors = req.validationErrors();

  if(errors)
  {
    User.findById(req.user._id, function (err, user)
    {
      user_limited=
      {
        username:user.username,
        email:user.email,
        about:user.about
      }
      res.render('user_account',
      {
        selected:'changepw',
        user:user_limited,
        errors: errors
      });
    });
  }
  else
  {
    User.findById(req.user._id, function (err, user)
    {
      if(user)
      {
        bcrypt.compare(req.body.password, user.password, function(err, isMatch)
        {
          if(!isMatch)
          {
            req.flash('danger', 'Password is incorrect');
            return res.redirect('/user/account/changepassword');
          }
          else
          {
            if(req.body.password2 != req.body.password3)
            {
              req.flash('danger', 'New passwords don\'t match');
              return res.redirect('/user/account/changepassword');
            }
            else
            {
              bcrypt.genSalt(10, function(err, salt)
              {
                bcrypt.hash(req.body.password2, salt, function(err, hash)
                {
                  if(err)
                  {
                    console.log(err);
                  }
                  else
                  {
                    user.password = hash;
                    user.save(function(err)
                    {
                      if(err)
                      {
                        console.log(err)
                        return;
                      }
                      else
                      {
                        req.flash('success', 'Password updated succesfully');
                        return res.redirect('/user/account/changepassword');
                      }
                    });
                  }
                });
              });
            }
          }
        });
      }
    });
  }
});

router.post('/updatebio',ensureAuth, function(req,res,next)
{
  User.findById(req.user._id, function (err, user)
  {
    if(user)
    {
      user.about = req.body.body;

      let query = {_id:req.user._id};

      User.updateOne(query, user, function(err)
      {
        if(err)
        {
          console.log(err);
        }
        else
        {
          req.flash('success', 'Your profile has been updated.');
          res.redirect('/user/account');
        }
      });
    }
  });
});

router.post('/updateemail',ensureAuth, function(req,res,next)
{
  User.findOne({ email: req.body.email.toLowerCase() }, function (err, user)
  {
    if(user)
    {
      req.flash('danger','Email already associated with an existing account.');
      res.redirect('/user/account/updateemail');
    }
    else
    {
      User.findById(req.user._id, function (err, user)
      {
        if(user)
        {
          user.email = req.body.email;

          let query = {_id:req.user._id};

          User.updateOne(query, user, function(err)
          {
            if(err)
            {
              console.log(err);
            }
            else
            {
              req.flash('success', 'Your profile has been updated.');
              res.redirect('/user/account');
            }
          });
        }
      });
    }
  });
});

function ensureAuth(req, res, next) {
  if(req.isAuthenticated())
  {
    return next();
  }
  else
  {
    req.flash('danger','Please login to view this content');
    res.redirect('/user/login');
  }
}

function addMinutes(date, minutes) {
    return new Date(new Date(date).getTime() + minutes*60000);
}

module.exports = router;
