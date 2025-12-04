import { Strategy as LocalStrategy } from 'passport-local';
import bcrypt from 'bcryptjs';
import { PassportStatic } from 'passport';
import User from 'dynamo/models/user';
import type UserType from '@utils/datatypes/User';

export default (passport: PassportStatic): void => {
  // Local Strategy
  passport.use(
    new LocalStrategy(async (username, password, done) => {
      let fromQuery = await User.getByUsername(username);

      if (!fromQuery) {
        fromQuery = await User.getByEmail(username);
      }

      if (!fromQuery) {
        return done(null, false, {
          message: 'Incorrect username',
        });
      }

      const userWithSensitiveData = await User.getByIdWithSensitiveData(fromQuery.id);

      if (!userWithSensitiveData) {
        return done(null, false, {
          message: 'Incorrect username',
        });
      }

      // Match password
      return bcrypt.compare(password, userWithSensitiveData.passwordHash, (err, isMatch) => {
        if (err) {
          return done(null, false, {
            message: 'Failed to authenticate password',
          });
        }
        if (isMatch) {
          // Return the user without sensitive data
          return done(null, fromQuery);
        }
        return done(null, false, {
          message: 'Incorrect password',
        });
      });
    }),
  );

  passport.serializeUser((user: Express.User, done) => {
    done(null, (user as UserType).id);
  });

  passport.deserializeUser(async (id: string, done) => {
    const user = await User.getById(id);
    done(null, user);
  });
};
