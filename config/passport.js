const LocalStrategy = require('passport-local').Strategy;
const bcrypt = require('bcryptjs');
const User = require('../dynamo/models/user');

module.exports = (passport) => {
  // Local Strategy
  passport.use(
    new LocalStrategy(async (username, password, done) => {
      const user = await User.getByUsername(username);

      if (!user) {
        return done(null, false, {
          message: 'Incorrect username',
        });
      }

      // Match password
      return bcrypt.compare(password, user.passwordHash, (err, isMatch) => {
        if (err) {
          return done(null, false, {
            message: 'Failed to authenticate password',
          });
        }
        if (isMatch) {
          return done(null, user);
        }
        return done(null, false, {
          message: 'Incorrect password',
        });
      });
    }),
  );

  passport.serializeUser((user, done) => {
    done(null, user.id);
  });

  passport.deserializeUser(async (id, done) => {
    const user = await User.getById(id);
    done(null, user);
  });
};
