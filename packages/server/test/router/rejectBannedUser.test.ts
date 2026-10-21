import { UserRoles } from '@utils/datatypes/User';
import connectFlash from 'connect-flash';
import express from 'express';
import session from 'express-session';
import { Passport } from 'passport';
import { rejectBannedUser } from 'router/middleware';
import request from 'supertest';

const BANNED_MESSAGE = 'Your account has been banned, please contact CubeCobra staff if you believe this is in error.';

const USERS: Record<string, { id: string; username: string; roles: UserRoles[] }> = {
  banned: { id: 'banned', username: 'banned', roles: [UserRoles.BANNED] },
  member: { id: 'member', username: 'member', roles: [] },
};

// Real session, flash and passport stack: the bug was in how those interact, which a stubbed req hides.
const buildApp = () => {
  const passport = new Passport();
  passport.serializeUser((user: any, done) => done(null, user.id));
  passport.deserializeUser((id: string, done) => done(null, USERS[id] ?? false));

  const app = express();
  app.use(session({ secret: 'test-secret', resave: false, saveUninitialized: false }));
  app.use(connectFlash());
  app.use(passport.initialize());
  app.use(passport.session());

  app.get('/login/:id', (req: any, res, next) => {
    req.login(USERS[req.params.id], (err: unknown) => (err ? next(err) : res.sendStatus(204)));
  });

  app.use(rejectBannedUser);

  const reached = jest.fn();
  app.get('/{*path}', (req: any, res) => {
    reached(req.path);
    res.json({ user: req.user?.id ?? null, flash: req.flash() });
  });

  return { app, reached };
};

describe('rejectBannedUser', () => {
  it('logs a banned user out and redirects home without running the route', async () => {
    const { app, reached } = buildApp();
    const agent = request.agent(app);
    await agent.get('/login/banned').expect(204);

    const res = await agent.get('/cube/list/abc').expect(302);

    expect(res.headers.location).toBe('/');
    expect(reached).not.toHaveBeenCalled();
  });

  it('shows the ban message on the next page, as a logged-out user', async () => {
    const { app } = buildApp();
    const agent = request.agent(app);
    await agent.get('/login/banned').expect(204);
    await agent.get('/cube/list/abc').expect(302);

    const res = await agent.get('/').expect(200);

    expect(res.body).toEqual({ user: null, flash: { danger: [BANNED_MESSAGE] } });
  });

  it('lets other logged-in users through', async () => {
    const { app } = buildApp();
    const agent = request.agent(app);
    await agent.get('/login/member').expect(204);

    const res = await agent.get('/cube/list/abc').expect(200);

    expect(res.body).toEqual({ user: 'member', flash: {} });
  });

  it('lets anonymous users through', async () => {
    const { app } = buildApp();

    const res = await request(app).get('/cube/list/abc').expect(200);

    expect(res.body).toEqual({ user: null, flash: {} });
  });
});
