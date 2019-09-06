const LocalStrategy = require('passport-local').Strategy;
const User = require('../models/user');
const bcrypt = require('bcryptjs');

module.exports = function(passport) {
  //Local Strategy
  passport.use(new LocalStrategy(function(username, password, done) {
    //Match username
    let query = {
      username_lower: username.toLowerCase()
    };
    User.findOne(query, function(err, user) {
      if (err) throw err;
      if (!user) {
        return done(null, false, {
          message: 'Incorrect username'
        });
      }

      //Match password
      bcrypt.compare(password, user.password, function(err, isMatch) {
        if (err) throw err;
        if (isMatch) {
          return done(null, user);
        } else {
          return done(null, false, {
            message: 'Incorrect password'
          });
        }
      });
    });
  }));

  passport.serializeUser(function(user, done) {
    done(null, user.id);
  });

  passport.deserializeUser(function(id, done) {
    User.findById(id, function(err, user) {
      done(err, user);
    });
  });
}