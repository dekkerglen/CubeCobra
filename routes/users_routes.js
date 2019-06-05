const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const passport = require('passport');
const emailconfig = require('../config/email');
const mailer = require("nodemailer");

// Bring in models
let User = require('../models/user')

//Register form
router.get('/register', function(req, res)
{
  res.render('register');
});

//Register process
router.post('/register', function(req, res)
{
  const name = req.body.name.toLowerCase();
  const email = req.body.email.toLowerCase();
  const username = req.body.username.toLowerCase();
  const password = req.body.password;
  const password2 = req.body.password2;

  req.checkBody('name', 'Name is required').notEmpty();
  req.checkBody('email', 'Email is required').notEmpty();
  req.checkBody('email', 'Email is not valid').isEmail();
  req.checkBody('username', 'Username is required').notEmpty();
  req.checkBody('password', 'Password is required').notEmpty();
  req.checkBody('password2', 'Passwords do not match').equals(req.body.password);

  req.checkBody('name', 'Name must be between 5 and 100 characters.').isLength({ min: 5, max:100 });
  req.checkBody('email', 'Email must be between 5 and 100 characters.').isLength({ min: 5, max:100 });
  req.checkBody('username', 'Username must be between 5 and 100 characters.').isLength({ min: 5, max:100 });
  req.checkBody('password', 'Password must be between 8 and 32 characters.').isLength({ min: 8, max:32 });

  let errors = req.validationErrors();

  if(errors)
  {
    res.render('register',
    {
      errors: errors
    })
  }
  else
  {
    User.findOne({ username: req.body.username.toLowerCase() }, function (err, user)
    {
      if(user)
      {
        req.flash('danger','Username already taken.');
        res.redirect('/user/register');
      }
      else
      {
        //check if user exists
        User.findOne({ email: req.body.email.toLowerCase() }, function (err, user)
        {
          if(user)
          {
            req.flash('danger','Email already associated with an existing account.');
            res.redirect('/user/register');
          }
          else
          {
            let newUser = new User({
              name:name,
              email:email,
              username:username,
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
                          from: "CubeMA Team <cubemanagementapp@gmail.com>",
                          to: email,
                          subject: "Confirm Account",
                          html: "<a href=\"localhost/user/register/confirm/" + newUser._id + "\">Click</a> to confirm account!"
                      }

                      smtpTransport.sendMail(mail, function(error, response){
                          if(error){
                              console.log(error);
                          }else{
                              console.log("Message sent");
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
  User.findOne({ username: req.body.username.toLowerCase() }, function (err, user)
  {
    req.body.username = req.body.username.toLowerCase();
    req.body.password = req.body.password.toLowerCase();
    if (err || !user)
    {
      req.flash('danger','No user found');
      return res.redirect('/user/login');
    }
    else
    {
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
})

//logout
router.get('/logout', function(req, res)
{
  req.logout();
  req.flash('success', 'You have been logged out');
  res.redirect('/');
});

//account page
router.get('/account', function(req, res)
{
  res.render('user_account', {selected:'info'});
});

//account page, password reset
router.get('/account/changepassword', function(req, res)
{
  res.render('user_account', {selected:'changepw'});
});

router.post('/resetpassword', ensureAuth, function(req,res,next)
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
});

function ensureAuth(req, res, next)
{
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

module.exports = router;
