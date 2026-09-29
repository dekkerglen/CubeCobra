/**
 * Picks the daily game the dashboard shows a viewer.
 *
 * The dashboard used to show Daily P1P1 unconditionally. It now shows one of the four
 * dailies — Daily P1P1, Mana Matrix, Synergy Connect, the Crossword — chosen from the
 * ones that viewer has not started yet today.
 *
 * Two things this module is careful about, because the dashboard is a hot page:
 *
 *  - **Reads are batched, never chained per game.** One wave resolves which puzzle is
 *    live for each game, a second wave asks whether this viewer has touched each of
 *    them. Every touch check is a primary-key `get` on `<ITEMTYPE>#<userId>#<date>` —
 *    no index, no scan.
 *  - **Only the winner is hydrated.** Three of the four games are fully described by
 *    the puzzle fetched in wave one. Daily P1P1 is not (its cards live in S3 and its
 *    cube is a separate row), so that third wave runs only when P1P1 is the pick.
 *
 * The net effect against the old dashboard, which read the daily P1P1 record, the pack
 * (with its S3 body), the pack's cube, the ManaMatrix puzzle and the viewer's ManaMatrix
 * submission: more DynamoDB reads — eight instead of five, because four games have to be
 * asked about rather than two — but in two round trips instead of three, and with the S3
 * fetch skipped entirely three times out of four.
 *
 * "Touched" is read off the fields each game actually records rather than a shared
 * notion of played — see the comments on `touchedByGame`.
 */
import { DAILY_GAME_KEYS, DailyGameKey } from '@utils/datatypes/DailyGameStats';
import { CrosswordShapeTeaser, DailyGameTeaser, DailyGameTeaserResult } from '@utils/datatypes/DailyGameTeaser';
import { CrosswordPuzzle } from '@utils/datatypes/Crossword';
import {
  crosswordPuzzleDao,
  crosswordSubmissionDao,
  cubeDao,
  dailyP1P1Dao,
  manaMatrixPuzzleDao,
  manaMatrixSubmissionDao,
  p1p1PackDao,
  synergyConnectPuzzleDao,
  synergyConnectSubmissionDao,
} from 'dynamo/daos';
import seedrandom from 'seedrandom';
import { toBoard as toCrosswordBoard } from 'serverutils/crossword/board';
import { toBoard as toSynergyConnectBoard } from 'serverutils/synergyconnect/board';

interface Logger {
  error: (message: string, error: any) => void;
}

/** The UTC day. Every puzzle's `date` and the rotation job are keyed on it. */
export const utcToday = (): string => new Date().toISOString().slice(0, 10);

/**
 * The crossword's teaser: the shape of the grid, and nothing else.
 *
 * Built from `toBoard` rather than from `puzzle.grid`, so it inherits that module's
 * answer boundary — there is no path from here to a letter or an entry text. The clues
 * are dropped too: the card draws black squares, it does not read the puzzle out.
 */
export const toCrosswordTeaser = (puzzle: CrosswordPuzzle): CrosswordShapeTeaser => {
  const board = toCrosswordBoard(puzzle);
  return {
    date: board.date,
    width: board.width,
    height: board.height,
    blocks: board.blocks,
    clueCount: board.slots.length,
  };
};

/**
 * A game's place in this viewer's rotation for the day.
 *
 * Seeded per (viewer, date, game) rather than drawn once from the surviving candidates,
 * which buys two things. The pick is stable all day — the dashboard is a page people hit
 * constantly, and a card that changed on every navigation would be noise — and the whole
 * four-game order is fixed, so finishing the game on top promotes the next one down
 * instead of reshuffling the rest. It also differs between users, rotates at UTC
 * midnight, and is reproducible from a user id and a date, which is what a bug report
 * about "the wrong card" needs.
 *
 * To make the card re-roll on every page load instead, seed this with something that
 * changes per request (`Date.now()`) — that is the whole change. Never `Math.random()`;
 * the repo seeds with `seedrandom` everywhere it needs a reproducible draw.
 */
const rotationKey = (userId: string | undefined, today: string, game: DailyGameKey): number =>
  seedrandom(`${userId ?? 'anonymous'}:${today}:${game}`)();

/**
 * Per game: `true` touched, `false` untouched and playable, `null` no puzzle today.
 *
 * The third state matters. A game with no live puzzle is neither playable nor "already
 * played", so it must not tip the slot into the all-played state.
 */
type TouchState = Record<DailyGameKey, boolean | null>;

export interface PickDailyGameOptions {
  logger?: Logger;
  /**
   * The viewer, when logged in. Nothing is persisted for anonymous play, so an
   * anonymous viewer has every game read as untouched and costs no touch reads at all.
   */
  userId?: string;
  /** Overridable for tests. Defaults to the UTC day. */
  today?: string;
  /**
   * Whether Daily P1P1 may be picked. The dashboard passes false for viewers who set
   * "hide featured cubes", which is what used to suppress the P1P1 card: that card
   * leads with a cube and its owner, so the preference still applies. Those viewers get
   * a three-game rotation.
   */
  includeDailyP1P1?: boolean;
}

/**
 * Today's daily game for this viewer, or the all-played state.
 *
 * Optional content, like the Daily P1P1 fetch it replaces: it never throws, and a
 * failed read degrades to an empty slot rather than a broken dashboard.
 */
export const pickDailyGame = async ({
  logger,
  userId,
  today = utcToday(),
  includeDailyP1P1 = true,
}: PickDailyGameOptions = {}): Promise<DailyGameTeaserResult> => {
  try {
    // Wave 1: which puzzle is live for each game. Four independent reads, one round trip.
    const [dailyP1P1Record, manaMatrixPuzzle, synergyConnectPuzzle, crosswordPuzzle] = await Promise.all([
      includeDailyP1P1 ? dailyP1P1Dao.getCurrentDailyP1P1() : undefined,
      manaMatrixPuzzleDao.getActive(),
      synergyConnectPuzzleDao.getActive(),
      crosswordPuzzleDao.getActive(),
    ]);

    // Wave 2: what this viewer has already done with them. Issued together, not in
    // sequence. Each submission read is a primary-key get; the P1P1 read is the pack's
    // DynamoDB row only (`getMetadataById`), which carries `votesByUser` and skips the
    // pack's S3 payload — that is only worth fetching if P1P1 actually wins.
    const [dailyP1P1Metadata, manaMatrixSubmission, synergyConnectSubmission, crosswordSubmission] = await Promise.all([
      userId && dailyP1P1Record ? p1p1PackDao.getMetadataById(dailyP1P1Record.packId) : undefined,
      userId && manaMatrixPuzzle ? manaMatrixSubmissionDao.getByUserAndDate(userId, manaMatrixPuzzle.date) : undefined,
      userId && synergyConnectPuzzle
        ? synergyConnectSubmissionDao.getByUserAndDate(userId, synergyConnectPuzzle.date)
        : undefined,
      userId && crosswordPuzzle ? crosswordSubmissionDao.getByUserAndDate(userId, crosswordPuzzle.date) : undefined,
    ]);

    const touchedByGame: TouchState = {
      // Daily P1P1 keeps no per-user-per-day row — a vote is recorded as an entry in
      // `votesByUser` on the pack — so membership there is the whole signal.
      dailyp1p1: dailyP1P1Record ? !!userId && dailyP1P1Metadata?.votesByUser?.[userId] !== undefined : null,
      // Mana Matrix and Synergy Connect only create a row on the first submitted guess,
      // so the row existing at all is the signal; there is no emptier state to check.
      manamatrix: manaMatrixPuzzle ? manaMatrixSubmission !== undefined : null,
      synergyconnect: synergyConnectPuzzle ? synergyConnectSubmission !== undefined : null,
      // The crossword is the exception: its row is created when the puzzle is *opened*,
      // because that is when the server's clock starts. Opening it still counts as
      // touching it — the point is not to offer a game they have already looked at — so
      // this is the row existing too, not `attempts > 0`.
      crossword: crosswordPuzzle ? crosswordSubmission !== undefined : null,
    };

    /** The teaser for one game, or null if it turns out not to be renderable after all. */
    const buildTeaser = async (game: DailyGameKey): Promise<DailyGameTeaser | null> => {
      switch (game) {
        case 'manamatrix':
          return manaMatrixPuzzle ? { game, puzzle: manaMatrixPuzzle } : null;
        case 'synergyconnect':
          // The same boundary the game page serves: sixteen cards in board order, with
          // no group membership and no commander names. No submission, so no solved
          // groups — by construction, since this viewer has not played it.
          return synergyConnectPuzzle ? { game, board: toSynergyConnectBoard(synergyConnectPuzzle, null) } : null;
        case 'crossword':
          return crosswordPuzzle ? { game, shape: toCrosswordTeaser(crosswordPuzzle) } : null;
        case 'dailyp1p1': {
          if (!dailyP1P1Record) {
            return null;
          }
          // The one game that needs a third round trip, paid only when it wins.
          const [pack, cube] = await Promise.all([
            p1p1PackDao.getById(dailyP1P1Record.packId),
            cubeDao.getById(dailyP1P1Record.cubeId),
          ]);
          return pack && cube ? { game, pack, cube, date: dailyP1P1Record.date } : null;
        }
      }
    };

    const rotation = [...DAILY_GAME_KEYS].sort((a, b) => rotationKey(userId, today, a) - rotationKey(userId, today, b));

    for (const game of rotation) {
      if (touchedByGame[game] !== false) {
        continue;
      }
      const teaser = await buildTeaser(game);
      if (teaser) {
        return { teaser, allPlayed: false };
      }
      // A game that can't be rendered (an expired P1P1 pack, say) falls through to the
      // next one rather than leaving the slot empty.
    }

    // Nothing left to offer. Only call it "all played" if there was something to play:
    // a day with no live puzzles is an empty slot, not an achievement.
    const live = DAILY_GAME_KEYS.filter((game) => touchedByGame[game] !== null);
    return { teaser: null, allPlayed: live.length > 0 && live.every((game) => touchedByGame[game] === true) };
  } catch (err) {
    if (logger) {
      logger.error('Error picking the daily game:', err);
    }
    return { teaser: null, allPlayed: false };
  }
};

export default { pickDailyGame, toCrosswordTeaser, utcToday };
