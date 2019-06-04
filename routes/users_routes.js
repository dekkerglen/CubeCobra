const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const passport = require('passport');

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
  const name = req.body.name;
  const email = req.body.email;
  const username = req.body.username;
  const password = req.body.password;
  const password2 = req.body.password2;

  req.checkBody('name', 'Name is required').notEmpty();
  req.checkBody('email', 'Email is required').notEmpty();
  req.checkBody('email', 'Email is not valid').isEmail();
  req.checkBody('username', 'Username is required').notEmpty();
  req.checkBody('password', 'Password is required').notEmpty();
  req.checkBody('password2', 'Passwords do not match').equals(req.body.password);

  let errors = req.validationErrors();

  if(errors)
  {
    res.render('register',
    {
      errors: errors
    })
  }
  else {
    let newUser = new User({
      name:name,
      email:email,
      username:username,
      password:password
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
          newUser.save(function(err)
          {
            if(err)
            {
              console.log(err)
              return;
            }
            else
            {
              req.flash('success','You are now registered and can log in.');
              res.redirect('/user/login');
            }
          });
        }
      });
    });
  }
});

//Login route
router.get('/login', function(req, res)
{
  res.render('login');
})

//Login post
router.post('/login', function(req, res, next)
{
  passport.authenticate('local',
  {
      successRedirect:'/',
      failureRedirect:'/user/Login',
      failureFlash:true
  })(req, res, next);
})

router.get('/logout', function(req, res)
{
  req.logout();
  req.flash('success', 'You have been logged out');
  res.redirect('/');
});

module.exports = router;
