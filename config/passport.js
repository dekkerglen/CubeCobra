const LocalStrategy = require('passport-local').Strategy;
const bcrypt = require('bcryptjs');
const User = require('../dynamo/models/user');
const { getUserFromId } = require('../serverjs/cache');

module.exports = (passport) => {
  // Local Strategy
  passport.use(
    new LocalStrategy(async (username, password, done) => {
      const queryResult = await User.getByUsername(username);

      if (queryResult.items.length !== 1) {
        return done(null, false, {
          message: 'Incorrect username',
        });
      }

      const user = queryResult.items[0];

      // Match password
      return bcrypt.compare(password, user.passwordHash, (err, isMatch) => {
        if (err) throw err;
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
    const user = await getUserFromId(id);
    done(null, user);
  });
};
