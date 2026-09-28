import { ALL_CROSSWORD_CLASSES, CrosswordEntryClass } from '@utils/datatypes/Crossword';
import { UserRoles } from '@utils/datatypes/User';
import { makeFilter } from '@utils/filtering/FilterCards';
import Joi from 'joi';
import { bodyValidation, csrfProtection, ensureRole } from 'router/middleware';
import { whenCardDbReady } from 'serverutils/cardCatalog';
import { CrosswordProgress, generateCrossword, isGenerateFailure } from 'serverutils/crossword/generate';
import { withClues } from 'serverutils/crossword/puzzle';
import { getVocabulary } from 'serverutils/crossword/vocabulary';
import { handleRouteError, render } from 'serverutils/render';

import { Request, Response } from '../../../types/express';

/**
 * What the lab may spend on one grid, against the 20s the daily path runs on.
 *
 * The difference is who is waiting. `buildDailyGrid` answers a rotate request
 * the daily jobs lambda is blocked on, and overrunning that means a day with no
 * puzzle; here the waiting party is an admin watching the grid fill, who would
 * rather wait three minutes than be told a configuration is impossible when it
 * merely wasn't given long enough. `minWordLength: 4` is the case that motivated
 * this: it converges, and not inside twenty seconds.
 *
 * The cost used to be that this is also how long the process stops serving every
 * other request, generation being one blocking loop. Passing `onProgress` now
 * makes that loop yield between snapshots (see `yieldToEventLoop` in wfc.ts), so
 * three minutes here is three minutes of a busy event loop rather than a dead
 * one. It is still three minutes of one core, which is why the route stays
 * admin-gated and hand-driven, and why the budget is a property of the call
 * rather than a module constant that the daily path would inherit.
 *
 * Three minutes also exceeds the 60-second `req/res.setTimeout` that `index.ts`
 * puts on every request, and what keeps this route under it is the progress
 * stream itself: a socket timeout is an *inactivity* timeout, and every line
 * written resets it. Verified rather than assumed — a handler writing every
 * 200ms against a 2s timeout delivers all of its lines, and the same handler
 * silent for the same span is cut off. So the snapshots are load-bearing twice
 * over, and a silent stretch longer than 60 seconds would drop the connection.
 * Nothing reaches that today: the gaps are the vocabulary build before the first
 * snapshot and `withClues` after the last, both a couple of seconds. It became
 * true when the loop started yielding — while it blocked, the timer could not
 * fire at all.
 */
const LAB_BUDGET_MS = 180_000;

/**
 * Vocabulary supply per word length, split by class. Short slots are the
 * binding constraint on whether a grid can be filled, so the lab surfaces
 * this next to the generator.
 */
const vocabularyStats = () => {
  const vocab = getVocabulary();
  const lengths = [...vocab.byLength.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([length, indices]) => {
      const byClass: Record<string, number> = {};
      for (const index of indices) {
        const entryClass = vocab.entries[index]!.entryClass;
        byClass[entryClass] = (byClass[entryClass] ?? 0) + 1;
      }
      return { length, total: indices.length, byClass };
    });

  return { total: vocab.entries.length, counts: vocab.counts, lengths };
};

export const crosswordLabPageHandler = async (req: Request, res: Response) => {
  try {
    await whenCardDbReady();
    return render(req, res, 'CrosswordLabPage', { stats: vocabularyStats() });
  } catch (err) {
    return handleRouteError(req, res, err, '/');
  }
};

export const GenerateCrosswordSchema = Joi.object({
  size: Joi.number().integer().min(5).max(21).required(),
  symmetry: Joi.string().valid('rotational180', 'rotational90', 'none').required(),
  minWordLength: Joi.number().integer().min(3).max(6).required(),
  maxAcronymRatio: Joi.number().min(0).max(1).required(),
  themeFilterText: Joi.string().max(120).allow('').required(),
  allowedClasses: Joi.array()
    .items(Joi.string().valid(...ALL_CROSSWORD_CLASSES))
    .min(1)
    .required(),
  preferredClasses: Joi.array()
    .items(Joi.string().valid(...ALL_CROSSWORD_CLASSES))
    .required(),
  seed: Joi.string().max(64).allow('').required(),
});

/**
 * NDJSON, one object per line: any number of `progress` lines and then exactly
 * one `result` or `error`.
 *
 * Streamed over the existing POST rather than through an EventSource, which is
 * GET-only and so cannot carry a CSRF token the way this route requires.
 *
 * Everything that can fail *before* the first line is written still answers as
 * an ordinary JSON status — validation, an unparseable theme filter — so the
 * client's "not ok" path is unchanged. Once the stream is open the status is
 * already 200 and a failure has to travel as a line.
 */
type CrosswordLabLine =
  | ({ type: 'progress' } & CrosswordProgress)
  | { type: 'result'; success: boolean; error?: string; [key: string]: unknown }
  | { type: 'error'; error: string };

export const generateCrosswordHandler = async (req: Request, res: Response) => {
  const body = req.body as {
    size: number;
    symmetry: 'rotational180' | 'rotational90' | 'none';
    minWordLength: number;
    maxAcronymRatio: number;
    themeFilterText: string;
    allowedClasses: CrosswordEntryClass[];
    preferredClasses: CrosswordEntryClass[];
    seed: string;
  };

  try {
    await whenCardDbReady();

    if (body.themeFilterText) {
      const { err } = makeFilter(body.themeFilterText);
      if (err) {
        return res.status(400).json({ error: `Theme filter didn't parse: ${body.themeFilterText}` });
      }
    }
  } catch (err) {
    const error = err as Error;
    req.logger.error(error.message, error.stack);
    return res.status(500).json({ error: 'Error generating crossword' });
  }

  res.status(200);
  res.setHeader('Content-Type', 'application/x-ndjson');
  // `no-transform` is what turns the app-wide compression() off for this
  // response. zlib holds a partial block until it is flushed, so a compressed
  // stream would need `res.flush()` to land on every line to stay incremental;
  // opting out is a shorter answer than getting that right, and these lines are
  // a few hundred bytes each. `X-Accel-Buffering` asks a reverse proxy not to
  // hold the response either.
  //
  // Neither of these was the reason snapshots weren't arriving — that was the
  // socket cork described on `send` below, and it is reproducible with the
  // compression middleware removed entirely.
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  // A client that navigates away mid-generation destroys the socket, and the
  // writes still in flight would otherwise surface as an unhandled 'error' on
  // the response. Nothing to do about it but stop writing.
  let broken = false;
  res.on('error', () => {
    broken = true;
  });

  const send = (line: CrosswordLabLine): void => {
    if (broken || res.writableEnded) {
      return;
    }
    // This writes; it does not send. The first write on a response corks the
    // socket and schedules the uncork on `process.nextTick`, so a caller that
    // never yields gets every line buffered and delivered in one burst at the
    // end — measured here as 22 snapshots spanning 2209ms of generation arriving
    // inside the same 4ms. `res.write` returns true throughout, because true
    // means "buffered". What makes these lines arrive is `generateCrossword`
    // yielding on each `onProgress`; see `yieldToEventLoop` in wfc.ts.
    //
    // `flush` is compression()'s, and a no-op here by construction, since
    // `no-transform` above means nothing is compressing. Kept because it costs
    // nothing and stops being a no-op the moment that header is dropped.
    res.write(`${JSON.stringify(line)}\n`);
    (res as Response & { flush?: () => void }).flush?.();
  };

  const seed = body.seed || `${Date.now()}`;

  try {
    const result = await generateCrossword(
      { ...body, seed },
      {
        budgetMs: LAB_BUDGET_MS,
        onProgress: (progress) => send({ type: 'progress', ...progress }),
      },
    );

    if (isGenerateFailure(result)) {
      send({
        type: 'result',
        success: false,
        error: `${result.reason} (added ${result.blocksAdded} black square${result.blocksAdded === 1 ? '' : 's'} trying.) Try a smaller size, a broader theme, or a larger acronym budget.`,
      });
    } else {
      // KNOWN LIMITATION, deliberate: the whole solution goes to the client here —
      // `grid.letters` is the filled grid and every slot carries its entry text — so
      // the lab's Check / Reveal buttons work client-side. That is fine for an
      // admin-only lab, where the audience is the person tuning the generator. The
      // real daily game must not do this: it has to send a board with the answers
      // stripped and validate guesses server-side. See
      // serverutils/synergyconnect/board.ts `toBoard` for the in-repo precedent
      // (and its test asserting the payload leaks nothing).
      send({ type: 'result', success: true, ...result, grid: withClues(result.grid, seed) });
    }
  } catch (err) {
    const error = err as Error;
    req.logger.error(error.message, error.stack);
    send({ type: 'error', error: 'Error generating crossword' });
  }

  return res.end();
};

export const routes = [
  {
    method: 'get',
    path: '/',
    handler: [ensureRole(UserRoles.ADMIN), crosswordLabPageHandler],
  },
  {
    method: 'post',
    path: '/generate',
    handler: [
      ensureRole(UserRoles.ADMIN),
      csrfProtection,
      bodyValidation(GenerateCrosswordSchema),
      generateCrosswordHandler,
    ],
  },
];
