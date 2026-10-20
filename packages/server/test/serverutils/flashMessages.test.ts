import path from 'path';

import connectFlash from 'connect-flash';
import express from 'express';
import session from 'express-session';
import request from 'supertest';

import { flashMessages } from '../../src/serverutils/flashMessages';

const VIEWS_DIR = path.join(__dirname, '../../src/views');

// Exercises the real Express view pipeline rather than a stub: the bug this guards against
// came from Express 5 forcing view-engine callbacks onto the next tick, which only shows up
// when res.render actually runs.
const buildApp = (flashInHandler: (req: any) => void) => {
  const app = express();
  app.set('views', VIEWS_DIR);
  app.set('view engine', 'pug');

  app.use(session({ secret: 'test-secret', resave: false, saveUninitialized: false }));
  app.use(connectFlash());
  app.use(flashMessages);

  app.get('/', (req, res) => {
    flashInHandler(req);
    res.render('dynamic_flash', { notice: undefined });
  });

  return app;
};

const parseFlash = (html: string): Record<string, string[]> => {
  const match = html.match(/id="flash" value="([^"]*)"/);
  if (!match) {
    throw new Error(`No #flash input found in rendered output: ${html}`);
  }
  // Pug escapes attribute values, so undo the entities before parsing.
  const decoded = match[1]!
    .replace(/&quot;/g, '"')
    .replace(/&#34;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;/g, "'");
  return JSON.parse(decoded);
};

describe('flashMessages', () => {
  it('renders messages flashed by the route handler', async () => {
    const app = buildApp((req) => req.flash('danger', 'Password must be between 8 and 1024 characters.'));

    const res = await request(app).get('/').expect(200);

    expect(parseFlash(res.text)).toEqual({
      danger: ['Password must be between 8 and 1024 characters.'],
    });
  });

  it('renders multiple messages across types', async () => {
    const app = buildApp((req) => {
      req.flash('danger', 'first');
      req.flash('danger', 'second');
      req.flash('success', 'done');
    });

    const res = await request(app).get('/').expect(200);

    expect(parseFlash(res.text)).toEqual({
      danger: ['first', 'second'],
      success: ['done'],
    });
  });

  it('renders an empty payload when nothing was flashed', async () => {
    const app = buildApp(() => undefined);

    const res = await request(app).get('/').expect(200);

    expect(parseFlash(res.text)).toEqual({});
  });

  it('drains the flash so messages are not repeated on the next render', async () => {
    const app = buildApp((req) => {
      if (!req.session.alreadyFlashed) {
        req.session.alreadyFlashed = true;
        req.flash('danger', 'only once');
      }
    });

    const agent = request.agent(app);

    const first = await agent.get('/').expect(200);
    expect(parseFlash(first.text)).toEqual({ danger: ['only once'] });

    const second = await agent.get('/').expect(200);
    expect(parseFlash(second.text)).toEqual({});
  });
});
